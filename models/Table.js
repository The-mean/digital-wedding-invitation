const db = require('../config/database');

class Table {
    static async create(invitationId, tableData) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const { tableNumber, name, capacity, notes } = tableData;

            // Masa numarasının benzersiz olduğunu kontrol et
            const [existingTable] = await connection.execute(
                'SELECT id FROM tables WHERE invitation_id = ? AND table_number = ?',
                [invitationId, tableNumber]
            );

            if (existingTable.length > 0) {
                throw new Error('Table number already exists');
            }

            // Yeni masa oluştur
            const [result] = await connection.execute(
                `INSERT INTO tables 
                (invitation_id, table_number, name, capacity, notes) 
                VALUES (?, ?, ?, ?, ?)`,
                [invitationId, tableNumber, name, capacity, notes]
            );

            await connection.commit();
            return result.insertId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async update(id, tableData) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const { tableNumber, name, capacity, notes } = tableData;

            // Masa numarasının benzersiz olduğunu kontrol et
            const [existingTable] = await connection.execute(
                'SELECT invitation_id FROM tables WHERE id = ?',
                [id]
            );

            if (existingTable.length > 0) {
                const [duplicateCheck] = await connection.execute(
                    'SELECT id FROM tables WHERE invitation_id = ? AND table_number = ? AND id != ?',
                    [existingTable[0].invitation_id, tableNumber, id]
                );

                if (duplicateCheck.length > 0) {
                    throw new Error('Table number already exists');
                }
            }

            // Masayı güncelle
            const [result] = await connection.execute(
                `UPDATE tables 
                SET table_number = ?, name = ?, capacity = ?, notes = ? 
                WHERE id = ?`,
                [tableNumber, name, capacity, notes, id]
            );

            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async delete(id) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Önce masa atamalarını sil
            await connection.execute(
                'DELETE FROM table_assignments WHERE table_id = ?',
                [id]
            );

            // Sonra masayı sil
            const [result] = await connection.execute(
                'DELETE FROM tables WHERE id = ?',
                [id]
            );

            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async assignGuest(tableId, rsvpResponseId, userId, notes = '') {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Masa kapasitesini ve mevcut atama sayısını kontrol et
            const [tableInfo] = await connection.execute(
                `SELECT t.capacity, COUNT(ta.id) as current_assignments 
                FROM tables t 
                LEFT JOIN table_assignments ta ON t.id = ta.table_id 
                WHERE t.id = ? 
                GROUP BY t.id, t.capacity`,
                [tableId]
            );

            if (tableInfo.length === 0) {
                throw new Error('Table not found');
            }

            if (tableInfo[0].current_assignments >= tableInfo[0].capacity) {
                throw new Error('Table is at full capacity');
            }

            // Misafirin başka bir masaya atanmış olup olmadığını kontrol et
            const [existingAssignment] = await connection.execute(
                'SELECT table_id FROM table_assignments WHERE rsvp_response_id = ?',
                [rsvpResponseId]
            );

            let previousTableId = null;
            if (existingAssignment.length > 0) {
                previousTableId = existingAssignment[0].table_id;
                // Mevcut atamayı sil
                await connection.execute(
                    'DELETE FROM table_assignments WHERE rsvp_response_id = ?',
                    [rsvpResponseId]
                );
            }

            // Yeni atama oluştur
            await connection.execute(
                `INSERT INTO table_assignments 
                (table_id, rsvp_response_id, assigned_by, notes) 
                VALUES (?, ?, ?, ?)`,
                [tableId, rsvpResponseId, userId, notes]
            );

            // Atama geçmişini kaydet
            const action = previousTableId ? 'MOVE' : 'ASSIGN';
            await connection.execute(
                `INSERT INTO table_assignment_history 
                (table_id, rsvp_response_id, assigned_by, action, previous_table_id, notes) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [tableId, rsvpResponseId, userId, action, previousTableId, notes]
            );

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async unassignGuest(rsvpResponseId, userId, notes = '') {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Mevcut atamayı bul
            const [assignment] = await connection.execute(
                'SELECT table_id FROM table_assignments WHERE rsvp_response_id = ?',
                [rsvpResponseId]
            );

            if (assignment.length === 0) {
                throw new Error('Guest is not assigned to any table');
            }

            const tableId = assignment[0].table_id;

            // Atamayı sil
            await connection.execute(
                'DELETE FROM table_assignments WHERE rsvp_response_id = ?',
                [rsvpResponseId]
            );

            // Atama geçmişini kaydet
            await connection.execute(
                `INSERT INTO table_assignment_history 
                (table_id, rsvp_response_id, assigned_by, action, notes) 
                VALUES (?, ?, ?, 'UNASSIGN', ?)`,
                [tableId, rsvpResponseId, userId, notes]
            );

            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getTablesByInvitation(invitationId) {
        const [rows] = await db.execute(
            `SELECT t.*, 
                COUNT(ta.id) as assigned_guests,
                GROUP_CONCAT(
                    JSON_OBJECT(
                        'id', r.id,
                        'name', r.guest_name,
                        'email', r.guest_email,
                        'guests', r.number_of_guests
                    )
                ) as guests
            FROM tables t
            LEFT JOIN table_assignments ta ON t.id = ta.table_id
            LEFT JOIN rsvp_responses r ON ta.rsvp_response_id = r.id
            WHERE t.invitation_id = ?
            GROUP BY t.id`,
            [invitationId]
        );

        return rows.map(row => ({
            ...row,
            guests: row.guests ? JSON.parse(`[${row.guests}]`) : []
        }));
    }

    static async getTableAssignments(tableId) {
        const [rows] = await db.execute(
            `SELECT 
                ta.*,
                r.guest_name,
                r.guest_email,
                r.number_of_guests,
                u.name as assigned_by_name
            FROM table_assignments ta
            JOIN rsvp_responses r ON ta.rsvp_response_id = r.id
            JOIN users u ON ta.assigned_by = u.id
            WHERE ta.table_id = ?
            ORDER BY ta.created_at`,
            [tableId]
        );
        return rows;
    }

    static async getAssignmentHistory(tableId) {
        const [rows] = await db.execute(
            `SELECT 
                th.*,
                r.guest_name,
                r.guest_email,
                u.name as assigned_by_name,
                t_prev.table_number as previous_table_number
            FROM table_assignment_history th
            JOIN rsvp_responses r ON th.rsvp_response_id = r.id
            JOIN users u ON th.assigned_by = u.id
            LEFT JOIN tables t_prev ON th.previous_table_id = t_prev.id
            WHERE th.table_id = ?
            ORDER BY th.created_at DESC`,
            [tableId]
        );
        return rows;
    }

    static async getGuestAssignment(rsvpResponseId) {
        const [rows] = await db.execute(
            `SELECT 
                ta.*,
                t.table_number,
                t.name as table_name,
                t.capacity
            FROM table_assignments ta
            JOIN tables t ON ta.table_id = t.id
            WHERE ta.rsvp_response_id = ?`,
            [rsvpResponseId]
        );
        return rows[0];
    }
}

module.exports = Table; 
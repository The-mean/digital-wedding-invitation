const Table = require('../models/Table');
const { translate } = require('../services/i18nService');

exports.createTable = async (req, res) => {
    try {
        const invitationId = req.params.invitationId;
        const tableData = {
            tableNumber: req.body.tableNumber,
            name: req.body.name,
            capacity: req.body.capacity,
            notes: req.body.notes
        };

        const tableId = await Table.create(invitationId, tableData);

        res.status(201).json({
            success: true,
            message: translate('seating.createSuccess', req.language),
            tableId
        });
    } catch (error) {
        console.error('Error creating table:', error);
        if (error.message === 'Table number already exists') {
            return res.status(400).json({
                success: false,
                message: translate('seating.tableNumberExists', req.language)
            });
        }
        res.status(500).json({
            success: false,
            message: translate('common.error', req.language)
        });
    }
};

exports.updateTable = async (req, res) => {
    try {
        const tableId = req.params.id;
        const tableData = {
            tableNumber: req.body.tableNumber,
            name: req.body.name,
            capacity: req.body.capacity,
            notes: req.body.notes
        };

        const updated = await Table.update(tableId, tableData);

        if (updated) {
            res.json({
                success: true,
                message: translate('seating.updateSuccess', req.language)
            });
        } else {
            res.status(404).json({
                success: false,
                message: translate('seating.tableNotFound', req.language)
            });
        }
    } catch (error) {
        console.error('Error updating table:', error);
        if (error.message === 'Table number already exists') {
            return res.status(400).json({
                success: false,
                message: translate('seating.tableNumberExists', req.language)
            });
        }
        res.status(500).json({
            success: false,
            message: translate('common.error', req.language)
        });
    }
};

exports.deleteTable = async (req, res) => {
    try {
        const tableId = req.params.id;
        const deleted = await Table.delete(tableId);

        if (deleted) {
            res.json({
                success: true,
                message: translate('seating.deleteSuccess', req.language)
            });
        } else {
            res.status(404).json({
                success: false,
                message: translate('seating.tableNotFound', req.language)
            });
        }
    } catch (error) {
        console.error('Error deleting table:', error);
        res.status(500).json({
            success: false,
            message: translate('common.error', req.language)
        });
    }
};

exports.assignGuest = async (req, res) => {
    try {
        const { tableId, rsvpResponseId } = req.params;
        const { notes } = req.body;
        const userId = req.user.userId;

        await Table.assignGuest(tableId, rsvpResponseId, userId, notes);

        res.json({
            success: true,
            message: translate('seating.assignSuccess', req.language)
        });
    } catch (error) {
        console.error('Error assigning guest:', error);
        if (error.message === 'Table is at full capacity') {
            return res.status(400).json({
                success: false,
                message: translate('seating.tableFullCapacity', req.language)
            });
        }
        if (error.message === 'Table not found') {
            return res.status(404).json({
                success: false,
                message: translate('seating.tableNotFound', req.language)
            });
        }
        res.status(500).json({
            success: false,
            message: translate('common.error', req.language)
        });
    }
};

exports.unassignGuest = async (req, res) => {
    try {
        const { rsvpResponseId } = req.params;
        const { notes } = req.body;
        const userId = req.user.userId;

        await Table.unassignGuest(rsvpResponseId, userId, notes);

        res.json({
            success: true,
            message: translate('seating.unassignSuccess', req.language)
        });
    } catch (error) {
        console.error('Error unassigning guest:', error);
        if (error.message === 'Guest is not assigned to any table') {
            return res.status(404).json({
                success: false,
                message: translate('seating.guestNotAssigned', req.language)
            });
        }
        res.status(500).json({
            success: false,
            message: translate('common.error', req.language)
        });
    }
};

exports.getTablesByInvitation = async (req, res) => {
    try {
        const invitationId = req.params.invitationId;
        const tables = await Table.getTablesByInvitation(invitationId);

        res.json({
            success: true,
            tables
        });
    } catch (error) {
        console.error('Error getting tables:', error);
        res.status(500).json({
            success: false,
            message: translate('common.error', req.language)
        });
    }
};

exports.getTableAssignments = async (req, res) => {
    try {
        const tableId = req.params.id;
        const assignments = await Table.getTableAssignments(tableId);

        res.json({
            success: true,
            assignments
        });
    } catch (error) {
        console.error('Error getting table assignments:', error);
        res.status(500).json({
            success: false,
            message: translate('common.error', req.language)
        });
    }
};

exports.getAssignmentHistory = async (req, res) => {
    try {
        const tableId = req.params.id;
        const history = await Table.getAssignmentHistory(tableId);

        res.json({
            success: true,
            history
        });
    } catch (error) {
        console.error('Error getting assignment history:', error);
        res.status(500).json({
            success: false,
            message: translate('common.error', req.language)
        });
    }
};

exports.getGuestAssignment = async (req, res) => {
    try {
        const rsvpResponseId = req.params.rsvpResponseId;
        const assignment = await Table.getGuestAssignment(rsvpResponseId);

        if (assignment) {
            res.json({
                success: true,
                assignment
            });
        } else {
            res.status(404).json({
                success: false,
                message: translate('seating.guestNotAssigned', req.language)
            });
        }
    } catch (error) {
        console.error('Error getting guest assignment:', error);
        res.status(500).json({
            success: false,
            message: translate('common.error', req.language)
        });
    }
}; 
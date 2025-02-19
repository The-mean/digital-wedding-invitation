const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authController = require('./controllers/authController');
const auth = require('./middleware/auth');
const {
    registerValidation,
    loginValidation,
    resetPasswordValidation,
    newPasswordValidation,
    validate,
} = require('./middleware/validators');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.post('/api/register', registerValidation, validate, authController.register);
app.post('/api/login', loginValidation, validate, authController.login);
app.post('/api/request-reset', resetPasswordValidation, validate, authController.requestPasswordReset);
app.post('/api/reset-password', newPasswordValidation, validate, authController.resetPassword);

// Protected route example
app.get('/api/profile', auth, (req, res) => {
    res.json({ message: 'Protected route accessed successfully', userId: req.user.userId });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 
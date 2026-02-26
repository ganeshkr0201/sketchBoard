const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middlewares/auth');

// Traditional auth routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Google OAuth routes
router.post('/google', authController.googleAuth);

// Protected routes
router.get('/profile', auth, authController.getProfile);
router.put('/profile', auth, authController.updateProfile);

module.exports = router;

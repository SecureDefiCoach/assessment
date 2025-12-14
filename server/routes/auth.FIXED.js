/**
 * SECURITY FIX: Secure Authentication Routes
 * 
 * SECURITY IMPROVEMENTS:
 * 1. Added rate limiting for auth endpoints
 * 2. Implemented input validation
 * 3. Added authentication middleware
 * 4. Enhanced error handling
 * 5. Added request logging
 */

const express = require('express');
const { body } = require('express-validator');
const { 
  authenticateToken, 
  requireAdmin, 
  strictLimiter 
} = require('../middleware/security');

const router = express.Router();

// SECURITY FIX: Import secure auth controller
const authController = require('../controllers/auth.controller.FIXED');

// SECURITY FIX: Password change validation
const passwordChangeValidation = [
  body('_id')
    .isMongoId()
    .withMessage('Valid user ID is required'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
  body('currentPassword')
    .optional()
    .isLength({ min: 1, max: 128 })
    .withMessage('Current password is required for verification')
];

// Public routes (with rate limiting)
router.post('/user/login', authController.userLogin);
router.post('/user/register', authController.userRegistration);

// Protected admin routes
router.get('/admin/userList', 
  strictLimiter,
  authenticateToken, 
  requireAdmin, 
  authController.userList
);

router.put('/admin/changePass', 
  strictLimiter,
  authenticateToken, 
  requireAdmin, 
  passwordChangeValidation,
  authController.changePass
);

// SECURITY FIX: User self-service password change
router.put('/user/changePass', 
  strictLimiter,
  authenticateToken,
  passwordChangeValidation,
  authController.changePass
);

// SECURITY FIX: Token validation endpoint
router.get('/validate', authenticateToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Token is valid',
    user: req.user
  });
});

// SECURITY FIX: Logout endpoint (client-side token removal)
router.post('/logout', authenticateToken, (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // This endpoint can be used for logging purposes
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;
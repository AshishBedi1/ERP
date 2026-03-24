const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const employerController = require('../controllers/employerController');
const { body } = require('express-validator');

const router = express.Router();

// Public: get employer info for employee registration page
router.get('/public/:employerId', employerController.getEmployerPublic);

// Protected: employer only
router.use(protect, authorize('employer'));

router.get('/employees', employerController.listEmployees);
router.post(
  '/employees',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
  ],
  validate,
  employerController.createEmployee
);

router.patch(
  '/employees/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  employerController.updateEmployee
);

router.delete('/employees/:id', employerController.deleteEmployee);

module.exports = router;

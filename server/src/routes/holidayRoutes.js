const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const holidayController = require('../controllers/holidayController');

const router = express.Router();

router.get('/', protect, holidayController.listHolidays);

router.post(
  '/',
  protect,
  authorize('employer'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('date').notEmpty().withMessage('Date is required'),
  ],
  validate,
  holidayController.createHoliday
);

router.patch(
  '/:id',
  protect,
  authorize('employer'),
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('date').optional().notEmpty().withMessage('Date cannot be empty'),
  ],
  validate,
  holidayController.updateHoliday
);

router.delete('/:id', protect, authorize('employer'), holidayController.deleteHoliday);

module.exports = router;

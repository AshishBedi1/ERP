const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const attendanceController = require('../controllers/attendanceController');

const router = express.Router();

router.get('/today', protect, authorize('employee'), attendanceController.getToday);
router.post('/check-in', protect, authorize('employee'), attendanceController.checkIn);
router.post('/check-out', protect, authorize('employee'), attendanceController.checkOut);
router.post('/reset-today', protect, authorize('employee'), attendanceController.resetTodayTest);

module.exports = router;

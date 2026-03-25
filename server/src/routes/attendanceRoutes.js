const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const attendanceController = require('../controllers/attendanceController');

const router = express.Router();

router.get('/team-today', protect, authorize('employer'), attendanceController.getTeamToday);
router.get(
  '/team/:employeeId/calendar',
  protect,
  authorize('employer'),
  attendanceController.getEmployeeCalendarForEmployer
);
router.get('/calendar', protect, authorize('employee'), attendanceController.getCalendarMonth);
router.get('/heatmap', protect, authorize('employee'), attendanceController.getHeatmapWeeks);
router.get('/today', protect, authorize('employee'), attendanceController.getToday);
router.post('/check-in', protect, authorize('employee'), attendanceController.checkIn);
router.post('/check-out', protect, authorize('employee'), attendanceController.checkOut);
router.post('/reset-today', protect, authorize('employee'), attendanceController.resetTodayTest);

module.exports = router;

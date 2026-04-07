const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const taskController = require('../controllers/taskController');

const router = express.Router();

router.get('/today', protect, authorize('employee'), taskController.getMyTodayTasks);
router.put('/today', protect, authorize('employee'), taskController.putMyTodayTasks);
router.get('/history', protect, authorize('employee'), taskController.getMyTaskHistory);

module.exports = router;

const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const leaveController = require('../controllers/leaveController');

const router = express.Router();

router.get('/summary', protect, authorize('employee'), leaveController.getSummary);
router.post('/request', protect, authorize('employee'), leaveController.createRequest);
router.get('/my-requests', protect, authorize('employee'), leaveController.listMyRequests);

module.exports = router;

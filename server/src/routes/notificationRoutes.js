const express = require('express');
const { protect } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.use(protect);

router.get('/unread-count', notificationController.unreadCount);
router.post('/read-all', notificationController.markAllRead);
router.get('/', notificationController.list);
router.patch('/:id/read', notificationController.markRead);
router.delete('/:id', notificationController.destroy);

module.exports = router;

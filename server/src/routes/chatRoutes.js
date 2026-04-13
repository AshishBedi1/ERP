const express = require('express');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const chatController = require('../controllers/chatController');
const { body, query } = require('express-validator');

const router = express.Router();

router.use(protect);

router.get(
  '/messages',
  [query('withUserId').notEmpty().withMessage('withUserId is required.')],
  validate,
  chatController.listMessages
);

router.post(
  '/messages',
  [
    body('withUserId').notEmpty().withMessage('withUserId is required.'),
    body('body').trim().notEmpty().withMessage('Message cannot be empty.'),
  ],
  validate,
  chatController.sendMessage
);

router.post(
  '/read',
  [body('withUserId').notEmpty().withMessage('withUserId is required.')],
  validate,
  chatController.markRead
);

router.get('/unread-count', chatController.unreadCount);
router.get('/summary', chatController.inboxSummary);

router.get('/channels', chatController.listChannels);
router.post(
  '/channels',
  [
    body('name').trim().notEmpty().withMessage('Name is required.').isLength({ max: 80 }),
    body('memberIds').isArray({ min: 1 }).withMessage('Add at least one other person.'),
  ],
  validate,
  chatController.createChannel
);
router.get(
  '/channels/:channelId/messages',
  [query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  chatController.listChannelMessages
);
router.post(
  '/channels/:channelId/messages',
  [body('body').trim().notEmpty().withMessage('Message cannot be empty.')],
  validate,
  chatController.sendChannelMessage
);

module.exports = router;

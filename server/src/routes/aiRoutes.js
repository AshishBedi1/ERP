const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const aiController = require('../controllers/aiController');

const router = express.Router();

router.post('/refine-plan', protect, authorize('employee'), aiController.refinePlanText);
router.post('/refine-note', protect, authorize('employee', 'employer'), aiController.refineNoteText);

module.exports = router;

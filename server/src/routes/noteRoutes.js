const express = require('express');
const { protect } = require('../middleware/auth');
const noteController = require('../controllers/noteController');

const router = express.Router();

router.use(protect);

router.get('/folders', noteController.listFolders);
router.post('/folders', noteController.createFolder);
router.patch('/folders/:id', noteController.updateFolder);
router.delete('/folders/:id', noteController.deleteFolder);

router.get('/documents', noteController.listDocuments);
router.get('/documents/:id', noteController.getDocument);
router.post('/documents', noteController.createDocument);
router.patch('/documents/:id', noteController.updateDocument);
router.delete('/documents/:id', noteController.deleteDocument);

module.exports = router;

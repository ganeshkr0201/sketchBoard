const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const auth = require('../middlewares/auth');

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'File routes working', timestamp: new Date() });
});

router.post('/upload', auth, fileController.uploadFile);
router.get('/download/:roomId/:fileName', auth, fileController.downloadFile);

module.exports = router;

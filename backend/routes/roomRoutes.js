const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const auth = require('../middlewares/auth');

router.post('/create', auth, roomController.createRoom);
router.post('/join', auth, roomController.joinRoom);
router.get('/user/recent', auth, roomController.getUserRooms);
router.get('/:roomId', auth, roomController.getRoom);
router.post('/save', auth, roomController.saveCanvas);
router.post('/permissions', auth, roomController.updatePermissions);
router.get('/:roomId/permissions', auth, roomController.getPermissions);
router.delete('/:roomId', auth, roomController.deleteRoom);

module.exports = router;

const router = require('express').Router();
const roomController = require('../controllers/room.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Tất cả routes cần xác thực
router.use(authMiddleware);

// POST /api/rooms          (tạo room)
router.post('/', roomController.createRoom);

// GET /api/rooms            (danh sách rooms của user)
router.get('/', roomController.getUserRooms);

// GET  /api/rooms/invite/:code       (xem trước nhóm từ link mời)
router.get('/invite/:code', roomController.getInvitePreview);

// POST /api/rooms/invite/:code/join  (xin vào nhóm bằng link mời, chờ duyệt)
router.post('/invite/:code/join', roomController.joinByInvite);

// GET /api/rooms/:id        (chi tiết room)
router.get('/:id', roomController.getRoomById);

// GET /api/rooms/:id/messages  (tin nhắn của room, phân trang)
router.get('/:id/messages', roomController.getRoomMessages);

// POST /api/rooms/:id/members  (thêm thành viên)
router.post('/:id/members', roomController.addMember);

// DELETE /api/rooms/:id/members/:userId  (trưởng/phó nhóm xoá thành viên)
router.delete('/:id/members/:userId', roomController.removeMember);

// PUT /api/rooms/:id/members/:userId/role  (trưởng nhóm phong/bỏ phó nhóm)
router.put('/:id/members/:userId/role', roomController.setMemberRole);

// DELETE /api/rooms/:id/leave  (rời room)
router.delete('/:id/leave', roomController.leaveRoom);

// PUT  /api/rooms/:id/nickname     (đặt biệt danh)
router.put('/:id/nickname', roomController.setNickname);

// PUT  /api/rooms/:id/mute         (tắt/bật thông báo)
router.put('/:id/mute', roomController.toggleMute);

// POST /api/rooms/:id/request-join (mời người vào danh sách chờ)
router.post('/:id/request-join', roomController.requestJoin);

// PUT  /api/rooms/:id/approve      (trưởng/phó nhóm duyệt thành viên)
router.put('/:id/approve', roomController.approveMember);

// PUT  /api/rooms/:id/reject       (trưởng/phó nhóm từ chối thành viên)
router.put('/:id/reject', roomController.rejectMember);

// GET  /api/rooms/:id/pending      (lấy danh sách chờ duyệt)
router.get('/:id/pending', roomController.getPendingMembers);

// GET  /api/rooms/:id/invite       (lấy link mời nhóm)
router.get('/:id/invite', roomController.getInviteLink);

// PUT  /api/rooms/:id/invite       (trưởng/phó nhóm đổi link mời)
router.put('/:id/invite', roomController.resetInviteLink);

// PUT  /api/rooms/:id/settings     (admin cập nhật ảnh & thông tin nhóm)
router.put('/:id/settings', roomController.updateGroupSettings);

// DELETE /api/rooms/:id/chat       (xóa lịch sử chat cho user hiện tại)
router.delete('/:id/chat', roomController.deleteChat);

// PUT  /api/rooms/:id/pin          (ghim tin nhắn)
router.put('/:id/pin', roomController.pinMessage);

// PUT  /api/rooms/:id/unpin        (bỏ ghim tin nhắn)
router.put('/:id/unpin', roomController.unpinMessage);

// POST /api/rooms/forward          (chuyển tiếp tin nhắn)
router.post('/forward', roomController.forwardMessage);

module.exports = router;

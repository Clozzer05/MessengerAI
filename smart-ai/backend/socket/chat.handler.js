const Room = require('../models/Room');
const Message = require('../models/Message');
const { getAnonymousOwner, maskMessage, maskRoom, ownerToMaskFor, emitToRoomMasked, ANONYMOUS_PROFILE } = require('../utils/anonymity');
module.exports = (io, socket) => {
    const userId = socket.user._id;

    socket.on('room:join', async ({ roomId }) => {
        try {
            const room = await Room.findById(roomId);
            if (!room) return socket.emit('error', { message: 'Room không tồn tại' });

            const isMember = room.members.some(m => m.user.toString() === userId.toString());
            if (!isMember) return socket.emit('error', { message: 'Bạn không phải thành viên' });

            // Join socket room
            socket.join(roomId);

            // Lấy tin nhắn gần nhất
            const messages = await Message.getByRoom(roomId, { page: 1, limit: 50 });

            // Lấy members info
            const populatedRoom = await Room.findById(roomId)
                .populate('members.user', 'username avatar googlePicture status preferredLanguage preferredLanguageLabel socketId');

            const ownerId = populatedRoom.type === 'counseling'
                ? ownerToMaskFor(await getAnonymousOwner(roomId), userId)
                : null;

            socket.emit('room:joined', {
                roomId,
                messages: ownerId ? messages.map(m => maskMessage(m, ownerId)) : messages,
                members: ownerId ? maskRoom(populatedRoom.members, ownerId) : populatedRoom.members,
            });

            console.log(`🚪 ${socket.user.username} joined room ${roomId}`);
        } catch (error) {
            console.error('room:join error:', error.message);
            socket.emit('error', { message: 'Lỗi khi join room' });
        }
    });

    socket.on('room:leave', ({ roomId }) => {
        socket.leave(roomId);
        console.log(`🚪 ${socket.user.username} left room ${roomId}`);
    });

    // "Đang nhập" chỉ phát vào phòng mà socket đã vào qua room:join (đã kiểm tra thành viên)
    socket.on('room:typing', async ({ roomId }) => {
        if (!socket.rooms.has(roomId)) return;
        const anonymousOwner = await getAnonymousOwner(roomId);
        emitToRoomMasked(io, roomId, 'room:typing', {
            roomId,
            userId: userId.toString(),
            username: anonymousOwner === userId.toString() ? ANONYMOUS_PROFILE.username : socket.user.username,
        }, anonymousOwner, { excludeSocketId: socket.id });
    });

    socket.on('room:stop-typing', async ({ roomId }) => {
        if (!socket.rooms.has(roomId)) return;
        emitToRoomMasked(io, roomId, 'room:stop-typing', {
            roomId,
            userId: userId.toString(),
        }, await getAnonymousOwner(roomId), { excludeSocketId: socket.id });
    });
};

const crypto = require('crypto');
const Room = require('../models/Room');
const { getAnonymousOwners, getAnonymousOwner, displayNameInRoom, maskRoom, maskMessage, ownerToMaskFor, emitToRoomMasked } = require('../utils/anonymity');
const Message = require('../models/Message');
const { User } = require('../models/User');

// ─── Tạo room mới ────────────────────────────────────────────────────
exports.createRoom = async (req, res, next) => {
    try {
        const { name, type, memberIds } = req.body;
        const currentUserId = req.user._id;

        // ── Direct chat (1-1) ──
        if (type === 'direct') {
            if (!memberIds || memberIds.length !== 1) {
                return res.status(400).json({ error: 'Chat 1-1 cần đúng 1 người nhận' });
            }

            const targetUserId = memberIds[0];

            // Kiểm tra đã có direct room chưa
            const existingRoom = await Room.findDirectRoom(currentUserId, targetUserId);
            if (existingRoom) {
                // Mở lại chat đã xóa: hiện lại trong danh sách của người mở
                if (existingRoom.hiddenFor?.some((id) => id.toString() === currentUserId.toString())) {
                    existingRoom.hiddenFor.pull(currentUserId);
                    await existingRoom.save();
                }
                // Phòng đã có thì trả kèm tin nhắn cuối như danh sách phòng, để giao diện hiện đúng giờ
                const populated = await existingRoom.populate([
                    { path: 'members.user', select: 'username avatar googlePicture status preferredLanguage preferredLanguageLabel' },
                    { path: 'lastMessage' },
                ]);
                return res.json({ room: populated, existing: true });
            }

            const room = await Room.create({
                type: 'direct',
                members: [
                    { user: currentUserId, role: 'admin' },
                    { user: targetUserId, role: 'member' },
                ],
            });

            const populated = await room.populate('members.user', 'username avatar googlePicture status preferredLanguage preferredLanguageLabel');
            return res.status(201).json({ room: populated });
        }

        // ── Group chat ──
        if (type === 'group') {
            if (!name || name.trim().length === 0) {
                return res.status(400).json({ error: 'Tên nhóm là bắt buộc' });
            }
            if (!memberIds || memberIds.length < 1) {
                return res.status(400).json({ error: 'Nhóm cần ít nhất 1 thành viên khác' });
            }

            const members = [
                { user: currentUserId, role: 'admin' },
                ...memberIds.map(id => ({ user: id, role: 'member' })),
            ];

            const room = await Room.create({
                name: name.trim(),
                type: 'group',
                members,
            });

            const populated = await room.populate('members.user', 'username avatar googlePicture status preferredLanguage preferredLanguageLabel');
            return res.status(201).json({ room: populated });
        }

        return res.status(400).json({ error: 'Loại room không hợp lệ (direct | group)' });
    } catch (error) {
        next(error);
    }
};

// ─── Lấy danh sách room của user ─────────────────────────────────────
exports.getUserRooms = async (req, res, next) => {
    try {
        const rooms = await Room.getUserRooms(req.user._id);
        const owners = await getAnonymousOwners(rooms.filter(r => r.type === 'counseling').map(r => r._id));
        res.json({ rooms: rooms.map(r => maskRoom(r, ownerToMaskFor(owners.get(String(r._id)), req.user._id))) });
    } catch (error) {
        next(error);
    }
};

// ─── Lấy thông tin chi tiết room ──────────────────────────────────────
exports.getRoomById = async (req, res, next) => {
    try {
        const room = await Room.findById(req.params.id)
            .populate('members.user', 'username avatar googlePicture status preferredLanguage preferredLanguageLabel')
            .populate('lastMessage')
            .populate({
                path: 'pinnedMessages',
                populate: { path: 'sender', select: 'username avatar googlePicture' },
            });

        if (!room) {
            return res.status(404).json({ error: 'Room không tồn tại' });
        }

        // Kiểm tra user có phải member không
        const isMember = room.members.some(m => m.user._id.toString() === req.user._id.toString());
        if (!isMember) {
            return res.status(403).json({ error: 'Bạn không phải thành viên của room này' });
        }

        const ownerId = room.type === 'counseling' ? ownerToMaskFor(await getAnonymousOwner(room._id), req.user._id) : null;
        res.json({ room: maskRoom(room, ownerId) });
    } catch (error) {
        next(error);
    }
};

// ─── Lấy tin nhắn của room (phân trang) ──────────────────────────────
exports.getRoomMessages = async (req, res, next) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        // Kiểm tra quyền truy cập
        const room = await Room.findById(id);
        if (!room) {
            return res.status(404).json({ error: 'Room không tồn tại' });
        }
        const isMember = room.members.some(m => m.user.toString() === req.user._id.toString());
        if (!isMember) {
            return res.status(403).json({ error: 'Bạn không phải thành viên của room này' });
        }

        const messages = await Message.getByRoom(id, { page, limit, userId: req.user._id });
        const hasMore = messages.length >= limit;
        const ownerId = room.type === 'counseling' ? ownerToMaskFor(await getAnonymousOwner(room._id), req.user._id) : null;
        res.json({ messages: ownerId ? messages.map(m => maskMessage(m, ownerId)) : messages, page, limit, hasMore });
    } catch (error) {
        next(error);
    }
};

// ─── Thêm thành viên vào group ────────────────────────────────────────
exports.addMember = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        const room = await Room.findById(id);
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Group không tồn tại' });
        }

        // Trưởng/phó nhóm thêm thẳng; thành viên thường mời qua danh sách chờ duyệt (requestJoin)
        const currentMember = room.members.find(m => m.user.toString() === req.user._id.toString());
        if (!currentMember) {
            return res.status(403).json({ error: 'Bạn không phải thành viên của nhóm' });
        }
        if (!MANAGER_ROLES.includes(currentMember.role)) {
            return res.status(403).json({ error: 'Chỉ trưởng nhóm hoặc phó nhóm mới thêm thẳng được thành viên' });
        }

        // Kiểm tra đã là member chưa
        const alreadyMember = room.members.some(m => m.user.toString() === userId);
        if (alreadyMember) {
            return res.status(409).json({ error: 'User đã là thành viên' });
        }

        const wasPending = room.pendingMembers.some(uid => uid.toString() === userId);
        room.pendingMembers = room.pendingMembers.filter(uid => uid.toString() !== userId);
        room.members.push({ user: userId, role: 'member' });
        await room.save();
        if (wasPending) emitPendingUpdated(req, room);

        const populated = await room.populate('members.user', 'username avatar googlePicture status preferredLanguage preferredLanguageLabel');

        // Emit realtime event cho tất cả thành viên trong room
        const io = req.app.get('io');
        if (io) {
            for (const member of populated.members) {
                const memberDoc = await User.findById(member.user._id).select('socketId').lean();
                if (memberDoc?.socketId) {
                    io.to(memberDoc.socketId).emit('room:member-added', {
                        roomId: id,
                        room: populated,
                    });
                }
            }
        }

        res.status(200).json({ room: populated });
    } catch (error) {
        next(error);
    }
};

// ─── Rời khỏi group ──────────────────────────────────────────────────
exports.leaveRoom = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { newOwnerId } = req.body || {};

        const room = await Room.findById(id);
        if (!room) {
            return res.status(404).json({ error: 'Room không tồn tại' });
        }

        const leavingUserId = req.user._id.toString();
        const leavingMember = room.members.find(m => m.user.toString() === leavingUserId);
        if (!leavingMember) {
            return res.status(403).json({ error: 'Bạn không phải thành viên' });
        }

        // If an admin is leaving, ensure there is at least one admin left
        if (leavingMember.role === 'admin') {
            const otherMembers = room.members.filter(m => m.user.toString() !== leavingUserId);
            if (otherMembers.length > 0) {
                const hasOtherAdmins = otherMembers.some(m => m.role === 'admin');
                if (!hasOtherAdmins) {
                    if (newOwnerId) {
                        const newOwner = otherMembers.find(m => m.user.toString() === newOwnerId);
                        if (newOwner) {
                            newOwner.role = 'admin';
                        } else {
                            // Fallback if invalid newOwnerId is provided
                            otherMembers[0].role = 'admin';
                        }
                    } else {
                        // Fault tolerance: Auto-promote the first available member if newOwnerId is missing
                        otherMembers[0].role = 'admin';
                    }
                }
            }
        }

        room.members = room.members.filter(m => m.user.toString() !== leavingUserId);

        if (room.members.length === 0) {
            await Room.findByIdAndDelete(id);
            return res.json({ message: 'Room đã bị xóa vì không còn thành viên' });
        }

        await room.save();
        res.json({ message: 'Đã rời khỏi room' });
    } catch (error) {
        next(error);
    }
};

// Trưởng nhóm và phó nhóm quản lý thành viên: thêm thẳng, duyệt, đổi link mời
const MANAGER_ROLES = ['admin', 'deputy'];
const isManager = (room, userId) => room.members.some(
    m => String(m.user._id || m.user) === userId.toString() && MANAGER_ROLES.includes(m.role)
);

// Báo trưởng/phó nhóm tải lại danh sách chờ duyệt
const emitPendingUpdated = (req, room) => {
    const io = req.app.get('io');
    if (!io) return;
    room.members.filter(m => MANAGER_ROLES.includes(m.role)).forEach(m => {
        io.to(String(m.user._id || m.user)).emit('room:pending-updated', { roomId: room._id.toString() });
    });
};

const newInviteCode = () => crypto.randomBytes(9).toString('base64url');

// Gửi danh sách thành viên mới cho mọi thành viên còn trong nhóm
const emitMembersUpdated = async (req, room) => {
    const io = req.app.get('io');
    if (!io) return;
    const populated = await room.populate('members.user', 'username avatar googlePicture status preferredLanguage preferredLanguageLabel');
    for (const member of populated.members) {
        io.to(member.user._id.toString()).emit('room:members-updated', { roomId: room._id.toString(), room: populated });
    }
    return populated;
};

// ─── Xoá thành viên khỏi nhóm (trưởng nhóm hoặc phó nhóm) ───────────
// Trưởng nhóm xoá được phó nhóm và thành viên; phó nhóm chỉ xoá được thành viên thường.
exports.removeMember = async (req, res, next) => {
    try {
        const { id, userId } = req.params;
        const room = await Room.findById(id);
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Group không tồn tại' });
        }

        const actor = room.members.find(m => m.user.toString() === req.user._id.toString());
        if (!actor || !['admin', 'deputy'].includes(actor.role)) {
            return res.status(403).json({ error: 'Chỉ trưởng nhóm hoặc phó nhóm mới được xoá thành viên' });
        }
        if (userId === req.user._id.toString()) {
            return res.status(400).json({ error: 'Muốn rời nhóm hãy dùng chức năng rời nhóm' });
        }

        const target = room.members.find(m => m.user.toString() === userId);
        if (!target) {
            return res.status(404).json({ error: 'Người này không còn trong nhóm' });
        }
        const allowed = actor.role === 'admin' ? target.role !== 'admin' : target.role === 'member';
        if (!allowed) {
            return res.status(403).json({ error: 'Bạn không có quyền xoá người này khỏi nhóm' });
        }

        room.members = room.members.filter(m => m.user.toString() !== userId);
        await room.save();

        req.app.get('io')?.to(userId).emit('room:removed', { roomId: id, roomName: room.name });
        const populated = await emitMembersUpdated(req, room);
        res.json({ room: populated || room });
    } catch (error) {
        next(error);
    }
};

// ─── Phong / bỏ phó nhóm (chỉ trưởng nhóm) ──────────────────────────
exports.setMemberRole = async (req, res, next) => {
    try {
        const { id, userId } = req.params;
        const { role } = req.body || {};
        if (!['deputy', 'member'].includes(role)) {
            return res.status(400).json({ error: 'Vai trò chỉ được là deputy hoặc member' });
        }

        const room = await Room.findById(id);
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Group không tồn tại' });
        }

        const actor = room.members.find(m => m.user.toString() === req.user._id.toString());
        if (actor?.role !== 'admin') {
            return res.status(403).json({ error: 'Chỉ trưởng nhóm mới được phong phó nhóm' });
        }

        const target = room.members.find(m => m.user.toString() === userId);
        if (!target || target.role === 'admin') {
            return res.status(400).json({ error: 'Không thể đổi vai trò của người này' });
        }

        target.role = role;
        await room.save();

        const populated = await emitMembersUpdated(req, room);
        res.json({ room: populated || room });
    } catch (error) {
        next(error);
    }
};

// ─── Đặt biệt danh ──────────────────────────────────────────────────
exports.setNickname = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { targetUserId, nickname } = req.body;

        const room = await Room.findById(id);
        if (!room) {
            return res.status(404).json({ error: 'Room không tồn tại' });
        }

        const isMember = room.members.some(m => m.user.toString() === req.user._id.toString());
        if (!isMember) {
            return res.status(403).json({ error: 'Bạn không phải thành viên' });
        }

        // Kiểm tra target cũng là member
        const targetIsMember = room.members.some(m => m.user.toString() === targetUserId);
        if (!targetIsMember) {
            return res.status(400).json({ error: 'User không phải thành viên của room' });
        }

        if (nickname && nickname.trim()) {
            room.nicknames.set(targetUserId, nickname.trim());
        } else {
            room.nicknames.delete(targetUserId);
        }

        await room.save();

        // Create system message for nickname change
        const setter = await User.findById(req.user._id).select('username').lean();
        const target = await User.findById(targetUserId).select('username').lean();
        const setterName = await displayNameInRoom(id, req.user._id, setter?.username || '?');
        const targetName = await displayNameInRoom(id, targetUserId, target?.username || '?');
        const systemContent = nickname && nickname.trim()
            ? `${setterName} đã đặt biệt danh cho ${targetName} thành "${nickname.trim()}"`
            : `${setterName} đã xóa biệt danh của ${targetName}`;

        const systemMsg = await Message.create({
            room: id,
            sender: req.user._id,
            type: 'system',
            content: systemContent,
        });
        const populatedSystemMsg = await Message.findById(systemMsg._id)
            .populate('sender', 'username avatar googlePicture preferredLanguage preferredBubbleFrame');

        // Emit realtime nickname update to all room members
        const io = req.app.get('io');
        const updatedNicknames = Object.fromEntries(room.nicknames);

        // Emit system message + nickname update
        const anonymousOwner = await getAnonymousOwner(id);
        emitToRoomMasked(io, id, 'message:received', { message: populatedSystemMsg }, anonymousOwner);
        for (const member of room.members) {
            const memberDoc = await User.findById(member.user).select('socketId').lean();
            if (memberDoc?.socketId) {
                const payload = { roomId: id, nicknames: updatedNicknames };
                io.to(memberDoc.socketId).emit('room:nickname-updated',
                    anonymousOwner && member.user.toString() !== anonymousOwner ? maskRoom(payload, anonymousOwner) : payload);
            }
        }

        res.json({ nicknames: maskRoom(updatedNicknames, ownerToMaskFor(anonymousOwner, req.user._id)) });
    } catch (error) {
        next(error);
    }
};

// ─── Tắt/Bật thông báo ──────────────────────────────────────────────
exports.toggleMute = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const room = await Room.findById(id);
        if (!room) {
            return res.status(404).json({ error: 'Room không tồn tại' });
        }

        const isMember = room.members.some(m => m.user.toString() === userId.toString());
        if (!isMember) {
            return res.status(403).json({ error: 'Bạn không phải thành viên' });
        }

        const isMuted = room.mutedBy.some(uid => uid.toString() === userId.toString());

        if (isMuted) {
            room.mutedBy = room.mutedBy.filter(uid => uid.toString() !== userId.toString());
        } else {
            room.mutedBy.push(userId);
        }

        await room.save();
        res.json({ muted: !isMuted });
    } catch (error) {
        next(error);
    }
};

// ─── Yêu cầu tham gia nhóm (pending) ────────────────────────────────
exports.requestJoin = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        const requesterId = req.user._id;

        const room = await Room.findById(id);
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Nhóm không tồn tại' });
        }

        // Chỉ member hiện tại mới mời được người khác
        const isMember = room.members.some(m => m.user.toString() === requesterId.toString());
        if (!isMember) {
            return res.status(403).json({ error: 'Bạn không phải thành viên' });
        }

        const targetId = userId || requesterId.toString();

        // Đã là member?
        const alreadyMember = room.members.some(m => m.user.toString() === targetId);
        if (alreadyMember) {
            return res.status(409).json({ error: 'User đã là thành viên' });
        }

        // Đã trong danh sách chờ?
        const alreadyPending = room.pendingMembers.some(uid => uid.toString() === targetId);
        if (alreadyPending) {
            return res.status(409).json({ error: 'User đã trong danh sách chờ' });
        }

        room.pendingMembers.push(targetId);
        await room.save();
        emitPendingUpdated(req, room);

        res.json({ message: 'Đã thêm vào danh sách chờ duyệt' });
    } catch (error) {
        next(error);
    }
};

// ─── Admin duyệt thành viên chờ ─────────────────────────────────────
exports.approveMember = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        const room = await Room.findById(id);
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Nhóm không tồn tại' });
        }

        if (!isManager(room, req.user._id)) {
            return res.status(403).json({ error: 'Chỉ trưởng nhóm hoặc phó nhóm mới có quyền duyệt' });
        }

        // Kiểm tra user có trong danh sách chờ không
        const isPending = room.pendingMembers.some(uid => uid.toString() === userId);
        if (!isPending) {
            return res.status(400).json({ error: 'User không có trong danh sách chờ' });
        }

        // Chuyển từ pending sang members
        room.pendingMembers = room.pendingMembers.filter(uid => uid.toString() !== userId);
        room.members.push({ user: userId, role: 'member' });
        await room.save();

        const populated = await emitMembersUpdated(req, room);
        req.app.get('io')?.to(userId).emit('room:approved', { roomId: id, roomName: room.name });
        emitPendingUpdated(req, room);

        res.json({ room: populated });
    } catch (error) {
        next(error);
    }
};

// ─── Admin từ chối thành viên chờ ───────────────────────────────────
exports.rejectMember = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        const room = await Room.findById(id);
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Nhóm không tồn tại' });
        }

        if (!isManager(room, req.user._id)) {
            return res.status(403).json({ error: 'Chỉ trưởng nhóm hoặc phó nhóm mới có quyền từ chối' });
        }

        const isPending = room.pendingMembers.some(uid => uid.toString() === userId);
        if (!isPending) {
            return res.status(400).json({ error: 'User không có trong danh sách chờ' });
        }

        room.pendingMembers = room.pendingMembers.filter(uid => uid.toString() !== userId);
        await room.save();
        emitPendingUpdated(req, room);

        res.json({ message: 'Đã từ chối' });
    } catch (error) {
        next(error);
    }
};

// ─── Lấy danh sách pending members ─────────────────────────────────
exports.getPendingMembers = async (req, res, next) => {
    try {
        const { id } = req.params;

        const room = await Room.findById(id).populate('pendingMembers', 'username avatar googlePicture');
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Nhóm không tồn tại' });
        }

        if (!isManager(room, req.user._id)) {
            return res.status(403).json({ error: 'Chỉ trưởng nhóm hoặc phó nhóm mới xem được' });
        }

        res.json({ pendingMembers: room.pendingMembers });
    } catch (error) {
        next(error);
    }
};

// ─── Link mời vào nhóm ──────────────────────────────────────────────
// Thành viên nào cũng lấy được link; người vào bằng link phải chờ trưởng/phó nhóm duyệt.
exports.getInviteLink = async (req, res, next) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Nhóm không tồn tại' });
        }
        if (!room.members.some(m => m.user.toString() === req.user._id.toString())) {
            return res.status(403).json({ error: 'Bạn không phải thành viên của nhóm' });
        }

        if (!room.inviteCode) {
            room.inviteCode = newInviteCode();
            await room.save();
        }
        res.json({ inviteCode: room.inviteCode });
    } catch (error) {
        next(error);
    }
};

// Trưởng/phó nhóm tạo link mới, link cũ hết hiệu lực
exports.resetInviteLink = async (req, res, next) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Nhóm không tồn tại' });
        }
        if (!isManager(room, req.user._id)) {
            return res.status(403).json({ error: 'Chỉ trưởng nhóm hoặc phó nhóm mới đổi được link mời' });
        }

        room.inviteCode = newInviteCode();
        await room.save();
        res.json({ inviteCode: room.inviteCode });
    } catch (error) {
        next(error);
    }
};

// Xem trước nhóm từ link mời
exports.getInvitePreview = async (req, res, next) => {
    try {
        const room = await Room.findOne({ inviteCode: req.params.code, type: 'group' });
        if (!room) {
            return res.status(404).json({ error: 'Link mời không hợp lệ hoặc đã bị đổi' });
        }

        const me = req.user._id.toString();
        const status = room.members.some(m => m.user.toString() === me) ? 'member'
            : room.pendingMembers.some(uid => uid.toString() === me) ? 'pending'
                : 'none';
        res.json({
            room: { _id: room._id, name: room.name, groupAvatar: room.groupAvatar, memberCount: room.members.length },
            status,
        });
    } catch (error) {
        next(error);
    }
};

// Xin vào nhóm bằng link mời: vào danh sách chờ duyệt
exports.joinByInvite = async (req, res, next) => {
    try {
        const room = await Room.findOne({ inviteCode: req.params.code, type: 'group' });
        if (!room) {
            return res.status(404).json({ error: 'Link mời không hợp lệ hoặc đã bị đổi' });
        }

        const me = req.user._id.toString();
        if (room.members.some(m => m.user.toString() === me)) {
            return res.json({ status: 'member', roomId: room._id });
        }
        if (!room.pendingMembers.some(uid => uid.toString() === me)) {
            await Room.updateOne({ _id: room._id }, { $addToSet: { pendingMembers: req.user._id } });
            emitPendingUpdated(req, room);
        }
        res.json({ status: 'pending' });
    } catch (error) {
        next(error);
    }
};

// ─── Admin cập nhật thông tin nhóm (avatar, cover, description) ─────
exports.updateGroupSettings = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, groupAvatar, groupBackground } = req.body;

        const room = await Room.findById(id);
        if (!room || room.type !== 'group') {
            return res.status(404).json({ error: 'Nhóm không tồn tại' });
        }

        // Chỉ admin mới được cập nhật
        const currentMember = room.members.find(m => m.user.toString() === req.user._id.toString());
        if (!currentMember || currentMember.role !== 'admin') {
            return res.status(403).json({ error: 'Chỉ admin mới có quyền chỉnh sửa' });
        }

        // Cập nhật các trường được gửi lên
        if (name !== undefined) room.name = name.trim();
        if (description !== undefined) room.description = description.trim();
        if (groupAvatar !== undefined) room.groupAvatar = groupAvatar;
        if (groupBackground !== undefined) room.groupBackground = groupBackground;

        await room.save();

        const populated = await room.populate('members.user', 'username avatar googlePicture status preferredLanguage preferredLanguageLabel');

        // Broadcast cập nhật realtime cho tất cả thành viên đang online
        const io = req.app.get('io');
        if (io) {
            io.to(id).emit('room:settings-updated', {
                roomId: id,
                name: room.name,
                description: room.description,
                groupAvatar: room.groupAvatar,
                groupBackground: room.groupBackground,
            });
        }

        res.json({ room: populated });
    } catch (error) {
        next(error);
    }
};

// ─── Xóa lịch sử chat cho user hiện tại ─────────────────────────────
exports.deleteChat = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const room = await Room.findById(id);
        if (!room) return res.status(404).json({ error: 'Room không tồn tại' });

        const isMember = room.members.some(m => m.user.toString() === userId.toString());
        if (!isMember) return res.status(403).json({ error: 'Bạn không phải thành viên' });

        await Message.updateMany(
            { room: id, deletedFor: { $ne: userId } },
            { $addToSet: { deletedFor: userId } },
        );

        await Room.findByIdAndUpdate(id, {
            $addToSet: { hiddenFor: userId },
        });

        res.json({ message: 'Đã xóa lịch sử trò chuyện' });
    } catch (error) {
        next(error);
    }
};

// ─── Ghim tin nhắn ───────────────────────────────────────────────────
exports.pinMessage = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { messageId } = req.body;

        const room = await Room.findById(id);
        if (!room) return res.status(404).json({ error: 'Room không tồn tại' });

        const isMember = room.members.some(m => m.user.toString() === req.user._id.toString());
        if (!isMember) return res.status(403).json({ error: 'Bạn không phải thành viên' });

        const message = await Message.findById(messageId);
        if (!message || message.room.toString() !== id) {
            return res.status(404).json({ error: 'Tin nhắn không tồn tại trong room này' });
        }

        message.pinned = true;
        message.pinnedBy = req.user._id;
        message.pinnedAt = new Date();
        await message.save();

        if (!room.pinnedMessages.includes(messageId)) {
            room.pinnedMessages.push(messageId);
            await room.save();
        }

        const pinner = await User.findById(req.user._id).select('username').lean();
        const systemMsg = await Message.create({
            room: id, sender: req.user._id, type: 'system',
            content: `${await displayNameInRoom(id, req.user._id, pinner?.username || '?')} đã ghim một tin nhắn`,
        });
        const populatedSystemMsg = await Message.findById(systemMsg._id)
            .populate('sender', 'username avatar googlePicture preferredLanguage preferredBubbleFrame');

        const populatedPinnedMsg = await Message.findById(messageId)
            .populate('sender', 'username avatar googlePicture preferredBubbleFrame')
            .lean();

        const io = req.app.get('io');
        const anonymousOwner = await getAnonymousOwner(id);
        emitToRoomMasked(io, id, 'message:received', { message: populatedSystemMsg }, anonymousOwner);
        emitToRoomMasked(io, id, 'message:pinned', { messageId, roomId: id, pinned: true, message: populatedPinnedMsg }, anonymousOwner);

        res.json({ message: 'Đã ghim tin nhắn' });
    } catch (error) {
        next(error);
    }
};

// ─── Bỏ ghim tin nhắn ───────────────────────────────────────────────
exports.unpinMessage = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { messageId } = req.body;

        const room = await Room.findById(id);
        if (!room) return res.status(404).json({ error: 'Room không tồn tại' });

        const message = await Message.findById(messageId);
        if (message) {
            message.pinned = false;
            message.pinnedBy = null;
            message.pinnedAt = null;
            await message.save();
        }

        room.pinnedMessages = room.pinnedMessages.filter(
            (pid) => pid.toString() !== messageId
        );
        await room.save();

        const io = req.app.get('io');
        io.to(id).emit('message:pinned', { messageId, roomId: id, pinned: false });

        res.json({ message: 'Đã bỏ ghim tin nhắn' });
    } catch (error) {
        next(error);
    }
};

// ─── Chuyển tiếp tin nhắn ────────────────────────────────────────────
exports.forwardMessage = async (req, res, next) => {
    try {
        const { messageId, targetRoomId } = req.body;

        const originalMessage = await Message.findById(messageId)
            .populate('sender', 'username').lean();
        if (!originalMessage) return res.status(404).json({ error: 'Tin nhắn không tồn tại' });

        const targetRoom = await Room.findById(targetRoomId);
        if (!targetRoom) return res.status(404).json({ error: 'Room đích không tồn tại' });

        const isMember = targetRoom.members.some(m => m.user.toString() === req.user._id.toString());
        if (!isMember) return res.status(403).json({ error: 'Bạn không phải thành viên của room đích' });

        const forwardedMsg = await Message.create({
            room: targetRoomId,
            sender: req.user._id,
            type: originalMessage.type === 'system' ? 'text' : originalMessage.type,
            content: originalMessage.content,
            file: originalMessage.file,
            location: originalMessage.location,
            forwardedFrom: {
                room: originalMessage.room,
                sender: originalMessage.sender?._id || originalMessage.sender,
                senderName: originalMessage.sender?.username || 'Unknown',
            },
        });

        const populated = await Message.findById(forwardedMsg._id)
            .populate('sender', 'username avatar googlePicture preferredLanguage preferredBubbleFrame');

        await Room.findByIdAndUpdate(targetRoomId, { lastMessage: forwardedMsg._id, hiddenFor: [] });

        const io = req.app.get('io');
        emitToRoomMasked(io, targetRoomId, 'message:received', { message: populated }, await getAnonymousOwner(targetRoomId));

        res.json({ message: 'Đã chuyển tiếp tin nhắn', forwardedMessage: populated });
    } catch (error) {
        next(error);
    }
};

const { User } = require('../models/User');
const Report = require('../models/Report');
const Message = require('../models/Message');
const Room = require('../models/Room');
const { getAnonymousOwner, scrub, ANONYMOUS_ID } = require('../utils/anonymity');
// ─── Block user ──────────────────────────────────────────────────────
exports.blockUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user._id;

        if (userId === currentUserId.toString()) {
            return res.status(400).json({ error: 'Không thể tự chặn chính mình' });
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User không tồn tại' });
        }

        const currentUser = await User.findById(currentUserId);
        const alreadyBlocked = currentUser.blockedUsers.some(
            uid => uid.toString() === userId
        );

        if (alreadyBlocked) {
            return res.status(409).json({ error: 'Đã chặn user này rồi' });
        }

        currentUser.blockedUsers.push(userId);
        await currentUser.save();

        // Emit realtime block notification to the blocked user
        const io = req.app.get('io');
        if (targetUser.socketId) {
            io.to(targetUser.socketId).emit('user:block-updated', {
                blockedBy: currentUserId.toString(),
                action: 'block',
            });
        }

        res.json({ message: 'Đã chặn user', blockedUsers: currentUser.blockedUsers });
    } catch (error) {
        next(error);
    }
};

// ─── Unblock user ────────────────────────────────────────────────────
exports.unblockUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user._id;

        const currentUser = await User.findById(currentUserId);
        const isBlocked = currentUser.blockedUsers.some(
            uid => uid.toString() === userId
        );

        if (!isBlocked) {
            return res.status(400).json({ error: 'User này chưa bị chặn' });
        }

        currentUser.blockedUsers = currentUser.blockedUsers.filter(
            uid => uid.toString() !== userId
        );
        await currentUser.save();

        // Emit realtime unblock notification to the unblocked user
        const io = req.app.get('io');
        const targetUser = await User.findById(userId).select('socketId').lean();
        if (targetUser?.socketId) {
            io.to(targetUser.socketId).emit('user:block-updated', {
                blockedBy: currentUserId.toString(),
                action: 'unblock',
            });
        }

        res.json({ message: 'Đã bỏ chặn', blockedUsers: currentUser.blockedUsers });
    } catch (error) {
        next(error);
    }
};

// ─── Lấy danh sách blocked users ────────────────────────────────────
exports.getBlockedUsers = async (req, res, next) => {
    try {
        const currentUser = await User.findById(req.user._id)
            .populate('blockedUsers', 'username avatar googlePicture');

        res.json({ blockedUsers: currentUser.blockedUsers });
    } catch (error) {
        next(error);
    }
};

// ─── Gửi báo cáo ────────────────────────────────────────────────────
exports.reportUser = async (req, res, next) => {
    try {
        const { reason, description, roomId, messageId } = req.body;
        let { reportedUserId } = req.body;
        const reporterId = req.user._id;

        // Báo cáo người hỏi ẩn danh trong phiên tư vấn: tra ra tài khoản thật để admin xử lý
        let anonymousOwner = null;
        if (reportedUserId === ANONYMOUS_ID) {
            const room = roomId && await Room.findById(roomId).select('members').lean();
            const isMember = room?.members?.some(m => m.user.toString() === reporterId.toString());
            anonymousOwner = isMember ? await getAnonymousOwner(roomId) : null;
            if (!anonymousOwner) return res.status(400).json({ error: 'Không xác định được người bị báo cáo' });
            reportedUserId = anonymousOwner;
        }

        if (reportedUserId === reporterId.toString()) {
            return res.status(400).json({ error: 'Không thể báo cáo chính mình' });
        }

        const VALID_REASONS = [
            'spam', 'harassment', 'hate_speech', 'violence',
            'inappropriate_content', 'impersonation', 'other',
        ];
        if (!reason || !VALID_REASONS.includes(reason)) {
            return res.status(400).json({ error: 'Lý do không hợp lệ' });
        }

        const targetUser = await User.findById(reportedUserId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User không tồn tại' });
        }

        // Báo cáo một tin nhắn cụ thể: tin phải thuộc phòng đó và do người bị báo cáo gửi
        let message = null;
        if (messageId) {
            message = await Message.findById(messageId).select('room sender').lean();
            if (!message || message.sender?.toString() !== reportedUserId
                || (roomId && message.room.toString() !== roomId)) {
                return res.status(400).json({ error: 'Tin nhắn báo cáo không hợp lệ' });
            }
        }

        const duplicate = await Report.exists({
            reporter: reporterId,
            reportedUser: reportedUserId,
            message: message ? message._id : null,
            status: 'pending',
        });
        if (duplicate) {
            return res.status(409).json({ error: 'Bạn đã báo cáo nội dung này, admin đang xem xét' });
        }

        const report = await Report.create({
            reporter: reporterId,
            reportedUser: reportedUserId,
            room: message ? message.room : (roomId || null),
            message: message ? message._id : null,
            targetType: message ? 'message' : 'user',
            reason,
            description: description || '',
        });

        res.status(201).json({ message: 'Báo cáo đã được gửi', report: anonymousOwner ? scrub(report, anonymousOwner) : report });
    } catch (error) {
        next(error);
    }
};

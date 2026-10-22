// Chế tài tài khoản dùng chung cho admin (ban/khóa tay, xử lý báo cáo)
// và bộ lọc từ cấm (tự khóa khi vi phạm nhiều lần).

// Số lần dùng từ cấm trước khi bị tự khóa, và thời gian khóa
const BAD_WORD_LIMIT = 5;
const BAD_WORD_LOCK_MINUTES = 60;

const ADMIN_ROLES = ['sub_admin', 'super_admin'];

const emitStatus = (io, user) => {
    io?.to(user._id.toString()).emit('user:status-updated', {
        accountStatus: user.accountStatus,
        lockUntil: user.lock_until,
        isLocked: user.is_locked,
    });
};

const banAccount = async (io, user) => {
    user.accountStatus = 'banned';
    user.status = 'banned';
    user.is_locked = true;
    user.lock_until = null;
    await user.save({ validateModifiedOnly: true });
    if (!io) return;
    const room = user._id.toString();
    emitStatus(io, user);
    io.to(room).emit('account:banned', { message: 'Tài khoản đã bị khóa vĩnh viễn bởi Admin' });
    // Cho sự kiện kịp tới client rồi mới ngắt kết nối
    setTimeout(() => io.in(room).disconnectSockets(true), 500);
};

// minutes = 0 nghĩa là mở khóa ngay
const lockAccount = async (io, user, minutes, message) => {
    if (minutes === 0) {
        user.accountStatus = 'active';
        user.status = 'active';
        user.is_locked = false;
        user.lock_until = null;
    } else {
        user.accountStatus = 'locked';
        user.status = 'active';
        user.is_locked = true;
        user.lock_until = new Date(Date.now() + minutes * 60000);
    }
    await user.save({ validateModifiedOnly: true });
    if (!io) return;
    emitStatus(io, user);
    if (minutes > 0) {
        io.to(user._id.toString()).emit('account:locked', {
            message: message || `Tài khoản bị khóa tạm thời ${minutes} phút`,
            lockUntil: user.lock_until,
        });
    }
};

const isLockActive = (user) =>
    user?.accountStatus === 'locked' && user.lock_until && new Date(user.lock_until) > new Date();

module.exports = { BAD_WORD_LIMIT, BAD_WORD_LOCK_MINUTES, ADMIN_ROLES, banAccount, lockAccount, isLockActive };

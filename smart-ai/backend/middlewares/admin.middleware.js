const adminMiddleware = (req, res, next) => {
    if (!req.user || !['sub_admin', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập chức năng này' });
    }
    next();
};

const superAdminMiddleware = (req, res, next) => {
    if (!req.user || req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Chỉ Super Admin mới có quyền thực hiện' });
    }
    next();
};

module.exports = { adminMiddleware, superAdminMiddleware };

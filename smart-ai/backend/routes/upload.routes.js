const router = require('express').Router();
const uploadController = require('../controllers/upload.controller');
const { upload } = require('../config/multer');
const { authMiddleware } = require('../middlewares/auth.middleware');
const SystemConfig = require('../models/SystemConfig');

// Tất cả routes cần xác thực
router.use(authMiddleware);

// Chặn upload khi admin tắt "Tải file lên" trong Cấu hình hệ thống
router.use(async (req, res, next) => {
    try {
        if (await SystemConfig.getValue('fileUploadEnabled', true)) return next();
        res.status(403).json({ error: 'Quản trị viên đã tạm tắt tính năng tải file lên' });
    } catch (error) {
        next(error);
    }
});

// POST /api/upload          (upload 1 file)
router.post('/', upload.single('file'), uploadController.uploadFile);

// POST /api/upload/multiple (upload nhiều file, tối đa 5)
router.post('/multiple', upload.array('files', 5), uploadController.uploadFiles);

module.exports = router;

const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
}, { timestamps: true });

// Đọc 1 giá trị cấu hình, trả về fallback nếu admin chưa từng lưu key đó
systemConfigSchema.statics.getValue = async function (key, fallback) {
    const doc = await this.findOne({ key }).lean();
    return doc ? doc.value : fallback;
};

module.exports = mongoose.model('SystemConfig', systemConfigSchema);

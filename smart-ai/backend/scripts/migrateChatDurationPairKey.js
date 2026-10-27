// Chạy 1 lần sau khi deploy bản thêm pairKey cho ChatDuration (cả trên DB local):
//   node scripts/migrateChatDurationPairKey.js
// Điền pairKey cho bản ghi cũ rồi đồng bộ index theo schema: bỏ unique index cũ trên participants
// (khiến mỗi user chỉ có được 1 bản ghi, tin nhắn chat 1-1 thứ hai báo lỗi E11000) và tạo unique index trên pairKey.
require('dotenv').config();
const mongoose = require('mongoose');
const ChatDuration = require('../models/ChatDuration');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_ai_chat');

    const docs = await ChatDuration.find({ pairKey: { $exists: false } }).select('participants').lean();
    for (const doc of docs) {
        await ChatDuration.updateOne({ _id: doc._id }, { $set: { pairKey: ChatDuration.pairKeyOf(doc.participants) } });
    }
    console.log(`Đã điền pairKey cho ${docs.length} bản ghi`);

    const dropped = await ChatDuration.syncIndexes();
    console.log('Index đã xoá:', dropped.length ? dropped.join(', ') : 'không có');
    const indexes = await ChatDuration.collection.indexes();
    console.log('Index hiện tại:', indexes.map((i) => `${i.name}${i.unique ? ' (unique)' : ''}`).join(', '));

    await mongoose.disconnect();
})().catch((err) => {
    console.error('Lỗi:', err.message);
    process.exit(1);
});

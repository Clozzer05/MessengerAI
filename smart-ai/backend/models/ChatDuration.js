const mongoose = require('mongoose');

const chatDurationSchema = new mongoose.Schema({
    participants: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
        validate: {
            validator(value) {
                return Array.isArray(value) && value.length === 2;
            },
            message: 'participants phải gồm đúng 2 user',
        },
        required: true,
    },
    // Khóa duy nhất cho một cặp user (2 id đã sắp xếp, nối bằng "_").
    // Không đặt unique trên mảng participants: MongoDB sẽ hiểu là mỗi user chỉ được nằm trong 1 bản ghi.
    pairKey: {
        type: String,
        required: true,
        unique: true,
    },
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true,
    },
    totalMessages: {
        type: Number,
        default: 0,
    },
    lastInteraction: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

chatDurationSchema.statics.pairKeyOf = (ids) => ids.map((id) => id.toString()).sort().join('_');

chatDurationSchema.pre('validate', function () {
    if (Array.isArray(this.participants) && this.participants.length === 2) {
        this.participants = this.participants
            .map((id) => id.toString())
            .sort()
            .map((id) => new mongoose.Types.ObjectId(id));
        this.pairKey = this.constructor.pairKeyOf(this.participants);
    }
});

chatDurationSchema.index({ participants: 1 });
chatDurationSchema.index({ lastInteraction: -1 });

module.exports = mongoose.model('ChatDuration', chatDurationSchema);

const mongoose = require('mongoose');
const Room = require('../models/Room');
const Message = require('../models/Message');
const ChatDuration = require('../models/ChatDuration');
const { User } = require('../models/User');
const { translateForRoom, getTranslationForUser } = require('../services/translation.service');
const { filterMessage } = require('../utils/badWordFilter');
const { getAnonymousOwner, maskMessage, emitToRoomMasked } = require('../utils/anonymity');
const { BAD_WORD_LIMIT, BAD_WORD_LOCK_MINUTES, ADMIN_ROLES, lockAccount, isLockActive } = require('../utils/moderation');
const STICKER_MESSAGE_PREFIX = '__smartsticker__:';
const isStickerPayload = (content) => typeof content === 'string' && content.startsWith(STICKER_MESSAGE_PREFIX);

module.exports = (io, socket) => {
    const userId = socket.user._id;

    // Ghi nhận 1 lần dùng từ cấm: cảnh báo, đủ BAD_WORD_LIMIT lần thì tự khóa tạm
    const recordBadWord = async () => {
        if (ADMIN_ROLES.includes(socket.user.role)) return;
        const user = await User.findByIdAndUpdate(userId, { $inc: { badWordViolations: 1 } }, { new: true });
        if (!user) return;
        if (user.badWordViolations >= BAD_WORD_LIMIT) {
            user.badWordViolations = 0;
            await lockAccount(io, user, BAD_WORD_LOCK_MINUTES,
                `Bạn đã dùng từ ngữ bị cấm ${BAD_WORD_LIMIT} lần nên bị khóa chat ${BAD_WORD_LOCK_MINUTES} phút`);
            console.log(`🚫 Auto-locked ${user.username} for ${BAD_WORD_LOCK_MINUTES} minutes (bad words)`);
        } else {
            socket.emit('moderation:warning', {
                message: `Tin nhắn chứa từ ngữ bị cấm và đã được che. Cảnh báo ${user.badWordViolations}/${BAD_WORD_LIMIT}: đến lần thứ ${BAD_WORD_LIMIT} bạn sẽ bị khóa chat ${BAD_WORD_LOCK_MINUTES} phút.`,
            });
        }
    };
    // ─── message:send ───────────────────────────────────────────────────
    socket.on('message:send', async ({ roomId, content, type = 'text', file = null, replyTo = null }) => {
        try {
            if (!roomId) return socket.emit('error', { message: 'roomId là bắt buộc' });
            if (type === 'text' && (!content || content.trim() === '')) {
                return socket.emit('error', { message: 'Nội dung tin nhắn không được trống' });
            }
            if (type === 'location' && (!file?.lat || !file?.lng)) {
                return socket.emit('error', { message: 'Thiếu tọa độ vị trí' });
            }

            const room = await Room.findById(roomId);
            if (!room) return socket.emit('error', { message: 'Room không tồn tại' });

            const isMember = room.members.some(m => m.user.toString() === userId.toString());
            if (!isMember) return socket.emit('error', { message: 'Bạn không phải thành viên' });

            // ── Kiểm tra block: nếu bất kỳ thành viên nào đã chặn sender → từ chối ──
            if (room.type === 'direct') {
                const otherMember = room.members.find(m => m.user.toString() !== userId.toString());
                if (otherMember) {
                    const otherUser = await User.findById(otherMember.user).select('blockedUsers').lean();
                    if (otherUser?.blockedUsers?.some(id => id.toString() === userId.toString())) {
                        return socket.emit('error', { message: 'Không thể gửi tin nhắn. Người dùng đã chặn bạn.' });
                    }
                    // Cũng kiểm tra: sender đã chặn receiver → không cho gửi
                    const senderDoc = await User.findById(userId).select('blockedUsers').lean();
                    if (senderDoc?.blockedUsers?.some(id => id.toString() === otherMember.user.toString())) {
                        return socket.emit('error', { message: 'Bạn đã chặn người này. Bỏ chặn để gửi tin nhắn.' });
                    }
                }
            }

            // ── Lấy preferredLanguage MỚI NHẤT từ DB (socket.user có thể stale) ──
            const senderFresh = await User.findById(userId).select('preferredLanguage accountStatus lock_until').lean();

            // ── Check account status ──
            if (senderFresh?.accountStatus === 'banned') {
                return socket.emit('error', { message: 'Tài khoản của bạn đã bị khóa.' });
            }
            if (isLockActive(senderFresh)) {
                return socket.emit('error', { message: 'Tài khoản đang bị khóa tạm thời.' });
            }

            const senderLanguage = senderFresh?.preferredLanguage || socket.user.preferredLanguage || 'vi';

            // ── Bad word filter ──
            let filteredContent = content;
            if (type === 'text' && content) {
                if (!isStickerPayload(content)) {
                    const { filtered, hasBadWord } = await filterMessage(content);
                    filteredContent = filtered;
                    if (hasBadWord) await recordBadWord();
                }
            }

            // ── Trả lời tin nhắn: chỉ nhận tin trong cùng phòng ──
            if (replyTo && !(mongoose.isValidObjectId(replyTo) && await Message.exists({ _id: replyTo, room: roomId }))) {
                return socket.emit('error', { message: 'Tin nhắn được trả lời không tồn tại' });
            }

            // ── Tạo message ──
            const messageData = {
                room: roomId,
                sender: userId,
                type,
                content: filteredContent || '',
                originalLanguage: senderLanguage,
                replyTo: replyTo || null,
            };

            if (type === 'location' && file) {
                messageData.location = {
                    lat: file.lat,
                    lng: file.lng,
                    address: file.address || '',
                };
            } else if (file) {
                messageData.file = {
                    url: file.url,
                    name: file.name,
                    size: file.size,
                    mimeType: file.mimeType,
                };
            }

            const message = await Message.create(messageData);

            // ── Track tương tác cho direct chat (cặp user) ──
            // Chỉ là thống kê: lỗi ở đây không được chặn việc gửi tin nhắn
            if (room.type === 'direct') {
                const otherMember = room.members.find((m) => m.user.toString() !== userId.toString());
                if (otherMember) {
                    const participants = [userId.toString(), otherMember.user.toString()].sort();
                    const pairKey = ChatDuration.pairKeyOf(participants);
                    try {
                        await ChatDuration.findOneAndUpdate(
                            { pairKey },
                            {
                                $setOnInsert: {
                                    participants,
                                    pairKey,
                                },
                                $set: {
                                    roomId: room._id,
                                    lastInteraction: new Date(),
                                },
                                $inc: {
                                    totalMessages: 1,
                                },
                            },
                            { upsert: true, new: true, setDefaultsOnInsert: true }
                        );
                    } catch (err) {
                        console.error('ChatDuration update error:', err.message);
                    }
                }
            }

            const populatedMessage = await Message.findById(message._id)
                .populate('sender', 'username avatar googlePicture preferredLanguage preferredBubbleFrame')
                .populate(Message.REPLY_TO_POPULATE);

            // Cập nhật lastMessage; có tin mới thì hiện lại cuộc trò chuyện cho ai đã xóa nó (như Messenger)
            await Room.findByIdAndUpdate(roomId, { lastMessage: message._id, hiddenFor: [] });

            // ═════════════════════════════════════════════════════════════════
            // BƯỚC 1: Broadcast tin nhắn GỐC ngay lập tức (không chờ AI)
            // ═════════════════════════════════════════════════════════════════
            // Phòng tư vấn ẩn danh: chỉ người hỏi thấy tên thật của mình
            const anonymousOwner = room.type === 'counseling' ? await getAnonymousOwner(roomId) : null;
            emitToRoomMasked(io, roomId, 'message:received', { message: populatedMessage }, anonymousOwner);

            // ═════════════════════════════════════════════════════════════════
            // BƯỚC 1.5: Notify ALL room members (sidebar update + unread)
            // io.to(roomId) only reaches users who socket.join(roomId).
            // Sidebar needs updates for rooms the user has NOT joined.
            // ═════════════════════════════════════════════════════════════════
            for (const member of room.members) {
                if (member.user.toString() === userId.toString()) continue;
                const memberDoc = await User.findById(member.user).select('socketId').lean();
                if (memberDoc?.socketId) {
                    const newMessagePayload = { roomId, lastMessage: populatedMessage, senderId: userId.toString() };
                    io.to(memberDoc.socketId).emit('room:new-message',
                        anonymousOwner && member.user.toString() !== anonymousOwner
                            ? maskMessage(newMessagePayload, anonymousOwner)
                            : newMessagePayload);
                }
            }

            console.log(`💬 ${socket.user.username} → room ${roomId}: ${content?.substring(0, 50) || '[file]'}`);

            // ═════════════════════════════════════════════════════════════════
            // BƯỚC 2: Dịch thuật ASYNC (fire-and-forget, không block UX)
            // ═════════════════════════════════════════════════════════════════
            if (type === 'text' && filteredContent && filteredContent.trim().length >= 2 && !isStickerPayload(filteredContent)) {
                translateForRoom(io, roomId, message._id, filteredContent, senderLanguage)
                    .catch(err => console.error('Translation error:', err.message));
            }

            // ═════════════════════════════════════════════════════════════════
            // BƯỚC 3: AI Counseling Bot Response
            // ═════════════════════════════════════════════════════════════════
            if (room.type === 'counseling' && type === 'text') {
                const CounselingSession = require('../models/CounselingSession');
                const session = await CounselingSession.findOne({ room: roomId, status: 'active' });
                
                if (session) {
                    const isMentioningAI = content.toLowerCase().includes('@aiweise');
                    
                    if (session.aiActive || isMentioningAI) {
                        const { generateCounselingResponse } = require('../services/ai.service');
                        
                        // Emit typing status for AI
                        io.to(roomId).emit('room:typing', { roomId, userId: 'ai-bot', username: 'AI Tư vấn' });
                        
                        try {
                            const history = await Message.find({ room: roomId }).sort({ createdAt: 1 }).limit(20);
                            const mappedHistory = history.map(msg => ({
                                role: msg.aiMetadata?.isAIResponse ? 'assistant' : (msg.sender.toString() === session.user.toString() ? 'user' : 'system'),
                                content: msg.content
                            }));
                            
                            const aiReply = await generateCounselingResponse(content, session.category, mappedHistory);
                            
                            const aiMessage = await Message.create({
                                room: roomId,
                                sender: session.user, // Dummy sender so schema passes
                                type: 'ai-response',
                                content: aiReply,
                                aiMetadata: { isAIResponse: true, model: 'gemini' }
                            });
                            
                            const populatedAI = await Message.findById(aiMessage._id).populate('sender', 'username avatar googlePicture');
                            await Room.findByIdAndUpdate(roomId, { lastMessage: aiMessage._id, hiddenFor: [] });
                            
                            io.to(roomId).emit('room:stop-typing', { roomId, userId: 'ai-bot' });
                            
                            if (session.expert) {
                                // If expert is in the room, only show AI reply to the user (private AI message)
                                const userDoc = await User.findById(session.user).select('socketId').lean();
                                if (userDoc?.socketId) {
                                    io.to(userDoc.socketId).emit('message:received', { message: populatedAI });
                                    io.to(userDoc.socketId).emit('room:new-message', {
                                        roomId,
                                        lastMessage: populatedAI,
                                        senderId: 'ai-bot',
                                    });
                                }
                            } else {
                                // Broadcast to all
                                io.to(roomId).emit('message:received', { message: populatedAI });
                                for (const member of room.members) {
                                    const memberDoc = await User.findById(member.user).select('socketId').lean();
                                    if (memberDoc?.socketId) {
                                        io.to(memberDoc.socketId).emit('room:new-message', {
                                            roomId,
                                            lastMessage: populatedAI,
                                            senderId: 'ai-bot',
                                        });
                                    }
                                }
                            }
                        } catch (err) {
                            console.error('AI Counseling error:', err.message);
                            io.to(roomId).emit('room:stop-typing', { roomId, userId: 'ai-bot' });
                        }
                    }
                }
            }

        } catch (error) {
            console.error('message:send error:', error.message);
            socket.emit('error', { message: 'Lỗi khi gửi tin nhắn' });
        }
    });

    // ─── message:read ───────────────────────────────────────────────────
    socket.on('message:read', async ({ roomId, messageId }) => {
        try {
            await Message.findByIdAndUpdate(messageId, {
                $addToSet: {
                    readBy: { user: userId, readAt: new Date() },
                },
            });

            emitToRoomMasked(io, roomId, 'message:read-update', {
                messageId,
                userId: userId.toString(),
            }, await getAnonymousOwner(roomId), { excludeSocketId: socket.id });
        } catch (error) {
            console.error('message:read error:', error.message);
        }
    });

    // ─── message:edit ───────────────────────────────────────────────────
    socket.on('message:edit', async ({ messageId, roomId, content }) => {
        try {
            if (!messageId || !content || !content.trim()) return;
            const message = await Message.findById(messageId);
            if (!message) return;
            if (message.sender.toString() !== userId.toString()) {
                return socket.emit('error', { message: 'Không thể sửa tin nhắn của người khác' });
            }
            if (message.type !== 'text') {
                return socket.emit('error', { message: 'Chỉ có thể sửa tin nhắn dạng văn bản' });
            }
            if (message.deleted) {
                return socket.emit('error', { message: 'Tin nhắn đã bị xoá' });
            }

            const editor = await User.findById(userId).select('accountStatus lock_until').lean();
            if (editor?.accountStatus === 'banned' || isLockActive(editor)) {
                return socket.emit('error', { message: 'Tài khoản đang bị khóa, không thể sửa tin nhắn.' });
            }

            // Sửa tin cũng phải qua bộ lọc, tránh gửi chữ sạch rồi sửa thành từ cấm
            const { filtered, hasBadWord } = await filterMessage(content.trim());
            if (hasBadWord) await recordBadWord();

            message.content = filtered;
            message.editedAt = new Date();
            // Stale translations: clear so they re-translate on demand
            if (Array.isArray(message.translations)) message.translations = [];
            await message.save();

            io.to(roomId || message.room.toString()).emit('message:edited', {
                messageId: message._id,
                roomId: message.room.toString(),
                content: message.content,
                editedAt: message.editedAt,
            });
        } catch (error) {
            console.error('message:edit error:', error.message);
        }
    });

    // ─── message:delete ─────────────────────────────────────────────────
    socket.on('message:delete', async ({ messageId, roomId }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;

            if (message.sender.toString() !== userId.toString()) {
                return socket.emit('error', { message: 'Bạn không thể xóa tin nhắn của người khác' });
            }

            message.deleted = true;
            message.content = '';
            await message.save();

            io.to(roomId).emit('message:deleted', { messageId });
        } catch (error) {
            console.error('message:delete error:', error.message);
        }
    });

    // ─── message:react ────────────────────────────────────────────────
    socket.on('message:react', async ({ messageId, roomId, emoji }) => {
        try {
            if (!messageId || !roomId || typeof emoji !== 'string' || !emoji || emoji.length > 16) return;

            const message = await Message.findById(messageId);
            if (!message) return socket.emit('error', { message: 'Tin nhắn không tồn tại' });

            // Chỉ thành viên của phòng chứa tin nhắn mới thả cảm xúc được
            if (message.room.toString() !== String(roomId)) return;
            const room = await Room.findById(roomId).select('members.user').lean();
            if (!room?.members.some(m => m.user.toString() === userId.toString())) {
                return socket.emit('error', { message: 'Bạn không phải thành viên' });
            }

            const existingIdx = message.reactions.findIndex(
                (r) => r.user.toString() === userId.toString()
            );

            if (existingIdx !== -1) {
                if (message.reactions[existingIdx].emoji === emoji) {
                    // Same emoji → remove (toggle off)
                    message.reactions.splice(existingIdx, 1);
                } else {
                    // Different emoji → update
                    message.reactions[existingIdx].emoji = emoji;
                }
            } else {
                // New reaction
                message.reactions.push({ user: userId, emoji });
            }

            await message.save();

            // Broadcast updated reactions to room
            emitToRoomMasked(io, roomId, 'message:reacted', {
                messageId,
                reactions: message.reactions,
            }, await getAnonymousOwner(roomId));
        } catch (error) {
            console.error('message:react error:', error.message);
        }
    });

    // ─── message:get-translation ────────────────────────────────────────
    // Client request bản dịch cho 1 message cụ thể (khi load history)
    socket.on('message:get-translation', async ({ messageId }) => {
        try {
            const translation = await getTranslationForUser(messageId, socket.user.preferredLanguage);
            if (translation) {
                socket.emit('message:translated', {
                    messageId,
                    translation: {
                        language: translation.language,
                        content: translation.content,
                    },
                });
            }
        } catch (error) {
            console.error('message:get-translation error:', error.message);
        }
    });

    // ─── poll:vote ──────────────────────────────────────────────────────
    socket.on('poll:vote', async ({ messageId, roomId, optionIndex }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message || !message.poll) return;

            const option = message.poll.options[optionIndex];
            if (!option) return;

            // Remove previous vote from all options
            for (const opt of message.poll.options) {
                opt.votes = opt.votes.filter(v => v.toString() !== userId.toString());
            }

            // Add vote to selected option
            option.votes.push(userId);
            await message.save();

            emitToRoomMasked(io, roomId, 'poll:updated', {
                messageId,
                poll: message.poll,
            }, await getAnonymousOwner(roomId));
        } catch (error) {
            console.error('poll:vote error:', error.message);
        }
    });

    // ─── message:send-poll ──────────────────────────────────────────────
    socket.on('message:send-poll', async ({ roomId, question, options }) => {
        try {
            if (!roomId || !question || !options || options.length < 2) {
                return socket.emit('error', { message: 'Poll cần ít nhất 2 lựa chọn' });
            }

            const room = await Room.findById(roomId);
            if (!room) return socket.emit('error', { message: 'Room không tồn tại' });

            const message = await Message.create({
                room: roomId,
                sender: userId,
                type: 'poll',
                content: question,
                poll: {
                    question,
                    options: options.map(text => ({ text, votes: [] })),
                },
            });

            const populated = await Message.findById(message._id)
                .populate('sender', 'username avatar googlePicture preferredLanguage preferredBubbleFrame');

            await Room.findByIdAndUpdate(roomId, { lastMessage: message._id, hiddenFor: [] });
            emitToRoomMasked(io, roomId, 'message:received', { message: populated }, await getAnonymousOwner(roomId));
        } catch (error) {
            console.error('message:send-poll error:', error.message);
        }
    });

    // ─── message:send-contact-card ──────────────────────────────────────
    socket.on('message:send-contact-card', async ({ roomId, contactUserId }) => {
        try {
            if (!roomId || !contactUserId) return;

            const contactUser = await User.findById(contactUserId).select('username avatar bio').lean();
            if (!contactUser) return socket.emit('error', { message: 'User không tồn tại' });

            const message = await Message.create({
                room: roomId,
                sender: userId,
                type: 'contact-card',
                content: `Đã chia sẻ liên hệ: ${contactUser.username}`,
                contactCard: {
                    userId: contactUserId,
                    username: contactUser.username,
                    avatar: contactUser.avatar || '',
                    bio: contactUser.bio || '',
                },
            });

            const populated = await Message.findById(message._id)
                .populate('sender', 'username avatar googlePicture preferredLanguage preferredBubbleFrame');

            await Room.findByIdAndUpdate(roomId, { lastMessage: message._id, hiddenFor: [] });
            emitToRoomMasked(io, roomId, 'message:received', { message: populated }, await getAnonymousOwner(roomId));
        } catch (error) {
            console.error('message:send-contact-card error:', error.message);
        }
    });
};


// Che danh tính người hỏi trong phiên tư vấn ẩn danh với mọi người xem khác chính người hỏi.
// Mọi chỗ chứa mã tài khoản của người hỏi (người gửi, thành viên, đã xem, reaction, phiếu bầu...)
// đều được thay bằng 'anonymous', nên không tra ngược được hồ sơ qua /api/users/:id.
const CounselingSession = require('../models/CounselingSession');

const ANONYMOUS_ID = 'anonymous';
const ANONYMOUS_PROFILE = { _id: ANONYMOUS_ID, id: ANONYMOUS_ID, username: 'Người dùng ẩn danh', avatar: '', googlePicture: '' };
// Các trường không lộ danh tính nhưng giao diện cần (dịch tin nhắn, khung chat)
const SAFE_FIELDS = ['preferredLanguage', 'preferredLanguageLabel', 'preferredBubbleFrame'];

// Phiên đã tạo thì không đổi chế độ ẩn danh, nên cache theo phòng cho các sự kiện gửi liên tục (đang nhập...)
const ownerCache = new Map(); // roomId -> { ownerId|null, at }
const CACHE_TTL = 60 * 1000;

// Map roomId -> userId của người hỏi, chỉ với các phòng tư vấn ẩn danh
const getAnonymousOwners = async (roomIds) => {
    if (!roomIds.length) return new Map();
    const sessions = await CounselingSession.find({ room: { $in: roomIds }, isAnonymous: true })
        .select('room user').lean();
    return new Map(sessions.map((s) => [String(s.room), String(s.user)]));
};

const getAnonymousOwner = async (roomId) => {
    const key = String(roomId);
    const hit = ownerCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.ownerId;
    const ownerId = (await getAnonymousOwners([key])).get(key) || null;
    ownerCache.set(key, { ownerId, at: Date.now() });
    return ownerId;
};

const scrubValue = (value, ownerId) => {
    if (value === ownerId) return ANONYMOUS_ID;
    if (Array.isArray(value)) return value.map((v) => scrubValue(v, ownerId));
    if (value && typeof value === 'object') {
        if (value._id === ownerId) {
            const safe = Object.fromEntries(SAFE_FIELDS.filter((k) => value[k] !== undefined).map((k) => [k, value[k]]));
            return { ...safe, ...ANONYMOUS_PROFILE };
        }
        // Khóa object cũng có thể là mã người dùng (vd: nicknames { [userId]: 'tên' })
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k === ownerId ? ANONYMOUS_ID : k, scrubValue(v, ownerId)]));
    }
    return value;
};

// Trả về bản sao đã che (dạng JSON thuần) của bất kỳ payload nào
const scrub = (payload, ownerId) => {
    if (!ownerId || payload == null) return payload;
    return scrubValue(JSON.parse(JSON.stringify(payload)), String(ownerId));
};

// Gửi sự kiện tới từng socket trong phòng: người hỏi nhận bản gốc, người khác nhận bản đã che
const emitToRoomMasked = (io, roomId, event, payload, ownerId, { excludeSocketId } = {}) => {
    const room = String(roomId);
    if (!ownerId) {
        const target = excludeSocketId ? io.to(room).except(excludeSocketId) : io.to(room);
        return target.emit(event, payload);
    }
    const masked = scrub(payload, ownerId);
    for (const socketId of io.sockets.adapter.rooms.get(room) || []) {
        if (socketId === excludeSocketId) continue;
        const s = io.sockets.sockets.get(socketId);
        if (s) s.emit(event, String(s.user?._id) === String(ownerId) ? payload : masked);
    }
};

// Tên dùng trong nội dung tin hệ thống (vd: "X đã ghim một tin nhắn") — nội dung này ai trong phòng cũng thấy
const displayNameInRoom = async (roomId, userId, username) =>
    (String(userId) === String(await getAnonymousOwner(roomId)) ? ANONYMOUS_PROFILE.username : username);

// viewerId: người đang xem; chính người hỏi thì vẫn thấy tên thật của mình
const ownerToMaskFor = (ownerId, viewerId) => (ownerId && ownerId !== String(viewerId) ? ownerId : null);

// Giữ tên cũ cho các chỗ đang gọi
const maskMessage = scrub;
const maskRoom = scrub;
const maskUser = scrub;

module.exports = {
    getAnonymousOwners, getAnonymousOwner, displayNameInRoom, scrub, maskUser, maskMessage, maskRoom, ownerToMaskFor, emitToRoomMasked,
    ANONYMOUS_ID, ANONYMOUS_PROFILE,
};

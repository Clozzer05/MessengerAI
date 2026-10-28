import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { roomAPI, resolveMediaUrl } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { emitToast } from '../../utils/toast';
import { confirmDialog } from '../../utils/confirm';
import { format } from 'date-fns';
import { Plus, Search, MessageCircle, Users, MoreHorizontal, Trash2 } from 'lucide-react';
import CreateRoomModal from './CreateRoomModal';
import SkeletonBlock from '../ui/SkeletonBlock';

// Thời gian ngắn gọn ở danh sách phòng: "Vừa xong", "5 phút", "3 giờ", "2 ngày", quá 1 tuần thì ngày/tháng
const formatShortTime = (date) => {
    const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút`;
    if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} giờ`;
    if (minutes < 7 * 24 * 60) return `${Math.floor(minutes / (24 * 60))} ngày`;
    return format(new Date(date), 'dd/MM');
};

export default function RoomList({ activeRoomId, onSelectRoom }) {
    const { user } = useAuth();
    const { onlineUsers, on, off } = useSocket();
    const [rooms, setRooms] = useState([]);
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [loading, setLoading] = useState(true);
    const [unreadCounts, setUnreadCounts] = useState({});

    // For Context Menu
    const [menuOpenId, setMenuOpenId] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const searchInputRef = useRef(null);
    const roomsRef = useRef([]);

    useEffect(() => {
        roomsRef.current = rooms;
    }, [rooms]);

    useEffect(() => {
        loadRooms();

        const handleClickOutside = () => setMenuOpenId(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    // Clear unread when a room becomes active
    useEffect(() => {
        if (activeRoomId) {
            setUnreadCounts((prev) => {
                if (!prev[activeRoomId]) return prev;
                const next = { ...prev };
                delete next[activeRoomId];
                return next;
            });
        }
    }, [activeRoomId]);

    // Listen for room updates
    useEffect(() => {
        const handleRoomUpdate = (updatedRoom) => {
            setRooms((prev) => {
                const idx = prev.findIndex((r) => r._id === updatedRoom._id);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = { ...updated[idx], ...updatedRoom };
                    return updated.sort(
                        (a, b) => new Date(b.lastMessage?.createdAt || b.updatedAt) - new Date(a.lastMessage?.createdAt || a.updatedAt)
                    );
                }
                return [updatedRoom, ...prev];
            });
        };

        on('room:updated', handleRoomUpdate);
        return () => off('room:updated', handleRoomUpdate);
    }, [on, off]);

    // Listen for nickname updates to reflect in sidebar
    useEffect(() => {
        const handleNicknameUpdated = ({ roomId, nicknames }) => {
            setRooms((prev) =>
                prev.map((r) =>
                    r._id === roomId ? { ...r, nicknames } : r
                )
            );
        };
        on('room:nickname-updated', handleNicknameUpdated);
        return () => off('room:nickname-updated', handleNicknameUpdated);
    }, [on, off]);

    // Bị trưởng/phó nhóm xoá khỏi nhóm: bỏ nhóm khỏi danh sách
    useEffect(() => {
        const handleRemoved = ({ roomId, roomName }) => {
            setRooms((prev) => prev.filter((r) => r._id !== roomId));
            emitToast(`Bạn đã bị xoá khỏi nhóm ${roomName || ''}`.trim(), { type: 'error' });
        };
        on('room:removed', handleRemoved);
        return () => off('room:removed', handleRemoved);
    }, [on, off]);

    // Tự rời nhóm (ChatInfoSidebar): bỏ nhóm khỏi danh sách
    useEffect(() => {
        const handleLeft = (e) => setRooms((prev) => prev.filter((r) => r._id !== e.detail?.roomId));
        window.addEventListener('room:left', handleLeft);
        return () => window.removeEventListener('room:left', handleLeft);
    }, []);

    // Được trưởng/phó nhóm duyệt vào nhóm: tải lại danh sách để thấy nhóm mới
    useEffect(() => {
        const handleApproved = ({ roomName }) => {
            loadRooms();
            emitToast(`Bạn đã được duyệt vào nhóm ${roomName || ''}`.trim(), { type: 'success' });
        };
        on('room:approved', handleApproved);
        return () => off('room:approved', handleApproved);
    }, [on, off]);

    // Listen for new messages (sidebar update + unread badge)
    useEffect(() => {
        const handleNewMessage = ({ roomId: msgRoomId, lastMessage, senderId }) => {
            // Update lastMessage and re-sort rooms
            setRooms((prev) => {
                const idx = prev.findIndex((r) => r._id === msgRoomId);
                if (idx < 0) return prev;
                const updated = [...prev];
                updated[idx] = { ...updated[idx], lastMessage, updatedAt: new Date().toISOString() };
                return updated.sort(
                    (a, b) => new Date(b.lastMessage?.createdAt || b.updatedAt) - new Date(a.lastMessage?.createdAt || a.updatedAt)
                );
            });

            // Increment unread if not active room and not own message
            if (msgRoomId !== activeRoomId && senderId !== user?._id) {
                setUnreadCounts((prev) => ({
                    ...prev,
                    [msgRoomId]: (prev[msgRoomId] || 0) + 1,
                }));

                const targetRoom = roomsRef.current.find((room) => room._id === msgRoomId);
                let roomName = 'cuộc trò chuyện';
                if (targetRoom?.type === 'group') {
                    roomName = targetRoom.name || roomName;
                } else if (targetRoom?.members?.length) {
                    const other = targetRoom.members.find((m) => (m.user?._id || m.user) !== user?._id);
                    const otherUser = other?.user;
                    roomName = targetRoom.nicknames?.[otherUser?._id] || otherUser?.username || roomName;
                }

                const preview = (lastMessage?.content || '').trim();
                const text = preview
                    ? `Tin nhắn mới từ ${roomName}: ${preview.slice(0, 90)}`
                    : `Bạn có tin nhắn mới từ ${roomName}.`;
                emitToast(text, { type: 'message' });
            }
        };

        on('room:new-message', handleNewMessage);
        return () => off('room:new-message', handleNewMessage);
    }, [on, off, activeRoomId, user]);

    const loadRooms = async () => {
        try {
            const { data } = await roomAPI.getAll();
            setRooms(data.rooms || []);
        } catch (err) {
            console.error('Load rooms error:', err);
        } finally {
            setLoading(false);
        }
    };

    const getRoomDisplay = (room) => {
        if (room.type === 'group' || room.type === 'topic' || room.type === 'counseling') {
            return { name: room.name, avatar: room.groupAvatar ? resolveMediaUrl(room.groupAvatar) : null, isGroup: true };
        }
        // Direct: show nickname if set, otherwise the other person's name
        const other = room.members?.find((m) => {
            const uid = m.user?._id || m.user;
            return uid !== user?._id;
        });
        const otherUser = other?.user;
        const otherNickname = otherUser?._id && room.nicknames?.[otherUser._id];
        return {
            name: otherNickname || otherUser?.username || 'Unknown',
            avatar: resolveMediaUrl(otherUser?.avatar || otherUser?.googlePicture),
            isGroup: false,
            otherUserId: otherUser?._id,
        };
    };

    const filtered = useMemo(() => rooms.filter((r) => {
        if (!search) return true;
        const display = getRoomDisplay(r);
        return display.name.toLowerCase().includes(search.toLowerCase());
    }), [rooms, search]);

    const focusSearch = useCallback(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
    }, []);

    const navigateRoomsByShortcut = useCallback((direction) => {
        if (!filtered.length) return;

        const currentIndex = filtered.findIndex((room) => room._id === activeRoomId);
        let nextIndex = currentIndex;

        if (currentIndex < 0) {
            nextIndex = direction === 'up' ? filtered.length - 1 : 0;
        } else {
            nextIndex = direction === 'up'
                ? (currentIndex - 1 + filtered.length) % filtered.length
                : (currentIndex + 1) % filtered.length;
        }

        onSelectRoom(filtered[nextIndex]._id);
    }, [filtered, activeRoomId, onSelectRoom]);

    useEffect(() => {
        const handleFocusSearch = () => focusSearch();
        const handleNavigate = (event) => {
            const direction = event.detail?.direction === 'up' ? 'up' : 'down';
            navigateRoomsByShortcut(direction);
        };

        window.addEventListener('roomlist:focus-search', handleFocusSearch);
        window.addEventListener('roomlist:navigate', handleNavigate);

        return () => {
            window.removeEventListener('roomlist:focus-search', handleFocusSearch);
            window.removeEventListener('roomlist:navigate', handleNavigate);
        };
    }, [focusSearch, navigateRoomsByShortcut]);

    const handleCreated = (newRoom) => {
        setRooms((prev) => [newRoom, ...prev]);
        setShowCreate(false);
        onSelectRoom(newRoom._id);
    };

    const handleDeleteChat = async (roomId, e) => {
        if (e) {
            e.stopPropagation();
        }
        setMenuOpenId(null);
        const ok = await confirmDialog({
            title: 'Xóa cuộc trò chuyện?',
            message: 'Bạn có chắc chắn muốn xóa cuộc trò chuyện này không? Hành động này không thể hoàn tác.',
            confirmText: 'Xóa',
            danger: true,
        });
        if (!ok) return;

        setDeleteLoading(true);
        try {
            await roomAPI.deleteChat(roomId);
            setRooms((prev) => prev.filter((r) => r._id !== roomId));
            if (activeRoomId === roomId) {
                onSelectRoom(null);
            }
        } catch (error) {
            console.error('Lỗi khi xóa cuộc trò chuyện:', error);
            emitToast('Không xóa được cuộc trò chuyện', { type: 'error' });
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-surface border-r border-line">
            {/* Header */}
            <div className="p-4 border-b border-line">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold text-fg">Tin nhắn</h2>
                    <button
                        data-tour="new-chat"
                        onClick={() => setShowCreate(true)}
                        className="p-2 hover:bg-hover rounded-full transition"
                        title="Tạo cuộc trò chuyện"
                    >
                        <Plus size={20} className="text-[var(--color-primary)]" />
                    </button>
                </div>

                {/* Search */}
                <div data-tour="search" className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Tìm kiếm... (Ctrl+K)"
                        className="w-full pl-9 pr-4 py-2 bg-surface-muted rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] transition"
                    />
                </div>
            </div>

            {/* Room List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
                {loading && (
                    <div className="p-4 space-y-3">
                        {Array.from({ length: 6 }).map((_, idx) => (
                            <div key={`room-skeleton-${idx}`} className="flex items-center gap-3 px-1 py-1">
                                <SkeletonBlock className="w-12 h-12 rounded-full shrink-0" />
                                <div className="flex-1 min-w-0 space-y-2">
                                    <SkeletonBlock className="h-3.5 w-32 rounded-md" />
                                    <SkeletonBlock className="h-3 w-48 max-w-full rounded-md" />
                                </div>
                                <SkeletonBlock className="h-3 w-9 rounded-md shrink-0" />
                            </div>
                        ))}
                    </div>
                )}

                {!loading && filtered.length === 0 && (
                    <div className="p-8 text-center text-fg-subtle">
                        <MessageCircle size={40} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Chưa có cuộc trò chuyện nào</p>
                    </div>
                )}

                {filtered.map((room) => {
                    const display = getRoomDisplay(room);
                    const isActive = room._id === activeRoomId;
                    const isOnline = display.otherUserId && onlineUsers.includes(display.otherUserId);
                    const lastMsg = room.lastMessage;
                    const unread = unreadCounts[room._id] || 0;
                    const lastFromMe = lastMsg && String(lastMsg.sender?._id || lastMsg.sender) === user?._id;
                    const lastPreview = !lastMsg
                        ? ''
                        : lastMsg.type === 'system'
                            ? lastMsg.content
                            : lastFromMe
                                ? `Bạn: ${lastMsg.content}`
                                : lastMsg.sender?.username
                                    ? `${lastMsg.sender.username}: ${lastMsg.content}`
                                    : lastMsg.content;

                    return (
                        <div key={room._id} className="relative group px-2">
                            {/* div thay cho button: bên trong có nút 3 chấm, HTML không cho button lồng button */}
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => onSelectRoom(room._id)}
                                onKeyDown={(e) => {
                                    if (e.target !== e.currentTarget) return;
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onSelectRoom(room._id);
                                    }
                                }}
                                className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition text-left cursor-pointer ${
                                    isActive ? 'bg-brand-soft' : 'hover:bg-hover'
                                }`}
                            >
                                {/* Avatar */}
                                <div className="relative shrink-0">
                                    <div
                                        className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg overflow-hidden ${
                                            display.isGroup ? 'bg-purple-500' : 'bg-[var(--color-primary)]'
                                        }`}
                                    >
                                        {display.avatar ? (
                                            <img src={display.avatar} alt={display.name} className="w-full h-full object-cover" />
                                        ) : display.isGroup ? (
                                            <Users size={20} />
                                        ) : (
                                            display.name.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    {isOnline && (
                                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[var(--bg-card)] rounded-full" />
                                    )}
                                </div>

                                {/* Tên + giờ ở dòng trên, tin cuối + số chưa đọc ở dòng dưới */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2">
                                        <span className={`flex-1 truncate text-fg ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>
                                            {display.name}
                                        </span>
                                        {lastMsg && (
                                            <span className={`text-xs whitespace-nowrap shrink-0 ${unread > 0 ? 'text-brand font-semibold' : 'text-fg-subtle'}`}>
                                                {formatShortTime(lastMsg.createdAt)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className={`flex-1 text-sm truncate ${unread > 0 ? 'text-fg font-semibold' : 'text-fg-subtle'}`}>
                                            {lastPreview || '\u00a0'}
                                        </p>
                                        {unread > 0 && (
                                            <span className="bg-[var(--color-primary)] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0">
                                                {unread > 99 ? '99+' : unread}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Nút 3 chấm: hiện khi rê chuột vào phòng hoặc khi menu đang mở */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenId(menuOpenId === room._id ? null : room._id);
                                }}
                                aria-label="Tùy chọn cuộc trò chuyện"
                                className={`absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full border border-line bg-surface text-fg-muted shadow-sm hover:bg-hover transition
                                ${menuOpenId === room._id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
                            >
                                <MoreHorizontal size={16} />
                            </button>

                            {/* Dropdown Menu - Đưa ra ngoài button để tránh lỗi click */}
                            {menuOpenId === room._id && (
                                <div className="absolute right-4 top-[calc(50%+20px)] w-48 bg-surface rounded-lg shadow-xl border border-line py-1 z-50 animate-fade-in">
                                    <button
                                        onClick={(e) => handleDeleteChat(room._id, e)}
                                        disabled={deleteLoading}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition disabled:opacity-50"
                                    >
                                        <Trash2 size={16} />
                                        {deleteLoading ? 'Đang xóa...' : 'Xóa đoạn chat'}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Create Room Modal */}
            {showCreate && (
                <CreateRoomModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
            )}
        </div>
    );
}
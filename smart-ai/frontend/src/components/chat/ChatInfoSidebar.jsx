import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { roomAPI, userActionsAPI, resolveMediaUrl } from '../../services/api';
import { emitToast } from '../../utils/toast';
import { confirmDialog } from '../../utils/confirm';
import MemberList from './MemberList';
import PendingMembers from './PendingMembers';
import NicknameModal from './NicknameModal';
import ReportModal from './ReportModal';
import AddMemberModal from './AddMemberModal';
import InviteLinkModal from './InviteLinkModal';
import OwnerTransferModal from './OwnerTransferModal';
import {
    X, Users, Bell, BellOff, Ban, Flag, UserPlus,
    ChevronDown, ChevronUp, Edit3, Loader2, Crown, Eye, Link2,
} from 'lucide-react';

export default function ChatInfoSidebar({ room, onClose, onRoomUpdate }) {
    const { user } = useAuth();
    const { onlineUsers, on, off } = useSocket();
    const navigate = useNavigate();

    const [muted, setMuted] = useState(false);
    const [blocked, setBlocked] = useState(false);
    const [showMembers, setShowMembers] = useState(true);
    const [showPending, setShowPending] = useState(false);
    const [pendingMembers, setPendingMembers] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);

    // Modals
    const [nicknameTarget, setNicknameTarget] = useState(null);
    const [showReport, setShowReport] = useState(false);
    const [showAddMember, setShowAddMember] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [showOwnerTransfer, setShowOwnerTransfer] = useState(false);

    const isGroup = room?.type === 'group';
    const myMember = room?.members?.find((m) => (m.user?._id || m.user) === user?._id);
    // Trưởng nhóm và phó nhóm: thêm thẳng thành viên, duyệt danh sách chờ, đổi link mời
    const canManage = ['admin', 'deputy'].includes(myMember?.role);

    // For 1-1 chats
    const otherMember = !isGroup
        ? room?.members?.find((m) => (m.user?._id || m.user) !== user?._id)
        : null;
    const otherUser = otherMember?.user;
    // Người hỏi trong phiên tư vấn ẩn danh: server đã che tên và _id
    const isAnonymousPeer = otherUser?._id === 'anonymous';
    const otherIsOnline = otherUser?._id && onlineUsers.includes(otherUser._id);

    // Check initial muted/blocked state
    useEffect(() => {
        if (!room) return;
        setMuted(room.mutedBy?.includes(user?._id) || false);
    }, [room, user]);

    useEffect(() => {
        if (isGroup || !otherUser?._id || isAnonymousPeer) return;
        userActionsAPI.getBlocked().then(({ data }) => {
            const blockedIds = (data.blockedUsers || []).map((u) => u._id || u);
            setBlocked(blockedIds.includes(otherUser._id));
        }).catch(() => { });
    }, [isGroup, otherUser, isAnonymousPeer]);

    // Listen for realtime block/unblock events from the other user
    useEffect(() => {
        if (isGroup || !otherUser?._id) return;
        const handleBlockUpdated = (payload) => {
            if (payload.blockedBy === otherUser._id) {
                // The other user blocked/unblocked us — no change to our "blocked" toggle
                // but we could reflect it in UI if needed
            }
        };
        on('user:block-updated', handleBlockUpdated);
        return () => off('user:block-updated', handleBlockUpdated);
    }, [isGroup, otherUser, on, off]);

    // Listen for realtime nickname updates
    useEffect(() => {
        if (!room?._id) return;
        const handleNicknameUpdated = (payload) => {
            if (payload.roomId === room._id) {
                onRoomUpdate?.({ ...room, nicknames: payload.nicknames });
            }
        };
        on('room:nickname-updated', handleNicknameUpdated);
        return () => off('room:nickname-updated', handleNicknameUpdated);
    }, [room, on, off, onRoomUpdate]);

    // Listen for realtime member changes (thêm, xoá, đổi vai trò)
    useEffect(() => {
        if (!isGroup || !room?._id) return;
        const handleMembersChanged = (payload) => {
            if (payload.roomId === room._id && payload.room) {
                onRoomUpdate?.(payload.room);
            }
        };
        on('room:member-added', handleMembersChanged);
        on('room:members-updated', handleMembersChanged);
        return () => {
            off('room:member-added', handleMembersChanged);
            off('room:members-updated', handleMembersChanged);
        };
    }, [isGroup, room, on, off, onRoomUpdate]);

    // Load pending members for trưởng/phó nhóm, tải lại khi có người xin vào hoặc được duyệt
    const roomId = room?._id;
    useEffect(() => {
        if (!isGroup || !canManage || !roomId) return;
        const loadPending = () => roomAPI.getPending(roomId).then(({ data }) => {
            setPendingMembers(data.pendingMembers || []);
        }).catch(() => { });
        const handlePendingUpdated = (payload) => {
            if (payload.roomId === roomId) loadPending();
        };
        loadPending();
        on('room:pending-updated', handlePendingUpdated);
        return () => off('room:pending-updated', handlePendingUpdated);
    }, [isGroup, canManage, roomId, on, off]);

    // Listen for real-time group settings updates
    useEffect(() => {
        if (!isGroup || !room?._id) return;
        const handleSettingsUpdate = (payload) => {
            if (payload.roomId === room._id) {
                onRoomUpdate?.((prev) => ({
                    ...(typeof prev === 'object' ? prev : room),
                    name: payload.name ?? room.name,
                    description: payload.description ?? room.description,
                    groupAvatar: payload.groupAvatar ?? room.groupAvatar,
                    groupBackground: payload.groupBackground ?? room.groupBackground,
                }));
            }
        };
        on('room:settings-updated', handleSettingsUpdate);
        return () => off('room:settings-updated', handleSettingsUpdate);
    }, [isGroup, room, on, off, onRoomUpdate]);

    const handleToggleMute = async () => {
        setActionLoading('mute');
        try {
            const { data } = await roomAPI.toggleMute(room._id);
            setMuted(data.muted);
        } catch (err) {
            console.error('Toggle mute error:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleBlock = async () => {
        setActionLoading('block');
        try {
            if (blocked) {
                await userActionsAPI.unblock(otherUser._id);
            } else {
                await userActionsAPI.block(otherUser._id);
            }
            setBlocked(!blocked);
        } catch (err) {
            console.error('Toggle block error:', err);
        } finally {
            setActionLoading(null);
        }
    };

    const handleLeave = async (newOwnerId) => {
        if (!newOwnerId && !(await confirmDialog({ title: 'Rời nhóm?', message: 'Bạn sẽ không nhận được tin nhắn của nhóm này nữa.', confirmText: 'Rời nhóm', danger: true }))) return;
        setActionLoading('leave');
        try {
            const { data } = await roomAPI.leave(room._id, newOwnerId ? { newOwnerId } : undefined);
            if (data.requireOwnerTransfer) {
                setShowOwnerTransfer(true);
                return;
            }
            // Báo danh sách phòng bỏ nhóm vừa rời
            window.dispatchEvent(new CustomEvent('room:left', { detail: { roomId: room._id } }));
            onRoomUpdate?.(null);
            onClose();
        } catch (err) {
            if (err.response?.data?.requireOwnerTransfer) {
                setShowOwnerTransfer(true);
            } else {
                console.error('Leave room error:', err);
                emitToast(err.response?.data?.error || 'Không rời nhóm được', { type: 'error' });
            }
        } finally {
            setActionLoading(null);
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!(await confirmDialog({ title: 'Xoá thành viên?', message: 'Người này sẽ bị xoá khỏi nhóm.', confirmText: 'Xoá', danger: true }))) return;
        try {
            const { data } = await roomAPI.removeMember(room._id, userId);
            onRoomUpdate?.(data.room);
        } catch (err) {
            emitToast(err.response?.data?.error || 'Không xoá được thành viên', { type: 'error' });
        }
    };

    const handleSetMemberRole = async (userId, role) => {
        try {
            const { data } = await roomAPI.setMemberRole(room._id, userId, role);
            onRoomUpdate?.(data.room);
        } catch (err) {
            emitToast(err.response?.data?.error || 'Không đổi được vai trò', { type: 'error' });
        }
    };

    const handleNicknameSaved = (targetUserId, nickname) => {
        // Update room nicknames locally
        onRoomUpdate?.({ ...room, nicknames: { ...room.nicknames, [targetUserId]: nickname } });
    };

    const handlePendingApproved = (userId) => {
        setPendingMembers((prev) => prev.filter((m) => (m.user?._id || m._id || m) !== userId));
    };

    const handlePendingRejected = (userId) => {
        setPendingMembers((prev) => prev.filter((m) => (m.user?._id || m._id || m) !== userId));
    };

    if (!room) return null;

    const existingMemberIds = room.members?.map((m) => m.user?._id || m.user) || [];
    const displayName = isGroup
        ? room.name
        : otherUser?.username || 'Unknown';
    const initial = displayName.charAt(0).toUpperCase();

    return (
        <>
            <div className="w-80 shrink-0 bg-app border-l border-line flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="relative flex items-center justify-center px-12 py-3 border-b border-line apple-material">
                    <h3 className="text-[15px] font-semibold text-fg">Thông tin</h3>
                    <button
                        onClick={onClose}
                        aria-label="Đóng"
                        className="absolute right-3 w-[30px] h-[30px] flex items-center justify-center rounded-full bg-field text-fg-subtle hover:text-fg transition"
                    >
                        <X size={16} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Scrollable content: các nhóm thao tác dạng thẻ như Cài đặt iOS */}
                <div className="flex-1 overflow-y-auto pb-6">
                    {/* Profile section */}
                    <div className="px-4 pt-6 pb-5 text-center">
                        <div
                            className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-white text-2xl font-bold cursor-pointer hover:opacity-90 transition overflow-hidden ${isGroup ? 'bg-purple-500' : 'bg-[var(--color-primary)]'}`}
                            onClick={() => {
                                if (isGroup) navigate(`/group/${room._id}`);
                                else if (otherUser?._id && !isAnonymousPeer) navigate(`/profile/${otherUser._id}`);
                            }}
                        >
                            {isGroup ? (
                                room.groupAvatar ? (
                                    <img src={resolveMediaUrl(room.groupAvatar)} alt={displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <Users size={32} />
                                )
                            ) : (otherUser?.avatar || otherUser?.googlePicture) ? (
                                <img src={resolveMediaUrl(otherUser.avatar || otherUser.googlePicture)} alt={displayName} className="w-full h-full object-cover" />
                            ) : (
                                initial
                            )}
                        </div>
                        <h4 className="mt-3 text-xl font-semibold tracking-tight text-fg">{displayName}</h4>
                        {!isGroup && (
                            <p className={`text-sm ${otherIsOnline ? 'text-[#34c759]' : 'text-fg-subtle'}`}>
                                {otherIsOnline ? 'Đang hoạt động' : 'Offline'}
                            </p>
                        )}
                        {isGroup && (
                            <p className="text-sm text-fg-subtle">{room.members?.length || 0} thành viên</p>
                        )}
                    </div>

                    {!isGroup && (
                        <>
                            <div className="mx-3 mb-4 rounded-xl bg-surface overflow-hidden divide-y divide-line">
                                {!isAnonymousPeer && (
                                    <>
                                        <InfoRow icon={Users} color="#007aff" label="Xem trang cá nhân" onClick={() => navigate(`/profile/${otherUser?._id}`)} />
                                        <InfoRow icon={Edit3} color="#ff9500" label="Đặt biệt danh" onClick={() => setNicknameTarget(otherMember)} />
                                    </>
                                )}
                                <InfoRow
                                    icon={muted ? BellOff : Bell}
                                    color="#ff3b30"
                                    label={muted ? 'Bật thông báo' : 'Tắt thông báo'}
                                    onClick={handleToggleMute}
                                    disabled={actionLoading === 'mute'}
                                    loading={actionLoading === 'mute'}
                                />
                            </div>

                            <div className="mx-3 mb-4 rounded-xl bg-surface overflow-hidden divide-y divide-line">
                                {!isAnonymousPeer && (
                                    <InfoRow
                                        icon={Ban}
                                        color="#8e8e93"
                                        label={blocked ? 'Bỏ chặn' : 'Chặn'}
                                        onClick={handleToggleBlock}
                                        disabled={actionLoading === 'block'}
                                        loading={actionLoading === 'block'}
                                        danger={!blocked}
                                    />
                                )}
                                {/* Report — với người hỏi ẩn danh, server tự tra tài khoản thật để admin xử lý */}
                                <InfoRow icon={Flag} color="#ff3b30" label="Báo cáo" onClick={() => setShowReport(true)} danger />
                            </div>
                        </>
                    )}

                    {isGroup && (
                        <>
                            {/* Group actions */}
                            <div className="mx-3 mb-4 rounded-xl bg-surface overflow-hidden divide-y divide-line">
                                <InfoRow icon={Eye} color="#007aff" label="Xem chi tiết nhóm" onClick={() => navigate(`/group/${room._id}`)} />
                                <InfoRow icon={UserPlus} color="#34c759" label={canManage ? 'Thêm thành viên' : 'Mời thành viên'} onClick={() => setShowAddMember(true)} />
                                <InfoRow icon={Link2} color="#5856d6" label="Link mời vào nhóm" onClick={() => setShowInvite(true)} />
                                <InfoRow icon={Edit3} color="#ff9500" label="Đặt biệt danh" onClick={() => setNicknameTarget(myMember)} />
                                <InfoRow
                                    icon={muted ? BellOff : Bell}
                                    color="#ff3b30"
                                    label={muted ? 'Bật thông báo' : 'Tắt thông báo'}
                                    onClick={handleToggleMute}
                                    disabled={actionLoading === 'mute'}
                                    loading={actionLoading === 'mute'}
                                />
                            </div>

                            <div className="mx-3 mb-4 rounded-xl bg-surface overflow-hidden">
                                <button
                                    onClick={() => setShowMembers(!showMembers)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 text-[15px] font-semibold text-fg hover:bg-hover transition"
                                >
                                    <span>Thành viên ({room.members?.length || 0})</span>
                                    {showMembers ? <ChevronUp size={16} className="text-fg-subtle" /> : <ChevronDown size={16} className="text-fg-subtle" />}
                                </button>
                                {showMembers && (
                                    <div className="px-1 pb-1 border-t border-line">
                                        <MemberList
                                            members={room.members || []}
                                            nicknames={room.nicknames}
                                            myRole={myMember?.role}
                                            onSetNickname={(member) => setNicknameTarget(member)}
                                            onRemoveMember={handleRemoveMember}
                                            onSetRole={handleSetMemberRole}
                                        />
                                    </div>
                                )}
                            </div>

                            {canManage && (
                                <div className="mx-3 mb-4 rounded-xl bg-surface overflow-hidden">
                                    <button
                                        onClick={() => setShowPending(!showPending)}
                                        className="w-full flex items-center justify-between px-3 py-2.5 text-[15px] font-semibold text-fg hover:bg-hover transition"
                                    >
                                        <span>Chờ duyệt ({pendingMembers.length})</span>
                                        {showPending ? <ChevronUp size={16} className="text-fg-subtle" /> : <ChevronDown size={16} className="text-fg-subtle" />}
                                    </button>
                                    {showPending && (
                                        <div className="px-2 py-2 border-t border-line">
                                            <PendingMembers
                                                roomId={room._id}
                                                pendingMembers={pendingMembers}
                                                onApproved={handlePendingApproved}
                                                onRejected={handlePendingRejected}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Leave group: dòng đỏ riêng ở cuối như iOS */}
                            <div className="mx-3 rounded-xl bg-surface overflow-hidden">
                                <button
                                    onClick={() => handleLeave()}
                                    disabled={actionLoading === 'leave'}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-[15px] text-[#ff3b30] hover:bg-hover transition disabled:opacity-50"
                                >
                                    {actionLoading === 'leave' && <Loader2 size={16} className="animate-spin" />}
                                    Rời nhóm
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {nicknameTarget && (
                <NicknameModal
                    roomId={room._id}
                    targetUser={nicknameTarget.user || nicknameTarget}
                    currentNickname={
                        room.nicknames?.get?.(nicknameTarget.user?._id || nicknameTarget._id) ||
                        room.nicknames?.[nicknameTarget.user?._id || nicknameTarget._id] || ''
                    }
                    onClose={() => setNicknameTarget(null)}
                    onSaved={handleNicknameSaved}
                />
            )}

            {showReport && (
                <ReportModal
                    reportedUserId={otherUser?._id}
                    roomId={room._id}
                    onClose={() => setShowReport(false)}
                />
            )}

            {showAddMember && (
                <AddMemberModal
                    roomId={room._id}
                    existingMemberIds={existingMemberIds}
                    canAddDirectly={canManage}
                    onClose={() => setShowAddMember(false)}
                    onAdded={(updatedRoom) => {
                        if (updatedRoom) {
                            onRoomUpdate?.(updatedRoom);
                        }
                        setShowAddMember(false);
                    }}
                />
            )}

            {showInvite && (
                <InviteLinkModal
                    roomId={room._id}
                    canReset={canManage}
                    onClose={() => setShowInvite(false)}
                />
            )}

            {showOwnerTransfer && (
                <OwnerTransferModal
                    members={room.members || []}
                    currentUserId={user?._id}
                    onTransfer={(newOwnerId) => {
                        setShowOwnerTransfer(false);
                        handleLeave(newOwnerId);
                    }}
                    onClose={() => setShowOwnerTransfer(false)}
                />
            )}
        </>
    );
}

// Một dòng thao tác kiểu Cài đặt iOS: ô vuông màu có biểu tượng trắng + nhãn
function InfoRow({ icon, color, label, onClick, disabled = false, loading = false, danger = false }) {
    const Glyph = icon;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center gap-3 px-3 py-2 text-[15px] text-left hover:bg-hover transition disabled:opacity-50 ${danger ? 'text-[#ff3b30]' : 'text-fg'}`}
        >
            <span className="w-7 h-7 shrink-0 rounded-[7px] flex items-center justify-center text-white" style={{ backgroundColor: color }}>
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Glyph size={15} />}
            </span>
            <span className="flex-1">{label}</span>
        </button>
    );
}

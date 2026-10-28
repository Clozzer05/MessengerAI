import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Stethoscope, Inbox, ClipboardList, Loader2, Clock } from 'lucide-react';
import { counselingAPI, resolveMediaUrl } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { emitToast } from '../utils/toast';
import { useSocket } from '../hooks/useSocket';

const CATEGORY_LABEL = {
    tam_ly: 'Tâm lý',
    phap_luat: 'Pháp luật',
    bao_luc_gia_dinh: 'Bạo lực gia đình',
    suc_khoe: 'Sức khỏe',
    giao_duc: 'Giáo dục',
};

const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} giờ trước`;
    return d.toLocaleDateString('vi-VN');
};

export default function ExpertCounselingPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { on, off } = useSocket();

    const [pending, setPending] = useState([]);
    const [mine, setMine] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('pending');
    const [claimingId, setClaimingId] = useState(null);
    const myCatsRef = useRef(user?.expertCategories || []);

    const isExpert = user?.role === 'expert';

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const [pRes, mRes] = await Promise.all([
                counselingAPI.expertPending(),
                counselingAPI.expertMine(),
            ]);
            setPending(pRes.data.sessions || []);
            setMine(mRes.data.sessions || []);
        } catch (err) {
            console.error('[Expert] load failed', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isExpert) return;
        reload();
    }, [isExpert, reload]);

    // Realtime: new session pending or session removed (claimed by another expert)
    useEffect(() => {
        if (!isExpert) return;
        const handleAdded = ({ session }) => {
            if (!session) return;
            const myCats = myCatsRef.current;
            if (myCats?.length && !myCats.includes(session.category)) return;
            setPending(prev => prev.some(s => s._id === session._id) ? prev : [session, ...prev]);
        };
        const handleRemoved = ({ sessionId }) => {
            setPending(prev => prev.filter(s => s._id !== sessionId));
        };
        on('counseling:pending-added', handleAdded);
        on('counseling:pending-removed', handleRemoved);
        return () => {
            off('counseling:pending-added', handleAdded);
            off('counseling:pending-removed', handleRemoved);
        };
    }, [isExpert, on, off]);

    const handleClaim = async (sessionId) => {
        if (claimingId) return;
        setClaimingId(sessionId);
        try {
            const { data } = await counselingAPI.joinExpert(sessionId);
            const roomId = data.roomId || data.session?.room?._id || data.session?.room;
            // Move session from pending to mine locally
            setPending(prev => prev.filter(s => s._id !== sessionId));
            if (data.session) setMine(prev => [data.session, ...prev]);
            if (roomId) navigate('/', { state: { roomId } });
        } catch (err) {
            const msg = err.response?.data?.error || 'Không thể nhận phiên tư vấn';
            emitToast(msg, { type: 'error' });
        } finally {
            setClaimingId(null);
        }
    };

    const handleOpen = (session) => {
        const roomId = session.room?._id || session.room;
        if (roomId) navigate('/', { state: { roomId } });
    };

    if (!isExpert) {
        return (
            <div className="h-dvh flex flex-col items-center justify-center theme-muted-surface">
                <Stethoscope size={48} className="text-fg-subtle mb-4" />
                <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Chỉ chuyên gia mới truy cập được</h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Tài khoản của bạn không có quyền truy cập trang này.</p>
                <button onClick={() => navigate('/')} className="btn btn-primary">Về trang chủ</button>
            </div>
        );
    }

    const list = tab === 'pending' ? pending : mine;

    return (
        <div className="h-dvh flex flex-col theme-muted-surface font-sans">
            <div className="h-14 border-b px-4 flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <ArrowLeft size={16} /> Quay lại
                </button>
                <div className="inline-flex items-center gap-2 font-semibold" style={{ color: 'var(--color-primary)' }}>
                    <Stethoscope size={18} /> Bảng điều khiển chuyên gia
                </div>
                <button
                    onClick={reload}
                    className="text-xs px-3 py-1 rounded-full border hover:bg-hover transition"
                    style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                >
                    Làm mới
                </button>
            </div>

            <div className="px-4 pt-4 shrink-0">
                <div className="max-w-4xl mx-auto flex gap-2">
                    <button
                        onClick={() => setTab('pending')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${tab === 'pending' ? 'bg-brand text-white' : 'bg-surface text-fg-muted border border-line hover:bg-hover'}`}
                    >
                        <Inbox size={15} /> Đang chờ
                        <span className={`px-2 py-0.5 rounded-full text-xs ${tab === 'pending' ? 'bg-white/20' : 'bg-brand-medium text-brand-strong'}`}>{pending.length}</span>
                    </button>
                    <button
                        onClick={() => setTab('mine')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${tab === 'mine' ? 'bg-brand text-white' : 'bg-surface text-fg-muted border border-line hover:bg-hover'}`}
                    >
                        <ClipboardList size={15} /> Đang phụ trách
                        <span className={`px-2 py-0.5 rounded-full text-xs ${tab === 'mine' ? 'bg-white/20' : 'bg-surface-muted text-fg-muted'}`}>{mine.length}</span>
                    </button>
                </div>
                <p className="max-w-4xl mx-auto mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {user?.expertCategories?.length
                        ? `Lĩnh vực của bạn: ${user.expertCategories.map(k => CATEGORY_LABEL[k] || k).join(', ')}`
                        : 'Bạn chưa được giao lĩnh vực nào nên chưa nhận được phiên tư vấn. Hãy liên hệ Super Admin.'}
                </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
                <div className="max-w-4xl mx-auto space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-fg-subtle">
                            <Loader2 size={20} className="animate-spin mr-2" /> Đang tải...
                        </div>
                    ) : list.length === 0 ? (
                        <div className="text-center py-20" style={{ color: 'var(--text-tertiary)' }}>
                            {tab === 'pending' ? 'Chưa có phiên nào đang chờ.' : 'Bạn chưa phụ trách phiên nào.'}
                        </div>
                    ) : (
                        list.map(session => {
                            const u = session.user || {};
                            const avatarUrl = resolveMediaUrl(u.avatar || u.googlePicture);
                            return (
                                <div key={session._id} className="bg-surface rounded-2xl p-4 flex items-center gap-3 transition">
                                    <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center text-white font-bold overflow-hidden shrink-0">
                                        {avatarUrl ? <img src={avatarUrl} alt={u.username} className="w-full h-full object-cover" /> : session.isAnonymous ? '?' : (u.username || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="font-medium text-fg truncate">{session.isAnonymous ? 'Người dùng ẩn danh' : (u.username || 'Người dùng')}</span>
                                            <span className="px-2 py-0.5 text-xs rounded-full bg-brand-soft text-brand-strong border border-brand-medium">{CATEGORY_LABEL[session.category] || session.category}</span>
                                        </div>
                                        <div className="text-sm text-fg-subtle truncate">{session.title || session.room?.name || 'Phiên tư vấn'}</div>
                                        <div className="text-xs text-fg-subtle flex items-center gap-1 mt-0.5">
                                            <Clock size={11} /> {formatTime(session.createdAt || session.updatedAt)}
                                        </div>
                                    </div>
                                    {tab === 'pending' ? (
                                        <button
                                            onClick={() => handleClaim(session._id)}
                                            disabled={claimingId === session._id}
                                            className="px-4 py-2 rounded-full bg-brand hover:bg-brand-hover text-white text-sm font-semibold shadow disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
                                        >
                                            {claimingId === session._id ? <Loader2 size={14} className="animate-spin" /> : <Stethoscope size={14} />}
                                            Nhận tư vấn
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleOpen(session)}
                                            className="px-4 py-2 rounded-full bg-surface-muted hover:bg-hover text-fg-muted text-sm font-semibold transition"
                                        >
                                            Mở chat
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

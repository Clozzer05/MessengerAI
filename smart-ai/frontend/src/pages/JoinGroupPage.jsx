import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, Loader2, Clock, LinkIcon } from 'lucide-react';
import { roomAPI, resolveMediaUrl } from '../services/api';

// Trang mở từ link mời nhóm (/join/:code): xem trước nhóm rồi gửi yêu cầu tham gia để trưởng/phó nhóm duyệt
export default function JoinGroupPage() {
    const { code } = useParams();
    const navigate = useNavigate();
    const [info, setInfo] = useState(null); // { room, status: 'member' | 'pending' | 'none' }
    const [error, setError] = useState('');
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        roomAPI.previewInvite(code)
            .then(({ data }) => setInfo(data))
            .catch((err) => setError(err.response?.data?.error || 'Link mời không hợp lệ'));
    }, [code]);

    const handleJoin = async () => {
        setJoining(true);
        try {
            const { data } = await roomAPI.joinByInvite(code);
            setInfo((prev) => ({ ...prev, status: data.status }));
        } catch (err) {
            setError(err.response?.data?.error || 'Không gửi được yêu cầu tham gia');
        } finally {
            setJoining(false);
        }
    };

    const room = info?.room;
    const avatar = room?.groupAvatar ? resolveMediaUrl(room.groupAvatar) : null;

    return (
        <div className="h-dvh flex items-center justify-center theme-muted-surface px-4">
            <div className="w-full max-w-sm rounded-2xl p-6 text-center shadow-sm border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
                {error ? (
                    <>
                        <LinkIcon size={40} className="mx-auto mb-3 text-fg-subtle" />
                        <p className="text-sm mb-5" style={{ color: 'var(--text-primary)' }}>{error}</p>
                    </>
                ) : !info ? (
                    <Loader2 size={24} className="mx-auto my-8 animate-spin text-[var(--color-primary)]" />
                ) : (
                    <>
                        <div className="w-20 h-20 rounded-full mx-auto mb-3 bg-purple-500 flex items-center justify-center text-white overflow-hidden">
                            {avatar ? <img src={avatar} alt={room.name} className="w-full h-full object-cover" /> : <Users size={32} />}
                        </div>
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{room.name}</h2>
                        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>{room.memberCount} thành viên</p>

                        {info.status === 'member' && (
                            <>
                                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Bạn đã ở trong nhóm này.</p>
                                <button
                                    onClick={() => navigate('/', { state: { roomId: room._id } })}
                                    className="w-full py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition"
                                >
                                    Mở nhóm
                                </button>
                            </>
                        )}
                        {info.status === 'pending' && (
                            <p className="flex items-center justify-center gap-2 text-sm mb-4 text-yellow-600">
                                <Clock size={16} /> Đã gửi yêu cầu, chờ trưởng nhóm hoặc phó nhóm duyệt.
                            </p>
                        )}
                        {info.status === 'none' && (
                            <button
                                onClick={handleJoin}
                                disabled={joining}
                                className="w-full py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {joining && <Loader2 size={16} className="animate-spin" />}
                                Xin vào nhóm
                            </button>
                        )}
                    </>
                )}
                {info?.status !== 'member' && (
                    <button onClick={() => navigate('/')} className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Về trang chủ
                    </button>
                )}
            </div>
        </div>
    );
}

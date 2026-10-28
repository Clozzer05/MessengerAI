import { useState, useEffect } from 'react';
import { X, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import { roomAPI } from '../../services/api';
import { emitToast } from '../../utils/toast';

// Link mời vào nhóm: ai mở link cũng phải chờ trưởng/phó nhóm duyệt; trưởng/phó nhóm đổi được link
export default function InviteLinkModal({ roomId, canReset, onClose }) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [resetting, setResetting] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        roomAPI.getInvite(roomId)
            .then(({ data }) => setCode(data.inviteCode))
            .catch((err) => emitToast(err.response?.data?.error || 'Không lấy được link mời', { type: 'error' }))
            .finally(() => setLoading(false));
    }, [roomId]);

    const link = code ? `${window.location.origin}/join/${code}` : '';

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            emitToast('Không sao chép được, hãy chọn và sao chép link thủ công', { type: 'error' });
        }
    };

    const handleReset = async () => {
        if (!confirm('Tạo link mới? Link cũ sẽ không dùng được nữa.')) return;
        setResetting(true);
        try {
            const { data } = await roomAPI.resetInvite(roomId);
            setCode(data.inviteCode);
            emitToast('Đã tạo link mời mới', { type: 'success' });
        } catch (err) {
            emitToast(err.response?.data?.error || 'Không đổi được link mời', { type: 'error' });
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-surface rounded-2xl w-full max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                    <h3 className="font-semibold text-fg">Link mời vào nhóm</h3>
                    <button onClick={onClose} className="p-1 hover:bg-hover rounded-full transition">
                        <X size={18} />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-3">
                    <p className="text-xs text-fg-subtle">Người mở link sẽ gửi yêu cầu tham gia, trưởng nhóm hoặc phó nhóm duyệt mới được vào nhóm.</p>
                    {loading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 size={20} className="animate-spin text-[var(--color-primary)]" />
                        </div>
                    ) : link && (
                        <>
                            <input
                                readOnly
                                value={link}
                                onFocus={(e) => e.target.select()}
                                className="w-full px-3 py-2 border border-line rounded-xl text-sm text-fg-muted bg-app focus:outline-none"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCopy}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition"
                                >
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                    {copied ? 'Đã sao chép' : 'Sao chép link'}
                                </button>
                                {canReset && (
                                    <button
                                        onClick={handleReset}
                                        disabled={resetting}
                                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-line text-sm text-fg-muted hover:bg-hover transition disabled:opacity-50"
                                        title="Tạo link mới, link cũ hết hiệu lực"
                                    >
                                        {resetting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                        Đổi link
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

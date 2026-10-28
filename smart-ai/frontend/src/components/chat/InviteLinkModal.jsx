import { useState, useEffect } from 'react';
import { Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import { roomAPI } from '../../services/api';
import { emitToast } from '../../utils/toast';
import { confirmDialog } from '../../utils/confirm';
import Modal from '../ui/Modal';

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
        if (!(await confirmDialog({ title: 'Tạo link mới?', message: 'Link cũ sẽ không dùng được nữa.', confirmText: 'Tạo link mới' }))) return;
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
        <Modal title="Link mời vào nhóm" onClose={onClose} size="sm">
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
                                className="btn btn-primary flex-1"
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
        </Modal>
    );
}

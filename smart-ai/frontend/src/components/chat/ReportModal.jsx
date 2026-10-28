import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { userActionsAPI } from '../../services/api';
import Modal from '../ui/Modal';

const REASONS = [
    { value: 'spam', label: 'Spam' },
    { value: 'harassment', label: 'Quấy rối' },
    { value: 'hate_speech', label: 'Ngôn ngữ thù ghét' },
    { value: 'violence', label: 'Bạo lực' },
    { value: 'inappropriate_content', label: 'Nội dung không phù hợp' },
    { value: 'impersonation', label: 'Mạo danh' },
    { value: 'other', label: 'Khác' },
];

// message (tuỳ chọn): khi có thì đây là báo cáo một tin nhắn cụ thể
export default function ReportModal({ reportedUserId, roomId, message, onClose }) {
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [description, setDescription] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason) return;
        setSending(true);
        setError('');
        try {
            await userActionsAPI.report({ reportedUserId, roomId, messageId: message?._id, reason, description: description.trim() });
            setSent(true);
        } catch (err) {
            setError(err.response?.data?.error || 'Gửi báo cáo thất bại. Vui lòng thử lại.');
        } finally {
            setSending(false);
        }
    };

    if (sent) {
        return (
            <Modal onClose={onClose} size="sm">
                <div className="p-6 text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-green-600 text-xl">✓</span>
                    </div>
                    <p className="font-semibold text-fg mb-1">Đã gửi báo cáo</p>
                    <p className="text-sm text-fg-subtle mb-4">Cảm ơn bạn đã báo cáo. Chúng tôi sẽ xem xét.</p>
                    <button onClick={onClose} className="btn btn-primary px-6">
                        Đóng
                    </button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            title={(
                <span className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-500" />
                    {message ? 'Báo cáo tin nhắn' : 'Báo cáo người dùng'}
                </span>
            )}
            onClose={onClose}
            size="sm"
        >
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {message && (
                    <div className="border-l-2 border-red-300 pl-3 text-sm text-fg-muted break-words line-clamp-3">
                        {message.type === 'text' ? message.content : `[${message.type === 'image' ? 'Hình ảnh' : 'Tệp đính kèm'}] ${message.file?.name || ''}`}
                    </div>
                )}
                <div>
                    <label className="text-sm font-medium text-fg-muted block mb-2">Lý do báo cáo</label>
                    <div className="space-y-2">
                        {REASONS.map((r) => (
                            <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="reason"
                                    value={r.value}
                                    checked={reason === r.value}
                                    onChange={() => setReason(r.value)}
                                    className="accent-blue-600"
                                />
                                <span className="text-sm text-fg-muted">{r.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium text-fg-muted block mb-1">Mô tả thêm (tuỳ chọn)</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Mô tả chi tiết vấn đề..."
                        rows={3}
                        maxLength={500}
                        className="w-full px-4 py-2.5 border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-transparent resize-none"
                    />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-secondary flex-1"
                    >
                        Huỷ
                    </button>
                    <button
                        type="submit"
                        disabled={!reason || sending}
                        className="btn btn-danger flex-1"
                    >
                        {sending && <Loader2 size={14} className="animate-spin" />}
                        Gửi báo cáo
                    </button>
                </div>
            </form>
        </Modal>
    );
}

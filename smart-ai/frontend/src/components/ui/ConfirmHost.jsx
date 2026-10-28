import { useEffect, useState } from 'react';
import Modal from './Modal';

// Hiển thị hộp xác nhận gửi từ confirmDialog() (utils/confirm.js), dạng hộp cảnh báo của iOS
export default function ConfirmHost() {
    const [request, setRequest] = useState(null);

    useEffect(() => {
        const handleConfirm = (event) => {
            setRequest((prev) => {
                prev?.resolve(false);
                return event.detail;
            });
        };
        window.addEventListener('app:confirm', handleConfirm);
        return () => window.removeEventListener('app:confirm', handleConfirm);
    }, []);

    if (!request) return null;

    const answer = (value) => {
        request.resolve(value);
        setRequest(null);
    };

    return (
        <Modal onClose={() => answer(false)} size="alert">
            <div className="px-4 pt-5 pb-4 text-center">
                <h3 className="text-[17px] font-semibold text-fg">{request.title || 'Xác nhận'}</h3>
                {request.message && (
                    <p className="mt-1 text-[13px] leading-snug text-fg-muted whitespace-pre-line">{request.message}</p>
                )}
            </div>
            <div className="flex border-t border-line">
                <button
                    type="button"
                    onClick={() => answer(false)}
                    className="flex-1 py-3 text-[17px] text-brand hover:bg-hover transition-colors"
                >
                    {request.cancelText || 'Hủy'}
                </button>
                <button
                    type="button"
                    autoFocus
                    onClick={() => answer(true)}
                    className={`flex-1 py-3 text-[17px] font-semibold border-l border-line hover:bg-hover transition-colors ${request.danger ? 'text-[#ff3b30]' : 'text-brand'}`}
                >
                    {request.confirmText || 'Đồng ý'}
                </button>
            </div>
        </Modal>
    );
}

import { useEffect, useState } from 'react';
import Modal from './Modal';

// Hiển thị hộp xác nhận gửi từ confirmDialog() (utils/confirm.js)
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
        <Modal
            title={request.title || 'Xác nhận'}
            onClose={() => answer(false)}
            size="sm"
            footer={(
                <>
                    <button type="button" onClick={() => answer(false)} className="btn btn-secondary flex-1">
                        {request.cancelText || 'Hủy'}
                    </button>
                    <button
                        type="button"
                        autoFocus
                        onClick={() => answer(true)}
                        className={`btn flex-1 ${request.danger ? 'btn-danger' : 'btn-primary'}`}
                    >
                        {request.confirmText || 'Đồng ý'}
                    </button>
                </>
            )}
        >
            {request.message && <p className="px-5 py-4 text-sm text-fg-muted whitespace-pre-line">{request.message}</p>}
        </Modal>
    );
}

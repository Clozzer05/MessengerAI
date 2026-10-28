import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

// Khung modal dùng chung cho cả app: nền phủ, bo góc, tiêu đề + nút đóng, Esc hoặc bấm ra ngoài để đóng.
// Render qua portal để không bị lệch vị trí khi nằm trong phần tử có transform (tin nhắn, sidebar...).
export default function Modal({ title, onClose, children, footer, size = 'md', className = '' }) {
    const panelRef = useRef(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onCloseRef.current?.();
        };
        document.addEventListener('keydown', handleKey);
        // Đưa focus vào modal để đọc màn hình và phím Tab bắt đầu từ đây
        if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
        return () => document.removeEventListener('keydown', handleKey);
    }, []);

    return createPortal(
        <div
            className="modal-overlay fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={typeof title === 'string' ? title : undefined}
                tabIndex={-1}
                className={`modal-panel w-full ${SIZES[size] || SIZES.md} max-h-[85vh] flex flex-col overflow-hidden rounded-2xl border border-line bg-surface text-fg shadow-xl outline-none ${className}`}
            >
                {title && (
                    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line shrink-0">
                        <h3 className="text-base font-semibold text-fg truncate">{title}</h3>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Đóng"
                            className="p-1.5 -mr-1.5 rounded-full text-fg-subtle hover:bg-hover hover:text-fg transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}
                <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
                {footer && <div className="flex gap-3 px-5 py-4 border-t border-line shrink-0">{footer}</div>}
            </div>
        </div>,
        document.body
    );
}

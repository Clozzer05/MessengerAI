import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, MessageCircle } from 'lucide-react';

function ToastIcon({ type }) {
    if (type === 'success') return <CheckCircle2 size={18} className="text-emerald-500" />;
    if (type === 'error') return <AlertCircle size={18} className="text-red-500" />;
    if (type === 'message') return <MessageCircle size={18} className="text-[var(--color-primary)]" />;
    return <Info size={18} className="text-[var(--color-primary)]" />;
}

export default function ToastViewport() {
    const [toasts, setToasts] = useState([]);

    const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    useEffect(() => {
        const handleToast = (event) => {
            const payload = event.detail || {};
            const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const toast = {
                id,
                message: payload.message,
                type: payload.type || 'info',
                duration: Number(payload.duration) || 2800,
            };

            setToasts((prev) => [...prev, toast]);
            window.setTimeout(() => dismissToast(id), toast.duration);
        };

        window.addEventListener('app:toast', handleToast);
        return () => window.removeEventListener('app:toast', handleToast);
    }, [dismissToast]);

    return (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[120] flex w-[min(92vw,380px)] flex-col gap-2 pointer-events-none">
            <AnimatePresence initial={false}>
                {toasts.map((toast) => (
                    <motion.div
                        key={toast.id}
                        layout
                        initial={{ opacity: 0, y: -16, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -12, scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="pointer-events-auto apple-material rounded-2xl px-4 py-3 text-fg shadow-lg"
                        role="status"
                        aria-live="polite"
                    >
                        <div className="flex items-start gap-2.5">
                            <ToastIcon type={toast.type} />
                            <p className="text-[15px] leading-snug">{toast.message}</p>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

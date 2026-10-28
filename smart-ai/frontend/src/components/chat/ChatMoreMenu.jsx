import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Bot, Sparkles, CheckSquare, BarChart3, Building2, House } from 'lucide-react';
import { SwitchTrack } from '../ui/Switch';

// Nút "..." trên header khung chat: gom các thao tác ít dùng để header chỉ còn gọi, video, thông tin
export default function ChatMoreMenu({
    aiEnabled,
    onToggleAI,
    onSummarize,
    selectionMode,
    onToggleSelection,
    onCreatePoll,
    onOpenOffice,
    onGoHome,
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handleMouseDown = (e) => {
            if (!rootRef.current?.contains(e.target)) setOpen(false);
        };
        const handleKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    const items = [
        { icon: Bot, label: 'AI Bot', onClick: () => onToggleAI(!aiEnabled), switchOn: aiEnabled },
        aiEnabled && { icon: Sparkles, label: 'Tóm tắt cuộc trò chuyện', onClick: onSummarize },
        { icon: CheckSquare, label: selectionMode ? 'Thoát chọn nhiều tin' : 'Chọn nhiều tin nhắn', onClick: onToggleSelection },
        { icon: BarChart3, label: 'Tạo bình chọn', onClick: onCreatePoll },
        { icon: Building2, label: 'Mở SkyOffice', onClick: onOpenOffice },
        { icon: House, label: 'Về trang chủ', onClick: onGoHome },
    ].filter(Boolean);

    return (
        <div ref={rootRef} className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label="Thêm tùy chọn"
                aria-expanded={open}
                title="Thêm tùy chọn"
                className={`relative w-10 h-10 flex items-center justify-center rounded-full text-brand transition ${open ? 'bg-brand-soft' : 'hover:bg-hover'}`}
            >
                <MoreHorizontal size={20} />
                {aiEnabled && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-500 ring-2 ring-[var(--bg-card)]" />
                )}
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute right-0 top-full mt-1 w-60 z-40 rounded-[14px] apple-material py-1.5 shadow-xl ring-1 ring-black/5 animate-fade-in"
                >
                    {items.map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                item.onClick?.();
                                setOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-fg hover:bg-hover transition"
                        >
                            <item.icon size={18} className="text-fg-muted shrink-0" />
                            <span className="flex-1 text-left">{item.label}</span>
                            {item.switchOn !== undefined && (
                                <SwitchTrack checked={item.switchOn} size="sm" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

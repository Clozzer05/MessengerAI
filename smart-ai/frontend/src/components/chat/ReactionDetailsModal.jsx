import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { resolveMediaUrl } from '../../services/api';

// Ai đã thả cảm xúc (giống Messenger): tab "Tất cả" và từng emoji; bấm vào dòng của mình để gỡ
export default function ReactionDetailsModal({ reactions, members, nicknames, myId, onRemove, onClose }) {
    const [tab, setTab] = useState('all');

    const counts = reactions.reduce((acc, r) => ({ ...acc, [r.emoji]: (acc[r.emoji] || 0) + 1 }), {});
    const emojiTabs = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const activeTab = tab === 'all' || counts[tab] ? tab : 'all';

    const rows = reactions
        .filter((r) => activeTab === 'all' || r.emoji === activeTab)
        .map((r) => {
            const id = String(r.user?._id || r.user);
            const u = members?.find((m) => String(m.user?._id || m.user) === id)?.user;
            return {
                id,
                emoji: r.emoji,
                isMe: id === myId,
                name: nicknames?.[id] || u?.username || 'Người dùng',
                avatar: u?.avatar || u?.googlePicture,
            };
        })
        .sort((a, b) => Number(b.isMe) - Number(a.isMe));

    const tabClass = (key) => `px-3 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === key
        ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
    }`;

    return createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
            <div
                className="w-full max-w-sm rounded-2xl shadow-xl overflow-hidden"
                style={{ backgroundColor: 'var(--bg-card)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Cảm xúc về tin nhắn</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--bg-hover)] transition" style={{ color: 'var(--text-secondary)' }}>
                        <X size={18} />
                    </button>
                </div>

                <div className="flex overflow-x-auto px-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                    <button onClick={() => setTab('all')} className={tabClass('all')}>Tất cả {reactions.length}</button>
                    {emojiTabs.map(([emoji, count]) => (
                        <button key={emoji} onClick={() => setTab(emoji)} className={tabClass(emoji)}>
                            <span className="text-base">{emoji}</span> {count}
                        </button>
                    ))}
                </div>

                <div className="max-h-80 overflow-y-auto py-1">
                    {rows.map((row) => (
                        <button
                            key={row.id}
                            type="button"
                            disabled={!row.isMe}
                            onClick={() => onRemove(row.emoji)}
                            className="w-full flex items-center gap-3 px-4 py-2 text-left enabled:hover:bg-[var(--bg-hover)] transition disabled:cursor-default"
                        >
                            <div className="w-9 h-9 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-sm font-semibold overflow-hidden shrink-0">
                                {row.avatar
                                    ? <img src={resolveMediaUrl(row.avatar)} alt={row.name} className="w-full h-full object-cover" />
                                    : row.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                    {row.isMe ? 'Bạn' : row.name}
                                </p>
                                {row.isMe && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Nhấn để gỡ</p>}
                            </div>
                            <span className="text-2xl leading-none">{row.emoji}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}

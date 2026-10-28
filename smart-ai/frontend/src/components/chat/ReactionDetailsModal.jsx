import { useState } from 'react';
import { resolveMediaUrl } from '../../services/api';
import Modal from '../ui/Modal';

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
        ? 'border-brand text-brand'
        : 'border-transparent text-fg-muted hover:text-fg'
    }`;

    return (
        <Modal title="Cảm xúc về tin nhắn" onClose={onClose} size="sm">

            <div className="flex overflow-x-auto px-2 border-b border-line">
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
                        className="w-full flex items-center gap-3 px-4 py-2 text-left enabled:hover:bg-hover transition disabled:cursor-default"
                    >
                        <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white text-sm font-semibold overflow-hidden shrink-0">
                            {row.avatar
                                ? <img src={resolveMediaUrl(row.avatar)} alt={row.name} className="w-full h-full object-cover" />
                                : row.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-fg truncate">
                                {row.isMe ? 'Bạn' : row.name}
                            </p>
                            {row.isMe && <p className="text-xs text-fg-muted">Nhấn để gỡ</p>}
                        </div>
                        <span className="text-2xl leading-none">{row.emoji}</span>
                    </button>
                ))}
            </div>
        </Modal>
    );
}

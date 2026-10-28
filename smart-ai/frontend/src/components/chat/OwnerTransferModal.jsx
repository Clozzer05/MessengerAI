import { useState } from 'react';
import { Loader2, Crown } from 'lucide-react';
import { resolveMediaUrl } from '../../services/api';
import Modal from '../ui/Modal';

export default function OwnerTransferModal({ members, currentUserId, onClose, onTransfer }) {
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);

    const otherMembers = members.filter(m => {
        const id = m.user?._id || m.user;
        return id !== currentUserId;
    });

    const handleTransfer = async () => {
        if (!selected) return;
        setLoading(true);
        try {
            await onTransfer(selected);
            onClose();
        } catch {
            setLoading(false);
        }
    };

    return (
        <Modal title={<span className="flex items-center gap-2"><Crown size={18} className="text-yellow-500" /> Chuyển quyền nhóm trưởng</span>} onClose={onClose} size="sm">
            <div className="p-5 space-y-4">
                <p className="text-sm text-fg-subtle">Chọn thành viên sẽ trở thành nhóm trưởng mới trước khi bạn rời nhóm:</p>

                <div className="space-y-1 max-h-60 overflow-y-auto">
                    {otherMembers.map(m => {
                        const u = m.user;
                        const id = u?._id || u;
                        const name = u?.username || 'Unknown';
                        const avatar = u?.avatar || u?.googlePicture;
                        return (
                            <button key={id} onClick={() => setSelected(id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-left ${selected === id ? 'bg-brand-soft border border-brand-ring' : 'hover:bg-hover border border-transparent'}`}>
                                <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white font-bold overflow-hidden shrink-0">
                                    {avatar ? <img src={resolveMediaUrl(avatar)} alt="" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-fg text-sm">{name}</span>
                                {selected === id && <Crown size={16} className="text-yellow-500 ml-auto" />}
                            </button>
                        );
                    })}
                </div>

                <div className="flex gap-3 pt-2">
                    <button onClick={onClose} className="btn btn-secondary flex-1">Hủy</button>
                    <button onClick={handleTransfer} disabled={!selected || loading}
                        className="btn btn-primary flex-1">
                        {loading && <Loader2 size={16} className="animate-spin" />} Xác nhận & Rời nhóm
                    </button>
                </div>
            </div>
        </Modal>
    );
}

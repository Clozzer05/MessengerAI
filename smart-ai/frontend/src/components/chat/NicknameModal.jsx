import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { roomAPI } from '../../services/api';
import Modal from '../ui/Modal';

export default function NicknameModal({ roomId, targetUser, currentNickname, onClose, onSaved }) {
    const [nickname, setNickname] = useState(currentNickname || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await roomAPI.setNickname(roomId, targetUser._id, nickname.trim());
            onSaved?.(targetUser._id, nickname.trim());
            onClose();
        } catch (err) {
            console.error('Set nickname error:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title="Đặt biệt danh" onClose={onClose} size="sm">
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                    <label className="text-sm text-fg-muted block mb-1">
                        Biệt danh cho <span className="font-medium text-fg">{targetUser.username}</span>
                    </label>
                    <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="Nhập biệt danh..."
                        className="w-full px-4 py-2.5 border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-transparent"
                        maxLength={50}
                        autoFocus
                    />
                </div>

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
                        disabled={saving}
                        className="btn btn-primary flex-1"
                    >
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        Lưu
                    </button>
                </div>
            </form>
        </Modal>
    );
}

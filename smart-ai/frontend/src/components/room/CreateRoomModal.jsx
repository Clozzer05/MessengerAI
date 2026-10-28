import { useState } from 'react';
import { roomAPI, userAPI } from '../../services/api';
import { X, Search, UserPlus, Users, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';

export default function CreateRoomModal({ onClose, onCreated }) {
    const [tab, setTab] = useState('direct'); // 'direct' | 'group'
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [searching, setSearching] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (q) => {
        setSearchQuery(q);
        if (q.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const { data } = await userAPI.search(q);
            setSearchResults(data.users || []);
        } catch {
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    };

    const toggleUser = (u) => {
        setSelectedUsers((prev) => {
            const exists = prev.find((s) => s._id === u._id);
            if (exists) return prev.filter((s) => s._id !== u._id);
            if (tab === 'direct') return [u]; // Only 1 for direct
            return [...prev, u];
        });
    };

    const handleCreate = async () => {
        setError('');
        if (selectedUsers.length === 0) {
            setError('Chọn ít nhất 1 người dùng');
            return;
        }

        setCreating(true);
        try {
            const payload = {
                type: tab,
                memberIds: selectedUsers.map((u) => u._id),
            };
            if (tab === 'group') {
                payload.name = groupName || selectedUsers.map((u) => u.username).join(', ');
            }
            const { data } = await roomAPI.create(payload);
            onCreated(data.room);
        } catch (err) {
            setError(err.response?.data?.error || 'Không thể tạo phòng');
        } finally {
            setCreating(false);
        }
    };

    return (
        <Modal title="Cuộc trò chuyện mới" onClose={onClose} size="md">

            {/* Tabs */}
            <div className="flex border-b">
                <button
                    onClick={() => { setTab('direct'); setSelectedUsers([]); }}
                    className={`flex-1 py-2.5 text-sm font-medium transition ${tab === 'direct'
                        ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                        : 'text-fg-subtle hover:text-fg-muted'
                        }`}
                >
                    <UserPlus size={16} className="inline mr-1" />
                    Trực tiếp
                </button>
                <button
                    onClick={() => { setTab('group'); setSelectedUsers([]); }}
                    className={`flex-1 py-2.5 text-sm font-medium transition ${tab === 'group'
                        ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                        : 'text-fg-subtle hover:text-fg-muted'
                        }`}
                >
                    <Users size={16} className="inline mr-1" />
                    Nhóm
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {error && (
                    <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm">{error}</div>
                )}

                {/* Group name */}
                {tab === 'group' && (
                    <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Tên nhóm (tùy chọn)"
                        className="w-full px-3 py-2 border border-line-strong rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary-ring)] focus:border-[var(--color-primary-ring)] outline-none"
                    />
                )}

                {/* Selected users */}
                {selectedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {selectedUsers.map((u) => (
                            <span
                                key={u._id}
                                className="inline-flex items-center gap-1 bg-[var(--color-primary-medium)] text-[var(--color-primary-dark)] px-2.5 py-1 rounded-full text-sm"
                            >
                                {u.username}
                                <button onClick={() => toggleUser(u)} className="hover:text-brand-strong">
                                    <X size={14} />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {/* Search */}
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Tìm người dùng..."
                        className="w-full pl-9 pr-4 py-2 bg-surface-muted rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)]"
                    />
                </div>

                {/* Results */}
                {searching && (
                    <div className="text-center py-4">
                        <Loader2 size={20} className="animate-spin mx-auto text-[var(--color-primary)]" />
                    </div>
                )}

                {searchResults.map((u) => {
                    const selected = selectedUsers.some((s) => s._id === u._id);
                    return (
                        <button
                            key={u._id}
                            onClick={() => toggleUser(u)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-left ${selected ? 'bg-[var(--color-primary-light)] ring-1 ring-[var(--color-primary-medium)]' : 'hover:bg-hover'
                                }`}
                        >
                            <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white font-medium">
                                {u.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-fg truncate">{u.username}</p>
                                <p className="text-xs text-fg-subtle">{u.preferredLanguageLabel || u.preferredLanguage}</p>
                            </div>
                            {selected && (
                                <div className="w-5 h-5 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t">
                <button
                    onClick={handleCreate}
                    disabled={creating || selectedUsers.length === 0}
                    className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {creating && <Loader2 size={16} className="animate-spin" />}
                    {tab === 'direct' ? 'Bắt đầu trò chuyện' : 'Tạo nhóm'}
                </button>
            </div>
        </Modal>
    );
}

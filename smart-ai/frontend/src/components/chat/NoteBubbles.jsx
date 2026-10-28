import { useState, useEffect } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { noteAPI, resolveMediaUrl } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import Modal from '../ui/Modal';

export default function NoteBubbles({ onSelectRoom }) {
    const { user } = useAuth();
    const { on, off } = useSocket();
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [content, setContent] = useState('');
    const [creating, setCreating] = useState(false);
    const [selectedNote, setSelectedNote] = useState(null);
    const [replyText, setReplyText] = useState('');

    const fetchNotes = async () => {
        try {
            const { data } = await noteAPI.getFriendNotes();
            setNotes(data.notes || data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchNotes(); }, []);

    useEffect(() => {
        const handleNewNote = () => fetchNotes();
        on('note:new', handleNewNote);
        return () => off('note:new', handleNewNote);
    }, [on, off]);

    const handleCreate = async () => {
        if (!content.trim()) return;
        setCreating(true);
        try {
            await noteAPI.create({ content: content.trim() });
            setContent('');
            setShowCreate(false);
            fetchNotes();
        } catch (err) {
            console.error(err);
        } finally {
            setCreating(false);
        }
    };

    const handleReply = async () => {
        if (!selectedNote || !replyText.trim()) return;
        try {
            const { data } = await noteAPI.reply(selectedNote._id, replyText.trim());
            setReplyText('');
            setSelectedNote(null);
            if (data.roomId && onSelectRoom) {
                onSelectRoom(data.roomId);
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (loading && notes.length === 0) return null;

    return (
        <div data-tour="notes" className="px-3 py-2 border-b border-line">
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-none py-1">
                {/* Create note button */}
                <div className="flex flex-col items-center gap-1 shrink-0 cursor-pointer" onClick={() => setShowCreate(true)}>
                    <div className="w-14 h-14 rounded-full border-2 border-dashed border-line-strong flex items-center justify-center hover:border-brand transition">
                        <Plus size={20} className="text-fg-subtle" />
                    </div>
                    <span className="text-[10px] text-fg-subtle">Note</span>
                </div>

                {/* Notes list */}
                {notes.map(note => {
                    const author = note.author;
                    const isOwn = author?._id === user?._id;
                    return (
                        <div key={note._id} className="group flex flex-col items-center gap-1 shrink-0 cursor-pointer"
                            onClick={() => setSelectedNote(note)}>
                            <div className="relative flex flex-col items-center">
                                {note?.content && (
                                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-20 transition-opacity duration-200 opacity-100 group-hover:opacity-100">
                                        <div className="max-w-[130px] bg-gray-800 text-white text-[11px] px-3 py-1 rounded-2xl shadow-md relative whitespace-nowrap overflow-hidden text-ellipsis">
                                            {note.content}
                                            <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45" />
                                        </div>
                                    </div>
                                )}

                                <div className={`w-14 h-14 rounded-full border-2 ${isOwn ? 'border-brand-ring' : 'border-purple-400'} flex items-center justify-center overflow-hidden relative`}>
                                    {author?.avatar ? (
                                        <img src={resolveMediaUrl(author.avatar)} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-brand to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                                            {author?.username?.charAt(0).toUpperCase() || '?'}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <span className="text-[10px] text-fg-muted max-w-[60px] truncate text-center">
                                {isOwn ? 'Bạn' : author?.username}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Create note modal */}
            {showCreate && (
                <Modal title="Tạo ghi chú" onClose={() => setShowCreate(false)} size="sm">
                    <div className="p-5 space-y-4">
                        <div>
                            <textarea value={content} onChange={e => setContent(e.target.value)} maxLength={60}
                                placeholder="Bạn đang nghĩ gì? (tối đa 60 ký tự)" rows={2}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-ring outline-none text-sm resize-none" />
                            <p className="text-xs text-fg-subtle text-right">{content.length}/60</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowCreate(false)} className="btn btn-secondary flex-1">Hủy</button>
                            <button onClick={handleCreate} disabled={!content.trim() || creating}
                                className="btn btn-primary flex-1">
                                {creating && <Loader2 size={16} className="animate-spin" />} Đăng
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* View note modal */}
            {selectedNote && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedNote(null)}>
                    <div className="bg-gradient-to-br from-brand to-purple-600 rounded-3xl w-full max-w-sm p-8 text-center text-white relative"
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => setSelectedNote(null)} className="absolute top-3 right-3 p-1 text-white/70 hover:text-white">
                            <X size={20} />
                        </button>
                        <div className="w-16 h-16 rounded-full mx-auto mb-3 overflow-hidden border-2 border-white/30">
                            {selectedNote.author?.avatar ? (
                                <img src={resolveMediaUrl(selectedNote.author.avatar)} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-white/20 flex items-center justify-center text-xl font-bold">
                                    {selectedNote.author?.username?.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-white/70 mb-2">{selectedNote.author?.username}</p>
                        <p className="text-xl font-bold mb-3">{selectedNote.content}</p>

                        {/* Reply */}
                        {selectedNote.author?._id !== user?._id && (
                            <div className="flex gap-2 mt-4">
                                <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
                                    placeholder="Trả lời note..." maxLength={200}
                                    onKeyDown={e => e.key === 'Enter' && handleReply()}
                                    className="flex-1 px-3 py-2 rounded-lg bg-white/20 text-white placeholder-white/50 outline-none text-sm" />
                                <button onClick={handleReply} disabled={!replyText.trim()}
                                    className="px-4 py-2 bg-white/30 rounded-lg text-sm font-medium hover:bg-white/40 disabled:opacity-50">
                                    Gửi
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

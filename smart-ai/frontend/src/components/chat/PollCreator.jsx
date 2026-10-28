import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';

export default function PollCreator({ onSend, onClose }) {
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);

    const addOption = () => {
        if (options.length < 10) setOptions([...options, '']);
    };

    const removeOption = (idx) => {
        if (options.length > 2) setOptions(options.filter((_, i) => i !== idx));
    };

    const handleSubmit = () => {
        const trimmedQ = question.trim();
        const trimmedOpts = options.map(o => o.trim()).filter(Boolean);
        if (!trimmedQ || trimmedOpts.length < 2) return;
        onSend({ question: trimmedQ, options: trimmedOpts });
        onClose();
    };

    return (
        <Modal title="Tạo bình chọn" onClose={onClose} size="sm">
            <div className="p-5 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-fg-muted mb-1">Câu hỏi</label>
                    <input type="text" value={question} onChange={e => setQuestion(e.target.value)}
                        placeholder="Nhập câu hỏi..." maxLength={200}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-ring outline-none text-sm" />
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-fg-muted">Lựa chọn</label>
                    {options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <input type="text" value={opt} onChange={e => {
                                const next = [...options]; next[idx] = e.target.value; setOptions(next);
                            }}
                                placeholder={`Lựa chọn ${idx + 1}`} maxLength={100}
                                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-ring outline-none text-sm" />
                            {options.length > 2 && (
                                <button onClick={() => removeOption(idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                    {options.length < 10 && (
                        <button onClick={addOption} className="flex items-center gap-1 text-sm text-brand hover:text-brand-strong px-1">
                            <Plus size={14} /> Thêm lựa chọn
                        </button>
                    )}
                </div>

                <div className="flex gap-3 pt-2">
                    <button onClick={onClose} className="btn btn-secondary flex-1">Hủy</button>
                    <button onClick={handleSubmit}
                        disabled={!question.trim() || options.filter(o => o.trim()).length < 2}
                        className="btn btn-primary flex-1">
                        Tạo bình chọn
                    </button>
                </div>
            </div>
        </Modal>
    );
}

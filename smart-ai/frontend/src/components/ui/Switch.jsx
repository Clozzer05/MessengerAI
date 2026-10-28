// Công tắc kiểu iOS: xanh lá khi bật, xám khi tắt
const SIZES = {
    md: { track: 'w-[51px] h-[31px]', knob: 'w-[27px] h-[27px]', on: 'translate-x-[20px]' },
    sm: { track: 'w-[38px] h-[23px]', knob: 'w-[19px] h-[19px]', on: 'translate-x-[15px]' },
};

// Chỉ phần hiển thị, dùng khi công tắc nằm trong một nút khác (vd. dòng menu)
export function SwitchTrack({ checked, size = 'md' }) {
    const s = SIZES[size] || SIZES.md;
    return (
        <span
            aria-hidden="true"
            className={`relative inline-block shrink-0 rounded-full transition-colors duration-200 ${s.track} ${checked ? 'bg-[#34c759]' : 'bg-[rgba(120,120,128,0.32)]'}`}
        >
            <span
                className={`absolute top-[2px] left-[2px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-transform duration-200 ${s.knob} ${checked ? s.on : 'translate-x-0'}`}
            />
        </span>
    );
}

export default function Switch({ checked, onChange, disabled = false, label, size = 'md' }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={!!checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange?.(!checked)}
            className="inline-flex shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <SwitchTrack checked={checked} size={size} />
        </button>
    );
}

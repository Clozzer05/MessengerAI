import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import './OnboardingPopup.css';

/**
 * Tour hướng dẫn: mỗi bước khoanh vùng đúng phần giao diện đang nói tới.
 *
 * - target: CSS selector của phần tử được giới thiệu (bỏ trống = hộp thoại giữa màn hình).
 * - activate: bấm vào phần tử đó trước khi khoanh vùng, để mở đúng tab đang giới thiệu.
 * - placement: vị trí đặt hộp chú thích; bỏ trống thì tự chọn chỗ còn trống.
 */
const STEPS = [
    {
        title: 'Chào mừng bạn đến với Smart Chat!',
        content: 'Đây là ứng dụng nhắn tin, gọi điện tích hợp trợ lý AI. Nhấn Tiếp tục để đi qua từng phần của giao diện.',
    },
    {
        target: '[data-tour="tab-chats"]',
        activate: true,
        placement: 'right',
        title: 'Tin nhắn',
        content: 'Toàn bộ cuộc trò chuyện riêng và nhóm của bạn nằm ở tab này.',
    },
    {
        target: '[data-tour="new-chat"]',
        placement: 'right',
        title: 'Tạo cuộc trò chuyện',
        content: 'Nhấn dấu cộng để bắt đầu trò chuyện riêng hoặc lập một nhóm chat mới.',
    },
    {
        target: '[data-tour="search"]',
        placement: 'right',
        title: 'Tìm kiếm nhanh',
        content: 'Gõ tên người hoặc tên nhóm để tìm cuộc trò chuyện. Phím tắt là Ctrl + K.',
    },
    {
        target: '[data-tour="notes"]',
        placement: 'right',
        title: 'Ghi chú',
        content: 'Đăng một dòng trạng thái ngắn cho bạn bè xem. Ghi chú tự biến mất sau 24 giờ.',
    },
    {
        target: '[data-tour="tab-friends"]',
        activate: true,
        placement: 'right',
        title: 'Bạn bè',
        content: 'Tìm người dùng, gửi và trả lời lời mời kết bạn, xem gợi ý kết bạn tại đây.',
    },
    {
        target: '[data-tour="tab-topics"]',
        activate: true,
        placement: 'right',
        title: 'Phòng chủ đề',
        content: 'Tham gia các phòng thảo luận công khai theo lĩnh vực bạn quan tâm.',
    },
    {
        target: '[data-tour="tab-counseling"]',
        placement: 'right',
        title: 'Tư vấn',
        content: 'Tạo phiên tư vấn ẩn danh. Trợ lý AI hỗ trợ ngay, sau đó chuyên gia sẽ tiếp nhận.',
    },
    {
        target: '[data-tour="settings"]',
        placement: 'bottom',
        title: 'Cài đặt',
        content: 'Đổi ảnh đại diện, ngôn ngữ hiển thị, giao diện màu sắc và khung bong bóng chat.',
    },
    {
        title: 'Chúc bạn trải nghiệm vui vẻ!',
        content: 'Mở một cuộc trò chuyện rồi bật AI Bot để hỏi đáp, tóm tắt hội thoại hoặc dịch tin nhắn.',
    },
];

const TOOLTIP_WIDTH = 330;
const GAP = 14;
const HOLE_PADDING = 8;

const findTarget = (selector) => (selector ? document.querySelector(selector) : null);

const computeTooltipStyle = (rect, placement) => {
    if (!rect) return null;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clampLeft = (left) => Math.max(12, Math.min(left, vw - TOOLTIP_WIDTH - 12));
    const clampTop = (top) => Math.max(12, Math.min(top, vh - 220));

    let place = placement;
    if (!place) {
        if (vw - (rect.left + rect.width) > TOOLTIP_WIDTH + GAP + 20) place = 'right';
        else if (vh - (rect.top + rect.height) > 240) place = 'bottom';
        else place = 'top';
    }

    switch (place) {
        case 'right':
            if (rect.left + rect.width + GAP + TOOLTIP_WIDTH > vw - 12) {
                return { top: clampTop(rect.top + rect.height + GAP), left: clampLeft(rect.left) };
            }
            return { top: clampTop(rect.top), left: rect.left + rect.width + GAP };
        case 'left':
            return { top: clampTop(rect.top), left: clampLeft(rect.left - TOOLTIP_WIDTH - GAP) };
        case 'top':
            return { bottom: Math.max(12, vh - rect.top + GAP), left: clampLeft(rect.left) };
        case 'bottom':
        default:
            return { top: clampTop(rect.top + rect.height + GAP), left: clampLeft(rect.left) };
    }
};

export default function OnboardingPopup({ onClose }) {
    const [step, setStep] = useState(0);
    const [rect, setRect] = useState(null);

    const current = STEPS[step];
    const total = STEPS.length;

    // Mỗi lần đổi bước: mở đúng tab (nếu cần) rồi đo vị trí phần tử
    useLayoutEffect(() => {
        const measure = () => {
            const node = findTarget(current.target);
            if (!node) {
                setRect(null);
                return;
            }
            const r = node.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) {
                setRect(null);
                return;
            }
            setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        };

        const node = findTarget(current.target);
        if (node) {
            if (current.activate) node.click();
            node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        measure();
        // Đo lại sau khi tab vừa chuyển và hiệu ứng chạy xong
        const timers = [setTimeout(measure, 80), setTimeout(measure, 320)];

        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);
        return () => {
            timers.forEach(clearTimeout);
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
        };
    }, [step, current]);

    const finish = useCallback(() => {
        // Trả giao diện về tab Tin nhắn như lúc đầu
        findTarget('[data-tour="tab-chats"]')?.click();
        onClose();
    }, [onClose]);

    const next = useCallback(() => {
        setStep((s) => {
            if (s < STEPS.length - 1) return s + 1;
            finish();
            return s;
        });
    }, [finish]);

    const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') finish();
            else if (e.key === 'ArrowRight') next();
            else if (e.key === 'ArrowLeft') prev();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [finish, next, prev]);

    const tooltipStyle = computeTooltipStyle(rect, current.placement);
    const isLast = step === STEPS.length - 1;

    return (
        <div className={`ob-root${rect ? '' : ' ob-dim'}`}>
            {rect && (
                <div
                    className="ob-spotlight"
                    style={{
                        top: rect.top - HOLE_PADDING,
                        left: rect.left - HOLE_PADDING,
                        width: rect.width + HOLE_PADDING * 2,
                        height: rect.height + HOLE_PADDING * 2,
                    }}
                />
            )}

            <div
                className={`ob-tooltip${rect ? '' : ' ob-center'}`}
                style={tooltipStyle || undefined}
                role="dialog"
                aria-modal="true"
            >
                <p className="ob-step-indicator">Bước {step + 1}/{total}</p>
                <h2>{current.title}</h2>
                <p className="ob-content">{current.content}</p>

                <div className="ob-dots" aria-hidden="true">
                    {STEPS.map((_, idx) => (
                        <span key={idx} className={idx === step ? 'dot active' : 'dot'} />
                    ))}
                </div>

                <div className="ob-actions">
                    <button type="button" className="ghost" onClick={finish}>Bỏ qua</button>
                    {step > 0 && <button type="button" className="ghost" onClick={prev}>Quay lại</button>}
                    <button type="button" onClick={next}>{isLast ? 'Kết thúc' : 'Tiếp tục'}</button>
                </div>
            </div>
        </div>
    );
}

/**
 * themes.js — Color theme definitions.
 *
 * Giao diện chung theo phong cách Apple: mọi theme dùng cùng bảng màu nền/chữ/viền của iOS
 * (sáng hoặc tối), mỗi theme chỉ khác màu chủ đạo (accent).
 * Các biến được gắn lên <html>; component dùng qua token Tailwind (bg-surface, text-fg, bg-brand...).
 */

// Màu nền, chữ, viền theo iOS/macOS (systemBackground, label, separator...)
const APPLE_LIGHT = {
    '--bg-main': '#f2f2f7',
    '--bg-card': '#ffffff',
    '--bg-secondary': '#f2f2f7',
    '--bg-input': 'rgba(118, 118, 128, 0.12)',
    '--bg-hover': 'rgba(120, 120, 128, 0.1)',
    '--bg-bubble-received': '#e9e9eb',
    '--text-primary': '#000000',
    '--text-secondary': '#3c3c43',
    '--text-tertiary': '#8a8a8e',
    '--border-color': '#e5e5ea',
    '--border-input': '#d1d1d6',
};

const APPLE_DARK = {
    '--bg-main': '#000000',
    '--bg-card': '#1c1c1e',
    '--bg-secondary': '#2c2c2e',
    '--bg-input': 'rgba(118, 118, 128, 0.24)',
    '--bg-hover': 'rgba(255, 255, 255, 0.08)',
    '--bg-bubble-received': '#3a3a3c',
    '--text-primary': '#ffffff',
    '--text-secondary': '#d1d1d6',
    '--text-tertiary': '#8e8e93',
    '--border-color': '#38383a',
    '--border-input': '#48484a',
};

// Các sắc độ của màu chủ đạo, trộn từ accent nên chỉ cần khai báo một màu cho mỗi theme
function accentVars(accent, isDark) {
    return isDark
        ? {
            '--color-primary': accent,
            '--color-primary-hover': `color-mix(in srgb, ${accent} 85%, white)`,
            '--color-primary-light': `color-mix(in srgb, ${accent} 18%, #1c1c1e)`,
            '--color-primary-medium': `color-mix(in srgb, ${accent} 30%, #1c1c1e)`,
            '--color-primary-dark': `color-mix(in srgb, ${accent} 55%, white)`,
            '--color-primary-ring': accent,
            '--color-gradient-from': accent,
            '--color-gradient-to': `color-mix(in srgb, ${accent} 50%, black)`,
        }
        : {
            '--color-primary': accent,
            '--color-primary-hover': `color-mix(in srgb, ${accent} 85%, black)`,
            '--color-primary-light': `color-mix(in srgb, ${accent} 10%, white)`,
            '--color-primary-medium': `color-mix(in srgb, ${accent} 20%, white)`,
            '--color-primary-dark': `color-mix(in srgb, ${accent} 75%, black)`,
            '--color-primary-ring': accent,
            '--color-gradient-from': accent,
            '--color-gradient-to': `color-mix(in srgb, ${accent} 55%, white)`,
        };
}

function theme(id, name, color, isDark = false) {
    return {
        id,
        name,
        color,
        isDark,
        vars: { ...(isDark ? APPLE_DARK : APPLE_LIGHT), ...accentVars(color, isDark) },
    };
}

// id giữ nguyên để không mất lựa chọn theme đã lưu của người dùng
export const THEMES = [
    theme('blue', 'Xanh dương', '#007aff'),
    theme('red', 'Đỏ', '#ff3b30'),
    theme('purple', 'Tím', '#af52de'),
    theme('yellow', 'Vàng', '#d97706'),
    theme('brown', 'Nâu', '#a2845e'),
    theme('dark', 'Đen (Dark)', '#0a84ff', true),
    theme('light', 'Trắng (Light)', '#5856d6'),
    theme('midnight-purple', 'Tím Đêm', '#bf5af2', true),
    theme('solarized', 'Solarized', '#268bd2'),
    theme('glassmorphism', 'Kính mờ', '#5e5ce6', true),
    theme('retro-terminal', 'Terminal', '#30d158', true),
    theme('pixel-art', 'Pixel Art 8-bit', '#ff9500'),
    theme('neon-night', 'Neon Night', '#32ade6', true),
];

export const DEFAULT_THEME = 'blue';

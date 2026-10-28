import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useLanguage } from '../hooks/useLanguage';
import { userAPI } from '../services/api';
import { ChevronLeft, Loader2, Check, Palette, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion'; // eslint-disable-line no-unused-vars

export default function SettingsPage() {
    const { user, updateUser, logout } = useAuth();
    const { themeId, changeTheme, themes } = useTheme();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        username: user?.username || '',
        phoneNumber: user?.phoneNumber || '',
    });
    const [loading, setLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [pendingThemeId, setPendingThemeId] = useState(null);
    const [pressedThemeId, setPressedThemeId] = useState(null);
    const themeSwitchTimerRef = useRef(null);

    useEffect(() => {
        return () => {
            if (themeSwitchTimerRef.current) {
                clearTimeout(themeSwitchTimerRef.current);
            }
        };
    }, []);

    const hexToRgba = (hex, alpha = 0.4) => {
        if (!hex) return `rgba(99, 102, 241, ${alpha})`;
        let value = hex.replace('#', '').trim();
        if (value.length === 3) {
            value = value.split('').map((c) => c + c).join('');
        }
        if (!/^[0-9a-fA-F]{6}$/.test(value)) {
            return `rgba(99, 102, 241, ${alpha})`;
        }
        const parsed = Number.parseInt(value, 16);
        const r = (parsed >> 16) & 255;
        const g = (parsed >> 8) & 255;
        const b = parsed & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const getThemeAccent = (theme) => theme.color;

    // Phần lớn là màu chủ đạo (để dấu tích trắng ở giữa luôn rõ), góc dưới là nền sáng/tối của theme
    const getThemePreviewBackground = (theme) =>
        `linear-gradient(135deg, ${theme.color} 62%, ${theme.isDark ? '#1c1c1e' : '#f2f2f7'} 62%)`;

    const handleSave = async () => {
        setError('');
        setLoading(true);
        try {
            const { data } = await userAPI.updateProfile({
                username: form.username,
                phoneNumber: form.phoneNumber,
                preferredLanguage: 'vi',
                preferredLanguageLabel: 'Tiếng Việt',
                preferredTheme: themeId,
            });
            updateUser(data.user);
            localStorage.setItem('preferredLanguage', 'vi');
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setError(err.response?.data?.error || t('settings.saveFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleThemeChange = (newThemeId) => {
        if (pendingThemeId === newThemeId) return;

        if (themeSwitchTimerRef.current) {
            clearTimeout(themeSwitchTimerRef.current);
        }

        setPressedThemeId(newThemeId);
        setPendingThemeId(newThemeId);

        themeSwitchTimerRef.current = setTimeout(() => {
            changeTheme(newThemeId);
            // Also persist to backend silently
            userAPI.updateProfile({ preferredTheme: newThemeId }).catch(() => { });
            setPendingThemeId(null);
            themeSwitchTimerRef.current = null;
        }, 320);

        setTimeout(() => {
            setPressedThemeId((prev) => (prev === newThemeId ? null : prev));
        }, 420);
    };

    return (
        <div className="min-h-screen bg-app">
            {/* Header */}
            <div className="sticky top-0 z-10 apple-material border-b border-line">
                <div className="relative max-w-lg mx-auto px-4 h-12 flex items-center justify-center">
                    <button
                        onClick={() => navigate('/')}
                        className="absolute left-2 flex items-center gap-0.5 px-2 py-1 text-[17px] text-brand rounded-lg hover:bg-hover"
                        title={t('settings.backToChat')}
                    >
                        <ChevronLeft size={22} className="-ml-1" />
                        Chat
                    </button>
                    <h1 className="text-[17px] font-semibold text-fg">{t('settings.title')}</h1>
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
                {/* Profile section */}
                <div className="bg-surface rounded-xl p-5 space-y-4">
                    <h2 className="text-[13px] font-medium uppercase tracking-wide text-fg-subtle">{t('settings.profileSection')}</h2>

                    {error && (
                        <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm">{error}</div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-fg-muted mb-1">{t('settings.displayName')}</label>
                        <input
                            type="text"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            className="w-full px-4 py-2.5 border border-line-strong rounded-[10px] focus:ring-2 focus:ring-brand-ring/40 outline-none transition"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-fg-muted mb-1">{t('settings.email')}</label>
                        <input
                            type="email"
                            value={user?.email || ''}
                            disabled
                            className="w-full px-4 py-2.5 rounded-[10px] text-fg-subtle"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-fg-muted mb-1">{t('settings.phoneNumber')}</label>
                        <div className="relative">
                            <input
                                type="tel"
                                value={form.phoneNumber}
                                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                                className="w-full px-4 py-2.5 pl-10 border border-line-strong rounded-[10px] focus:ring-2 focus:ring-brand-ring/40 outline-none transition"
                                placeholder="0912 345 678"
                            />
                            <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="btn btn-primary w-full"
                    >
                        {loading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : saved ? (
                            <>
                                <Check size={16} />
                                {t('common.saved')}
                            </>
                        ) : (
                            t('common.save')
                        )}
                    </button>
                </div>

                {/* Theme / Appearance section */}
                <div className="bg-surface rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <Palette size={18} className="text-[var(--color-primary)]" />
                        <h2 className="text-[13px] font-medium uppercase tracking-wide text-fg-subtle">{t('settings.appearanceSection')}</h2>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)]">
                        {t('settings.appearanceHelp')}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {themes.map((theme) => {
                            const isActive = themeId === theme.id;
                            const isPending = pendingThemeId === theme.id;
                            const accent = getThemeAccent(theme);

                            return (
                                <motion.button
                                key={theme.id}
                                type="button"
                                onClick={() => handleThemeChange(theme.id)}
                                title={theme.name}
                                whileHover={{
                                    scale: isActive ? 1.12 : 1.08,
                                    boxShadow: `0 0 0 4px ${hexToRgba(accent, 0.25)}, 0 0 24px ${hexToRgba(accent, 0.45)}`,
                                }}
                                whileTap={{ scale: 0.9 }}
                                animate={pressedThemeId === theme.id
                                    ? {
                                        scale: [1, 0.9, isActive ? 1.14 : 1.1, isActive ? 1.1 : 1],
                                        transition: { duration: 0.38, times: [0, 0.28, 0.68, 1] },
                                    }
                                    : {
                                        scale: isActive ? 1.1 : 1,
                                        transition: { duration: 0.2, ease: 'easeOut' },
                                    }}
                                className={`relative w-12 h-12 rounded-full transition-colors duration-200 border-2 flex items-center justify-center
                                    ${isActive || isPending
                                        ? 'border-[var(--color-primary)]'
                                        : 'border-transparent'}
                                `}
                                style={{
                                    background: getThemePreviewBackground(theme),
                                    boxShadow: isActive
                                        ? `0 8px 18px ${hexToRgba(accent, 0.45)}`
                                        : `0 4px 10px ${hexToRgba(accent, 0.18)}`,
                                }}
                            >
                                {isPending && (
                                    <span
                                        className="pointer-events-none absolute -inset-1.5 rounded-full border-2 border-transparent animate-spin"
                                        style={{
                                            borderTopColor: accent,
                                            borderRightColor: hexToRgba(accent, 0.5),
                                        }}
                                    />
                                )}

                                {isActive && !isPending && (
                                    <Check size={18} className="text-white drop-shadow" />
                                )}

                                {isPending && (
                                    <Loader2
                                        size={14}
                                        className="absolute animate-spin text-white drop-shadow"
                                    />
                                )}
                            </motion.button>
                            );
                        })}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                        {t('settings.usingTheme')} <span className="font-medium text-[var(--color-primary)]">{themes.find((theme) => theme.id === (pendingThemeId || themeId))?.name}</span>
                    </p>

                </div>

                {/* Danger zone */}
                <div className="bg-surface rounded-xl p-5">
                    <h2 className="text-[13px] font-medium uppercase tracking-wide text-fg-subtle mb-3">{t('settings.logoutSection')}</h2>
                    <button
                        onClick={() => {
                            logout();
                            navigate('/login');
                        }}
                        className="btn w-full bg-field text-[#ff3b30] hover:bg-hover"
                    >
                        {t('settings.logoutButton')}
                    </button>
                </div>
            </div>
        </div>
    );
}

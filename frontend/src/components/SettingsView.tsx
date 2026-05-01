import { useState, useEffect } from 'react';
import { Settings, Key, Clock, Monitor, Moon, Folder, Info, Check, AlertCircle, Globe, Palette, HardDrive, Trash2, ChevronDown, type LucideIcon } from 'lucide-react';
import { useStore } from '../store';
import { formatMessage, useI18n } from '../i18n';
import { themeOptions, useTheme } from '../theme';
import { BackupView } from './BackupView';
import { TrashView } from './TrashView';
import * as App from '../../wailsjs/go/main/App';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';

type SettingsTab = 'settings' | 'backup' | 'trash';

interface SettingsTabItem {
  id: SettingsTab;
  label: string;
  icon: LucideIcon;
}

const selectControlClassName = 'w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 pr-11 text-sm font-medium text-gray-800 shadow-sm transition-all hover:border-primary-300 focus:border-accent focus:outline-none focus:ring-4 focus:ring-primary-100';
const textInputControlClassName = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-sm transition-all placeholder:text-gray-400 hover:border-primary-300 focus:border-accent focus:outline-none focus:ring-4 focus:ring-primary-100';

export function SettingsView() {
  const { settings, setSettings, version, dataDir } = useStore();
  const { language, setLanguage, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [autoLockMinutes, setAutoLockMinutes] = useState(5);
  const [lockOnMinimize, setLockOnMinimize] = useState(false);
  const [lockOnSleep, setLockOnSleep] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('settings');

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newHint, setNewHint] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const getPasswordStrength = (password: string) => {
    if (!password) return { score: 0 as 0 | 1 | 2 | 3, label: t.common.none, color: 'bg-gray-200' };

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[^A-Za-z\d]/.test(password);
    const variety = Number(hasLower) + Number(hasUpper) + Number(hasNumber) + Number(hasSymbol);
    const len = password.length;

    let score: 0 | 1 | 2 | 3 = 1;
    if (len >= 12 && variety >= 3) score = 3;
    else if (len >= 8 && variety >= 2) score = 2;
    else score = 1;

    const map: Record<0 | 1 | 2 | 3, { label: string; color: string }> = {
      0: { label: t.common.none, color: 'bg-gray-200' },
      1: { label: t.settings.strengthWeak, color: 'bg-red-500' },
      2: { label: t.settings.strengthMedium, color: 'bg-yellow-500' },
      3: { label: t.settings.strengthStrong, color: 'bg-green-500' },
    };
    return { score, ...map[score] };
  };

  useEffect(() => {
    if (settings) {
      setAutoLockMinutes(settings.autoLockMinutes);
      setLockOnMinimize(settings.lockOnMinimize);
      setLockOnSleep(settings.lockOnSleep);
    }
  }, [settings]);

  const themeLabels = {
    themeApple: t.settings.themeApple,
    themeLobster: t.settings.themeLobster,
    themeSunset: t.settings.themeSunset,
  } as const;

  const settingsTabs: SettingsTabItem[] = [
    { id: 'settings', label: t.settings.tabSettings, icon: Settings },
    { id: 'backup', label: t.settings.tabBackup, icon: HardDrive },
    { id: 'trash', label: t.settings.tabTrash, icon: Trash2 },
  ];

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await App.UpdateSettings(autoLockMinutes, lockOnMinimize, lockOnSleep);
      const newSettings = await App.GetSettings();
      setSettings(newSettings);
      setMessage({ type: 'success', text: t.settings.saved });
    } catch (error) {
      setMessage({ type: 'error', text: `${t.settings.saveFailed}：${String(error)}` });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setMessage(null);

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: t.settings.passwordMinLength });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: t.settings.passwordMismatch });
      return;
    }

    setChangingPassword(true);

    try {
      await App.ChangePassword(oldPassword, newPassword, newHint);
      setMessage({ type: 'success', text: t.settings.passwordChanged });
      setShowChangePassword(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNewHint('');
    } catch (error) {
      setMessage({ type: 'error', text: `${t.settings.passwordChangeFailed}：${String(error)}` });
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="flex flex-col gap-4 border-b border-gray-100 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">{t.settings.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{t.settings.subtitle}</p>
        </div>
        <div
          className="flex flex-wrap gap-1 self-start rounded-xl border border-gray-200 bg-gray-50 p-1 shadow-sm sm:ml-auto sm:self-center"
          role="tablist"
          aria-label={t.settings.title}
        >
          {settingsTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-w-[92px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white text-accent shadow-sm ring-1 ring-primary-100'
                    : 'text-gray-500 hover:bg-white/80 hover:text-gray-700'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'settings' && (
          <>
            {message && (
              <div
                className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${message.type === 'success'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                  }`}
              >
                {message.type === 'success' ? (
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <p className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
                  {message.text}
                </p>
              </div>
            )}

            <div className="space-y-6">
          <div className="p-6 border border-gray-200 rounded-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-accent" />
                <h3 className="font-semibold text-gray-800">{t.settings.password}</h3>
              </div>

              {!showChangePassword && (
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="self-start rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600 sm:self-center"
                >
                  {t.settings.changePassword}
                </button>
              )}
            </div>

            {showChangePassword && (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">{t.settings.currentPassword}</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className={textInputControlClassName}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">{t.settings.newPassword}</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={textInputControlClassName}
                    placeholder={t.settings.passwordMinLength}
                  />
                  {(() => {
                    const s = getPasswordStrength(newPassword);
                    const width = `${(s.score / 3) * 100}%`;
                    return (
                      <div className="mt-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                          <div className={`h-full ${s.color} transition-all`} style={{ width }} />
                        </div>
                        <div className="mt-1 text-xs text-gray-500">{t.settings.passwordStrength}：{s.label}</div>
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">{t.settings.confirmPassword}</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={textInputControlClassName}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">{t.settings.passwordHint}</label>
                  <input
                    type="text"
                    value={newHint}
                    onChange={(e) => setNewHint(e.target.value)}
                    className={textInputControlClassName}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleChangePassword}
                    disabled={changingPassword || !oldPassword || !newPassword || !confirmPassword}
                    className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {changingPassword ? t.common.loading : t.common.confirm}
                  </button>
                  <button
                    onClick={() => {
                      setShowChangePassword(false);
                      setOldPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setNewHint('');
                    }}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-gray-800">{t.settings.autoLock}</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  {t.settings.autoLockTime}
                </label>
                <div className="relative max-w-sm">
                  <select
                    value={autoLockMinutes}
                    onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                    className={selectControlClassName}
                  >
                    <option value={0}>{t.settings.never}</option>
                    <option value={1}>{formatMessage(t.settings.minutes, { count: 1 })}</option>
                    <option value={5}>{formatMessage(t.settings.minutes, { count: 5 })}</option>
                    <option value={10}>{formatMessage(t.settings.minutes, { count: 10 })}</option>
                    <option value={15}>{formatMessage(t.settings.minutes, { count: 15 })}</option>
                    <option value={30}>{formatMessage(t.settings.minutes, { count: 30 })}</option>
                    <option value={60}>{t.settings.hour}</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lockOnMinimize}
                  onChange={(e) => setLockOnMinimize(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-accent focus:ring-accent"
                />
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700">{t.settings.lockOnMinimize}</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lockOnSleep}
                  onChange={(e) => setLockOnSleep(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-accent focus:ring-accent"
                />
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700">{t.settings.lockOnSleep}</span>
                </div>
              </label>

              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? t.common.loading : t.common.save}
              </button>
            </div>
          </div>

          <div className="p-6 border border-gray-200 rounded-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <Palette className="w-5 h-5 text-accent" />
                  <h3 className="font-semibold text-gray-800">{t.settings.theme}</h3>
                </div>
                <p className="text-sm text-gray-500 mt-2">{t.settings.themeDesc}</p>
              </div>
              <div className="flex flex-wrap gap-3 sm:justify-end">
                {themeOptions.map((option) => {
                  const isSelected = option.id === theme;
                  const themeSwatchLabel = themeLabels[option.nameKey];

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTheme(option.id)}
                      className={`relative h-11 w-11 rounded-xl border transition-all focus:outline-none focus:ring-4 focus:ring-primary-100 ${
                        isSelected
                          ? 'border-white shadow-md ring-2 ring-accent'
                          : 'border-white/80 shadow-sm ring-1 ring-black/10 hover:-translate-y-0.5 hover:shadow-md'
                      }`}
                      style={{ backgroundColor: option.swatch }}
                      aria-label={themeSwatchLabel}
                      aria-pressed={isSelected}
                      title={themeSwatchLabel}
                    >
                      <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/35 via-white/5 to-black/10" />
                      {isSelected && (
                        <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow">
                          <Check className="h-5 w-5 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-6 border border-gray-200 rounded-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-accent" />
                  <h3 className="font-semibold text-gray-800">{t.settings.language}</h3>
                </div>
                <p className="mt-2 text-sm text-gray-500">{t.settings.languageDesc}</p>
              </div>
              <div className="relative w-full sm:w-[220px]">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'zh-CN' | 'en-US')}
                  className={selectControlClassName}
                >
                  <option value="zh-CN">{t.settings.languageChinese}</option>
                  <option value="en-US">{t.settings.languageEnglish}</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="p-6 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <Folder className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-gray-800">{t.settings.dataDir}</h3>
            </div>
            <p className="text-sm text-gray-600 font-mono bg-gray-100 px-3 py-2 rounded-lg break-all">
              {dataDir}
            </p>
          </div>

          <div className="p-6 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <Settings className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-gray-800">{t.settings.shortcuts}</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{t.settings.shortcutSearch}</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Cmd/Ctrl + K</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t.settings.shortcutLock}</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Cmd/Ctrl + L</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t.settings.shortcutNewNote}</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Cmd/Ctrl + N</kbd>
              </div>
            </div>
          </div>

          <div className="p-6 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <Info className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-gray-800">{t.settings.about}</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">{t.settings.version}</span>
                <span className="text-gray-800 font-medium">{version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t.settings.mode}</span>
                <span className="text-gray-800 font-medium">{t.settings.modePrivate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{t.settings.website}</span>
                <button
                  onClick={() => BrowserOpenURL('https://locknote.app')}
                  className="text-sm text-gray-600 hover:text-accent hover:underline font-medium"
                >
                  https://locknote.app
                </button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">{t.settings.legal}</div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => BrowserOpenURL('https://locknote.app/privacy')}
                  className="text-sm text-gray-600 hover:text-accent hover:underline"
                >
                  {t.settings.privacy}
                </button>
                <button
                  onClick={() => BrowserOpenURL('https://locknote.app/terms')}
                  className="text-sm text-gray-600 hover:text-accent hover:underline"
                >
                  {t.settings.terms}
                </button>
                <button
                  onClick={() => BrowserOpenURL('https://locknote.app/disclaimer')}
                  className="text-sm text-gray-600 hover:text-accent hover:underline"
                >
                  {t.settings.disclaimer}
                </button>
              </div>
            </div>
          </div>
            </div>
          </>
        )}

        {activeTab === 'backup' && <BackupView embedded />}
        {activeTab === 'trash' && <TrashView embedded />}
      </div>
    </div>
  );
}

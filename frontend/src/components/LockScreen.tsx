import { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, HelpCircle, Key } from 'lucide-react';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import * as App from '../wailsjs/go/main/App';

type Mode = 'unlock' | 'forgot' | 'reset';

export function LockScreen() {
  const { setUnlocked } = useStore();
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('unlock');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState('');
  const [showHint, setShowHint] = useState(false);

  const [dataKey, setDataKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newHint, setNewHint] = useState('');

  const handleUnlock = async () => {
    setError('');
    setLoading(true);

    try {
      const success = await App.Unlock(password);
      if (success) {
        setUnlocked(true);
      } else {
        setError(t.auth.wrongPassword);
      }
    } catch (err) {
      setError(`${t.auth.unlockFailed}：${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleShowHint = async () => {
    try {
      const passwordHint = await App.GetPasswordHint();
      setHint(passwordHint || t.auth.noHint);
      setShowHint(true);
    } catch (err) {
      setHint(`${t.common.error}`);
      setShowHint(true);
    }
  };

  const handleResetPassword = async () => {
    setError('');

    if (newPassword.length < 6) {
      setError(t.settings.passwordMinLength);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t.settings.passwordMismatch);
      return;
    }

    setLoading(true);
    try {
      await App.ResetPasswordWithDataKey(dataKey, newPassword, newHint);
      setUnlocked(true);
    } catch (err) {
      setError(`${t.auth.resetFailed}：${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && mode === 'unlock' && password) {
      handleUnlock();
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background backdrop-blur-sm">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-lg border border-primary-100">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-accent" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">LockNote.app</h1>
        <p className="text-center text-gray-500 mb-6">
          {mode === 'unlock' && t.auth.enterPassword}
          {mode === 'forgot' && t.auth.forgotPassword}
          {mode === 'reset' && t.auth.resetPassword}
        </p>

        {mode === 'unlock' && (
          <div className="space-y-4">
            <div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder={t.auth.passwordPlaceholder}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {showHint && hint && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                <span className="font-medium">{t.auth.hint}：</span> {hint}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              onClick={handleUnlock}
              disabled={loading || !password}
              className="w-full py-3 bg-accent text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t.common.loading : t.auth.unlock}
            </button>

            <div className="flex justify-between text-sm">
              <button
                onClick={handleShowHint}
                className="text-gray-500 hover:text-accent flex items-center gap-1"
              >
                <HelpCircle className="w-4 h-4" />
                {t.auth.viewHint}
              </button>
              <button
                onClick={() => setMode('forgot')}
                className="text-gray-500 hover:text-accent flex items-center gap-1"
              >
                <Key className="w-4 h-4" />
                {t.auth.forgotPassword}
              </button>
            </div>
          </div>
        )}

        {mode === 'forgot' && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-700">
                {t.auth.forgotDesc}
              </p>
            </div>

            <button
              onClick={() => setMode('reset')}
              className="w-full py-3 bg-accent text-white rounded-lg font-medium hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
            >
              <Key className="w-5 h-5" />
              {t.auth.resetWithDataKey}
            </button>

            <button
              onClick={() => setMode('unlock')}
              className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
            >
              {t.auth.backToLogin}
            </button>
          </div>
        )}

        {mode === 'reset' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.auth.dataKeyLabel}</label>
              <input
                type="text"
                value={dataKey}
                onChange={(e) => setDataKey(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-mono tracking-wider"
                placeholder={t.auth.dataKeyFormatPlaceholder}
                maxLength={32}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.newPassword}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder={t.auth.passwordPlaceholderMin}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.confirmPassword}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder={t.auth.confirmPasswordPlaceholder}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.passwordHint}</label>
              <input
                type="text"
                value={newHint}
                onChange={(e) => setNewHint(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder={t.auth.passwordHintPlaceholder}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              onClick={handleResetPassword}
              disabled={loading || [...dataKey].length < 5 || [...dataKey].length > 32 || !newPassword || !confirmPassword}
              className="w-full py-3 bg-accent text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t.common.loading : t.auth.resetPassword}
            </button>

            <button
              onClick={() => setMode('unlock')}
              className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
            >
              {t.auth.backToLogin}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

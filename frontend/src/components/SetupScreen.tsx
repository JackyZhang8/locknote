import { useState } from 'react';
import { Lock, Eye, EyeOff, Key, AlertCircle, Check, RefreshCw } from 'lucide-react';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import * as App from '../../wailsjs/go/main/App';

type Step = 'password' | 'recovery' | 'verify';

export function SetupScreen() {
  const { setFirstRun, setUnlocked } = useStore();
  const { t, language, setLanguage } = useI18n();
  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hint, setHint] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dataKey, setDataKey] = useState('');
  const [verifyKey, setVerifyKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const generateRandomKey = () => {
    const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    for (let i = 0; i < 16; i++) {
      result += charset[array[i] % charset.length];
    }
    return result;
  };

  const handleSetPassword = () => {
    setError('');

    if (password.length < 6) {
      setError(t.settings.passwordMinLength);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.settings.passwordMismatch);
      return;
    }

    setDataKey(generateRandomKey());
    setStep('recovery');
  };

  const handleConfirmDataKey = async () => {
    setError('');

    const keyLength = [...dataKey].length;
    if (keyLength < 5 || keyLength > 32) {
      setError(t.auth.dataKeyLengthError);
      return;
    }

    setStep('verify');
  };

  const handleVerifyDataKey = async () => {
    setError('');

    if (verifyKey !== dataKey) {
      setError(t.auth.dataKeyMismatch);
      return;
    }

    setLoading(true);
    try {
      const result = await App.SetupPassword(password, hint, dataKey);
      if (result) {
        setFirstRun(false);
        setUnlocked(true);
      } else {
        setError(t.auth.setupFailed);
      }
    } catch (err) {
      setError(`${t.auth.setupFailed}：${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="relative w-full max-w-md">
        {step === 'password' && (
          <div className="absolute -top-12 right-0">
            <div className="inline-flex items-center gap-1 p-1 rounded-full border border-gray-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setLanguage('zh-CN')}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  language === 'zh-CN'
                    ? 'bg-accent text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t.settings.languageChinese}
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en-US')}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  language === 'en-US'
                    ? 'bg-accent text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t.settings.languageEnglish}
              </button>
            </div>
          </div>
        )}

        <div className="w-full p-8 bg-white rounded-2xl shadow-lg border border-primary-100">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-accent" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">{t.auth.welcome}</h1>
        <p className="text-center text-gray-500 mb-6">{t.auth.setupPasswordDesc}</p>

        {step === 'password' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.auth.setupPassword}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder={t.auth.passwordPlaceholderMin}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.settings.confirmPassword}</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                placeholder={t.auth.confirmPasswordPlaceholder}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.auth.passwordHint}</label>
              <input
                type="text"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
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
              onClick={handleSetPassword}
              disabled={loading || !password || !confirmPassword}
              className="w-full py-3 bg-accent text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? t.common.loading : t.common.next}
            </button>
          </div>
        )}

        {step === 'recovery' && (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Key className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-medium text-yellow-800">{t.auth.dataKeyTitle}</h3>
                  <p className="text-sm text-yellow-700 mt-1">{t.auth.dataKeyDescCustom}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.auth.dataKeyLabel}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={dataKey}
                  onChange={(e) => setDataKey(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-mono tracking-wider"
                  placeholder={t.auth.dataKeyCustomPlaceholder}
                  maxLength={32}
                />
                <button
                  type="button"
                  onClick={() => setDataKey(generateRandomKey())}
                  className="px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-gray-600"
                  title={t.auth.randomGenerate}
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">{t.auth.dataKeyLengthHint}</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              onClick={handleConfirmDataKey}
              disabled={[...dataKey].length < 5}
              className="w-full py-3 bg-accent text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t.common.next}
            </button>

            <button
              onClick={() => setStep('password')}
              className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
            >
              {t.common.back}
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700">{t.auth.dataKeyVerifyDesc}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.auth.dataKeyLabel}</label>
              <input
                type="text"
                value={verifyKey}
                onChange={(e) => setVerifyKey(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent font-mono text-center tracking-wider"
                placeholder={t.auth.dataKeyVerifyPlaceholder}
                maxLength={32}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              onClick={handleVerifyDataKey}
              disabled={loading || [...verifyKey].length < 5}
              className="w-full py-3 bg-accent text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                t.common.loading
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  {t.common.finish}
                </>
              )}
            </button>

            <button
              onClick={() => setStep('recovery')}
              className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm"
            >
              {t.common.back}
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

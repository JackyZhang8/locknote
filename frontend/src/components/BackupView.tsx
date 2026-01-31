import { useState, useEffect } from 'react';
import { Download, Upload, FileText, AlertCircle, Check, Key } from 'lucide-react';
import { useStore } from '../store';
import { formatMessage, useI18n } from '../i18n';
import * as App from '../../wailsjs/go/main/App';

export function BackupView() {
  const { setNotes } = useStore();
  const { t } = useI18n();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importKey, setImportKey] = useState('');

  useEffect(() => {
    if (!showRestoreConfirm) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowRestoreConfirm(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showRestoreConfirm]);

  const handleBackup = async () => {
    setLoading('backup');
    setMessage(null);

    try {
      const path = await App.CreateBackup();
      if (path) {
        setMessage({ type: 'success', text: `${t.backup.backupSuccess}：${path}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `${t.backup.backupFailed}：${String(error)}` });
    } finally {
      setLoading(null);
    }
  };

  const handleRestoreClick = () => {
    setShowRestoreConfirm(true);
  };

  const handleConfirmRestore = async () => {
    setShowRestoreConfirm(false);
    setLoading('restore');
    setMessage(null);

    try {
      await App.RestoreBackup();
      const notesList = await App.ListNotes();
      setNotes(notesList || []);
      setMessage({ type: 'success', text: t.backup.restoreSuccess });
    } catch (error) {
      setMessage({ type: 'error', text: `${t.backup.restoreFailed}：${String(error)}` });
    } finally {
      setLoading(null);
    }
  };

  const handleImport = async () => {
    setLoading('import');
    setMessage(null);

    try {
      const note = await App.ImportMarkdown();
      if (note) {
        const notesList = await App.ListNotes();
        setNotes(notesList || []);
        setMessage({ type: 'success', text: `${t.backup.importSuccess}：${note.title}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `${t.backup.importFailed}：${String(error)}` });
    } finally {
      setLoading(null);
    }
  };

  const handleImportWithKey = async () => {
    if (!importKey.trim()) {
      setMessage({ type: 'error', text: t.backup.dataKeyRequired });
      return;
    }

    setShowImportDialog(false);
    setLoading('importWithKey');
    setMessage(null);

    try {
      const count = await App.ImportBackupWithKey(importKey.trim());
      if (count > 0) {
        const notesList = await App.ListNotes();
        setNotes(notesList || []);
        setMessage({ type: 'success', text: formatMessage(t.backup.importedCount, { count }) });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `${t.backup.importFailed}：${String(error)}` });
    } finally {
      setLoading(null);
      setImportKey('');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-xl font-semibold text-gray-800">{t.backup.title}</h2>
        <p className="text-sm text-gray-500 mt-1">{t.backup.subtitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${
              message.type === 'success'
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

        <div className="grid gap-6 md:grid-cols-2">
          <div className="p-6 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <Download className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">{t.backup.createBackup}</h3>
                <p className="text-sm text-gray-500">{t.backup.createBackupDesc}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {t.backup.createBackupDesc}
            </p>
            <button
              onClick={handleBackup}
              disabled={loading !== null}
              className="w-full py-3 bg-accent text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'backup' ? t.common.loading : t.backup.createBackup}
            </button>
          </div>

          <div className="p-6 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">{t.backup.restoreBackup}</h3>
                <p className="text-sm text-gray-500">{t.backup.restoreBackupDesc}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {t.backup.restoreBackupDesc}
            </p>
            <button
              onClick={handleRestoreClick}
              disabled={loading !== null}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'restore' ? t.common.loading : t.backup.restoreBackup}
            </button>
          </div>

          <div className="p-6 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">{t.backup.importMarkdown}</h3>
                <p className="text-sm text-gray-500">{t.backup.importMarkdownDesc}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {t.backup.importMarkdownDesc}
            </p>
            <button
              onClick={handleImport}
              disabled={loading !== null}
              className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'import' ? t.common.loading : t.backup.importMarkdown}
            </button>
          </div>

          <div className="p-6 border border-gray-200 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Key className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">{t.backup.importBackup}</h3>
                <p className="text-sm text-gray-500">{t.backup.importBackupDesc}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {t.backup.importBackupDesc}
            </p>
            <button
              onClick={() => setShowImportDialog(true)}
              disabled={loading !== null}
              className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'importWithKey' ? t.common.loading : t.backup.importBackup}
            </button>
          </div>
        </div>

        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <h4 className="font-medium text-yellow-800 mb-2">{t.backup.securityTipTitle}</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>{t.backup.securityTip1}</li>
            <li>{t.backup.securityTip2}</li>
            <li>{t.backup.securityTip3}</li>
          </ul>
        </div>
      </div>

      {showRestoreConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setShowRestoreConfirm(false)}
        >
          <div
            className="w-[360px] bg-white rounded-xl shadow-xl border border-gray-200 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-gray-900">{t.backup.restoreBackup}</div>
            <div className="mt-2 text-sm text-gray-600">{t.backup.restoreBackupDesc}</div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={() => setShowRestoreConfirm(false)}
              >
                {t.common.cancel}
              </button>
              <button
                className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                onClick={handleConfirmRestore}
              >
                {t.common.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => { setShowImportDialog(false); setImportKey(''); }}
        >
          <div
            className="w-[420px] bg-white rounded-xl shadow-xl border border-gray-200 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-gray-900">{t.backup.importBackup}</div>
            <div className="mt-2 text-sm text-gray-600">{t.backup.dataKeyTip}</div>
            <div className="mt-4">
              <input
                type="text"
                value={importKey}
                onChange={(e) => setImportKey(e.target.value)}
                placeholder={t.backup.dataKeyPlaceholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                autoFocus
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={() => { setShowImportDialog(false); setImportKey(''); }}
              >
                {t.common.cancel}
              </button>
              <button
                className="px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleImportWithKey}
              >
                {t.common.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

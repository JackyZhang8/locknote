import { useEffect, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import { notes } from '../../wailsjs/go/models';
import * as App from '../../wailsjs/go/main/App';

export function TrashView() {
  const { deletedNotes, setDeletedNotes, setNotes } = useStore();
  const { t, language } = useI18n();
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmDeleteId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConfirmDeleteId(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [confirmDeleteId]);

  useEffect(() => {
    const loadDeletedNotes = async () => {
      try {
        const deleted = await App.ListDeletedNotes();
        setDeletedNotes(deleted || []);
      } catch (error) {
        console.error('Failed to load deleted notes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDeletedNotes();
  }, [setDeletedNotes]);

  const handleRestore = async (note: notes.Note) => {
    try {
      await App.RestoreNote(note.id);
      const [deleted, notesList] = await Promise.all([
        App.ListDeletedNotes(),
        App.ListNotes(),
      ]);
      setDeletedNotes(deleted || []);
      setNotes(notesList || []);
    } catch (error) {
      console.error('Failed to restore note:', error);
      alert(`${t.common.error}：${String(error)}`);
    }
  };

  const handlePermanentDeleteClick = (note: notes.Note) => {
    setConfirmDeleteId(note.id);
  };

  const handleConfirmPermanentDelete = async () => {
    if (!confirmDeleteId) return;
    const noteId = confirmDeleteId;
    setConfirmDeleteId(null);

    try {
      await App.DeleteNote(noteId);
      const [deleted, notesList] = await Promise.all([
        App.ListDeletedNotes(),
        App.ListNotes(),
      ]);
      setDeletedNotes(deleted || []);
      setNotes(notesList || []);
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert(`${t.common.error}：${String(error)}`);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString(language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Trash2 className="w-6 h-6 text-gray-500" />
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{t.trash.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.trash.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {deletedNotes.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <Trash2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t.trash.empty}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700">{t.trash.emptyTip}</p>
            </div>

            {deletedNotes.map((note) => (
              <div
                key={note.id}
                className="p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800 truncate">
                      {note.title || t.noteList.untitled}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {note.content?.substring(0, 100) || t.noteList.noContent}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {t.trash.deletedAt} {formatDate(note.deletedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleRestore(note)}
                      className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {t.trash.restore}
                    </button>
                    <button
                      onClick={() => handlePermanentDeleteClick(note)}
                      className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t.trash.deletePermanently}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="w-[380px] bg-white rounded-xl shadow-xl border border-gray-200 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-gray-900">{t.trash.deleteTitle}</div>
            <div className="mt-2 text-sm text-gray-600">{t.trash.deleteDesc}</div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={() => setConfirmDeleteId(null)}
              >
                {t.common.cancel}
              </button>
              <button
                className="px-3 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600"
                onClick={handleConfirmPermanentDelete}
              >
                {t.trash.deletePermanently}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

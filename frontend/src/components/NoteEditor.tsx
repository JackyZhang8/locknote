import { useState, useEffect, useCallback, useRef } from 'react';
import { Eye, Edit3, Columns, Tag, History, Download, X, Plus, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore, EditorMode } from '../store';
import { useI18n } from '../i18n';
import { notes, tags } from '../../wailsjs/go/models';
import * as App from '../../wailsjs/go/main/App';

export function NoteEditor() {
  const {
    selectedNote,
    setSelectedNote,
    editorMode,
    setEditorMode,
    tags: allTags,
    setNotes,
  } = useStore();

  const { t, language } = useI18n();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<notes.Note[]>([]);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagMenuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedNote) {
      setTitle(selectedNote.title || '');
      setContent(selectedNote.content || '');
    } else {
      setTitle('');
      setContent('');
    }
  }, [selectedNote]);

  useEffect(() => {
    if (!showTagMenu) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const container = tagMenuContainerRef.current;
      if (!container) return;
      if (container.contains(event.target as Node)) return;
      setShowTagMenu(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowTagMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showTagMenu]);

  useEffect(() => {
    if (!showHistory && !confirmRestoreId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (confirmRestoreId) {
          setConfirmRestoreId(null);
        } else {
          setShowHistory(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showHistory, confirmRestoreId]);

  const saveNote = useCallback(async () => {
    if (!selectedNote) return;

    setIsSaving(true);
    try {
      const updated = await App.UpdateNote(selectedNote.id, title, content);
      setSelectedNote(updated);
      const notesList = await App.ListNotes();
      setNotes(notesList || []);
    } catch (error) {
      console.error('Failed to save note:', error);
      alert(`${t.common.error}：${String(error)}`);
    } finally {
      setIsSaving(false);
    }
  }, [selectedNote, title, content, setSelectedNote, setNotes]);

  useEffect(() => {
    if (!selectedNote) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (title !== selectedNote.title || content !== selectedNote.content) {
        saveNote();
      }
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [title, content, selectedNote, saveNote]);

  const handleAddTag = async (tag: tags.Tag) => {
    if (!selectedNote) return;

    try {
      await App.AddTagToNote(selectedNote.id, tag.id);
      const updated = await App.GetNote(selectedNote.id);
      setSelectedNote(updated);
      const notesList = await App.ListNotes();
      setNotes(notesList || []);
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!selectedNote) return;

    try {
      await App.RemoveTagFromNote(selectedNote.id, tagId);
      const updated = await App.GetNote(selectedNote.id);
      setSelectedNote(updated);
      const notesList = await App.ListNotes();
      setNotes(notesList || []);
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  };

  const handleShowHistory = async () => {
    if (!selectedNote) return;

    try {
      const historyList = await App.GetNoteHistory(selectedNote.id);
      setHistory(historyList || []);
      setShowHistory(true);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const handleRestoreClick = (historyId: string) => {
    setConfirmRestoreId(historyId);
  };

  const handleConfirmRestore = async () => {
    if (!selectedNote || !confirmRestoreId) return;

    try {
      const restored = await App.RestoreNoteFromHistory(selectedNote.id, confirmRestoreId);
      setSelectedNote(restored);
      setTitle(restored.title);
      setContent(restored.content);
      setConfirmRestoreId(null);
      setShowHistory(false);
    } catch (error) {
      console.error('Failed to restore history:', error);
    }
  };

  const handleExport = async () => {
    if (!selectedNote) return;

    try {
      const path = await App.ExportNoteAsMarkdown(selectedNote.id);
      if (path) {
        alert(`${t.common.success}：${path}`);
      }
    } catch (error) {
      console.error('Failed to export:', error);
    }
  };

  const modeButtons: { mode: EditorMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'edit', icon: <Edit3 className="w-4 h-4" />, label: t.editor.edit },
    { mode: 'preview', icon: <Eye className="w-4 h-4" />, label: t.editor.preview },
    { mode: 'split', icon: <Columns className="w-4 h-4" />, label: t.editor.split },
  ];

  const noteTags = selectedNote?.tags || [];
  const availableTags = allTags.filter((t) => !noteTags.some((nt) => nt.id === t.id));

  if (!selectedNote) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-400">
          <Edit3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t.editor.selectNote}</p>
          <p className="text-sm mt-1">{t.editor.selectNoteTip}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {modeButtons.map((btn) => (
            <button
              key={btn.mode}
              onClick={() => setEditorMode(btn.mode)}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
                editorMode === btn.mode
                  ? 'bg-primary-100 text-accent'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {btn.icon}
              {btn.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isSaving && <span className="text-xs text-gray-400">{t.common.loading}</span>}

          <div className="relative" ref={tagMenuContainerRef}>
            <button
              onClick={() => setShowTagMenu(!showTagMenu)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              title={t.noteList.tag}
            >
              <Tag className="w-4 h-4" />
            </button>

            {showTagMenu && (
              <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-20 min-w-[200px]">
                <div className="px-3 pb-2 border-b border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">{t.editor.currentTags}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {noteTags.length === 0 ? (
                      <span className="text-xs text-gray-400">{t.editor.noTags}</span>
                    ) : (
                      noteTags.map((tag) => (
                        <span
                          key={tag.id}
                          className="text-xs px-2 py-1 rounded flex items-center gap-1"
                          style={{ backgroundColor: tag.color + '20', color: tag.color }}
                        >
                          {tag.name}
                          <button
                            onClick={() => handleRemoveTag(tag.id)}
                            className="hover:opacity-70"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {availableTags.length > 0 && (
                  <div className="px-3 pt-2">
                    <p className="text-xs text-gray-500 font-medium mb-2">{t.editor.addTag}</p>
                    {availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => handleAddTag(tag)}
                        className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-50 rounded flex items-center gap-2"
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                        <Plus className="w-3 h-3 ml-auto text-gray-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleShowHistory}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            title={t.editor.history}
          >
            <History className="w-4 h-4" />
          </button>

          <button
            onClick={handleExport}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            title={t.editor.export}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {(editorMode === 'edit' || editorMode === 'split') && (
          <div className={`flex flex-col ${editorMode === 'split' ? 'w-1/2 border-r border-gray-100' : 'flex-1'}`}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="px-6 py-4 text-2xl font-bold border-b border-gray-100 focus:outline-none"
              placeholder={t.editor.titlePlaceholder}
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 px-6 py-4 resize-none focus:outline-none font-mono text-sm leading-relaxed"
              placeholder={t.editor.contentPlaceholder}
            />
          </div>
        )}

        {(editorMode === 'preview' || editorMode === 'split') && (
          <div className={`flex flex-col overflow-y-auto ${editorMode === 'split' ? 'w-1/2' : 'flex-1'}`}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h1 className="text-2xl font-bold text-gray-800">{title || t.noteList.untitled}</h1>
            </div>
            <div className="flex-1 px-6 py-4 markdown-preview overflow-y-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || `*${t.noteList.noContent}*`}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {showHistory && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">{t.editor.historyTitle}</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              {history.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  <p>{t.editor.historyEmpty}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {history.map((h) => (
                    <div key={h.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-800">{h.title || t.noteList.untitled}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {new Date(h.createdAt).toLocaleString(language)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRestoreClick(h.id)}
                          className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-primary-600 flex items-center gap-1"
                        >
                          <Check className="w-4 h-4" />
                          {t.editor.historyRestore}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmRestoreId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
          onClick={() => setConfirmRestoreId(null)}
        >
          <div
            className="w-[360px] bg-white rounded-xl shadow-xl border border-gray-200 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-gray-900">{t.editor.historyRestoreConfirm}</div>
            <div className="mt-2 text-sm text-gray-600">
              {t.editor.historyRestoreConfirm}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={() => setConfirmRestoreId(null)}
              >
                {t.common.cancel}
              </button>
              <button
                className="px-3 py-2 text-sm rounded-lg bg-accent text-white hover:bg-primary-600"
                onClick={handleConfirmRestore}
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

import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import { useStore } from '../store';
import { formatMessage, useI18n } from '../i18n';
import * as App from '../../wailsjs/go/main/App';

const COLORS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#ef4444', '#06b6d4', '#84cc16', '#6366f1', '#f97316',
];

export function TagsView() {
  const { tags, notes, setTags, setCurrentView, setSelectedTagId, setNotes, selectedNote, setSelectedNote } = useStore();
  const { t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const getNoteCountForTag = (tagId: string) => {
    return notes.filter((n) => n.tags?.some((t) => t.id === tagId)).length;
  };

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

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      await App.CreateTag(name.trim(), color);
      const updatedTags = await App.ListTags();
      setTags(updatedTags || []);
      setName('');
      setColor(COLORS[0]);
      setShowCreate(false);
    } catch (error) {
      console.error('Failed to create tag:', error);
      alert(`${t.common.error}：${String(error)}`);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!name.trim()) return;

    try {
      await App.UpdateTag(id, name.trim(), color);
      const updatedTags = await App.ListTags();
      setTags(updatedTags || []);
      const notesList = await App.ListNotes();
      setNotes(notesList || []);
      // 如果当前有选中的笔记，刷新它以更新标签信息
      if (selectedNote) {
        const updated = await App.GetNote(selectedNote.id);
        setSelectedNote(updated);
      }
      setEditingId(null);
      setName('');
      setColor(COLORS[0]);
    } catch (error) {
      console.error('Failed to update tag:', error);
      alert(`${t.common.error}：${String(error)}`);
    }
  };

  const handleDeleteClick = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    const tagId = confirmDeleteId;
    setConfirmDeleteId(null);

    try {
      await App.DeleteTag(tagId);
      const updatedTags = await App.ListTags();
      setTags(updatedTags || []);
      const notesList = await App.ListNotes();
      setNotes(notesList || []);
      // 如果当前有选中的笔记，刷新它以更新标签信息
      if (selectedNote) {
        const updated = await App.GetNote(selectedNote.id);
        setSelectedNote(updated);
      }
    } catch (error) {
      console.error('Failed to delete tag:', error);
      alert(`${t.common.error}：${String(error)}`);
    }
  };

  const startEdit = (tag: { id: string; name: string; color: string }) => {
    setEditingId(tag.id);
    setName(tag.name);
    setColor(tag.color);
    setShowCreate(false);
  };

  const handleViewNotes = (tagId: string) => {
    setSelectedTagId(tagId);
    setCurrentView('notes');
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{t.tags.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.tags.subtitle}</p>
          </div>
          <button
            onClick={() => {
              setShowCreate(true);
              setEditingId(null);
              setName('');
              setColor(COLORS[0]);
            }}
            className="px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-primary-600 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t.tags.newTag}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {(showCreate || editingId) && (
          <div className="mb-6 p-3 border border-gray-200 rounded-xl bg-gray-50">
            <h3 className="text-sm font-medium text-gray-800 mb-3">
              {editingId ? t.tags.editTag : t.tags.newTag}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t.tags.tagName}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (editingId) {
                        handleUpdate(editingId);
                      } else {
                        handleCreate();
                      }
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setShowCreate(false);
                      setEditingId(null);
                      setName('');
                      setColor(COLORS[0]);
                    }
                  }}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                  placeholder={t.tags.tagNamePlaceholder}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t.tags.tagColor}</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full transition-all ${
                        color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => (editingId ? handleUpdate(editingId) : handleCreate())}
                  disabled={!name.trim()}
                  className="px-3 py-1.5 text-sm bg-accent text-white rounded-md font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  {editingId ? t.common.save : t.common.create}
                </button>
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setEditingId(null);
                    setName('');
                    setColor(COLORS[0]);
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-md transition-colors flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  {t.common.cancel}
                </button>
              </div>
            </div>
          </div>
        )}

        {tags.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <p>{t.tags.noTags}</p>
            <p className="text-sm mt-1">{t.tags.createTagTip}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="font-medium text-gray-800 truncate">{tag.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewNotes(tag.id)}
                    className="flex-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {formatMessage(t.tags.notesWithTag, { count: getNoteCountForTag(tag.id) })}
                  </button>
                  <button
                    onClick={() => startEdit(tag)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(tag.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
            <div className="text-sm font-semibold text-gray-900">{t.tags.deleteTagTitle}</div>
            <div className="mt-2 text-sm text-gray-600">{t.tags.deleteTagDesc}</div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={() => setConfirmDeleteId(null)}
              >
                {t.common.cancel}
              </button>
              <button
                className="px-3 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600"
                onClick={handleConfirmDelete}
              >
                {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import * as App from '../../wailsjs/go/main/App';

const COLORS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#ef4444', '#06b6d4', '#84cc16', '#6366f1', '#f97316',
];

interface TagsPanelProps {
  embedded?: boolean;
}

export function TagsPanel({ embedded = false }: TagsPanelProps) {
  const { tags, notes, setTags, setCurrentView, setSelectedTagId, setNotes, selectedNote, setSelectedNote } = useStore();
  const { t } = useI18n();
  const [tagDialogMode, setTagDialogMode] = useState<'create' | 'edit' | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isEditingTags, setIsEditingTags] = useState(false);

  const getNoteCountForTag = (tagId: string) => {
    return notes.filter((n) => n.tags?.some((t) => t.id === tagId)).length;
  };

  const closeTagDialog = () => {
    setTagDialogMode(null);
    setEditingTagId(null);
    setName('');
    setColor(COLORS[0]);
  };

  const openCreateDialog = () => {
    setTagDialogMode('create');
    setEditingTagId(null);
    setName('');
    setColor(COLORS[0]);
  };

  const openEditDialog = (tag: { id: string; name: string; color: string }) => {
    setTagDialogMode('edit');
    setEditingTagId(tag.id);
    setName(tag.name);
    setColor(tag.color);
  };

  useEffect(() => {
    if (!confirmDeleteId && !tagDialogMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (confirmDeleteId) setConfirmDeleteId(null);
        if (tagDialogMode) closeTagDialog();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [confirmDeleteId, tagDialogMode]);

  const refreshTagPageData = async () => {
    const updatedTags = await App.ListTags();
    setTags(updatedTags || []);
    const notesList = await App.ListNotes();
    setNotes(notesList || []);
    if (selectedNote) {
      const updated = await App.GetNote(selectedNote.id);
      setSelectedNote(updated);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      await App.CreateTag(name.trim(), color);
      await refreshTagPageData();
      closeTagDialog();
    } catch (error) {
      console.error('Failed to create tag:', error);
      alert(`${t.common.error}：${String(error)}`);
    }
  };

  const handleUpdate = async () => {
    if (!editingTagId || !name.trim()) return;

    try {
      await App.UpdateTag(editingTagId, name.trim(), color);
      await refreshTagPageData();
      closeTagDialog();
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
      await refreshTagPageData();
    } catch (error) {
      console.error('Failed to delete tag:', error);
      alert(`${t.common.error}：${String(error)}`);
    }
  };

  const handleViewNotes = (tagId: string) => {
    setSelectedTagId(tagId);
    setCurrentView('notes');
  };

  return (
    <div className={`${embedded ? 'h-full' : 'flex-1'} flex flex-col bg-white`}>
      <div className={`${embedded ? 'p-5' : 'p-6'} border-b border-gray-100`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className={`${embedded ? 'text-lg' : 'text-xl'} font-semibold text-gray-800`}>{t.tags.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.tags.subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {tags.length > 0 && (
              <button
                onClick={() => setIsEditingTags((editing) => !editing)}
                aria-pressed={isEditingTags}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  isEditingTags
                    ? 'border-accent bg-primary-50 text-accent'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {isEditingTags ? t.common.finish : t.common.edit}
              </button>
            )}
            <button
              onClick={openCreateDialog}
              className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
            >
              <Plus className="w-4 h-4" />
              {t.tags.newTag}
            </button>
          </div>
        </div>
      </div>

      <div className={`${embedded ? 'p-5' : 'p-6'} flex-1 overflow-y-auto`}>
        {tags.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <p>{t.tags.noTags}</p>
            <p className="text-sm mt-1">{t.tags.createTagTip}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {tags.map((tag) => (
              <div
                key={tag.id}
                role="button"
                tabIndex={0}
                onClick={() => handleViewNotes(tag.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  handleViewNotes(tag.id);
                }}
                className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-gray-200 hover:bg-gray-50"
              >
                <span
                  className="h-3.5 w-3.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">{tag.name}</span>
                <span className="min-w-[2rem] text-right text-xs tabular-nums text-gray-400">
                  {getNoteCountForTag(tag.id)}篇
                </span>
                {isEditingTags && (
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditDialog(tag);
                      }}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteClick(tag.id);
                      }}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {tagDialogMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
          onClick={closeTagDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-[420px] bg-white rounded-xl shadow-xl border border-gray-200 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">
                {tagDialogMode === 'edit' ? t.tags.editTag : t.tags.newTag}
              </h3>
              <button
                onClick={closeTagDialog}
                title={t.common.close}
                aria-label={t.common.close}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-700">{t.tags.tagName}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (tagDialogMode === 'edit') {
                        handleUpdate();
                      } else {
                        handleCreate();
                      }
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      closeTagDialog();
                    }
                  }}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder={t.tags.tagNamePlaceholder}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">{t.tags.tagColor}</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-7 w-7 rounded-full transition-all ${
                        color === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={closeTagDialog}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100"
                >
                  <X className="h-3.5 w-3.5" />
                  {t.common.cancel}
                </button>
                <button
                  onClick={() => (tagDialogMode === 'edit' ? handleUpdate() : handleCreate())}
                  disabled={!name.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {tagDialogMode === 'edit' ? t.common.save : t.common.create}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

export function TagsView() {
  return <TagsPanel />;
}

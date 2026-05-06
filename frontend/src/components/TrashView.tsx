import { useEffect, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, FileText, Image as ImageIcon } from 'lucide-react';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import { attachments, notes } from '../../wailsjs/go/models';
import * as App from '../../wailsjs/go/main/App';

interface TrashViewProps {
  embedded?: boolean;
}

export function TrashView({ embedded = false }: TrashViewProps) {
  const { deletedNotes, setDeletedNotes, setNotes } = useStore();
  const { t, language } = useI18n();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'notes' | 'images'>('notes');
  const [deletedImages, setDeletedImages] = useState<attachments.Attachment[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'note' | 'image'; id: string } | null>(null);

  useEffect(() => {
    if (!confirmDelete) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConfirmDelete(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [confirmDelete]);

  useEffect(() => {
    const loadTrash = async () => {
      try {
        const [deleted, images] = await Promise.all([
          App.ListDeletedNotes(),
          App.ListDeletedAttachments(),
        ]);
        setDeletedNotes(deleted || []);
        setDeletedImages(images || []);
      } catch (error) {
        console.error('Failed to load trash:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTrash();
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

  const handleRestoreImage = async (image: attachments.Attachment) => {
    try {
      await App.RestoreAttachment(image.id);
      const images = await App.ListDeletedAttachments();
      setDeletedImages(images || []);
    } catch (error) {
      console.error('Failed to restore image:', error);
      alert(`${t.common.error}：${String(error)}`);
    }
  };

  const handlePermanentDeleteClick = (note: notes.Note) => {
    setConfirmDelete({ type: 'note', id: note.id });
  };

  const handlePermanentDeleteImageClick = (image: attachments.Attachment) => {
    setConfirmDelete({ type: 'image', id: image.id });
  };

  const handleConfirmPermanentDelete = async () => {
    if (!confirmDelete) return;
    const request = confirmDelete;
    setConfirmDelete(null);

    try {
      if (request.type === 'note') {
        await App.DeleteNote(request.id);
        const [deleted, notesList] = await Promise.all([
          App.ListDeletedNotes(),
          App.ListNotes(),
        ]);
        setDeletedNotes(deleted || []);
        setNotes(notesList || []);
      } else {
        await App.DeleteAttachment(request.id);
        const images = await App.ListDeletedAttachments();
        setDeletedImages(images || []);
      }
    } catch (error) {
      console.error('Failed to delete trash item:', error);
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
      <div className={embedded ? 'flex items-center justify-center bg-white py-12' : 'flex-1 flex items-center justify-center bg-white'}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  return (
    <div className={embedded ? 'bg-white' : 'flex-1 flex flex-col bg-white'}>
      {!embedded && (
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Trash2 className="w-6 h-6 text-gray-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-800">{t.trash.title}</h2>
              <p className="text-sm text-gray-500 mt-1">{t.trash.subtitle}</p>
            </div>
          </div>
        </div>
      )}

      <div className={embedded ? '' : 'flex-1 overflow-y-auto p-6'}>
        <div className="mb-4 inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'notes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="h-4 w-4" />
            {t.trash.notesTab}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('images')}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'images' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            {t.trash.imagesTab}
          </button>
        </div>

        {activeTab === 'notes' && (deletedNotes.length === 0 ? (
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
        ))}

        {activeTab === 'images' && (deletedImages.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t.trash.emptyImages}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700">{t.trash.imageEmptyTip}</p>
            </div>

            {deletedImages.map((image) => (
              <DeletedImageRow
                key={image.id}
                image={image}
                deletedAt={formatDate(image.deletedAt)}
                onRestore={() => handleRestoreImage(image)}
                onDelete={() => handlePermanentDeleteImageClick(image)}
              />
            ))}
          </div>
        ))}
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-[380px] bg-white rounded-xl shadow-xl border border-gray-200 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-gray-900">
              {confirmDelete.type === 'image' ? t.trash.deleteImageTitle : t.trash.deleteTitle}
            </div>
            <div className="mt-2 text-sm text-gray-600">
              {confirmDelete.type === 'image' ? t.trash.deleteImageDesc : t.trash.deleteDesc}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={() => setConfirmDelete(null)}
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

function DeletedImageRow({
  image,
  deletedAt,
  onRestore,
  onDelete,
}: {
  image: attachments.Attachment;
  deletedAt: string;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const [thumbnail, setThumbnail] = useState('');

  useEffect(() => {
    let isMounted = true;
    App.GetAttachmentThumbnailDataURL(image.id)
      .then((dataURL) => {
        if (isMounted) setThumbnail(dataURL);
      })
      .catch((error) => {
        console.error('Failed to load deleted image thumbnail:', error);
      });
    return () => {
      isMounted = false;
    };
  }, [image.id]);

  return (
    <div className="p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
            {thumbnail ? (
              <img src={thumbnail} alt={image.originalName} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-7 w-7 text-gray-400" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-medium text-gray-800">{image.originalName}</h3>
            <p className="mt-1 text-xs text-gray-400">
              {t.trash.deletedAt} {deletedAt}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRestore}
            className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-4 h-4" />
            {t.trash.restore}
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-4 h-4" />
            {t.trash.deletePermanently}
          </button>
        </div>
      </div>
    </div>
  );
}

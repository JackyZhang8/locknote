import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, Copy, Image as ImageIcon, Loader2, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import { getImageGridColumnCount, toImageRows } from '../imageGrid';
import { attachmentMarkdown, fileToDataURL } from '../imageAttachments';
import { attachments } from '../../wailsjs/go/models';
import * as App from '../../wailsjs/go/main/App';

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

interface ImageCardProps {
  attachment: attachments.Attachment;
  dataURL?: string;
  deleting: boolean;
  onPreviewLoaded: (id: string, dataURL: string) => void;
  onCopyMarkdown: (attachment: attachments.Attachment) => void;
  onInsertIntoNote: (attachment: attachments.Attachment) => void;
  onDelete: (attachment: attachments.Attachment) => void;
}

function ImageCard({
  attachment,
  dataURL,
  deleting,
  onPreviewLoaded,
  onCopyMarkdown,
  onInsertIntoNote,
  onDelete,
}: ImageCardProps) {
  const { t, language } = useI18n();

  useEffect(() => {
    let cancelled = false;
    if (dataURL) return;

    App.GetAttachmentDataURL(attachment.id)
      .then((nextDataURL) => {
        if (!cancelled) {
          onPreviewLoaded(attachment.id, nextDataURL);
        }
      })
      .catch((error) => {
        console.error('Failed to load image preview:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [attachment.id, dataURL, onPreviewLoaded]);

  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="flex aspect-square items-center justify-center bg-gray-100">
        {dataURL ? (
          <img
            src={dataURL}
            alt={attachment.originalName}
            className="h-full w-full object-cover"
            draggable
            loading="lazy"
            onDragStart={(event) => {
              event.dataTransfer.setData('text/plain', attachmentMarkdown(attachment));
            }}
          />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>
      <div className="space-y-2 p-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-gray-900" title={attachment.originalName}>
            {attachment.originalName}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-gray-400">
            <span>{formatBytes(attachment.size)}</span>
            <span>{new Date(attachment.createdAt).toLocaleDateString(language)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-[11px] text-gray-400">{t.attachments.encrypted}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onCopyMarkdown(attachment)}
              className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
              title={t.attachments.copyMarkdown}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onInsertIntoNote(attachment)}
              className="rounded-md border border-primary-100 p-1.5 text-accent hover:bg-primary-50"
              title={t.attachments.insertIntoNote}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(attachment)}
              disabled={deleting}
              className="rounded-md border border-red-100 p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
              title={t.common.delete}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImageManager() {
  const { selectedNoteId, setCurrentView, setSelectedNote, setSelectedNoteId } = useStore();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const [items, setItems] = useState<attachments.Attachment[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [containerWidth, setContainerWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const columnCount = getImageGridColumnCount(containerWidth);
  const rows = useMemo(() => toImageRows(items, columnCount), [columnCount, items]);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 164,
    overscan: 6,
  });

  const loadImages = async () => {
    setLoading(true);
    try {
      const nextItems = await App.ListAttachments();
      setItems(nextItems || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages().catch((error) => {
      console.error('Failed to list images:', error);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return;

    const updateWidth = () => {
      setContainerWidth(element.clientWidth);
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  const handlePreviewLoaded = useCallback((id: string, dataURL: string) => {
    setPreviews((current) => {
      if (current[id]) return current;
      return { ...current, [id]: dataURL };
    });
  }, []);

  const importFiles = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setImporting(true);
    setMessage('');
    try {
      for (const file of imageFiles) {
        const dataURL = await fileToDataURL(file);
        await App.CreateImageFromDataURL('', file.name, dataURL);
      }
      await loadImages();
    } catch (error) {
      console.error('Failed to import images:', error);
      setMessage(`${t.common.error}：${String(error)}`);
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    importFiles(files);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    importFiles(Array.from(event.dataTransfer.files));
  };

  const handleCopyMarkdown = async (attachment: attachments.Attachment) => {
    await navigator.clipboard.writeText(attachmentMarkdown(attachment));
    setMessage(t.attachments.copied);
  };

  const handleInsertIntoSelectedNote = async (attachment: attachments.Attachment) => {
    if (!selectedNoteId) {
      setMessage(t.attachments.noSelectedNote);
      return;
    }

    const note = await App.GetNote(selectedNoteId);
    const markdown = attachmentMarkdown(attachment);
    const prefix = note.content && !note.content.endsWith('\n') ? '\n' : '';
    const updated = await App.UpdateNote(note.id, note.title, `${note.content}${prefix}${markdown}\n`);
    await App.AttachAttachmentToNote(note.id, attachment.id);
    setSelectedNoteId(note.id);
    setSelectedNote(updated);
    setCurrentView('notes');
    setMessage(t.attachments.inserted);
  };

  const handleDelete = async (attachment: attachments.Attachment) => {
    const confirmed = window.confirm(`${t.attachments.deleteTitle}\n\n${t.attachments.deleteDesc}`);
    if (!confirmed) return;

    setDeletingId(attachment.id);
    try {
      await App.DeleteAttachment(attachment.id);
      setItems((current) => current.filter((item) => item.id !== attachment.id));
      setPreviews((current) => {
        const next = { ...current };
        delete next[attachment.id];
        return next;
      });
    } catch (error) {
      console.error('Failed to delete image:', error);
      setMessage(`${t.common.error}：${String(error)}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-hidden bg-gray-50 flex flex-col">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{t.attachments.title}</h1>
            <p className="mt-1 text-sm text-gray-500">{t.attachments.subtitle}</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
            disabled={importing}
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t.attachments.add}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          onDragEnter={() => setDragActive(true)}
          onDragLeave={() => setDragActive(false)}
          className={`flex min-h-[5rem] flex-col items-center justify-center rounded-lg border-2 border-dashed bg-white px-4 text-center transition-colors ${
            dragActive ? 'border-accent bg-primary-50' : 'border-gray-200'
          }`}
        >
          <ImageIcon className="mb-1.5 h-6 w-6 text-gray-400" />
          <div className="text-sm font-medium text-gray-700">{t.attachments.dropTitle}</div>
          <div className="mt-1 text-xs text-gray-400">{t.attachments.dropDesc}</div>
        </div>

        {message && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary-100 bg-white px-4 py-2 text-sm text-gray-600">
            <Check className="h-4 w-4 text-accent" />
            {message}
          </div>
        )}
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400">
            <ImageIcon className="mb-3 h-10 w-10 opacity-60" />
            <div>{t.attachments.empty}</div>
          </div>
        ) : (
          <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={virtualRow.key}
                className="absolute left-0 top-0 grid w-full gap-3"
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {(rows[virtualRow.index] || []).map((attachment) => (
                  <ImageCard
                    key={attachment.id}
                    attachment={attachment}
                    dataURL={previews[attachment.id]}
                    deleting={deletingId === attachment.id}
                    onPreviewLoaded={handlePreviewLoaded}
                    onCopyMarkdown={handleCopyMarkdown}
                    onInsertIntoNote={handleInsertIntoSelectedNote}
                    onDelete={handleDelete}
                  />
                ))}
                {Array.from({ length: columnCount - (rows[virtualRow.index]?.length || 0) }).map((_, index) => (
                  <div key={`placeholder-${index}`} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

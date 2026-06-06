import { useState, useEffect, useCallback, useRef, type ClipboardEvent as ReactClipboardEvent, type DragEvent as ReactDragEvent, type ImgHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Eye, Edit3, Columns, Tag, History, Download, X, Plus, Check, ZoomIn, ZoomOut, ChevronUp, ChevronDown, Bold, Italic, Heading1, Heading2, List, ListOrdered, Quote, Code, Link2, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore, EditorMode } from '../store';
import { formatMessage, useI18n } from '../i18n';
import { attachmentMarkdown, fileToDataURL, markdownUrlTransform, parseAttachmentId } from '../imageAttachments';
import { notes, tags } from '../../wailsjs/go/models';
import * as App from '../../wailsjs/go/main/App';

const FONT_SCALE_STORAGE_KEY = 'locknote-editor-font-scale';
const MIN_FONT_SCALE = 0.8;
const MAX_FONT_SCALE = 1.8;

function AttachmentImage({ src, alt, title }: ImgHTMLAttributes<HTMLImageElement>) {
  const attachmentId = parseAttachmentId(src);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(attachmentId ? null : src ?? null);

  useEffect(() => {
    let cancelled = false;
    if (!attachmentId) {
      setResolvedSrc(src ?? null);
      return () => {
        cancelled = true;
      };
    }

    setResolvedSrc(null);
    App.GetAttachmentDataURL(attachmentId)
      .then((dataURL) => {
        if (!cancelled) {
          setResolvedSrc(dataURL);
        }
      })
      .catch((error) => {
        console.error('Failed to load attachment image:', error);
        if (!cancelled) {
          setResolvedSrc(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attachmentId, src]);

  if (!resolvedSrc) {
    return (
      <span className="inline-flex min-h-[5rem] min-w-[8rem] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400">
        image
      </span>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt ?? ''}
      title={title}
      className="my-3 max-h-[520px] max-w-full rounded-lg border border-gray-100 object-contain"
    />
  );
}

const markdownComponents: Components = {
  img: AttachmentImage,
};

interface NoteEditorProps {
  variant?: 'workspace' | 'modal';
  note?: notes.Note | null;
  onNoteChange?: (note: notes.Note | null) => void;
  onNotesReloaded?: (notes: notes.Note[]) => void;
  onRequestClose?: () => void;
  closeRequestToken?: number;
}

export function NoteEditor({
  variant = 'workspace',
  note,
  onNoteChange,
  onNotesReloaded,
  onRequestClose,
  closeRequestToken,
}: NoteEditorProps = {}) {
  const {
    selectedNote: storeSelectedNote,
    setSelectedNote: setStoreSelectedNote,
    editorMode,
    setEditorMode,
    tags: allTags,
    setNotes,
  } = useStore();

  const { t, language } = useI18n();
  const isControlledNote = note !== undefined;
  const selectedNote = isControlledNote ? note : storeSelectedNote;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<notes.Note[]>([]);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState(1);
  const [showMarkdownToolbar, setShowMarkdownToolbar] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagMenuContainerRef = useRef<HTMLDivElement | null>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const updateSelectedNote = useCallback((nextNote: notes.Note | null) => {
    if (isControlledNote) {
      onNoteChange?.(nextNote);
      return;
    }
    setStoreSelectedNote(nextNote);
  }, [isControlledNote, onNoteChange, setStoreSelectedNote]);

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
    try {
      const saved = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
      if (!saved) return;
      const parsed = Number(saved);
      if (Number.isFinite(parsed) && parsed >= MIN_FONT_SCALE && parsed <= MAX_FONT_SCALE) {
        setFontScale(parsed);
      }
    } catch {
      // ignore localStorage read errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(fontScale));
    } catch {
      // ignore localStorage write errors
    }
  }, [fontScale]);

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

  const saveNote = useCallback(async (): Promise<boolean> => {
    if (!selectedNote) return true;

    setIsSaving(true);
    try {
      const updated = await App.UpdateNote(selectedNote.id, title, content);
      updateSelectedNote(updated);
      const notesList = await App.ListNotes();
      const safeNotes = notesList || [];
      setNotes(safeNotes);
      onNotesReloaded?.(safeNotes);
      return true;
    } catch (error) {
      console.error('Failed to save note:', error);
      alert(`${t.common.error}：${String(error)}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [selectedNote, title, content, updateSelectedNote, setNotes, onNotesReloaded, t.common.error]);

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
      updateSelectedNote(updated);
      const notesList = await App.ListNotes();
      const safeNotes = notesList || [];
      setNotes(safeNotes);
      onNotesReloaded?.(safeNotes);
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!selectedNote) return;

    try {
      await App.RemoveTagFromNote(selectedNote.id, tagId);
      const updated = await App.GetNote(selectedNote.id);
      updateSelectedNote(updated);
      const notesList = await App.ListNotes();
      const safeNotes = notesList || [];
      setNotes(safeNotes);
      onNotesReloaded?.(safeNotes);
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
      updateSelectedNote(restored);
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

  const handleZoomIn = () => {
    setFontScale((prev) => Math.min(prev + 0.1, MAX_FONT_SCALE));
  };

  const handleZoomOut = () => {
    setFontScale((prev) => Math.max(prev - 0.1, MIN_FONT_SCALE));
  };

  const applyMarkdown = (before: string, after = '', placeholder = '') => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    const insertText = `${before}${selected || placeholder}${after}`;
    textarea.focus();
    textarea.setRangeText(insertText, start, end, 'select');
    const nextContent = textarea.value;
    setContent(nextContent);

    requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = start + before.length;
      const selectionEnd = selectionStart + (selected || placeholder).length;
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const insertMarkdownAtCursor = (markdown: string) => {
    const textarea = contentTextareaRef.current;
    const insertion = content && !content.endsWith('\n') ? `\n${markdown}\n` : `${markdown}\n`;
    if (!textarea) {
      setContent((current) => current + insertion);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.focus();
    textarea.setRangeText(insertion, start, end, 'end');
    const nextContent = textarea.value;
    setContent(nextContent);
  };

  const createAttachmentFromFile = async (file: File) => {
    if (!selectedNote || !file.type.startsWith('image/')) return;
    const dataURL = await fileToDataURL(file);
    const attachment = await App.CreateImageFromDataURL(
      selectedNote.id,
      file.name || `image-${Date.now()}`,
      dataURL,
    );
    insertMarkdownAtCursor(attachmentMarkdown(attachment));
  };

  const handleInsertImage = async () => {
    if (!selectedNote) return;
    try {
      const attachment = await App.ImportImage(selectedNote.id);
      if (attachment) {
        insertMarkdownAtCursor(attachmentMarkdown(attachment));
      }
    } catch (error) {
      console.error('Failed to import image:', error);
      alert(`${t.common.error}：${String(error)}`);
    }
  };

  const updateTextareaValue = (
    textarea: HTMLTextAreaElement,
    nextValue: string,
    selectionStart: number,
    selectionEnd: number,
  ) => {
    textarea.value = nextValue;
    textarea.setSelectionRange(selectionStart, selectionEnd);
    setContent(nextValue);
  };

  const getSelectedLineRange = (value: string, start: number, end: number) => {
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    let lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) {
      lineEnd = value.length;
    }
    return { lineStart, lineEnd };
  };

  const indentSelectedLines = (textarea: HTMLTextAreaElement) => {
    const { value, selectionStart, selectionEnd } = textarea;
    const { lineStart, lineEnd } = getSelectedLineRange(value, selectionStart, selectionEnd);
    const selectedBlock = value.slice(lineStart, lineEnd);
    const lines = selectedBlock.split('\n');
    const updatedLines = lines.map((line) => `\t${line}`);
    const nextBlock = updatedLines.join('\n');
    const nextValue = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;
    const nextSelectionStart = selectionStart + 1;
    const nextSelectionEnd = selectionEnd + lines.length;
    updateTextareaValue(textarea, nextValue, nextSelectionStart, nextSelectionEnd);
  };

  const outdentSelectedLines = (textarea: HTMLTextAreaElement) => {
    const { value, selectionStart, selectionEnd } = textarea;
    const { lineStart, lineEnd } = getSelectedLineRange(value, selectionStart, selectionEnd);
    const selectedBlock = value.slice(lineStart, lineEnd);
    const lines = selectedBlock.split('\n');
    let removedBeforeSelectionStart = 0;
    let removedTotal = 0;
    const updatedLines = lines.map((line, index) => {
      if (line.startsWith('\t')) {
        removedTotal += 1;
        if (index === 0 && selectionStart > lineStart) {
          removedBeforeSelectionStart = 1;
        }
        return line.slice(1);
      }
      if (line.startsWith('  ')) {
        removedTotal += 2;
        if (index === 0 && selectionStart > lineStart) {
          removedBeforeSelectionStart = Math.min(2, selectionStart - lineStart);
        }
        return line.slice(2);
      }
      return line;
    });
    const nextBlock = updatedLines.join('\n');
    const nextValue = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;
    const nextSelectionStart = Math.max(lineStart, selectionStart - removedBeforeSelectionStart);
    const nextSelectionEnd = Math.max(nextSelectionStart, selectionEnd - removedTotal);
    updateTextareaValue(textarea, nextValue, nextSelectionStart, nextSelectionEnd);
  };

  const toggleHeadingOnSelectedLines = (textarea: HTMLTextAreaElement) => {
    const { value, selectionStart, selectionEnd } = textarea;
    const { lineStart, lineEnd } = getSelectedLineRange(value, selectionStart, selectionEnd);
    const selectedBlock = value.slice(lineStart, lineEnd);
    const lines = selectedBlock.split('\n');
    const shouldRemoveHeading = lines.every((line) => line.trim().length === 0 || line.startsWith('# '));
    let deltaStart = 0;
    let deltaEnd = 0;
    const updatedLines = lines.map((line, index) => {
      if (line.trim().length === 0) {
        return line;
      }
      if (shouldRemoveHeading) {
        if (line.startsWith('# ')) {
          if (index === 0 && selectionStart > lineStart) {
            deltaStart -= Math.min(2, selectionStart - lineStart);
          }
          deltaEnd -= 2;
          return line.slice(2);
        }
        return line;
      }
      if (index === 0 && selectionStart > lineStart) {
        deltaStart += 2;
      }
      deltaEnd += 2;
      return `# ${line}`;
    });
    const nextBlock = updatedLines.join('\n');
    const nextValue = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;
    const nextSelectionStart = Math.max(lineStart, selectionStart + deltaStart);
    const nextSelectionEnd = Math.max(nextSelectionStart, selectionEnd + deltaEnd);
    updateTextareaValue(textarea, nextValue, nextSelectionStart, nextSelectionEnd);
  };

  const handleContentKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;

    if (event.key === 'Tab') {
      event.preventDefault();
      if (event.shiftKey) {
        outdentSelectedLines(textarea);
      } else {
        indentSelectedLines(textarea);
      }
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === '/') {
      event.preventDefault();
      toggleHeadingOnSelectedLines(textarea);
    }
  };

  const handleContentPaste = (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'));
    const file = imageItem?.getAsFile();
    if (!file) return;

    event.preventDefault();
    createAttachmentFromFile(file).catch((error) => {
      console.error('Failed to paste image:', error);
      alert(`${t.common.error}：${String(error)}`);
    });
  };

  const handleContentDrop = (event: ReactDragEvent<HTMLTextAreaElement>) => {
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith('image/'));
    if (!file) return;

    event.preventDefault();
    createAttachmentFromFile(file).catch((error) => {
      console.error('Failed to drop image:', error);
      alert(`${t.common.error}：${String(error)}`);
    });
  };

  const handleRequestClose = async () => {
    if (!onRequestClose) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (selectedNote && (title !== selectedNote.title || content !== selectedNote.content)) {
      const saved = await saveNote();
      if (!saved) return;
    }
    onRequestClose();
  };

  useEffect(() => {
    if (!closeRequestToken) return;
    handleRequestClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeRequestToken]);

  const modeButtons: { mode: EditorMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'edit', icon: <Edit3 className="w-4 h-4" />, label: t.editor.edit },
    { mode: 'preview', icon: <Eye className="w-4 h-4" />, label: t.editor.preview },
    { mode: 'split', icon: <Columns className="w-4 h-4" />, label: t.editor.split },
  ];

  const noteTags = selectedNote?.tags || [];
  const availableTags = allTags.filter((t) => !noteTags.some((nt) => nt.id === t.id));
  const markdownActions = [
    { title: '一级标题', icon: <Heading1 className="w-4 h-4" />, onClick: () => applyMarkdown('# ', '', t.editor.titlePlaceholder) },
    { title: '二级标题', icon: <Heading2 className="w-4 h-4" />, onClick: () => applyMarkdown('## ', '', t.editor.titlePlaceholder) },
    { title: '加粗', icon: <Bold className="w-4 h-4" />, onClick: () => applyMarkdown('**', '**', 'bold') },
    { title: '斜体', icon: <Italic className="w-4 h-4" />, onClick: () => applyMarkdown('*', '*', 'italic') },
    { title: '无序列表', icon: <List className="w-4 h-4" />, onClick: () => applyMarkdown('- ', '', t.noteList.newNote) },
    { title: '有序列表', icon: <ListOrdered className="w-4 h-4" />, onClick: () => applyMarkdown('1. ', '', t.noteList.newNote) },
    { title: '引用', icon: <Quote className="w-4 h-4" />, onClick: () => applyMarkdown('> ', '', t.noteList.noContent) },
    { title: '行内代码', icon: <Code className="w-4 h-4" />, onClick: () => applyMarkdown('`', '`', 'code') },
    { title: '链接', icon: <Link2 className="w-4 h-4" />, onClick: () => applyMarkdown('[', '](https://)', 'link') },
    { title: '图片', icon: <ImageIcon className="w-4 h-4" />, onClick: handleInsertImage },
  ];
  const titleFontSize = `${2 * fontScale}rem`;
  const contentFontSize = `${0.875 * fontScale}rem`;
  const previewFontSize = `${1 * fontScale}rem`;
  const fontPercent = `${Math.round(fontScale * 100)}%`;
  const bodyCharacterCount = content.trim().length;

  const handleCreateNewNote = async () => {
    try {
      const note = await App.CreateNote(t.noteList.newNote, '');
      const updatedNotes = await App.ListNotes();
      setNotes(updatedNotes || []);
      updateSelectedNote(note);
      setEditorMode('edit');
    } catch (error) {
      console.error('Failed to create note:', error);
      alert(`${t.common.error}：${String(error)}`);
    }
  };

  if (!selectedNote) {
    return (
      <div className={`${variant === 'modal' ? 'flex h-full min-h-0' : 'flex-1 flex'} items-center justify-center bg-gray-50 relative`}>
        <div className="text-center text-gray-400">
          <Edit3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t.editor.selectNote}</p>
          <p className="text-sm mt-1">{t.editor.selectNoteTip}</p>
        </div>
        {variant === 'workspace' ? (
          <button
            onClick={handleCreateNewNote}
            className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-accent text-white shadow-lg hover:bg-primary-600 hover:shadow-xl transition-all flex items-center justify-center group"
            title={t.noteList.newNote}
          >
            <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${variant === 'modal' ? 'flex h-full min-h-0' : 'flex-1 flex'} flex-col bg-white`}>
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

          <span className="whitespace-nowrap text-xs font-medium text-gray-400 select-none">
            {formatMessage(t.editor.wordCount, { count: bodyCharacterCount })}
          </span>

          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            title={`缩小字体（当前 ${fontPercent}）`}
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="min-w-[3.5rem] text-center text-xs font-medium text-gray-500 select-none">
            {fontPercent}
          </span>

          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            title={`放大字体（当前 ${fontPercent}）`}
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {editorMode !== 'preview' && (
            <button
              onClick={() => setShowMarkdownToolbar((prev) => !prev)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              title={showMarkdownToolbar ? '收起 Markdown 工具栏' : '展开 Markdown 工具栏'}
            >
              {showMarkdownToolbar ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}

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

      {(editorMode === 'edit' || editorMode === 'split') && showMarkdownToolbar && (
        <div className="px-6 py-2 border-b border-gray-100 flex items-center gap-1 flex-wrap bg-gray-50">
          {markdownActions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className="p-2 rounded-lg text-gray-600 hover:bg-white hover:text-accent transition-colors border border-transparent hover:border-gray-200"
              title={action.title}
            >
              {action.icon}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {(editorMode === 'edit' || editorMode === 'split') && (
          <div className={`flex flex-col ${editorMode === 'split' ? 'w-1/2 border-r border-gray-100' : 'flex-1'}`}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="px-6 py-4 font-bold border-b border-gray-100 focus:outline-none"
              style={{ fontSize: titleFontSize }}
              placeholder={t.editor.titlePlaceholder}
            />
            <textarea
              ref={contentTextareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleContentKeyDown}
              onPaste={handleContentPaste}
              onDrop={handleContentDrop}
              onDragOver={(event) => event.preventDefault()}
              className="flex-1 px-6 py-4 resize-none focus:outline-none font-mono leading-relaxed"
              style={{ fontSize: contentFontSize }}
              placeholder={t.editor.contentPlaceholder}
            />
          </div>
        )}

        {(editorMode === 'preview' || editorMode === 'split') && (
          <div className={`flex flex-col overflow-y-auto ${editorMode === 'split' ? 'w-1/2' : 'flex-1'}`}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h1 className="font-bold text-gray-800" style={{ fontSize: titleFontSize }}>
                {title || t.noteList.untitled}
              </h1>
            </div>
            <div className="flex-1 px-6 py-4 markdown-preview overflow-y-auto" style={{ fontSize: previewFontSize }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents} urlTransform={markdownUrlTransform}>{content || `*${t.noteList.noContent}*`}</ReactMarkdown>
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

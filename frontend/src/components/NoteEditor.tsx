import { useState, useEffect, useCallback, useRef, type ClipboardEvent as ReactClipboardEvent, type DragEvent as ReactDragEvent, type ImgHTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode, type UIEvent as ReactUIEvent } from 'react';
import { Eye, Edit3, Columns, Tag, History, Download, X, Plus, Check, ZoomIn, ZoomOut, ChevronUp, ChevronDown, Bold, Italic, Heading1, Heading2, List, ListOrdered, Quote, Code, Link2, Image as ImageIcon, Pilcrow, Copy, Scissors, Clipboard } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore, EditorMode } from '../store';
import { formatMessage, useI18n } from '../i18n';
import { attachmentMarkdown, fileToDataURL, markdownUrlTransform, parseAttachmentId } from '../imageAttachments';
import { notes, tags } from '../../wailsjs/go/models';
import * as App from '../../wailsjs/go/main/App';
import { ClipboardGetText, ClipboardSetText } from '../../wailsjs/runtime/runtime';

const FONT_SCALE_STORAGE_KEY = 'locknote-editor-font-scale';
const LINE_NUMBERS_STORAGE_KEY = 'locknote-editor-show-line-numbers';
const LINE_NUMBERS_CHANGE_EVENT = 'locknote-editor-show-line-numbers-change';
const MAX_TITLE_LENGTH = 80;
const HISTORY_BATCH_SIZE = 8;
const MIN_FONT_SCALE = 0.8;
const MAX_FONT_SCALE = 1.8;
const CONTEXT_MENU_WIDTH = 220;
const CONTEXT_MENU_EDIT_HEIGHT = 416;
const CONTEXT_MENU_PREVIEW_HEIGHT = 192;
const TAG_COLORS = [
  '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#ef4444', '#06b6d4', '#84cc16', '#6366f1', '#f97316',
];

const getLimitedTitle = (value: string) => value.slice(0, MAX_TITLE_LENGTH);
type EditableContextTarget = HTMLInputElement | HTMLTextAreaElement;
type EditorContextMenu = {
  x: number;
  y: number;
  mode: 'editable' | 'preview';
};
type EditorSnapshot = {
  title: string;
  content: string;
};
type ContextMenuButtonProps = {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void | Promise<void>;
};

const getTitleFontSize = (titleLength: number, scale: number) => {
  if (titleLength > 60) return `${1.25 * scale}rem`;
  if (titleLength > 40) return `${1.5 * scale}rem`;
  if (titleLength > 20) return `${1.75 * scale}rem`;
  return `${2 * scale}rem`;
};

const isEditableContextTarget = (target: EventTarget | null): target is EditableContextTarget => {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
};

const getBoundedContextMenuPosition = (clientX: number, clientY: number, estimatedHeight: number) => {
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - CONTEXT_MENU_WIDTH - margin);
  const maxY = Math.max(margin, window.innerHeight - estimatedHeight - margin);
  return {
    x: Math.min(Math.max(clientX, margin), maxX),
    y: Math.min(Math.max(clientY, margin), maxY),
  };
};

function ContextMenuButton({ icon, children, onClick }: ContextMenuButtonProps) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
    >
      {icon}
      {children}
    </button>
  );
}

function ContextMenuDivider() {
  return <div className="my-1 h-px bg-gray-100" />;
}

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
    setTags,
    setNotes,
  } = useStore();

  const { t, language } = useI18n();
  const isControlledNote = note !== undefined;
  const selectedNote = isControlledNote ? note : storeSelectedNote;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showCreateTagDialog, setShowCreateTagDialog] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<notes.Note[]>([]);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(HISTORY_BATCH_SIZE);
  const [previewHistory, setPreviewHistory] = useState<notes.Note | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState(1);
  const [showMarkdownToolbar, setShowMarkdownToolbar] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [contextMenu, setContextMenu] = useState<EditorContextMenu | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagMenuContainerRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumbersRef = useRef<HTMLDivElement | null>(null);
  const contextMenuTargetRef = useRef<EditableContextTarget | null>(null);
  const undoStackRef = useRef<EditorSnapshot[]>([]);
  const previousCloseRequestTokenRef = useRef(closeRequestToken);

  const updateSelectedNote = useCallback((nextNote: notes.Note | null) => {
    if (isControlledNote) {
      onNoteChange?.(nextNote);
      return;
    }
    setStoreSelectedNote(nextNote);
  }, [isControlledNote, onNoteChange, setStoreSelectedNote]);

  const closeCreateTagDialog = () => {
    setShowCreateTagDialog(false);
    setNewTagName('');
    setNewTagColor(TAG_COLORS[0]);
  };

  useEffect(() => {
    undoStackRef.current = [];
    if (selectedNote) {
      setTitle(getLimitedTitle(selectedNote.title || ''));
      setContent(selectedNote.content || '');
    } else {
      setTitle('');
      setContent('');
    }
  }, [selectedNote]);

  const pushUndoSnapshot = () => {
    const snapshot: EditorSnapshot = { title, content };
    const stack = undoStackRef.current;
    const last = stack[stack.length - 1];
    if (last && last.title === snapshot.title && last.content === snapshot.content) return;
    undoStackRef.current = [...stack.slice(-49), snapshot];
  };

  const undoLastEdit = (target: EditableContextTarget | null) => {
    const previous = undoStackRef.current.pop();
    if (!previous) return false;

    setTitle(previous.title);
    setContent(previous.content);
    if (target) {
      const nextValue = target === titleInputRef.current ? previous.title : previous.content;
      restoreEditableSelection(target, nextValue.length, nextValue.length);
    }
    return true;
  };

  const handleEditorUndoShortcut = (event: ReactKeyboardEvent<EditableContextTarget>) => {
    const isUndoShortcut =
      (event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z';
    if (!isUndoShortcut) return false;

    const didUndo = undoLastEdit(event.currentTarget);
    if (!didUndo) return false;

    event.preventDefault();
    return true;
  };

  const handleTitleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (handleEditorUndoShortcut(event)) return;
  };

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
    const readLineNumberPreference = () => {
      try {
        const saved = localStorage.getItem(LINE_NUMBERS_STORAGE_KEY);
        setShowLineNumbers(saved !== 'false');
      } catch {
        setShowLineNumbers(true);
      }
    };

    readLineNumberPreference();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LINE_NUMBERS_STORAGE_KEY) {
        readLineNumberPreference();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener(LINE_NUMBERS_CHANGE_EVENT, readLineNumberPreference);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(LINE_NUMBERS_CHANGE_EVENT, readLineNumberPreference);
    };
  }, []);

  const persistShowLineNumbers = (value: boolean) => {
    setShowLineNumbers(value);
    try {
      localStorage.setItem(LINE_NUMBERS_STORAGE_KEY, value ? 'true' : 'false');
      window.dispatchEvent(new Event(LINE_NUMBERS_CHANGE_EVENT));
    } catch {
      // ignore localStorage write errors
    }
  };

  useEffect(() => {
    if (!showTagMenu) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (showCreateTagDialog) return;
      const container = tagMenuContainerRef.current;
      if (!container) return;
      if (container.contains(event.target as Node)) return;
      setShowTagMenu(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (showCreateTagDialog) return;
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
  }, [showTagMenu, showCreateTagDialog]);

  useEffect(() => {
    if (!contextMenu) return;

    const closeContextMenu = () => {
      setContextMenu(null);
    };

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const container = contextMenuRef.current;
      if (container?.contains(event.target as Node)) return;
      closeContextMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', closeContextMenu, true);
    window.addEventListener('resize', closeContextMenu);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', closeContextMenu, true);
      window.removeEventListener('resize', closeContextMenu);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!showCreateTagDialog) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCreateTagDialog();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCreateTagDialog]);

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

  const handleCreateTagFromEditor = async () => {
    if (!selectedNote || !newTagName.trim()) return;

    try {
      const createdTag = await App.CreateTag(newTagName.trim(), newTagColor);
      const updatedTags = await App.ListTags();
      setTags(updatedTags || []);
      await App.AddTagToNote(selectedNote.id, createdTag.id);
      const updated = await App.GetNote(selectedNote.id);
      updateSelectedNote(updated);
      const notesList = await App.ListNotes();
      const safeNotes = notesList || [];
      setNotes(safeNotes);
      onNotesReloaded?.(safeNotes);
      closeCreateTagDialog();
      setShowTagMenu(true);
    } catch (error) {
      console.error('Failed to create tag:', error);
      alert(`${t.common.error}：${String(error)}`);
    }
  };

  const handleShowHistory = async () => {
    if (!selectedNote) return;

    try {
      const historyList = await App.GetNoteHistory(selectedNote.id);
      setHistory(historyList || []);
      setVisibleHistoryCount(HISTORY_BATCH_SIZE);
      setPreviewHistory(null);
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
      setPreviewHistory(null);
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

  const writeTextToClipboard = async (value: string) => {
    if (!value) return;
    try {
      await ClipboardSetText(value);
    } catch {
      await navigator.clipboard?.writeText?.(value);
    }
  };

  const readTextFromClipboard = async () => {
    try {
      return await ClipboardGetText();
    } catch {
      return await navigator.clipboard?.readText?.() ?? '';
    }
  };

  const getEditableSelection = (target: EditableContextTarget) => {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    return {
      start,
      end,
      text: target.value.slice(start, end),
    };
  };

  const restoreEditableSelection = (
    target: EditableContextTarget,
    selectionStart: number,
    selectionEnd: number,
  ) => {
    requestAnimationFrame(() => {
      const safeStart = Math.min(selectionStart, target.value.length);
      const safeEnd = Math.min(selectionEnd, target.value.length);
      target.focus();
      target.setSelectionRange(safeStart, safeEnd);
    });
  };

  const replaceEditableSelection = (target: EditableContextTarget, replacement: string) => {
    const { start, end } = getEditableSelection(target);
    const nextRawValue = `${target.value.slice(0, start)}${replacement}${target.value.slice(end)}`;
    const nextValue = target === titleInputRef.current ? getLimitedTitle(nextRawValue) : nextRawValue;
    const nextCursorPosition = Math.min(start + replacement.length, nextValue.length);

    if (nextValue === target.value) return;
    pushUndoSnapshot();
    if (target === titleInputRef.current) {
      setTitle(nextValue);
    } else {
      setContent(nextValue);
    }
    restoreEditableSelection(target, nextCursorPosition, nextCursorPosition);
  };

  const handleEditorContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const target = event.target;
    const editableTarget = isEditableContextTarget(target) ? target : null;
    const mode = editableTarget ? 'editable' : 'preview';
    const position = getBoundedContextMenuPosition(
      event.clientX,
      event.clientY,
      mode === 'editable' ? CONTEXT_MENU_EDIT_HEIGHT : CONTEXT_MENU_PREVIEW_HEIGHT,
    );

    contextMenuTargetRef.current = editableTarget;
    setContextMenu({ ...position, mode });
  };

  const handleCopyFromContextMenu = async () => {
    const target = contextMenuTargetRef.current;
    const text = target ? getEditableSelection(target).text : window.getSelection()?.toString() ?? '';
    await writeTextToClipboard(text);
    setContextMenu(null);
  };

  const handleCutFromContextMenu = async () => {
    const target = contextMenuTargetRef.current;
    if (!target) {
      setContextMenu(null);
      return;
    }

    const selection = getEditableSelection(target);
    await writeTextToClipboard(selection.text);
    if (selection.text) {
      replaceEditableSelection(target, '');
    }
    setContextMenu(null);
  };

  const handlePasteFromContextMenu = async () => {
    const target = contextMenuTargetRef.current;
    if (!target) {
      setContextMenu(null);
      return;
    }

    const clipboardText = await readTextFromClipboard();
    if (clipboardText) {
      replaceEditableSelection(target, clipboardText);
    }
    setContextMenu(null);
  };

  const handleSelectAllFromContextMenu = () => {
    const target = contextMenuTargetRef.current;
    if (target) {
      target.focus();
      target.select();
    }
    setContextMenu(null);
  };

  const handleCopyMarkdownFromContextMenu = async () => {
    await writeTextToClipboard(content);
    setContextMenu(null);
  };

  const handleShowHistoryFromContextMenu = () => {
    setContextMenu(null);
    handleShowHistory();
  };

  const handleExportFromContextMenu = () => {
    setContextMenu(null);
    handleExport();
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
    pushUndoSnapshot();
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
      pushUndoSnapshot();
      setContent((current) => current + insertion);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.focus();
    textarea.setRangeText(insertion, start, end, 'end');
    const nextContent = textarea.value;
    pushUndoSnapshot();
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
    pushUndoSnapshot();
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
    if (handleEditorUndoShortcut(event)) return;

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

  const handleTitleChange = (value: string) => {
    const nextTitle = getLimitedTitle(value);
    if (nextTitle === title) return;
    pushUndoSnapshot();
    setTitle(nextTitle);
  };

  const handleContentChange = (value: string) => {
    if (value === content) return;
    pushUndoSnapshot();
    setContent(value);
  };

  const handleContentScroll = () => {
    const textarea = contentTextareaRef.current;
    const lineNumbers = lineNumbersRef.current;
    if (!textarea || !lineNumbers) return;
    lineNumbers.scrollTop = textarea.scrollTop;
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
    if (closeRequestToken === previousCloseRequestTokenRef.current) return;
    previousCloseRequestTokenRef.current = closeRequestToken;
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
  const titleFontSize = getTitleFontSize(title.length, fontScale);
  const contentFontSize = `${0.875 * fontScale}rem`;
  const previewFontSize = `${1 * fontScale}rem`;
  const fontPercent = `${Math.round(fontScale * 100)}%`;
  const bodyCharacterCount = content.trim().length;
  const editorLineNumbers = content.split('\n');
  const visibleHistory = history.slice(0, visibleHistoryCount);
  const hasMoreHistory = visibleHistoryCount < history.length;

  const handleHistoryScroll = (event: ReactUIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceFromBottom > 48 || !hasMoreHistory) return;
    setVisibleHistoryCount((count) => Math.min(count + HISTORY_BATCH_SIZE, history.length));
  };

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
    <div
      data-note-editor-surface="true"
      onContextMenu={handleEditorContextMenu}
      className={`${variant === 'modal' ? 'flex h-full min-h-0 min-w-0' : 'flex-1 flex min-h-0 min-w-0 overflow-hidden'} flex-col bg-white`}
    >
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
            title={formatMessage(t.editor.zoomOutTooltip, { percent: fontPercent })}
            aria-label={formatMessage(t.editor.zoomOutTooltip, { percent: fontPercent })}
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="min-w-[3.5rem] text-center text-xs font-medium text-gray-500 select-none">
            {fontPercent}
          </span>

          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            title={formatMessage(t.editor.zoomInTooltip, { percent: fontPercent })}
            aria-label={formatMessage(t.editor.zoomInTooltip, { percent: fontPercent })}
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {editorMode !== 'preview' && (
            <button
              onClick={() => setShowMarkdownToolbar((prev) => !prev)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              title={showMarkdownToolbar ? t.editor.collapseMarkdownToolbar : t.editor.expandMarkdownToolbar}
              aria-label={showMarkdownToolbar ? t.editor.collapseMarkdownToolbar : t.editor.expandMarkdownToolbar}
            >
              {showMarkdownToolbar ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}

          <div className="relative" ref={tagMenuContainerRef}>
            <button
              onClick={() => setShowTagMenu(!showTagMenu)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              title={t.editor.tagsTooltip}
              aria-label={t.editor.tagsTooltip}
            >
              <Tag className="w-4 h-4" />
            </button>

            {showTagMenu && (
              <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-20 min-w-[220px]">
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

                <div className="px-3 pt-2">
                  <p className="text-xs text-gray-500 font-medium mb-2">{t.editor.addTag}</p>
                  <div className="max-h-[24rem] overflow-y-auto">
                    {availableTags.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-gray-400">{t.editor.noTags}</div>
                    ) : (
                      availableTags.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => handleAddTag(tag)}
                          className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-50 rounded flex items-center gap-2"
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                          <Plus className="w-3 h-3 ml-auto flex-shrink-0 text-gray-400" />
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-2 border-t border-gray-100 px-3 pt-2">
                  <button
                    onClick={() => setShowCreateTagDialog(true)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-accent transition-colors hover:bg-primary-50"
                  >
                    <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                    {t.tags.newTag}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleShowHistory}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            title={t.editor.historyTooltip}
            aria-label={t.editor.historyTooltip}
          >
            <History className="w-4 h-4" />
          </button>

          <button
            onClick={handleExport}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            title={t.editor.exportTooltip}
            aria-label={t.editor.exportTooltip}
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
          <button
            onClick={() => persistShowLineNumbers(!showLineNumbers)}
            className={`p-2 rounded-lg transition-colors border ${
              showLineNumbers
                ? 'border-primary-100 bg-white text-accent'
                : 'border-transparent text-gray-600 hover:bg-white hover:text-accent hover:border-gray-200'
            }`}
            title={t.settings.showLineNumbers}
            aria-pressed={showLineNumbers}
          >
            <Pilcrow className="w-4 h-4" />
          </button>
        </div>
      )}

      <div
        className={`min-h-0 min-w-0 flex-1 overflow-hidden ${editorMode === 'split' ? 'grid' : 'flex'}`}
        style={{
          gridTemplateColumns: editorMode === 'split' ? 'minmax(0, 1fr) minmax(0, 1fr)' : undefined,
        }}
      >
        {(editorMode === 'edit' || editorMode === 'split') && (
          <div
            data-editor-pane="markdown"
            className={`flex flex-col ${editorMode === 'split' ? 'min-w-0 border-r border-gray-100' : 'min-w-0 flex-1'}`}
          >
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              maxLength={MAX_TITLE_LENGTH}
              className="px-6 py-4 font-bold border-b border-gray-100 focus:outline-none"
              style={{ fontSize: titleFontSize }}
              placeholder={t.editor.titlePlaceholder}
            />
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {showLineNumbers && (
                <div
                  ref={lineNumbersRef}
                  aria-hidden="true"
                  className="select-none overflow-hidden border-r border-gray-100 bg-gray-50 px-3 py-4 text-right font-mono leading-relaxed text-gray-400"
                  style={{ fontSize: contentFontSize }}
                >
                  {editorLineNumbers.map((_, index) => (
                    <div key={index} className="min-w-[2.25rem] tabular-nums">
                      {index + 1}
                    </div>
                  ))}
                </div>
              )}
              <textarea
                ref={contentTextareaRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                onKeyDown={handleContentKeyDown}
                onPaste={handleContentPaste}
                onDrop={handleContentDrop}
                onScroll={handleContentScroll}
                onDragOver={(event) => event.preventDefault()}
                className={`min-w-0 flex-1 resize-none py-4 pr-6 focus:outline-none font-mono leading-relaxed ${showLineNumbers ? 'pl-4' : 'px-6'}`}
                style={{ fontSize: contentFontSize }}
                placeholder={t.editor.contentPlaceholder}
              />
            </div>
          </div>
        )}

        {(editorMode === 'preview' || editorMode === 'split') && (
          <div
            data-editor-pane="preview"
            className={`flex flex-col overflow-y-auto ${editorMode === 'split' ? 'min-w-0' : 'min-w-0 flex-1'}`}
          >
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

      {contextMenu && (
        <div
          ref={contextMenuRef}
          role="menu"
          data-note-editor-context-menu="true"
          className="fixed z-[1000] w-[220px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {contextMenu.mode === 'editable' ? (
            <>
              <ContextMenuButton
                icon={<Copy className="h-4 w-4 text-gray-400" />}
                onClick={handleCopyFromContextMenu}
              >
                {t.editor.contextCopy}
              </ContextMenuButton>
              <ContextMenuButton
                icon={<Scissors className="h-4 w-4 text-gray-400" />}
                onClick={handleCutFromContextMenu}
              >
                {t.editor.contextCut}
              </ContextMenuButton>
              <ContextMenuButton
                icon={<Clipboard className="h-4 w-4 text-gray-400" />}
                onClick={handlePasteFromContextMenu}
              >
                {t.editor.contextPaste}
              </ContextMenuButton>
              <ContextMenuButton
                icon={<Check className="h-4 w-4 text-gray-400" />}
                onClick={handleSelectAllFromContextMenu}
              >
                {t.editor.contextSelectAll}
              </ContextMenuButton>

              {contextMenuTargetRef.current === contentTextareaRef.current && (
                <>
                  <ContextMenuDivider />
                  <ContextMenuButton
                    icon={<Bold className="h-4 w-4 text-gray-400" />}
                    onClick={() => {
                      applyMarkdown('**', '**', 'bold');
                      setContextMenu(null);
                    }}
                  >
                    {t.editor.contextBold}
                  </ContextMenuButton>
                  <ContextMenuButton
                    icon={<Italic className="h-4 w-4 text-gray-400" />}
                    onClick={() => {
                      applyMarkdown('*', '*', 'italic');
                      setContextMenu(null);
                    }}
                  >
                    {t.editor.contextItalic}
                  </ContextMenuButton>
                  <ContextMenuButton
                    icon={<Heading1 className="h-4 w-4 text-gray-400" />}
                    onClick={() => {
                      applyMarkdown('# ', '', t.editor.titlePlaceholder);
                      setContextMenu(null);
                    }}
                  >
                    {t.editor.contextHeading}
                  </ContextMenuButton>
                  <ContextMenuButton
                    icon={<List className="h-4 w-4 text-gray-400" />}
                    onClick={() => {
                      applyMarkdown('- ', '', t.noteList.newNote);
                      setContextMenu(null);
                    }}
                  >
                    {t.editor.contextList}
                  </ContextMenuButton>
                  <ContextMenuButton
                    icon={<ImageIcon className="h-4 w-4 text-gray-400" />}
                    onClick={() => {
                      setContextMenu(null);
                      handleInsertImage();
                    }}
                  >
                    {t.editor.contextInsertImage}
                  </ContextMenuButton>
                </>
              )}

              <ContextMenuDivider />
              <ContextMenuButton
                icon={<History className="h-4 w-4 text-gray-400" />}
                onClick={handleShowHistoryFromContextMenu}
              >
                {t.editor.contextShowHistory}
              </ContextMenuButton>
              <ContextMenuButton
                icon={<Download className="h-4 w-4 text-gray-400" />}
                onClick={handleExportFromContextMenu}
              >
                {t.editor.contextExportMd}
              </ContextMenuButton>
            </>
          ) : (
            <>
              <ContextMenuButton
                icon={<Copy className="h-4 w-4 text-gray-400" />}
                onClick={handleCopyFromContextMenu}
              >
                {t.editor.contextCopy}
              </ContextMenuButton>
              <ContextMenuButton
                icon={<Clipboard className="h-4 w-4 text-gray-400" />}
                onClick={handleCopyMarkdownFromContextMenu}
              >
                {t.editor.contextCopyMarkdown}
              </ContextMenuButton>
              <ContextMenuDivider />
              <ContextMenuButton
                icon={<History className="h-4 w-4 text-gray-400" />}
                onClick={handleShowHistoryFromContextMenu}
              >
                {t.editor.contextShowHistory}
              </ContextMenuButton>
              <ContextMenuButton
                icon={<Download className="h-4 w-4 text-gray-400" />}
                onClick={handleExportFromContextMenu}
              >
                {t.editor.contextExportMd}
              </ContextMenuButton>
            </>
          )}
        </div>
      )}

      {showCreateTagDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4"
          onClick={closeCreateTagDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-[420px] bg-white rounded-xl shadow-xl border border-gray-200 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">{t.tags.newTag}</h3>
              <button
                onClick={closeCreateTagDialog}
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
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateTagFromEditor();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      closeCreateTagDialog();
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
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewTagColor(c)}
                      className={`h-7 w-7 rounded-full transition-all ${
                        newTagColor === c ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={closeCreateTagDialog}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100"
                >
                  <X className="h-3.5 w-3.5" />
                  {t.common.cancel}
                </button>
                <button
                  onClick={handleCreateTagFromEditor}
                  disabled={!newTagName.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {t.common.create}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => {
            setPreviewHistory(null);
            setShowHistory(false);
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            className="flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-800">{t.editor.historyTitle}</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {formatMessage(t.editor.historyCount, { count: history.length })}
                </p>
              </div>
              <button
                onClick={() => {
                  setPreviewHistory(null);
                  setShowHistory(false);
                }}
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
                title={t.common.close}
                aria-label={t.common.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-scroll" onScroll={handleHistoryScroll}>
              {history.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">
                  <p>{t.editor.historyEmpty}</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {visibleHistory.map((h) => (
                    <div key={h.id} className="p-4 transition-colors hover:bg-gray-50">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">{h.title || t.noteList.untitled}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {new Date(h.createdAt).toLocaleString(language)}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <button
                            onClick={() => setPreviewHistory(h)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-white hover:text-accent"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {t.editor.historyPreview}
                          </button>
                          <button
                            onClick={() => handleRestoreClick(h.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-600"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {t.editor.historyRestore}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {hasMoreHistory && (
                    <div className="px-4 py-3 text-center text-xs text-gray-400">
                      {t.editor.historyLoadMore}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {previewHistory && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4"
          onClick={() => setPreviewHistory(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">{t.editor.historyPreview}</p>
                <h3 className="mt-1 truncate text-base font-semibold text-gray-900">
                  {previewHistory.title || t.noteList.untitled}
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  {t.editor.historyBackupTime}：{new Date(previewHistory.createdAt).toLocaleString(language)}
                </p>
              </div>
              <button
                onClick={() => setPreviewHistory(null)}
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
                title={t.common.close}
                aria-label={t.common.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 markdown-preview" style={{ fontSize: previewFontSize }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents} urlTransform={markdownUrlTransform}>{previewHistory.content || `*${t.noteList.noContent}*`}</ReactMarkdown>
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

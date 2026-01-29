import { useEffect, useRef, useState, type MouseEvent, type DragEvent } from 'react';
import { Plus, Pin, MoreVertical, Trash2, X, ChevronDown, FolderInput, Folder, FolderOpen, Book, Tag, Check, ChevronRight, Edit2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useStore } from '../store';
import { formatMessage, useI18n } from '../i18n';
import { notes } from '../wailsjs/go/main/models';
import * as App from '../wailsjs/go/main/App';

export function NoteList() {
  const {
    notes: notesList,
    setNotes,
    setDeletedNotes,
    selectedNoteId,
    setSelectedNoteId,
    selectedNoteIds,
    toggleNoteSelection,
    selectNotesRange,
    clearNoteSelection,
    isMultiSelectMode,
    setMultiSelectMode,
    selectedTagId,
    setSelectedTagId,
    selectedNotebookId,
    setSelectedNotebookId,
    tags,
    notebooks,
    currentView,
    expandedNotebooks,
    toggleNotebookExpand,
  } = useStore();

  const { t, language } = useI18n();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [batchTagMenuOpen, setBatchTagMenuOpen] = useState(false);
  const [showNotebookDialog, setShowNotebookDialog] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [notebookMenuOpen, setNotebookMenuOpen] = useState<string | null>(null);
  const [editingNotebookId, setEditingNotebookId] = useState<string | null>(null);
  const [editingNotebookName, setEditingNotebookName] = useState('');
  const [dragOverNotebookId, setDragOverNotebookId] = useState<string | null>(null);
  const [confirmDeleteNotebookId, setConfirmDeleteNotebookId] = useState<string | null>(null);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [dragOverNoteId, setDragOverNoteId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [draggedNoteIds, setDraggedNoteIds] = useState<string[]>([]);
  const menuContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const createMenuRef = useRef<HTMLDivElement | null>(null);
  const batchMoveMenuRef = useRef<HTMLDivElement | null>(null);
  const batchTagMenuRef = useRef<HTMLDivElement | null>(null);
  const lastSelectedId = useRef<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

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
    if (!moveMenuOpen && !batchTagMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      
      if (moveMenuOpen && batchMoveMenuRef.current && !batchMoveMenuRef.current.contains(target)) {
        setMoveMenuOpen(false);
      }
      if (batchTagMenuOpen && batchTagMenuRef.current && !batchTagMenuRef.current.contains(target)) {
        setBatchTagMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMoveMenuOpen(false);
        setBatchTagMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moveMenuOpen, batchTagMenuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const container = menuContainerRefs.current[menuOpen];
      const target = event.target as Node | null;
      if (!container || !target) return;
      if (!container.contains(target)) {
        setMenuOpen(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!createMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!createMenuRef.current || !target) return;
      if (!createMenuRef.current.contains(target)) {
        setCreateMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCreateMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [createMenuOpen]);

  useEffect(() => {
    if (!notebookMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const container = menuContainerRefs.current[`nb-${notebookMenuOpen}`];
      const target = event.target as Node | null;
      if (!container || !target) return;
      if (!container.contains(target)) {
        setNotebookMenuOpen(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotebookMenuOpen(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notebookMenuOpen]);

  let filteredNotes = notesList;

  if (currentView === 'recent') {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    filteredNotes = notesList.filter((note) => new Date(note.updatedAt) >= sevenDaysAgo);
  } else if (selectedTagId) {
    filteredNotes = notesList.filter((note) => note.tags?.some((tag) => tag.id === selectedTagId));
  } else if (selectedNotebookId) {
    filteredNotes = notesList.filter((note) => note.notebookId === selectedNotebookId);
  }

  const sortedNotes = filteredNotes;

  const virtualizer = useVirtualizer({
    count: sortedNotes.length,
    getScrollElement: () => listContainerRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  const handleCreateNote = async () => {
    try {
      const note = await App.CreateNote(t.noteList.newNote, '');
      const updatedNotes = await App.ListNotes();
      setNotes(updatedNotes || []);
      setSelectedNoteId(note.id);
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleTogglePin = async (note: notes.Note, e: MouseEvent) => {
    e.stopPropagation();
    try {
      await App.SetNotePinned(note.id, !note.pinned);
      const updatedNotes = await App.ListNotes();
      setNotes(updatedNotes || []);
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
    setMenuOpen(null);
  };

  const handleDeleteClick = (noteId: string, e: MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(noteId);
    setMenuOpen(null);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    const noteId = confirmDeleteId;
    setConfirmDeleteId(null);

    try {
      await App.SoftDeleteNote(noteId);
      const [updatedNotes, updatedDeleted] = await Promise.all([
        App.ListNotes(),
        App.ListDeletedNotes(),
      ]);
      setNotes(updatedNotes || []);
      setDeletedNotes(updatedDeleted || []);
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return t.time.yesterday;
    } else if (days < 7) {
      return formatMessage(t.time.daysAgo, { count: days });
    } else {
      return date.toLocaleDateString(language, { month: 'short', day: 'numeric' });
    }
  };

  const selectedTag = selectedTagId ? tags.find((t) => t.id === selectedTagId) : null;
  const selectedNotebook = selectedNotebookId ? notebooks.find((nb) => nb.id === selectedNotebookId) : null;

  const getTitle = () => {
    if (currentView === 'recent') return t.noteList.recentTitle;
    if (selectedTag) return `#${selectedTag.name}`;
    if (selectedNotebook) return `${selectedNotebook.icon} ${selectedNotebook.name}`;
    return t.noteList.title;
  };

  const handleCreateNotebookClick = () => {
    setCreateMenuOpen(false);
    setShowNotebookDialog(true);
    setNewNotebookName('');
  };

  const handleCreateNotebookConfirm = async () => {
    if (!newNotebookName.trim()) return;
    try {
      await App.CreateNotebook(newNotebookName.trim(), '📓');
      const updatedNotebooks = await App.ListNotebooks();
      useStore.getState().setNotebooks(updatedNotebooks || []);
    } catch (error) {
      console.error('Failed to create notebook:', error);
    }
    setShowNotebookDialog(false);
    setNewNotebookName('');
  };

  const handleMoveToNotebook = async (noteId: string, notebookId: string | null) => {
    try {
      await App.SetNoteNotebook(noteId, notebookId);
      const updatedNotes = await App.ListNotes();
      setNotes(updatedNotes || []);
    } catch (error) {
      console.error('Failed to move note:', error);
    }
    setMenuOpen(null);
    setMoveMenuOpen(false);
  };

  const handleNoteClick = (noteId: string, e: MouseEvent) => {
    if (isMultiSelectMode || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggleNoteSelection(noteId);
      lastSelectedId.current = noteId;
      if (!isMultiSelectMode) setMultiSelectMode(true);
    } else if (e.shiftKey && lastSelectedId.current) {
      e.preventDefault();
      selectNotesRange(lastSelectedId.current, noteId);
      if (!isMultiSelectMode) setMultiSelectMode(true);
    } else {
      clearNoteSelection();
      setSelectedNoteId(noteId);
      lastSelectedId.current = noteId;
    }
  };

  const handleBatchDelete = () => {
    if (selectedNoteIds.length === 0) return;
    setConfirmBatchDelete(true);
  };

  const confirmBatchDeleteAction = async () => {
    try {
      await App.BatchDeleteNotes(selectedNoteIds);
      const [updatedNotes, updatedDeleted] = await Promise.all([
        App.ListNotes(),
        App.ListDeletedNotes(),
      ]);
      setNotes(updatedNotes || []);
      setDeletedNotes(updatedDeleted || []);
      clearNoteSelection();
    } catch (error) {
      console.error('Failed to batch delete:', error);
    }
    setConfirmBatchDelete(false);
  };

  const handleBatchMoveToNotebook = async (notebookId: string | null) => {
    if (selectedNoteIds.length === 0) return;
    try {
      await App.SetNotesNotebook(selectedNoteIds, notebookId);
      const updatedNotes = await App.ListNotes();
      setNotes(updatedNotes || []);
      clearNoteSelection();
    } catch (error) {
      console.error('Failed to batch move:', error);
    }
    setMoveMenuOpen(false);
  };

  const handleBatchAddTag = async (tagId: string) => {
    if (selectedNoteIds.length === 0) return;
    try {
      await App.BatchAddTagToNotes(selectedNoteIds, tagId);
      const updatedNotes = await App.ListNotes();
      setNotes(updatedNotes || []);
      clearNoteSelection();
    } catch (error) {
      console.error('Failed to batch add tag:', error);
    }
    setBatchTagMenuOpen(false);
  };


  const handleNotebookDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // 只有当离开文件夹区域（包括子笔记）时才清除高亮
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverNotebookId(null);
    }
  };

  const handleNotebookDrop = async (e: DragEvent<HTMLDivElement>, notebookId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverNotebookId(null);
    setDraggingNoteId(null);
    setDraggedNoteIds([]);
    
    if (draggedNoteIds.length === 0) return;
    
    // 检查是否所有笔记都已经在目标文件夹中
    const notesToMove = draggedNoteIds.filter(id => {
      const note = notesList.find(n => n.id === id);
      return note && note.notebookId !== notebookId;
    });
    
    if (notesToMove.length === 0) return;
    
    try {
      await App.SetNotesNotebook(notesToMove, notebookId);
      const updatedNotes = await App.ListNotes();
      setNotes(updatedNotes || []);
      clearNoteSelection();
    } catch (error) {
      console.error('Failed to move notes:', error);
    }
  };

  const handleNoteDragOver = (e: DragEvent<HTMLDivElement>, noteId: string, targetNotebookId?: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 如果拖动的笔记在展开的文件夹内，高亮该文件夹
    if (targetNotebookId !== undefined) {
      setDragOverNotebookId(targetNotebookId);
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';
    setDragOverNoteId(noteId);
    setDragOverPosition(position);
  };

  const handleNoteDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // 只有当离开当前元素时才清除状态
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverNoteId(null);
      setDragOverPosition(null);
    }
  };

  const handleNoteDrop = async (e: DragEvent<HTMLDivElement>, targetNoteId: string, targetNotebookId?: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    const savedDragOverPosition = dragOverPosition;
    setDragOverNoteId(null);
    setDragOverPosition(null);
    setDragOverNotebookId(null);
    
    if (draggedNoteIds.length === 0 || !draggingNoteId) {
      setDraggingNoteId(null);
      setDraggedNoteIds([]);
      return;
    }
    
    const targetNote = notesList.find(n => n.id === targetNoteId);
    if (!targetNote) {
      setDraggingNoteId(null);
      setDraggedNoteIds([]);
      return;
    }
    
    // 判断是跨文件夹移动还是同文件夹内排序
    const draggedNote = notesList.find(n => n.id === draggingNoteId);
    const isCrossNotebookMove = targetNotebookId !== undefined && 
      draggedNote && draggedNote.notebookId !== targetNotebookId;
    
    if (isCrossNotebookMove) {
      // 跨文件夹移动
      const notesToMove = draggedNoteIds.filter(id => {
        const note = notesList.find(n => n.id === id);
        return note && note.notebookId !== targetNotebookId;
      });
      
      if (notesToMove.length > 0) {
        try {
          await App.SetNotesNotebook(notesToMove, targetNotebookId);
          const updatedNotes = await App.ListNotes();
          setNotes(updatedNotes || []);
          clearNoteSelection();
        } catch (error) {
          console.error('Failed to move notes:', error);
        }
      }
    } else {
      // 同文件夹内排序
      if (draggingNoteId === targetNoteId) {
        setDraggingNoteId(null);
        setDraggedNoteIds([]);
        return;
      }
      
      // 获取当前视图中的笔记列表（用于排序）
      const currentNotes = showNotebooksInList 
        ? (targetNote.notebookId 
            ? getNotesForNotebook(targetNote.notebookId) 
            : getUncategorizedNotes())
        : sortedNotes;
      
      const currentIds = currentNotes.map(n => n.id);
      const draggedIndex = currentIds.indexOf(draggingNoteId);
      let targetIndex = currentIds.indexOf(targetNoteId);
      
      if (draggedIndex === -1 || targetIndex === -1) {
        setDraggingNoteId(null);
        setDraggedNoteIds([]);
        return;
      }
      
      // 构建新的顺序
      const newIds = currentIds.filter(id => id !== draggingNoteId);
      if (savedDragOverPosition === 'after') {
        targetIndex = newIds.indexOf(targetNoteId) + 1;
      } else {
        targetIndex = newIds.indexOf(targetNoteId);
      }
      newIds.splice(targetIndex, 0, draggingNoteId);
      
      try {
        await App.ReorderNotes(newIds);
        const updatedNotes = await App.ListNotes();
        setNotes(updatedNotes || []);
      } catch (error) {
        console.error('Failed to reorder notes:', error);
      }
    }
    
    setDraggingNoteId(null);
    setDraggedNoteIds([]);
  };
  
  const handleDragStart = (e: DragEvent<HTMLDivElement>, noteId: string, isSelected: boolean) => {
    const ids = isSelected && selectedNoteIds.length > 0 ? selectedNoteIds : [noteId];
    setDraggingNoteId(noteId);
    setDraggedNoteIds(ids);
    e.dataTransfer.setData('text/plain', noteId);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragEnd = () => {
    setDraggingNoteId(null);
    setDraggedNoteIds([]);
    setDragOverNoteId(null);
    setDragOverPosition(null);
    setDragOverNotebookId(null);
  };

  const handleEditNotebook = (nb: typeof notebooks[0]) => {
    setEditingNotebookId(nb.id);
    setEditingNotebookName(nb.name);
    setNotebookMenuOpen(null);
  };

  const handleSaveNotebookEdit = async () => {
    if (!editingNotebookId || !editingNotebookName.trim()) return;
    try {
      const nb = notebooks.find((n) => n.id === editingNotebookId);
      await App.UpdateNotebook(editingNotebookId, editingNotebookName.trim(), nb?.icon || '📓');
      const updatedNotebooks = await App.ListNotebooks();
      useStore.getState().setNotebooks(updatedNotebooks || []);
    } catch (error) {
      console.error('Failed to update notebook:', error);
    }
    setEditingNotebookId(null);
    setEditingNotebookName('');
  };

  const handleDeleteNotebook = async () => {
    if (!confirmDeleteNotebookId) return;
    try {
      await App.DeleteNotebook(confirmDeleteNotebookId);
      const [updatedNotebooks, updatedNotes] = await Promise.all([
        App.ListNotebooks(),
        App.ListNotes(),
      ]);
      useStore.getState().setNotebooks(updatedNotebooks || []);
      setNotes(updatedNotes || []);
      if (selectedNotebookId === confirmDeleteNotebookId) {
        setSelectedNotebookId(null);
      }
    } catch (error) {
      console.error('Failed to delete notebook:', error);
    }
    setConfirmDeleteNotebookId(null);
  };

  const handleToggleNotebookPin = async (nb: typeof notebooks[0]) => {
    try {
      await App.SetNotebookPinned(nb.id, !nb.pinned);
      const updatedNotebooks = await App.ListNotebooks();
      useStore.getState().setNotebooks(updatedNotebooks || []);
    } catch (error) {
      console.error('Failed to toggle notebook pin:', error);
    }
    setNotebookMenuOpen(null);
  };

  const getNotesForNotebook = (notebookId: string) => {
    return sortedNotes.filter((note) => note.notebookId === notebookId);
  };

  const getUncategorizedNotes = () => {
    return sortedNotes.filter((note) => !note.notebookId);
  };

  const showNotebooksInList = currentView === 'notes' && !selectedTagId && !selectedNotebookId;

  const selectedNotes = notesList.filter((n) => selectedNoteIds.includes(n.id));
  const selectedNotebookIds = new Set(selectedNotes.map((n) => n.notebookId ?? null));
  const batchMoveExcludeNotebookId = selectedNotebookIds.size === 1 ? Array.from(selectedNotebookIds)[0] : undefined;
  const batchShowUncategorizedTarget = !(selectedNotebookIds.size === 1 && selectedNotebookIds.has(null));

  const renderNoteItem = (note: notes.Note, indented: boolean, parentNotebookId?: string | null) => {
    const isSelected = selectedNoteIds.includes(note.id);
    const moveToNotebooks = notebooks.filter((nb) => nb.id !== note.notebookId);
    const showUncategorizedTarget = !!note.notebookId;
    const isDragOver = dragOverNoteId === note.id;
    const isDragging = draggingNoteId === note.id || draggedNoteIds.includes(note.id);
    return (
      <div
        key={note.id}
        draggable
        onDragStart={(e) => handleDragStart(e, note.id, isSelected)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleNoteDragOver(e, note.id, parentNotebookId)}
        onDragLeave={handleNoteDragLeave}
        onDrop={(e) => handleNoteDrop(e, note.id, parentNotebookId)}
        onClick={(e) => handleNoteClick(note.id, e)}
        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors relative border-b border-gray-100 ${
          indented ? 'pl-10' : ''
        } ${selectedNoteId === note.id ? 'bg-primary-50 border-l-2 border-accent' : ''} ${isSelected ? 'bg-blue-50' : ''} ${isDragOver && dragOverPosition === 'before' ? 'border-t-2 border-t-accent' : ''} ${isDragOver && dragOverPosition === 'after' ? 'border-b-2 border-b-accent' : ''} ${isDragging ? 'opacity-50' : ''}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {isMultiSelectMode && (
              <div className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center ${
                isSelected ? 'bg-accent border-accent' : 'border-gray-300'
              }`}>
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {note.pinned && <Pin className="w-3 h-3 text-accent flex-shrink-0" />}
                <h3 className="font-medium text-gray-800 truncate">
                  {note.title || t.noteList.untitled}
                </h3>
              </div>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {note.content?.substring(0, 100) || t.noteList.noContent}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-400">{formatDate(note.updatedAt)}</span>
                {note.tags && note.tags.length > 0 && (
                  <div className="flex gap-1">
                    {note.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag.id}
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: tag.color + '20', color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                    {note.tags.length > 2 && (
                      <span className="text-xs text-gray-400">+{note.tags.length - 2}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            className="relative"
            ref={(el) => { menuContainerRefs.current[note.id] = el; }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(menuOpen === note.id ? null : note.id);
              }}
              className="p-1 rounded hover:bg-gray-200 text-gray-400"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen === note.id && (
              <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[100] min-w-[140px]">
                <button
                  onClick={(e) => handleTogglePin(note, e)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Pin className="w-4 h-4" />
                  {note.pinned ? t.noteList.unpin : t.noteList.pin}
                </button>
                <div className="relative group">
                  <button
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FolderInput className="w-4 h-4" />
                    {t.noteList.moveTo}
                  </button>
                  <div className="absolute right-full top-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px] hidden group-hover:block z-[100]">
                    {showUncategorizedTarget && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveToNotebook(note.id, null); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        {t.noteList.uncategorized}
                      </button>
                    )}
                    {moveToNotebooks.map((nb) => (
                      <button
                        key={nb.id}
                        onClick={(e) => { e.stopPropagation(); handleMoveToNotebook(note.id, nb.id); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Folder className="w-4 h-4 text-emerald-400" />
                        {nb.name}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteClick(note.id, e)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                  {t.common.delete}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-72 bg-white border-r border-primary-100 flex flex-col relative">
      <div className="p-4 border-b border-primary-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-semibold text-gray-800 truncate">{getTitle()}</h2>
            {(selectedTagId || selectedNotebookId) && (
              <button
                onClick={() => {
                  setSelectedTagId(null);
                  setSelectedNotebookId(null);
                }}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title={t.noteList.clearFilter}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="relative" ref={createMenuRef}>
            <button
              onClick={() => setCreateMenuOpen(!createMenuOpen)}
              className="p-2 rounded-lg bg-accent text-white hover:bg-primary-600 transition-colors flex items-center gap-1"
              title={t.common.create}
            >
              <Plus className="w-5 h-5" />
              <ChevronDown className="w-3 h-3" />
            </button>
            {createMenuOpen && (
              <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
                <button
                  onClick={() => { handleCreateNote(); setCreateMenuOpen(false); }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {t.noteList.newNote}
                </button>
                <button
                  onClick={handleCreateNotebookClick}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Book className="w-4 h-4" />
                  {t.noteList.newNotebook}
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {formatMessage(t.noteList.notesCount, { count: sortedNotes.length })}
        </p>

        {isMultiSelectMode && selectedNoteIds.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">
              {formatMessage(t.noteList.selectedCount, { count: selectedNoteIds.length })}
            </span>
            <div className="flex gap-1">
              <div className="relative" ref={batchMoveMenuRef}>
                <button
                  onClick={() => setMoveMenuOpen(!moveMenuOpen)}
                  className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 flex items-center gap-1"
                >
                  <FolderInput className="w-3 h-3" />
                  {t.noteList.move}
                </button>
                {moveMenuOpen && (
                  <div className="absolute left-0 top-7 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
                    {batchShowUncategorizedTarget && (
                      <button
                        onClick={() => handleBatchMoveToNotebook(null)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        {t.noteList.uncategorized}
                      </button>
                    )}
                    {notebooks
                      .filter((nb) => (batchMoveExcludeNotebookId ? nb.id !== batchMoveExcludeNotebookId : true))
                      .map((nb) => (
                      <button
                        key={nb.id}
                        onClick={() => handleBatchMoveToNotebook(nb.id)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Folder className="w-4 h-4 text-emerald-400" />
                        {nb.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative" ref={batchTagMenuRef}>
                <button
                  onClick={() => setBatchTagMenuOpen(!batchTagMenuOpen)}
                  className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 flex items-center gap-1"
                >
                  <Tag className="w-3 h-3" />
                  {t.noteList.tag}
                </button>
                {batchTagMenuOpen && (
                  <div className="absolute left-0 top-7 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[120px] max-h-[200px] overflow-y-auto">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => handleBatchAddTag(tag.id)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleBatchDelete}
                className="px-2 py-1 text-xs rounded bg-red-100 text-red-600 hover:bg-red-200 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                {t.common.delete}
              </button>
              <button
                onClick={clearNoteSelection}
                className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" ref={listContainerRef}>
        {showNotebooksInList ? (
          <div>
            {notebooks.map((nb) => {
              const notebookNotes = getNotesForNotebook(nb.id);
              const isExpanded = expandedNotebooks.has(nb.id);
              const isNotebookDragOver = dragOverNotebookId === nb.id;
              return (
                <div 
                  key={nb.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverNotebookId(nb.id);
                  }}
                  onDragLeave={handleNotebookDragLeave}
                  onDrop={(e) => handleNotebookDrop(e, nb.id)}
                  className={isNotebookDragOver ? 'ring-2 ring-blue-400 ring-inset bg-blue-50/30' : ''}
                >
                  <div
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 ${
                      isNotebookDragOver ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => toggleNotebookExpand(nb.id)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      {isExpanded ? (
                        <FolderOpen className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <Folder className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      )}
                      {editingNotebookId === nb.id ? (
                        <input
                          type="text"
                          value={editingNotebookName}
                          onChange={(e) => setEditingNotebookName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNotebookEdit(); if (e.key === 'Escape') setEditingNotebookId(null); }}
                          onBlur={handleSaveNotebookEdit}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-accent/50"
                          autoFocus
                        />
                      ) : (
                        <>
                          {nb.pinned && <Pin className="w-3 h-3 text-accent flex-shrink-0" />}
                          <span className="font-medium text-gray-700 truncate">{nb.name}</span>
                        </>
                      )}
                      <span className="text-xs text-gray-400">({notebookNotes.length})</span>
                    </div>
                    <div className="relative" ref={(el) => { menuContainerRefs.current[`nb-${nb.id}`] = el; }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setNotebookMenuOpen(notebookMenuOpen === nb.id ? null : nb.id); }}
                        className="p-1 rounded hover:bg-gray-200 text-gray-400"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {notebookMenuOpen === nb.id && (
                        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleToggleNotebookPin(nb); }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Pin className="w-4 h-4" />
                            {nb.pinned ? t.noteList.unpin : t.noteList.pin}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditNotebook(nb); }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            {t.noteList.rename}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteNotebookId(nb.id); setNotebookMenuOpen(null); }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                            {t.common.delete}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {isExpanded && notebookNotes.map((note) => renderNoteItem(note, true, nb.id))}
                </div>
              );
            })}
            {getUncategorizedNotes().length > 0 && (
              <>
                {notebooks.length > 0 && (
                  <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                    {t.noteList.uncategorized}
                  </div>
                )}
                {getUncategorizedNotes().map((note) => renderNoteItem(note, false, null))}
              </>
            )}
            {sortedNotes.length === 0 && notebooks.length === 0 && (
              <div className="p-4 text-center text-gray-400">
                <p>{t.noteList.noNotes}</p>
                <p className="text-sm mt-1">{t.noteList.createTip}</p>
              </div>
            )}
          </div>
        ) : sortedNotes.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            <p>{t.noteList.noNotes}</p>
            <p className="text-sm mt-1">{t.noteList.createTip}</p>
          </div>
        ) : (
          <div
            style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const note = sortedNotes[virtualRow.index];
              const isSelected = selectedNoteIds.includes(note.id);
              const isDragging = draggingNoteId === note.id || draggedNoteIds.includes(note.id);
              const isDragOver = dragOverNoteId === note.id;
              return (
                <div
                  key={note.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, note.id, isSelected)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleNoteDragOver(e, note.id)}
                    onDragLeave={handleNoteDragLeave}
                    onDrop={(e) => handleNoteDrop(e, note.id)}
                    onClick={(e) => handleNoteClick(note.id, e)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors relative border-b border-gray-100 ${
                      selectedNoteId === note.id ? 'bg-primary-50 border-l-2 border-accent' : ''
                    } ${isSelected ? 'bg-blue-50' : ''} ${isDragOver && dragOverPosition === 'before' ? 'border-t-2 border-t-accent' : ''} ${isDragOver && dragOverPosition === 'after' ? 'border-b-2 border-b-accent' : ''} ${isDragging ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {isMultiSelectMode && (
                          <div className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center ${
                            isSelected ? 'bg-accent border-accent' : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {note.pinned && <Pin className="w-3 h-3 text-accent flex-shrink-0" />}
                            <h3 className="font-medium text-gray-800 truncate">
                              {note.title || t.noteList.untitled}
                            </h3>
                          </div>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {note.content?.substring(0, 100) || t.noteList.noContent}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-400">{formatDate(note.updatedAt)}</span>
                            {note.tags && note.tags.length > 0 && (
                              <div className="flex gap-1">
                                {note.tags.slice(0, 2).map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="text-xs px-1.5 py-0.5 rounded"
                                    style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                                {note.tags.length > 2 && (
                                  <span className="text-xs text-gray-400">+{note.tags.length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        className="relative"
                        ref={(el) => {
                          menuContainerRefs.current[note.id] = el;
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(menuOpen === note.id ? null : note.id);
                          }}
                          className="p-1 rounded hover:bg-gray-200 text-gray-400"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {menuOpen === note.id && (
                          <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[100] min-w-[140px]">
                            <button
                              onClick={(e) => handleTogglePin(note, e)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Pin className="w-4 h-4" />
                              {note.pinned ? t.noteList.unpin : t.noteList.pin}
                            </button>
                            <div className="relative group">
                              <button
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FolderInput className="w-4 h-4" />
                                {t.noteList.moveTo}
                              </button>
                              <div className="absolute right-full top-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px] hidden group-hover:block z-[100]">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleMoveToNotebook(note.id, null); }}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                >
                                  {t.noteList.uncategorized}
                                </button>
                                {notebooks.map((nb) => (
                                  <button
                                    key={nb.id}
                                    onClick={(e) => { e.stopPropagation(); handleMoveToNotebook(note.id, nb.id); }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <span>{nb.icon}</span>
                                    {nb.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <button
                              onClick={(e) => handleDeleteClick(note.id, e)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                              {t.common.delete}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="w-[360px] bg-white rounded-xl shadow-xl border border-gray-200 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-gray-900">{t.noteList.deleteNoteTitle}</div>
            <div className="mt-2 text-sm text-gray-600">{t.noteList.deleteNoteDesc}</div>
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

      {showNotebookDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setShowNotebookDialog(false)}
        >
          <div
            className="w-[360px] bg-white rounded-xl shadow-xl border border-gray-200 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-gray-900">{t.noteList.newNotebook}</div>
            <div className="mt-3">
              <input
                type="text"
                value={newNotebookName}
                onChange={(e) => setNewNotebookName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateNotebookConfirm(); }}
                placeholder={t.noteList.notebookNamePlaceholder}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                autoFocus
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={() => setShowNotebookDialog(false)}
              >
                {t.common.cancel}
              </button>
              <button
                className="px-3 py-2 text-sm rounded-lg bg-accent text-white hover:bg-primary-600"
                onClick={handleCreateNotebookConfirm}
              >
                {t.common.create}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteNotebookId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setConfirmDeleteNotebookId(null)}
        >
          <div
            className="w-[360px] bg-white rounded-xl shadow-xl border border-gray-200 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-gray-900">{t.noteList.deleteNotebookTitle}</div>
            <div className="mt-2 text-sm text-gray-600">{t.noteList.deleteNotebookDesc}</div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={() => setConfirmDeleteNotebookId(null)}
              >
                {t.common.cancel}
              </button>
              <button
                className="px-3 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600"
                onClick={handleDeleteNotebook}
              >
                {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmBatchDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setConfirmBatchDelete(false)}
        >
          <div
            className="w-[360px] bg-white rounded-xl shadow-xl border border-gray-200 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-gray-900">{t.noteList.batchDeleteTitle}</div>
            <div className="mt-2 text-sm text-gray-600">
              {formatMessage(t.noteList.batchDeleteDesc, { count: selectedNoteIds.length })}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={() => setConfirmBatchDelete(false)}
              >
                {t.common.cancel}
              </button>
              <button
                className="px-3 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600"
                onClick={confirmBatchDeleteAction}
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

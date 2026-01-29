import { create } from 'zustand';
import { notes, tags, database, notebooks } from '../wailsjs/go/main/models';

export type ViewType = 'notes' | 'search' | 'tags' | 'backup' | 'settings' | 'trash' | 'recent';
export type EditorMode = 'edit' | 'preview' | 'split';

interface AppState {
  isUnlocked: boolean;
  isFirstRun: boolean;
  currentView: ViewType;
  notes: notes.Note[];
  deletedNotes: notes.Note[];
  tags: tags.Tag[];
  notebooks: notebooks.Notebook[];
  selectedNoteId: string | null;
  selectedNoteIds: string[];
  selectedNote: notes.Note | null;
  selectedNotebookId: string | null;
  editorMode: EditorMode;
  searchQuery: string;
  searchResults: notes.Note[];
  isSearching: boolean;
  searchProgress: number;
  selectedTagId: string | null;
  settings: database.Settings | null;
  version: string;
  dataDir: string;
  isCommandPaletteOpen: boolean;
  isMultiSelectMode: boolean;
  expandedNotebooks: Set<string>;

  setUnlocked: (unlocked: boolean) => void;
  setFirstRun: (firstRun: boolean) => void;
  setCurrentView: (view: ViewType) => void;
  setNotes: (notes: notes.Note[]) => void;
  setDeletedNotes: (notes: notes.Note[]) => void;
  setTags: (tags: tags.Tag[]) => void;
  setNotebooks: (notebooks: notebooks.Notebook[]) => void;
  setSelectedNoteId: (id: string | null) => void;
  setSelectedNoteIds: (ids: string[]) => void;
  toggleNoteSelection: (id: string) => void;
  selectNotesRange: (fromId: string, toId: string) => void;
  clearNoteSelection: () => void;
  setSelectedNote: (note: notes.Note | null) => void;
  setSelectedNotebookId: (id: string | null) => void;
  setEditorMode: (mode: EditorMode) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: notes.Note[]) => void;
  setIsSearching: (searching: boolean) => void;
  setSearchProgress: (progress: number) => void;
  setSelectedTagId: (id: string | null) => void;
  setSettings: (settings: database.Settings | null) => void;
  setVersion: (version: string) => void;
  setDataDir: (dir: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setMultiSelectMode: (mode: boolean) => void;
  expandNotebook: (id: string) => void;
  collapseNotebook: (id: string) => void;
  toggleNotebookExpand: (id: string) => void;
  reset: () => void;
}

const initialState = {
  isUnlocked: false,
  isFirstRun: true,
  currentView: 'notes' as ViewType,
  notes: [] as notes.Note[],
  deletedNotes: [] as notes.Note[],
  tags: [] as tags.Tag[],
  notebooks: [] as notebooks.Notebook[],
  selectedNoteId: null as string | null,
  selectedNoteIds: [] as string[],
  selectedNote: null as notes.Note | null,
  selectedNotebookId: null as string | null,
  editorMode: 'edit' as EditorMode,
  searchQuery: '',
  searchResults: [] as notes.Note[],
  isSearching: false,
  searchProgress: 0,
  selectedTagId: null as string | null,
  settings: null as database.Settings | null,
  version: 'v1.0.1',
  dataDir: '',
  isCommandPaletteOpen: false,
  isMultiSelectMode: false,
  expandedNotebooks: new Set<string>(),
};

export const useStore = create<AppState>((set, get) => ({
  ...initialState,

  setUnlocked: (unlocked) => set({ isUnlocked: unlocked }),
  setFirstRun: (firstRun) => set({ isFirstRun: firstRun }),
  setCurrentView: (view) => set({ currentView: view }),
  setNotes: (notes) => set({ notes }),
  setDeletedNotes: (notes) => set({ deletedNotes: notes }),
  setTags: (tags) => set({ tags }),
  setNotebooks: (notebooks) => set({ notebooks }),
  setSelectedNoteId: (id) => set({ selectedNoteId: id }),
  setSelectedNoteIds: (ids) => set({ selectedNoteIds: ids }),
  toggleNoteSelection: (id) => {
    const { selectedNoteIds } = get();
    if (selectedNoteIds.includes(id)) {
      set({ selectedNoteIds: selectedNoteIds.filter((i) => i !== id) });
    } else {
      set({ selectedNoteIds: [...selectedNoteIds, id] });
    }
  },
  selectNotesRange: (fromId, toId) => {
    const { notes: notesList } = get();
    const fromIndex = notesList.findIndex((n) => n.id === fromId);
    const toIndex = notesList.findIndex((n) => n.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    const ids = notesList.slice(start, end + 1).map((n) => n.id);
    set({ selectedNoteIds: ids });
  },
  clearNoteSelection: () => set({ selectedNoteIds: [], isMultiSelectMode: false }),
  setSelectedNote: (note) => set({ selectedNote: note }),
  setSelectedNotebookId: (id) => set({ selectedNotebookId: id, selectedTagId: null }),
  setEditorMode: (mode) => set({ editorMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
  setIsSearching: (searching) => set({ isSearching: searching }),
  setSearchProgress: (progress) => set({ searchProgress: progress }),
  setSelectedTagId: (id) => set({ selectedTagId: id, selectedNotebookId: null }),
  setSettings: (settings) => set({ settings }),
  setVersion: (version) => set({ version }),
  setDataDir: (dir) => set({ dataDir: dir }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setMultiSelectMode: (mode) => set({ isMultiSelectMode: mode }),
  expandNotebook: (id) => set((state) => {
    const next = new Set(state.expandedNotebooks);
    next.add(id);
    return { expandedNotebooks: next };
  }),
  collapseNotebook: (id) => set((state) => {
    const next = new Set(state.expandedNotebooks);
    next.delete(id);
    return { expandedNotebooks: next };
  }),
  toggleNotebookExpand: (id) => set((state) => {
    const next = new Set(state.expandedNotebooks);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return { expandedNotebooks: next };
  }),
  reset: () => set(initialState),
}));

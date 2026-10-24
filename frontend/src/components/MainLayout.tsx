import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n, formatMessage } from '../i18n';
import { useStore } from '../store';
import { Sidebar } from './Sidebar';
import { NoteList } from './NoteList';
import { NoteEditor } from './NoteEditor';
import { SearchView } from './SearchView';
import { SettingsView } from './SettingsView';
import { CommandPalette } from './CommandPalette';
import { TodoWorkspace } from './TodoWorkspace';
import { ImageManager } from './ImageManager';
import { CalendarView } from './CalendarView';
import * as App from '../../wailsjs/go/main/App';

export function MainLayout() {
  const { t } = useI18n();
  const {
    currentView,
    setNotes,
    setTags,
    setNotebooks,
    setSettings,
    setSelectedNote,
    selectedNoteId,
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    isNoteListCollapsed,
    toggleNoteListCollapsed,
    undecryptableNotes,
    setUndecryptableNotes,
  } = useStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [notesResult, tagsList, notebooksList, settings] = await Promise.all([
          App.ListNotesWithStatus(),
          App.ListTags(),
          App.ListNotebooks(),
          App.GetSettings(),
        ]);
        setNotes(notesResult?.notes || []);
        setUndecryptableNotes(notesResult?.undecryptable || 0);
        setTags(tagsList || []);
        setNotebooks(notebooksList || []);
        setSettings(settings);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };

    loadData();
  }, [setNotes, setTags, setNotebooks, setSettings, setUndecryptableNotes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCommandPaletteOpen]);

  useEffect(() => {
    let cancelled = false;
    const loadSelectedNote = async () => {
      if (selectedNoteId) {
        try {
          const note = await App.GetNote(selectedNoteId);
          if (!cancelled) setSelectedNote(note);
        } catch (error) {
          console.error('Failed to load note:', error);
          if (!cancelled) setSelectedNote(null);
        }
      } else if (!cancelled) {
        setSelectedNote(null);
      }
    };

    loadSelectedNote();
    return () => {
      cancelled = true;
    };
  }, [selectedNoteId, setSelectedNote]);

  const renderContent = () => {
    switch (currentView) {
      case 'notes':
      case 'recent':
        return (
          <div className="flex min-w-0 flex-1 overflow-hidden">
            {!isNoteListCollapsed && <NoteList />}
            <div className="relative flex items-stretch">
              <div className="w-px h-full bg-primary-100" />
              <button
                onClick={toggleNoteListCollapsed}
                className="absolute left-1/2 top-4 -translate-x-1/2 z-10 w-8 h-8 rounded-full border border-primary-200 bg-white text-primary-300 shadow-sm hover:bg-primary-50 hover:border-primary-300 hover:text-primary-500 transition-colors flex items-center justify-center"
                title={isNoteListCollapsed ? t.noteList.expandLeftList : t.noteList.collapseLeftList}
              >
                <span
                  className={`block w-2.5 h-2.5 border-t-2 border-r-2 border-current transition-transform ${
                    isNoteListCollapsed ? 'rotate-45 -translate-x-px' : '-rotate-[135deg] translate-x-px'
                  }`}
                />
              </button>
            </div>
            <NoteEditor />
          </div>
        );
      case 'search':
        return <SearchView />;
      case 'todos':
        return <TodoWorkspace />;
      case 'calendar':
        return <CalendarView />;
      case 'images':
        return <ImageManager />;
      case 'settings':
        return <SettingsView />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex bg-background">
      <Sidebar />
      <main className="min-w-0 flex-1 flex flex-col overflow-hidden">
        {undecryptableNotes > 0 && (
          <div
            role="alert"
            className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formatMessage(t.warnings.undecryptableNotes, { count: undecryptableNotes })}</span>
          </div>
        )}
        <div className="min-w-0 flex-1 flex overflow-hidden">
          {renderContent()}
        </div>
      </main>
      {isCommandPaletteOpen && <CommandPalette />}
    </div>
  );
}

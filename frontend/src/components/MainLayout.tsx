import { useEffect } from 'react';
import { useStore } from '../store';
import { Sidebar } from './Sidebar';
import { NoteList } from './NoteList';
import { NoteEditor } from './NoteEditor';
import { SearchView } from './SearchView';
import { TagsView } from './TagsView';
import { BackupView } from './BackupView';
import { SettingsView } from './SettingsView';
import { TrashView } from './TrashView';
import { CommandPalette } from './CommandPalette';
import * as App from '../wailsjs/go/main/App';

export function MainLayout() {
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
  } = useStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [notesList, tagsList, notebooksList, settings] = await Promise.all([
          App.ListNotes(),
          App.ListTags(),
          App.ListNotebooks(),
          App.GetSettings(),
        ]);
        setNotes(notesList || []);
        setTags(tagsList || []);
        setNotebooks(notebooksList || []);
        setSettings(settings);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };

    loadData();
  }, [setNotes, setTags, setNotebooks, setSettings]);

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
    const loadSelectedNote = async () => {
      if (selectedNoteId) {
        try {
          const note = await App.GetNote(selectedNoteId);
          setSelectedNote(note);
        } catch (error) {
          console.error('Failed to load note:', error);
          setSelectedNote(null);
        }
      } else {
        setSelectedNote(null);
      }
    };

    loadSelectedNote();
  }, [selectedNoteId, setSelectedNote]);

  const renderContent = () => {
    switch (currentView) {
      case 'notes':
      case 'recent':
        return (
          <div className="flex flex-1 overflow-hidden">
            <NoteList />
            <NoteEditor />
          </div>
        );
      case 'search':
        return <SearchView />;
      case 'tags':
        return <TagsView />;
      case 'backup':
        return <BackupView />;
      case 'settings':
        return <SettingsView />;
      case 'trash':
        return <TrashView />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 flex overflow-hidden">
        {renderContent()}
      </main>
      {isCommandPaletteOpen && <CommandPalette />}
    </div>
  );
}

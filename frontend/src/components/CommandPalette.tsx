import { useState, useEffect, useRef } from 'react';
import { Search, FileText, Tag, Book, X } from 'lucide-react';
import { useStore } from '../store';
import { useI18n } from '../i18n';

export function CommandPalette() {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    notes,
    notebooks,
    tags,
    setSelectedNoteId,
    setCurrentView,
    setSelectedNotebookId,
    setSelectedTagId,
  } = useStore();

  const { t } = useI18n();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
      }
    };
    if (isCommandPaletteOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const lowerQuery = query.toLowerCase();

  const filteredNotes = notes
    .filter((n) => n.title?.toLowerCase().includes(lowerQuery) || n.content?.toLowerCase().includes(lowerQuery))
    .slice(0, 8);

  const filteredNotebooks = notebooks
    .filter((nb) => nb.name.toLowerCase().includes(lowerQuery))
    .slice(0, 4);

  const filteredTags = tags
    .filter((t) => t.name.toLowerCase().includes(lowerQuery))
    .slice(0, 4);

  const handleSelectNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    setCurrentView('notes');
    setCommandPaletteOpen(false);
  };

  const handleSelectNotebook = (notebookId: string) => {
    setSelectedNotebookId(notebookId);
    setCurrentView('notes');
    setCommandPaletteOpen(false);
  };

  const handleSelectTag = (tagId: string) => {
    setSelectedTagId(tagId);
    setCurrentView('notes');
    setCommandPaletteOpen(false);
  };

  const hasResults = filteredNotes.length > 0 || filteredNotebooks.length > 0 || filteredTags.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="w-[560px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.commandPalette.placeholder}
            className="flex-1 text-base outline-none placeholder-gray-400"
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 rounded hover:bg-gray-100 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {!hasResults && query && (
            <div className="px-4 py-8 text-center text-gray-400">
              {t.commandPalette.noResults}
            </div>
          )}

          {filteredNotebooks.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1 text-xs font-medium text-gray-400 uppercase">{t.sidebar.notebooks}</div>
              {filteredNotebooks.map((nb) => (
                <button
                  key={nb.id}
                  onClick={() => handleSelectNotebook(nb.id)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                >
                  <Book className="w-4 h-4 text-gray-400" />
                  <span className="mr-2">{nb.icon}</span>
                  <span className="text-gray-700">{nb.name}</span>
                </button>
              ))}
            </div>
          )}

          {filteredTags.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1 text-xs font-medium text-gray-400 uppercase">{t.sidebar.tags}</div>
              {filteredTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleSelectTag(tag.id)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                >
                  <Tag className="w-4 h-4" style={{ color: tag.color }} />
                  <span className="text-gray-700">{tag.name}</span>
                </button>
              ))}
            </div>
          )}

          {filteredNotes.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1 text-xs font-medium text-gray-400 uppercase">{t.sidebar.notes}</div>
              {filteredNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => handleSelectNote(note.id)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                >
                  <FileText className="w-4 h-4 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-700 truncate">{note.title || t.noteList.untitled}</div>
                    <div className="text-xs text-gray-400 truncate">
                      {note.content?.substring(0, 60) || t.noteList.noContent}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!query && (
            <div className="px-4 py-6 text-center text-gray-400 text-sm">
              {t.commandPalette.placeholder}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 flex items-center gap-4">
          <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">↑↓</kbd> {t.commandPalette.navigate}</span>
          <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Enter</kbd> {t.commandPalette.select}</span>
          <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">Esc</kbd> {t.commandPalette.close}</span>
        </div>
      </div>
    </div>
  );
}

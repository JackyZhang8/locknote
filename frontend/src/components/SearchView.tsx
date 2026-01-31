import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, Folder } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useStore } from '../store';
import { formatMessage, useI18n } from '../i18n';
import { notes as notesModel } from '../../wailsjs/go/models';

export function SearchView() {
  const {
    notes,
    notebooks,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isSearching,
    setIsSearching,
    searchProgress,
    setSearchProgress,
    setCurrentView,
    setSelectedNoteId,
    setSelectedNotebookId,
    expandNotebook,
  } = useStore();

  const { t } = useI18n();

  const [localQuery, setLocalQuery] = useState(searchQuery);
  const searchRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const handleSearch = async () => {
    if (!localQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchProgress(0);
    abortRef.current = false;

    const query = localQuery.toLowerCase();
    const results: typeof notes = [];

    for (let i = 0; i < notes.length; i++) {
      if (abortRef.current) break;

      const note = notes[i];
      const titleMatch = note.title?.toLowerCase().includes(query);
      const contentMatch = note.content?.toLowerCase().includes(query);
      const tagMatch = note.tags?.some((tag) => tag.name.toLowerCase().includes(query));

      if (titleMatch || contentMatch || tagMatch) {
        results.push(note);
      }

      if (i % 50 === 0) {
        setSearchProgress(Math.round(((i + 1) / notes.length) * 100));
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    setSearchProgress(100);

    if (!abortRef.current) {
      setSearchResults(results);
      setSearchQuery(localQuery);
    }
    setIsSearching(false);
  };

  const handleCancel = () => {
    abortRef.current = true;
    setIsSearching(false);
  };

  const handleSelectNote = (note: notesModel.Note) => {
    setSelectedNoteId(note.id);
    // 如果笔记属于某个笔记本，展开该笔记本并清除筛选
    if (note.notebookId) {
      expandNotebook(note.notebookId);
    }
    // 清除笔记本筛选，显示全部笔记视图
    setSelectedNotebookId(null);
    setCurrentView('notes');
  };

  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text;

    const escapedQuery = escapeRegExp(query);
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const virtualizer = useVirtualizer({
    count: searchResults.length,
    getScrollElement: () => listContainerRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  const getNotebookName = (notebookId: string | null | undefined) => {
    if (!notebookId) return null;
    const notebook = notebooks.find((nb) => nb.id === notebookId);
    return notebook?.name || null;
  };

  return (
    <div className="flex-1 flex flex-col bg-white">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder={t.search.placeholder}
            />
            {localQuery && (
              <button
                onClick={() => {
                  setLocalQuery('');
                  setSearchResults([]);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !localQuery.trim()}
            className="px-6 py-3 bg-accent text-white rounded-xl font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t.common.search}
          </button>
        </div>

        {isSearching && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t.search.searching} {searchProgress}%
              </div>
              <button onClick={handleCancel} className="text-sm text-red-500 hover:text-red-600">
                {t.common.cancel}
              </button>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-accent h-1.5 rounded-full transition-all"
                style={{ width: `${searchProgress}%` }}
              />
            </div>
          </div>
        )}

        <p className="text-sm text-gray-500 mt-3">
          {formatMessage(t.search.shortcutTip, { shortcut: 'Cmd/Ctrl+K' })}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6" ref={listContainerRef}>
        {searchResults.length === 0 && searchQuery && !isSearching ? (
          <div className="text-center text-gray-400 py-12">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t.search.noResults}</p>
          </div>
        ) : searchResults.length > 0 ? (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              {formatMessage(t.search.resultsCount, { count: searchResults.length })}
            </p>
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const note = searchResults[virtualRow.index];
                const notebookName = getNotebookName(note.notebookId);
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
                      onClick={() => handleSelectNote(note)}
                      className="p-4 mb-3 border border-gray-200 rounded-xl hover:border-accent hover:bg-primary-50 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-800 flex-1">
                          {highlightText(note.title || t.noteList.untitled, localQuery)}
                        </h3>
                        {notebookName && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Folder className="w-3 h-3" />
                            {notebookName}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                        {highlightText(note.content?.substring(0, 200) || t.noteList.noContent, localQuery)}
                      </p>
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {note.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="text-xs px-2 py-0.5 rounded"
                              style={{ backgroundColor: tag.color + '20', color: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400 py-12">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t.search.startSearch}</p>
          </div>
        )}
      </div>
    </div>
  );
}

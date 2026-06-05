import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { formatMessage, useI18n } from '../i18n';
import { useStore } from '../store';
import {
  buildCalendarDayIndex,
  buildHeatMapWeeks,
  buildMonthGrid,
  getCalendarHeatLevel,
  getHeatMapColumnCapacity,
  parseCalendarTimestamp,
  type CalendarDaySummary,
  type CalendarMonthCell,
  type CalendarTodoSource,
} from '../calendar';
import { notes, todos } from '../../wailsjs/go/models';
import * as App from '../../wailsjs/go/main/App';

function dateKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

function emptyDaySummary(dateKey: string): CalendarDaySummary {
  return {
    dateKey,
    noteEvents: [],
    dueTodos: [],
    completedTodos: [],
    noteCount: 0,
    todoDueCount: 0,
    todoCompletedCount: 0,
    heatScore: 0,
  };
}

function formatTime(value: string | undefined, language: string): string {
  if (!value) return '--';
  const date = parseCalendarTimestamp(value);
  if (!date) return '--';
  return date.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value: string | undefined, language: string): string {
  void language;
  if (!value) return '--';
  const date = parseCalendarTimestamp(value);
  if (!date) return '--';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function getTodoSubtaskProgress(todo: CalendarTodoSource): string {
  const subtasks = Array.isArray(todo.subtasks) ? todo.subtasks : [];
  const completedCount = subtasks.filter((subtask) => subtask.completed).length;
  return `${completedCount}/${subtasks.length}`;
}

function formatMonthTitle(date: Date, language: string): string {
  return date.toLocaleDateString(language, { year: 'numeric', month: 'long' });
}

function formatSelectedDate(dateKey: string, language: string): string {
  return dateFromKey(dateKey).toLocaleDateString(language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

function heatLevelClass(level: number): string {
  switch (level) {
    case 1:
      return 'bg-emerald-100 border-emerald-200';
    case 2:
      return 'bg-emerald-200 border-emerald-300';
    case 3:
      return 'bg-emerald-400 border-emerald-500';
    case 4:
      return 'bg-emerald-600 border-emerald-700';
    default:
      return 'bg-gray-100 border-gray-200';
  }
}

function priorityDotClass(priority: string): string {
  switch (priority) {
    case 'high':
      return 'bg-red-500';
    case 'low':
      return 'bg-gray-400';
    default:
      return 'bg-amber-500';
  }
}

export function CalendarView() {
  const {
    setCurrentView,
    setEditorMode,
    setNotes,
    setSelectedNoteId,
    setSelectedNotebookId,
    setSelectedTagId,
    setSelectedTodoId,
  } = useStore();
  const { t, language } = useI18n();

  const getPriorityLabel = (priority: string): string => {
    switch (priority) {
      case 'high':
        return t.todos.priorityHigh;
      case 'low':
        return t.todos.priorityLow;
      default:
        return t.todos.priorityMedium;
    }
  };

  const todayKey = dateKeyFromDate(new Date());
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [noteItems, setNoteItems] = useState<notes.Note[]>([]);
  const [todoItems, setTodoItems] = useState<todos.Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewTodoInput, setShowNewTodoInput] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isCreatingTodo, setIsCreatingTodo] = useState(false);
  const [showHeatMap, setShowHeatMap] = useState(false);
  const heatMapContainerRef = useRef<HTMLDivElement | null>(null);
  const [heatMapColumnCount, setHeatMapColumnCount] = useState(() => getHeatMapColumnCapacity(0));
  const [hoveredHeatMapDay, setHoveredHeatMapDay] = useState<CalendarDaySummary | null>(null);

  const loadCalendarData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [notesList, todosList] = await Promise.all([
        App.ListNotes(),
        App.ListTodos(),
      ]);
      setNoteItems(notesList || []);
      setTodoItems(todosList || []);
      setNotes(notesList || []);
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showHeatMap || !heatMapContainerRef.current) return undefined;

    const container = heatMapContainerRef.current;
    const updateColumnCount = (width: number) => {
      const nextCount = getHeatMapColumnCapacity(width);
      setHeatMapColumnCount((current) => (current === nextCount ? current : nextCount));
    };

    updateColumnCount(container.clientWidth);

    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => updateColumnCount(container.clientWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }

    const observer = new ResizeObserver((entries) => {
      updateColumnCount(entries[0]?.contentRect.width ?? container.clientWidth);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [showHeatMap]);

  const dayIndex = useMemo(() => buildCalendarDayIndex(noteItems, todoItems), [noteItems, todoItems]);
  const monthCells = useMemo(
    () => buildMonthGrid(monthCursor.getFullYear(), monthCursor.getMonth()),
    [monthCursor],
  );
  const selectedDay = dayIndex[selectedDateKey] || emptyDaySummary(selectedDateKey);
  const heatMapAnchorDate = useMemo(() => dateFromKey(todayKey), [todayKey]);
  const heatWeeks = useMemo(
    () => buildHeatMapWeeks(heatMapAnchorDate, heatMapColumnCount),
    [heatMapAnchorDate, heatMapColumnCount],
  );

  const selectDate = (cell: CalendarMonthCell) => {
    setSelectedDateKey(cell.dateKey);
    if (cell.date.getMonth() !== monthCursor.getMonth() || cell.date.getFullYear() !== monthCursor.getFullYear()) {
      setMonthCursor(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
    }
  };

  const goToPreviousMonth = () => {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const now = new Date();
    setSelectedDateKey(dateKeyFromDate(now));
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const openNote = (note: notes.Note) => {
    setSelectedTagId(null);
    setSelectedNotebookId(null);
    setSelectedNoteId(note.id);
    setEditorMode('edit');
    setCurrentView('notes');
  };

  const openTodo = (todo: todos.Todo) => {
    setSelectedTodoId(todo.id);
    setCurrentView('todos');
  };

  const handleCreateNote = async () => {
    if (isCreatingNote) return;
    setIsCreatingNote(true);
    setError(null);
    try {
      const created = await App.CreateNote(t.calendar.newNoteTitle, '');
      const notesList = await App.ListNotes();
      setNoteItems(notesList || []);
      setNotes(notesList || []);
      setSelectedTagId(null);
      setSelectedNotebookId(null);
      setSelectedNoteId(created.id);
      setEditorMode('edit');
      setCurrentView('notes');
    } catch (createError) {
      setError(String(createError));
    } finally {
      setIsCreatingNote(false);
    }
  };

  const handleCreateTodo = async () => {
    const title = newTodoTitle.trim();
    if (!title || isCreatingTodo) return;
    setIsCreatingTodo(true);
    setError(null);
    try {
      const created = await App.CreateTodo(title, 'medium', selectedDateKey);
      const todosList = await App.ListTodos();
      setTodoItems(todosList || []);
      setSelectedTodoId(created.id);
      setNewTodoTitle('');
      setShowNewTodoInput(false);
    } catch (createError) {
      setError(String(createError));
    } finally {
      setIsCreatingTodo(false);
    }
  };

  const handleTodoKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleCreateTodo();
    }
    if (event.key === 'Escape') {
      setShowNewTodoInput(false);
      setNewTodoTitle('');
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden bg-background">
      <div className="grid flex-1 grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-[minmax(260px,1fr)_minmax(0,3fr)]">
        <aside className="min-w-0 overflow-y-auto">
          <section className="bg-white border border-primary-100 rounded-lg">
            <div className="border-b border-gray-100 px-4 py-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold text-gray-900">{t.calendar.title}</h2>
              </div>
              <p className="mt-1 text-xs text-gray-500">{t.calendar.subtitle}</p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadCalendarData}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  title={t.calendar.refresh}
                  aria-label={t.calendar.refresh}
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={goToToday}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  {t.calendar.today}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <button
                type="button"
                onClick={goToPreviousMonth}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                title={t.calendar.previousMonth}
                aria-label={t.calendar.previousMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="text-sm font-semibold text-gray-900">{formatMonthTitle(monthCursor, language)}</h3>
              <button
                type="button"
                onClick={goToNextMonth}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                title={t.calendar.nextMonth}
                aria-label={t.calendar.nextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {loading ? (
              <div className="px-4 py-10 text-sm text-gray-400">{t.calendar.loading}</div>
            ) : (
              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[11px] font-medium text-gray-400">
                  {t.calendar.weekdays.map((weekday) => (
                    <div key={weekday}>{weekday}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthCells.map((cell) => {
                    const day = dayIndex[cell.dateKey] || emptyDaySummary(cell.dateKey);
                    const heatLevel = getCalendarHeatLevel(day.heatScore);
                    const isSelected = cell.dateKey === selectedDateKey;
                    const isToday = cell.dateKey === todayKey;
                    const heatClass = cell.isCurrentMonth ? heatLevelClass(heatLevel) : 'border-gray-100 bg-white';
                    const dateTextClass = cell.isCurrentMonth && heatLevel >= 3 ? 'text-white' : 'text-gray-600';
                    const todayClass = isToday && !isSelected ? 'ring-2 ring-accent/30 text-accent' : '';
                    return (
                      <button
                        key={cell.dateKey}
                        type="button"
                        onClick={() => selectDate(cell)}
                        className={`aspect-square rounded-lg border text-sm font-medium transition-colors ${
                          isSelected
                            ? 'border-accent bg-primary-50 text-accent shadow-sm'
                            : `${heatClass} ${dateTextClass} hover:border-primary-300 hover:ring-2 hover:ring-primary-100`
                        } ${todayClass} ${cell.isCurrentMonth ? '' : 'opacity-40'}`}
                      >
                        {cell.date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </aside>

        <div className="min-w-0 overflow-y-auto">
          <section className="bg-white border border-primary-100 rounded-lg">
            <div className="border-b border-gray-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{t.calendar.heatMap}</h3>
                  <p className="mt-1 text-sm text-gray-500">{t.calendar.heatMapSubtitle}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <span>{t.calendar.heatLegendLess}</span>
                    {[0, 1, 2, 3, 4].map((level) => (
                      <span key={level} className={`h-3 w-3 rounded-sm border ${heatLevelClass(level)}`} />
                    ))}
                    <span>{t.calendar.heatLegendMore}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHeatMap((open) => !open)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    {showHeatMap ? t.calendar.hideHeatMap : t.calendar.showHeatMap}
                  </button>
                </div>
              </div>
            </div>
            {showHeatMap ? (
              <div className="overflow-visible p-5">
                <div ref={heatMapContainerRef} className="min-w-0">
                  <div className="flex justify-end gap-1">
                    {heatWeeks.map((week, weekIndex) => (
                      <div key={`${heatMapAnchorDate.toISOString()}-${weekIndex}`} className="grid grid-rows-7 gap-1">
                        {week.map((cell) => {
                          const day = dayIndex[cell.dateKey] || emptyDaySummary(cell.dateKey);
                          return (
                            <div
                              key={cell.dateKey}
                              className="relative h-3.5 w-3.5"
                              onMouseEnter={() => setHoveredHeatMapDay(day)}
                              onMouseLeave={() => setHoveredHeatMapDay(null)}
                            >
                              <button
                                type="button"
                                onClick={() => selectDate(cell)}
                                className={`h-3.5 w-3.5 rounded-sm border ${heatLevelClass(getCalendarHeatLevel(day.heatScore))} ${
                                  cell.isCurrentMonth ? '' : 'opacity-30'
                                }`}
                                aria-label={`${cell.dateKey}: ${day.noteCount} ${t.calendar.notes}, ${day.todoCompletedCount} ${t.calendar.completedTodos}`}
                              />
                              {hoveredHeatMapDay ? (
                                hoveredHeatMapDay.dateKey === day.dateKey ? (
                                  <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-left text-[11px] font-medium text-white shadow-lg">
                                    <div>{cell.dateKey}</div>
                                    <div className="font-normal text-gray-200">
                                      {day.noteCount} {t.calendar.notes} · {day.todoCompletedCount} {t.calendar.completedTodos}
                                    </div>
                                  </div>
                                ) : null
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <div className="mt-6 bg-white border border-primary-100 rounded-lg">
            <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-medium uppercase text-gray-400">{t.calendar.selectedDay}</div>
                  <h3 className="mt-1 text-lg font-semibold text-gray-900">{formatSelectedDate(selectedDateKey, language)}</h3>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCreateNote}
                    disabled={isCreatingNote}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t.calendar.createNote}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewTodoInput(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t.calendar.createTodo}</span>
                  </button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-primary-50 px-2 py-2 text-gray-600">
                  <div className="font-semibold text-gray-900">{selectedDay.noteCount}</div>
                  <div>{t.calendar.notes}</div>
                </div>
                <div className="rounded-lg bg-amber-50 px-2 py-2 text-amber-700">
                  <div className="font-semibold">{selectedDay.todoDueCount}</div>
                  <div>{t.calendar.dueTodos}</div>
                </div>
                <div className="rounded-lg bg-emerald-50 px-2 py-2 text-emerald-700">
                  <div className="font-semibold">{selectedDay.todoCompletedCount}</div>
                  <div>{t.calendar.completedTodos}</div>
                </div>
              </div>
              {showNewTodoInput ? (
                <input
                  value={newTodoTitle}
                  autoFocus
                  onChange={(event) => setNewTodoTitle(event.target.value)}
                  onKeyDown={handleTodoKeyDown}
                  onBlur={() => {
                    if (!newTodoTitle.trim()) setShowNewTodoInput(false);
                  }}
                  placeholder={t.calendar.newTodoPlaceholder}
                  disabled={isCreatingTodo}
                  className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:bg-gray-50"
                />
              ) : null}
              {error ? (
                <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {t.calendar.loadFailed}: {error}
                </div>
              ) : null}
            </div>

            <div className="space-y-6 p-5">
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-accent" />
                  <h4 className="font-semibold text-gray-900">{t.calendar.notesOnDay}</h4>
                </div>
                {selectedDay.noteEvents.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                    {t.calendar.noNotes}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDay.noteEvents.map((event) => (
                      <button
                        key={event.note.id}
                        type="button"
                        onClick={() => openNote(event.note as notes.Note)}
                        className="w-full rounded-lg border border-gray-100 px-3 py-3 text-left hover:border-primary-200 hover:bg-primary-50/50"
                      >
                        <div className="line-clamp-1 text-sm font-medium text-gray-800">
                          {event.note.title || t.noteList.untitled}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                          {event.createdOnDate ? (
                            <span>{formatMessage(t.calendar.createdAt, { time: formatTime(event.note.createdAt, language) })}</span>
                          ) : null}
                          {event.updatedOnDate ? (
                            <span>{formatMessage(t.calendar.editedAt, { time: formatTime(event.note.updatedAt, language) })}</span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-amber-500" />
                  <h4 className="font-semibold text-gray-900">{t.calendar.dueToday}</h4>
                </div>
                {selectedDay.dueTodos.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                    {t.calendar.noDueTodos}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDay.dueTodos.map((todo) => (
                      <button
                        key={todo.id}
                        type="button"
                        onClick={() => openTodo(todo as todos.Todo)}
                        className="w-full rounded-lg border border-gray-100 px-3 py-3 text-left hover:border-primary-200 hover:bg-primary-50/50"
                      >
                        <div className="flex items-start gap-2">
                          {todo.completed ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                          ) : (
                            <Circle className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-300" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className={`line-clamp-2 text-sm font-medium ${todo.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                              {todo.title}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
                              <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-sm ${priorityDotClass(todo.priority)}`} />
                              <span>{t.todos.priority}</span>
                              <span>{getPriorityLabel(todo.priority)}</span>
                              <span>{getTodoSubtaskProgress(todo)}</span>
                              <span>{formatDateTime(todo.createdAt, language)}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <h4 className="font-semibold text-gray-900">{t.calendar.completedToday}</h4>
                </div>
                {selectedDay.completedTodos.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                    {t.calendar.noCompletedTodos}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDay.completedTodos.map((todo) => (
                      <button
                        key={todo.id}
                        type="button"
                        onClick={() => openTodo(todo as todos.Todo)}
                        className="w-full rounded-lg border border-gray-100 px-3 py-3 text-left hover:border-primary-200 hover:bg-primary-50/50"
                      >
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 text-sm font-medium text-gray-500 line-through">{todo.title}</div>
                            <div className="mt-2 text-xs text-gray-400">
                              {formatTime(todo.completedAt || todo.updatedAt, language)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

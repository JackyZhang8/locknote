import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Calendar, Check, ChevronRight, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import { filterTodos, type TodoDateFilter } from '../todoFilters';
import { todos } from '../../wailsjs/go/models';
import * as App from '../../wailsjs/go/main/App';

type DeleteTarget = { type: 'todo' | 'subtask'; id: string };

function toDateInputValue(value?: string): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function getPrioritySquareClasses(priority: string): string {
  switch (priority) {
    case 'high':
      return 'bg-red-500';
    case 'low':
      return 'bg-gray-400';
    default:
      return 'bg-amber-500';
  }
}

function getPriorityTitleClasses(priority: string, completed: boolean): string {
  if (completed) return 'text-gray-400 line-through';
  switch (priority) {
    case 'high':
      return 'text-red-600';
    case 'low':
      return 'text-gray-700';
    default:
      return 'text-amber-700';
  }
}

function getDueDateClasses(value?: string): string {
  if (!value) return 'text-gray-400';
  const dueAt = new Date(value);
  if (Number.isNaN(dueAt.getTime())) return 'text-gray-400';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (dueAt < todayStart) return 'text-red-500';
  if (dueAt < tomorrowStart) return 'text-accent';
  return 'text-gray-500';
}

function getTodoSubtasks(todo: todos.Todo | null): todos.Subtask[] {
  return Array.isArray(todo?.subtasks) ? todo.subtasks : [];
}

export function TodoWorkspace() {
  const { selectedTodoId, setSelectedTodoId } = useStore();
  const { t, language } = useI18n();
  const priorityMenuRef = useRef<HTMLDivElement | null>(null);

  const [todoItems, setTodoItems] = useState<todos.Todo[]>([]);
  const [todoFilter, setTodoFilter] = useState<TodoDateFilter>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [showNewTodoInput, setShowNewTodoInput] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showNewSubtaskInput, setShowNewSubtaskInput] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingTodoTitle, setEditingTodoTitle] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [editDueDate, setEditDueDate] = useState('');
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<DeleteTarget | null>(null);
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [recentlyCompletedTodoIds, setRecentlyCompletedTodoIds] = useState<string[]>([]);
  const priorityOptions = [
    { id: 'low', label: t.todos.priorityLow },
    { id: 'medium', label: t.todos.priorityMedium },
    { id: 'high', label: t.todos.priorityHigh },
  ];
  const getPriorityText = (priority: string) => {
    const option = priorityOptions.find((item) => item.id === priority);
    return option?.label || t.todos.priorityMedium;
  };

  const loadWorkspace = async (preferredTodoId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const todosList = await App.ListTodos();
      setTodoItems(todosList || []);

      const nextSelectedId = preferredTodoId ?? selectedTodoId;
      if (nextSelectedId && (todosList || []).some((todo) => todo.id === nextSelectedId)) {
        setSelectedTodoId(nextSelectedId);
      } else if ((todosList || []).length > 0) {
        setSelectedTodoId(todosList[0].id);
      } else {
        setSelectedTodoId(null);
      }
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTodos = useMemo(() => {
    const baseTodos = filterTodos(todoItems, todoFilter);
    if (todoFilter === 'completed' || recentlyCompletedTodoIds.length === 0) {
      return baseTodos;
    }
    const visibleIds = new Set(baseTodos.map((todo) => todo.id));
    const retainedTodos = todoItems.filter((todo) => recentlyCompletedTodoIds.includes(todo.id) && !visibleIds.has(todo.id));
    return [...retainedTodos, ...baseTodos];
  }, [recentlyCompletedTodoIds, todoFilter, todoItems]);

  const selectedTodo = useMemo(
    () => todoItems.find((todo) => todo.id === selectedTodoId) || null,
    [selectedTodoId, todoItems],
  );

  const todoFilterOptions: Array<{ id: TodoDateFilter; label: string; count: number }> = useMemo(() => [
    { id: 'active', label: t.todos.filterActive, count: filterTodos(todoItems, 'active').length },
    { id: 'today', label: t.todos.filterToday, count: filterTodos(todoItems, 'today').length },
    { id: 'overdue', label: t.todos.filterOverdue, count: filterTodos(todoItems, 'overdue').length },
    { id: 'completed', label: t.todos.filterCompleted, count: filterTodos(todoItems, 'completed').length },
  ], [t.todos.filterActive, t.todos.filterCompleted, t.todos.filterOverdue, t.todos.filterToday, todoItems]);

  useEffect(() => {
    if (!selectedTodo) {
      setEditTitle('');
      setEditPriority('medium');
      setEditDueDate('');
      return;
    }

    setEditTitle(selectedTodo.title);
    setEditingTodoTitle(false);
    setEditingSubtaskId(null);
    setEditingSubtaskTitle('');
    setShowNewSubtaskInput(false);
    setPriorityMenuOpen(false);
    setEditPriority(selectedTodo.priority || 'medium');
    setEditDueDate(toDateInputValue(selectedTodo.dueAt));
    setEditingDueDate(false);
  }, [selectedTodo]);

  useEffect(() => {
    if (!selectedTodoId || filteredTodos.some((todo) => todo.id === selectedTodoId)) {
      return;
    }
    if (filteredTodos.length > 0) {
      setSelectedTodoId(filteredTodos[0].id);
    }
  }, [filteredTodos, selectedTodoId, setSelectedTodoId]);

  useEffect(() => {
    if (!priorityMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || priorityMenuRef.current?.contains(target)) return;
      setPriorityMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [priorityMenuOpen]);

  const handleCreateTodo = async () => {
    const title = newTodoTitle.trim();
    if (!title) return;
    const todo = await App.CreateTodo(title, 'medium', '');
    setNewTodoTitle('');
    setShowNewTodoInput(false);
    await loadWorkspace(todo.id);
  };

  const handleNewTodoBlur = () => {
    if (newTodoTitle.trim()) return;
    setShowNewTodoInput(false);
  };

  const saveTodo = async (overrides: Partial<{ title: string; priority: string; dueDate: string }> = {}) => {
    if (!selectedTodo) return;
    const title = (overrides.title ?? editTitle).trim();
    if (!title) {
      setEditTitle(selectedTodo.title);
      return;
    }
    const priority = overrides.priority ?? editPriority;
    const dueDate = overrides.dueDate ?? editDueDate;
    const updated = await App.UpdateTodo(selectedTodo.id, title, priority, dueDate);
    await loadWorkspace(updated.id);
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.currentTarget.blur();
  };

  const handleSaveTodoTitle = async () => {
    setEditingTodoTitle(false);
    await saveTodo();
  };

  const handlePriorityChange = async (priority: string) => {
    setEditPriority(priority);
    setPriorityMenuOpen(false);
    await saveTodo({ priority });
  };

  const handleDueDateChange = async (dueDate: string) => {
    setEditDueDate(dueDate);
    await saveTodo({ dueDate });
  };

  const handleDueDateBlur = async () => {
    setEditingDueDate(false);
    await saveTodo({ dueDate: editDueDate });
  };

  const handleToggleTodo = async (todoId: string, completed: boolean) => {
    if (completed) {
      setRecentlyCompletedTodoIds((ids) => ids.includes(todoId) ? ids : [todoId, ...ids]);
      window.setTimeout(() => {
        setRecentlyCompletedTodoIds((ids) => ids.filter((id) => id !== todoId));
      }, 500);
    }
    const updated = await App.SetTodoCompleted(todoId, completed);
    await loadWorkspace(updated.id);
  };

  const handleRequestDeleteTodo = () => {
    if (!selectedTodo) return;
    setConfirmDeleteTarget({ type: 'todo', id: selectedTodo.id });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteTarget) return;
    const target = confirmDeleteTarget;
    setConfirmDeleteTarget(null);
    if (target.type === 'todo') {
      await App.DeleteTodo(target.id);
      await loadWorkspace();
      return;
    }

    if (!selectedTodo) return;
    await App.DeleteTodoSubtask(target.id);
    await loadWorkspace(selectedTodo.id);
  };

  const handleCreateSubtask = async () => {
    if (!selectedTodo) return;
    const title = newSubtaskTitle.trim();
    if (!title) return;
    await App.CreateTodoSubtask(selectedTodo.id, title);
    setNewSubtaskTitle('');
    setShowNewSubtaskInput(false);
    await loadWorkspace(selectedTodo.id);
  };

  const handleNewSubtaskBlur = () => {
    if (newSubtaskTitle.trim()) return;
    setShowNewSubtaskInput(false);
  };

  const handleToggleSubtask = async (subtask: todos.Subtask) => {
    if (!selectedTodo) return;
    await App.SetTodoSubtaskCompleted(subtask.id, !subtask.completed);
    await loadWorkspace(selectedTodo.id);
  };

  const handleStartEditSubtask = (subtask: todos.Subtask) => {
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskTitle(subtask.title);
  };

  const handleSaveSubtaskTitle = async (subtask: todos.Subtask) => {
    if (!selectedTodo) return;
    const title = editingSubtaskTitle.trim();
    setEditingSubtaskId(null);
    if (!title) {
      setEditingSubtaskTitle('');
      return;
    }
    await App.UpdateTodoSubtask(subtask.id, title);
    setEditingSubtaskTitle('');
    await loadWorkspace(selectedTodo.id);
  };

  const handleSubtaskTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.currentTarget.blur();
  };

  const handleRequestDeleteSubtask = (subtaskId: string) => {
    if (!selectedTodo) return;
    setConfirmDeleteTarget({ type: 'subtask', id: subtaskId });
  };

  const selectedTodoSubtasks = getTodoSubtasks(selectedTodo);

  return (
    <div className="flex flex-1 overflow-hidden bg-background">
      <div className="w-72 border-r border-primary-100 bg-white flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-gray-800">{t.todos.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{t.todos.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewTodoInput(true)}
            className="p-2 rounded-lg bg-accent text-white hover:bg-primary-600 transition-colors flex items-center gap-1"
            title={t.todos.newTodo}
            aria-label={t.todos.newTodo}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100 space-y-3">
          {showNewTodoInput ? (
            <input
              value={newTodoTitle}
              autoFocus
              onChange={(e) => setNewTodoTitle(e.target.value)}
              onBlur={handleNewTodoBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTodo(); }}
              placeholder={t.todos.newTodoPlaceholder}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            {todoFilterOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setTodoFilter(option.id)}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  todoFilter === option.id
                    ? 'border-accent bg-primary-50 text-accent'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">{option.label}</div>
                <div className="mt-0.5 text-gray-400">{option.count}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-sm text-gray-400">{t.common.loading}</div>
          ) : error ? (
            <div className="p-6 text-sm text-red-500">{error}</div>
          ) : filteredTodos.length === 0 ? (
            <div className="p-6 text-sm text-gray-400">{t.todos.empty}</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTodos.map((todo) => {
                const subtasks = getTodoSubtasks(todo);
                return (
                  <button
                    key={todo.id}
                    onClick={() => setSelectedTodoId(todo.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      selectedTodoId === todo.id ? 'bg-primary-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggleTodo(todo.id, !todo.completed);
                        }}
                        className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                          todo.completed ? 'border-accent bg-accent text-white' : 'border-gray-300 bg-white text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={`font-medium ${getPriorityTitleClasses(todo.priority, todo.completed)}`}>
                          {todo.title}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          <span className="text-gray-400">{t.todos.priority}：{getPriorityText(todo.priority)}</span>
                          {todo.dueAt ? (
                            <span className={getDueDateClasses(todo.dueAt)}>{new Date(todo.dueAt).toLocaleDateString(language)}</span>
                          ) : null}
                          {subtasks.length > 0 ? (
                            <span className="text-gray-400">
                              {subtasks.filter((subtask) => subtask.completed).length}/{subtasks.length}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white flex flex-col">
        {!selectedTodo ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>{t.todos.selectTodo}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => handleToggleTodo(selectedTodo.id, !selectedTodo.completed)}
                  className={`mt-2 flex h-6 w-6 items-center justify-center rounded-full border ${
                    selectedTodo.completed ? 'border-accent bg-accent text-white' : 'border-gray-300 bg-white text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <div className="flex-1 min-w-0">
                  {editingTodoTitle ? (
                    <input
                      value={editTitle}
                      autoFocus
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={handleSaveTodoTitle}
                      onKeyDown={handleTitleKeyDown}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-2xl font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-accent/40"
                      placeholder={t.todos.todoTitlePlaceholder}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingTodoTitle(true)}
                      className={`group block w-full rounded-lg px-2 py-1 text-left text-2xl font-semibold hover:bg-gray-50 focus:outline-none ${
                        selectedTodo.completed ? 'text-gray-400 line-through' : 'text-gray-800'
                      }`}
                    >
                      {selectedTodo.title}
                      <span className="ml-2 align-middle text-xs font-normal text-transparent group-hover:text-gray-400">{t.common.edit}</span>
                    </button>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400">
                    <div ref={priorityMenuRef} className="relative flex items-center gap-1.5" aria-label={t.todos.priority}>
                      <span>{t.todos.priority}：</span>
                      <button
                        type="button"
                        onClick={() => setPriorityMenuOpen(!priorityMenuOpen)}
                        className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                      >
                        <span className={`h-3.5 w-3.5 rounded-sm ${getPrioritySquareClasses(editPriority)}`} />
                        <span>{getPriorityText(editPriority)}</span>
                      </button>
                      {priorityMenuOpen ? (
                        <div className="absolute left-0 top-7 z-20 min-w-[110px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                          {priorityOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => handlePriorityChange(option.id)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50"
                            >
                              <span className={`h-3.5 w-3.5 rounded-sm ${getPrioritySquareClasses(option.id)}`} />
                              <span>{option.label}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>{t.todos.dueDate}</span>
                      {editingDueDate ? (
                        <input
                          type="date"
                          value={editDueDate}
                          autoFocus
                          onChange={(e) => handleDueDateChange(e.target.value)}
                          onBlur={handleDueDateBlur}
                          className="h-7 w-[132px] rounded border border-gray-200 px-2 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent/40"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingDueDate(true)}
                          className="rounded px-1 py-0.5 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                        >
                          {editDueDate ? new Date(editDueDate).toLocaleDateString(language) : '--'}
                        </button>
                      )}
                    </div>
                    <div>
                      {t.todos.updatedAtLabel} {new Date(selectedTodo.updatedAt).toLocaleString(language)}
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={handleRequestDeleteTodo}
                className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
                title={t.common.delete}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">{t.todos.subtasks}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {selectedTodoSubtasks.filter((subtask) => subtask.completed).length}/{selectedTodoSubtasks.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNewSubtaskInput(true)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-accent"
                      title={t.todos.newSubtaskPlaceholder}
                      aria-label={t.todos.newSubtaskPlaceholder}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {selectedTodoSubtasks.length === 0 && !showNewSubtaskInput ? (
                    <button
                      type="button"
                      onClick={() => setShowNewSubtaskInput(true)}
                      className="w-full rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400 hover:border-accent hover:text-accent"
                    >
                      {t.todos.emptySubtasks}
                    </button>
                  ) : null}
                  {selectedTodoSubtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-3 border-b border-gray-100 px-1 py-2">
                      <button
                        type="button"
                        onClick={() => handleToggleSubtask(subtask)}
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          subtask.completed ? 'border-accent bg-accent text-white' : 'border-gray-300 bg-white text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      {editingSubtaskId === subtask.id ? (
                        <input
                          value={editingSubtaskTitle}
                          autoFocus
                          onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                          onBlur={() => handleSaveSubtaskTitle(subtask)}
                          onKeyDown={handleSubtaskTitleKeyDown}
                          className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent/40"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEditSubtask(subtask)}
                          className={`min-w-0 flex-1 text-left text-sm focus:outline-none ${
                            subtask.completed ? 'text-gray-400 line-through' : 'text-gray-700'
                          }`}
                        >
                          {subtask.title}
                        </button>
                      )}
                      <button
                        onClick={() => handleRequestDeleteSubtask(subtask.id)}
                        className="p-1 rounded text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {showNewSubtaskInput ? (
                    <input
                      value={newSubtaskTitle}
                      autoFocus
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onBlur={handleNewSubtaskBlur}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSubtask(); }}
                      placeholder={t.todos.newSubtaskPlaceholder}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {confirmDeleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setConfirmDeleteTarget(null)}
        >
          <div
            className="w-[360px] bg-white rounded-xl shadow-xl border border-gray-200 p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-sm font-semibold text-gray-900">
              {confirmDeleteTarget.type === 'todo' ? t.todos.deleteTodoTitle : t.todos.deleteSubtaskTitle}
            </div>
            <div className="mt-2 text-sm text-gray-600">
              {confirmDeleteTarget.type === 'todo' ? t.todos.deleteTodoDesc : t.todos.deleteSubtaskDesc}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
                onClick={() => setConfirmDeleteTarget(null)}
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
    </div>
  );
}

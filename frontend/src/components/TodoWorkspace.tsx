import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Plus } from 'lucide-react';
import { useStore } from '../store';
import { useI18n } from '../i18n';
import { filterTodos, type TodoDateFilter } from '../todoFilters';
import { TodoDetailEditor } from './TodoDetailEditor';
import { todos } from '../../wailsjs/go/models';
import * as App from '../../wailsjs/go/main/App';

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

  const [todoItems, setTodoItems] = useState<todos.Todo[]>([]);
  const [todoFilter, setTodoFilter] = useState<TodoDateFilter>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [showNewTodoInput, setShowNewTodoInput] = useState(false);
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
    if (!selectedTodoId || filteredTodos.some((todo) => todo.id === selectedTodoId)) {
      return;
    }
    if (filteredTodos.length > 0) {
      setSelectedTodoId(filteredTodos[0].id);
    }
  }, [filteredTodos, selectedTodoId, setSelectedTodoId]);

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
        <TodoDetailEditor todo={selectedTodo} onReload={loadWorkspace} />
      </div>
    </div>
  );
}

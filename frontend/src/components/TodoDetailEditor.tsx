import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Calendar, Check, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { todos } from '../../wailsjs/go/models';
import * as App from '../../wailsjs/go/main/App';

type DeleteTarget = { type: 'todo' | 'subtask'; id: string };

interface TodoDetailEditorProps {
  todo: todos.Todo | null;
  emptyClassName?: string;
  onReload: (preferredTodoId?: string | null) => Promise<void>;
}

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

function getTodoSubtasks(todo: todos.Todo | null): todos.Subtask[] {
  return Array.isArray(todo?.subtasks) ? todo.subtasks : [];
}

export function TodoDetailEditor({ todo, emptyClassName = 'flex-1', onReload }: TodoDetailEditorProps) {
  const { t, language } = useI18n();
  const priorityMenuRef = useRef<HTMLDivElement | null>(null);

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
  const priorityOptions = [
    { id: 'low', label: t.todos.priorityLow },
    { id: 'medium', label: t.todos.priorityMedium },
    { id: 'high', label: t.todos.priorityHigh },
  ];

  const getPriorityText = (priority: string) => {
    const option = priorityOptions.find((item) => item.id === priority);
    return option?.label || t.todos.priorityMedium;
  };

  useEffect(() => {
    if (!todo) {
      setEditTitle('');
      setEditPriority('medium');
      setEditDueDate('');
      return;
    }

    setEditTitle(todo.title);
    setEditingTodoTitle(false);
    setEditingSubtaskId(null);
    setEditingSubtaskTitle('');
    setShowNewSubtaskInput(false);
    setPriorityMenuOpen(false);
    setEditPriority(todo.priority || 'medium');
    setEditDueDate(toDateInputValue(todo.dueAt));
    setEditingDueDate(false);
  }, [todo]);

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

  const saveTodo = async (overrides: Partial<{ title: string; priority: string; dueDate: string }> = {}) => {
    if (!todo) return;
    const title = (overrides.title ?? editTitle).trim();
    if (!title) {
      setEditTitle(todo.title);
      return;
    }
    const priority = overrides.priority ?? editPriority;
    const dueDate = overrides.dueDate ?? editDueDate;
    const updated = await App.UpdateTodo(todo.id, title, priority, dueDate);
    await onReload(updated.id);
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
    const updated = await App.SetTodoCompleted(todoId, completed);
    await onReload(updated.id);
  };

  const handleRequestDeleteTodo = () => {
    if (!todo) return;
    setConfirmDeleteTarget({ type: 'todo', id: todo.id });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteTarget) return;
    const target = confirmDeleteTarget;
    setConfirmDeleteTarget(null);
    if (target.type === 'todo') {
      await App.DeleteTodo(target.id);
      await onReload();
      return;
    }

    if (!todo) return;
    await App.DeleteTodoSubtask(target.id);
    await onReload(todo.id);
  };

  const handleCreateSubtask = async () => {
    if (!todo) return;
    const title = newSubtaskTitle.trim();
    if (!title) return;
    await App.CreateTodoSubtask(todo.id, title);
    setNewSubtaskTitle('');
    setShowNewSubtaskInput(false);
    await onReload(todo.id);
  };

  const handleNewSubtaskBlur = () => {
    if (newSubtaskTitle.trim()) return;
    setShowNewSubtaskInput(false);
  };

  const handleToggleSubtask = async (subtask: todos.Subtask) => {
    if (!todo) return;
    await App.SetTodoSubtaskCompleted(subtask.id, !subtask.completed);
    await onReload(todo.id);
  };

  const handleStartEditSubtask = (subtask: todos.Subtask) => {
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskTitle(subtask.title);
  };

  const handleSaveSubtaskTitle = async (subtask: todos.Subtask) => {
    if (!todo) return;
    const title = editingSubtaskTitle.trim();
    setEditingSubtaskId(null);
    if (!title) {
      setEditingSubtaskTitle('');
      return;
    }
    await App.UpdateTodoSubtask(subtask.id, title);
    setEditingSubtaskTitle('');
    await onReload(todo.id);
  };

  const handleSubtaskTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.currentTarget.blur();
  };

  const handleRequestDeleteSubtask = (subtaskId: string) => {
    if (!todo) return;
    setConfirmDeleteTarget({ type: 'subtask', id: subtaskId });
  };

  const selectedTodoSubtasks = getTodoSubtasks(todo);

  if (!todo) {
    return (
      <div className={`${emptyClassName} flex items-center justify-center text-gray-400`}>
        <div className="text-center">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>{t.todos.selectTodo}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => handleToggleTodo(todo.id, !todo.completed)}
            className={`mt-2 flex h-6 w-6 items-center justify-center rounded-full border ${
              todo.completed ? 'border-accent bg-accent text-white' : 'border-gray-300 bg-white text-transparent'
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
                  todo.completed ? 'text-gray-400 line-through' : 'text-gray-800'
                }`}
              >
                {todo.title}
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
                {t.todos.updatedAtLabel} {new Date(todo.updatedAt).toLocaleString(language)}
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
            {!showNewSubtaskInput ? (
              <button
                type="button"
                data-testid="add-subtask-action"
                onClick={() => setShowNewSubtaskInput(true)}
                className="w-full rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400 hover:border-accent hover:text-accent"
              >
                {t.todos.newSubtaskPlaceholder}
              </button>
            ) : null}
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

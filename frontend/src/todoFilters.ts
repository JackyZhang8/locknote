export type TodoDateFilter = 'active' | 'today' | 'overdue' | 'completed';

export interface FilterableTodo {
  id: string;
  completed: boolean;
  dueAt?: string;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function nextLocalDay(date: Date): Date {
  const start = startOfLocalDay(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
}

function parseDueAt(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function filterTodos<TTodo extends FilterableTodo>(
  todos: TTodo[],
  filter: TodoDateFilter,
  now = new Date(),
): TTodo[] {
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = nextLocalDay(now);

  return todos.filter((todo) => {
    if (filter === 'completed') return todo.completed;
    if (todo.completed) return false;

    const dueAt = parseDueAt(todo.dueAt);
    if (filter === 'today') {
      return Boolean(dueAt && dueAt >= todayStart && dueAt < tomorrowStart);
    }
    if (filter === 'overdue') {
      return Boolean(dueAt && dueAt < todayStart);
    }
    return true;
  });
}

export interface CalendarNoteSource {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarTodoSource {
  id: string;
  title: string;
  completed: boolean;
  priority: string;
  createdAt?: string;
  dueAt?: string;
  updatedAt?: string;
  completedAt?: string;
  subtasks?: Array<{ completed: boolean }>;
}

export interface CalendarNoteEvent {
  note: CalendarNoteSource;
  createdOnDate: boolean;
  updatedOnDate: boolean;
}

export interface CalendarDaySummary {
  dateKey: string;
  noteEvents: CalendarNoteEvent[];
  dueTodos: CalendarTodoSource[];
  completedTodos: CalendarTodoSource[];
  noteCount: number;
  todoDueCount: number;
  todoCompletedCount: number;
  heatScore: number;
}

export interface CalendarMonthCell {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
}

const HEAT_MAP_CELL_WIDTH_PX = 14;
const HEAT_MAP_COLUMN_GAP_PX = 4;

function leadingDateKey(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : null;
}

function normalizeGoTimeString(value: string): string | null {
  const trimmed = value.replace(/\s+m=[+-]?\d+(?:\.\d+)?$/, '').trim();
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)? ([+-]\d{2})(\d{2})(?: [A-Za-z]+)?$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const [, date, time, fraction = '', offsetHours, offsetMinutes] = match;
  return `${date}T${time}${fraction}${offsetHours}:${offsetMinutes}`;
}

export function parseCalendarTimestamp(value: string): Date | null {
  const normalized = normalizeGoTimeString(value) || value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toLocalDateKey(value: string): string | null {
  const date = parseCalendarTimestamp(value);
  return date ? dateToLocalDateKey(date) : leadingDateKey(value);
}

function toStoredCalendarDateKey(value: string): string | null {
  return leadingDateKey(value) || toLocalDateKey(value);
}

function dateToLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createEmptyDay(dateKey: string): CalendarDaySummary {
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

function getOrCreateDay(index: Record<string, CalendarDaySummary>, dateKey: string): CalendarDaySummary {
  if (!index[dateKey]) {
    index[dateKey] = createEmptyDay(dateKey);
  }
  return index[dateKey];
}

function addNoteEvent(index: Record<string, CalendarDaySummary>, note: CalendarNoteSource, dateKey: string, eventType: 'created' | 'updated') {
  const day = getOrCreateDay(index, dateKey);
  const existing = day.noteEvents.find((event) => event.note.id === note.id);
  if (existing) {
    if (eventType === 'created') existing.createdOnDate = true;
    if (eventType === 'updated') existing.updatedOnDate = true;
    return;
  }
  day.noteEvents.push({
    note,
    createdOnDate: eventType === 'created',
    updatedOnDate: eventType === 'updated',
  });
}

function finalizeDay(day: CalendarDaySummary): void {
  day.noteEvents.sort((a, b) => {
    const aTime = parseCalendarTimestamp(a.note.updatedAt)?.getTime() ?? 0;
    const bTime = parseCalendarTimestamp(b.note.updatedAt)?.getTime() ?? 0;
    return bTime - aTime;
  });
  day.dueTodos.sort((a, b) => String(a.dueAt || '').localeCompare(String(b.dueAt || '')));
  day.completedTodos.sort((a, b) => {
    const aTime = getTodoCompletionTime(a);
    const bTime = getTodoCompletionTime(b);
    return (bTime ? parseCalendarTimestamp(bTime)?.getTime() ?? 0 : 0)
      - (aTime ? parseCalendarTimestamp(aTime)?.getTime() ?? 0 : 0);
  });
  day.noteCount = day.noteEvents.length;
  day.todoDueCount = day.dueTodos.length;
  day.todoCompletedCount = day.completedTodos.length;
  day.heatScore = day.noteCount + day.todoCompletedCount;
}

function getTodoCompletionTime(todo: CalendarTodoSource): string | undefined {
  return todo.completedAt || (todo.completed ? todo.updatedAt : undefined);
}

export function buildCalendarDayIndex(
  notes: CalendarNoteSource[],
  todos: CalendarTodoSource[],
): Record<string, CalendarDaySummary> {
  const index: Record<string, CalendarDaySummary> = {};

  for (const note of notes) {
    const createdKey = toLocalDateKey(note.createdAt);
    const updatedKey = toLocalDateKey(note.updatedAt);
    if (createdKey) {
      addNoteEvent(index, note, createdKey, 'created');
    }
    if (updatedKey) {
      addNoteEvent(index, note, updatedKey, 'updated');
    }
  }

  for (const todo of todos) {
    const dueKey = todo.dueAt ? toStoredCalendarDateKey(todo.dueAt) : null;
    if (dueKey) {
      getOrCreateDay(index, dueKey).dueTodos.push(todo);
    }

    const completedTime = getTodoCompletionTime(todo);
    const completedKey = completedTime ? toLocalDateKey(completedTime) : null;
    if (completedKey) {
      getOrCreateDay(index, completedKey).completedTodos.push(todo);
    }
  }

  for (const day of Object.values(index)) {
    finalizeDay(day);
  }

  return index;
}

export function buildMonthGrid(year: number, monthIndex: number): CalendarMonthCell[] {
  const firstDay = new Date(year, monthIndex, 1);
  const start = new Date(firstDay);
  const mondayBasedWeekday = (firstDay.getDay() + 6) % 7;
  start.setDate(firstDay.getDate() - mondayBasedWeekday);

  const cells: CalendarMonthCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    cells.push({
      date,
      dateKey: dateToLocalDateKey(date),
      isCurrentMonth: date.getMonth() === monthIndex,
    });
  }
  return cells;
}

export function getHeatMapColumnCapacity(width: number): number {
  if (width <= HEAT_MAP_CELL_WIDTH_PX) {
    return 1;
  }
  return Math.max(1, Math.floor((width + HEAT_MAP_COLUMN_GAP_PX) / (HEAT_MAP_CELL_WIDTH_PX + HEAT_MAP_COLUMN_GAP_PX)));
}

export function buildHeatMapWeeks(anchorDate: Date, columnCount: number): CalendarMonthCell[][] {
  const safeColumnCount = Math.max(1, Math.floor(columnCount));
  const end = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
  const start = new Date(end);
  start.setDate(end.getDate() - safeColumnCount * 7 + 1);
  const weeks: CalendarMonthCell[][] = [];
  let week: CalendarMonthCell[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    week.push({
      date: new Date(cursor),
      dateKey: dateToLocalDateKey(cursor),
      isCurrentMonth: true,
    });

    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  if (week.length > 0) {
    weeks.push(week);
  }

  return weeks;
}

export function getCalendarHeatLevel(score: number): number {
  if (score <= 0) return 0;
  if (score <= 2) return 1;
  if (score <= 5) return 2;
  if (score <= 6) return 3;
  return 4;
}

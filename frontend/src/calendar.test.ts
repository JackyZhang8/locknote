import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCalendarDayIndex,
  buildHeatMapWeeks,
  buildMonthGrid,
  getCalendarHeatLevel,
  getHeatMapColumnCapacity,
  type CalendarNoteSource,
  type CalendarTodoSource,
} from './calendar.js';

function note(overrides: Partial<CalendarNoteSource>): CalendarNoteSource {
  return {
    id: overrides.id || 'note-id',
    title: overrides.title || 'Note title',
    createdAt: overrides.createdAt || '2026-06-01T09:00:00+08:00',
    updatedAt: overrides.updatedAt || '2026-06-01T10:00:00+08:00',
  };
}

function todo(overrides: Partial<CalendarTodoSource>): CalendarTodoSource {
  return {
    id: overrides.id || 'todo-id',
    title: overrides.title || 'Todo title',
    completed: overrides.completed ?? false,
    priority: overrides.priority || 'medium',
    dueAt: overrides.dueAt,
    completedAt: overrides.completedAt,
    updatedAt: overrides.updatedAt,
  };
}

test('buildCalendarDayIndex places notes on created and updated days without double-counting one day', () => {
  const index = buildCalendarDayIndex(
    [
      note({
        id: 'split-note',
        title: 'Cross-day note',
        createdAt: '2026-06-01T09:00:00+08:00',
        updatedAt: '2026-06-03T21:30:00+08:00',
      }),
      note({
        id: 'same-day-note',
        title: 'Same-day note',
        createdAt: '2026-06-02T09:00:00+08:00',
        updatedAt: '2026-06-02T12:15:00+08:00',
      }),
    ],
    [],
  );

  assert.equal(index['2026-06-01'].noteCount, 1);
  assert.deepEqual(index['2026-06-01'].noteEvents.map((event) => ({
    id: event.note.id,
    createdOnDate: event.createdOnDate,
    updatedOnDate: event.updatedOnDate,
  })), [
    { id: 'split-note', createdOnDate: true, updatedOnDate: false },
  ]);

  assert.equal(index['2026-06-02'].noteCount, 1);
  assert.deepEqual(index['2026-06-02'].noteEvents.map((event) => ({
    id: event.note.id,
    createdOnDate: event.createdOnDate,
    updatedOnDate: event.updatedOnDate,
  })), [
    { id: 'same-day-note', createdOnDate: true, updatedOnDate: true },
  ]);

  assert.equal(index['2026-06-03'].noteCount, 1);
  assert.deepEqual(index['2026-06-03'].noteEvents.map((event) => ({
    id: event.note.id,
    createdOnDate: event.createdOnDate,
    updatedOnDate: event.updatedOnDate,
  })), [
    { id: 'split-note', createdOnDate: false, updatedOnDate: true },
  ]);
});

test('buildCalendarDayIndex separates due todos from completed todos and builds heat score from notes plus completed todos', () => {
  const index = buildCalendarDayIndex(
    [
      note({
        id: 'edited-note',
        createdAt: '2026-06-04T08:00:00+08:00',
        updatedAt: '2026-06-04T18:00:00+08:00',
      }),
    ],
    [
      todo({
        id: 'due-todo',
        title: 'Due today',
        dueAt: '2026-06-04T00:00:00+08:00',
      }),
      todo({
        id: 'completed-todo',
        title: 'Completed today',
        completed: true,
        completedAt: '2026-06-04T19:00:00+08:00',
      }),
    ],
  );

  assert.equal(index['2026-06-04'].noteCount, 1);
  assert.equal(index['2026-06-04'].todoDueCount, 1);
  assert.equal(index['2026-06-04'].todoCompletedCount, 1);
  assert.equal(index['2026-06-04'].heatScore, 2);
  assert.deepEqual(index['2026-06-04'].dueTodos.map((item) => item.id), ['due-todo']);
  assert.deepEqual(index['2026-06-04'].completedTodos.map((item) => item.id), ['completed-todo']);
});

test('buildCalendarDayIndex keeps todo due dates on their stored calendar date', () => {
  const index = buildCalendarDayIndex(
    [],
    [
      todo({
        id: 'date-only-todo',
        dueAt: '2026-06-04T00:00:00+14:00',
      }),
    ],
  );

  assert.equal(index['2026-06-04'].todoDueCount, 1);
});

test('buildCalendarDayIndex handles Wails todo timestamps for calendar detail lists', () => {
  const index = buildCalendarDayIndex(
    [],
    [
      todo({
        id: 'calendar-created',
        dueAt: '2026-06-04T00:00:00Z',
      }),
      todo({
        id: 'calendar-completed',
        completed: true,
        completedAt: '2026-06-04T21:30:00+08:00',
      }),
    ],
  );

  assert.deepEqual(index['2026-06-04'].dueTodos.map((item) => item.id), ['calendar-created']);
  assert.deepEqual(index['2026-06-04'].completedTodos.map((item) => item.id), ['calendar-completed']);
});

test('buildCalendarDayIndex falls back to updatedAt for legacy completed todos', () => {
  const index = buildCalendarDayIndex(
    [],
    [
      todo({
        id: 'legacy-completed',
        completed: true,
        updatedAt: '2026-06-04T21:30:00+08:00',
      }),
      todo({
        id: 'sqlite-completed',
        completed: true,
        completedAt: '2026-06-04 22:10:00 +0800 CST m=+14.480140689',
      }),
    ],
  );

  assert.deepEqual(index['2026-06-04'].completedTodos.map((item) => item.id), [
    'sqlite-completed',
    'legacy-completed',
  ]);
});

test('buildMonthGrid returns a stable six week grid around the target month', () => {
  const cells = buildMonthGrid(2026, 5);

  assert.equal(cells.length, 42);
  assert.equal(cells[0].dateKey, '2026-06-01');
  assert.equal(cells[0].isCurrentMonth, true);
  assert.equal(cells[41].dateKey, '2026-07-12');
  assert.equal(cells[41].isCurrentMonth, false);
});

test('buildHeatMapWeeks fills the requested columns from the anchor date backward', () => {
  const anchorDate = new Date('2026-06-04T12:00:00');
  const narrowCells = buildHeatMapWeeks(anchorDate, 4).flat();
  const wideCells = buildHeatMapWeeks(anchorDate, 8).flat();

  assert.equal(narrowCells[0].dateKey, '2026-05-08');
  assert.equal(narrowCells[narrowCells.length - 1]?.dateKey, '2026-06-04');
  assert.equal(wideCells[0].dateKey, '2026-04-10');
  assert.equal(wideCells[wideCells.length - 1]?.dateKey, '2026-06-04');
  assert.equal(wideCells.some((cell) => cell.dateKey === '2026-06-05'), false);
  assert.equal(wideCells.every((cell) => cell.isCurrentMonth), true);
});

test('getHeatMapColumnCapacity fits whole columns inside the available width', () => {
  assert.equal(getHeatMapColumnCapacity(0), 1);
  assert.equal(getHeatMapColumnCapacity(14), 1);
  assert.equal(getHeatMapColumnCapacity(31), 1);
  assert.equal(getHeatMapColumnCapacity(32), 2);
  assert.equal(getHeatMapColumnCapacity(68), 4);
});

test('getCalendarHeatLevel maps activity counts to GitHub-like intensity buckets', () => {
  assert.equal(getCalendarHeatLevel(0), 0);
  assert.equal(getCalendarHeatLevel(1), 1);
  assert.equal(getCalendarHeatLevel(3), 2);
  assert.equal(getCalendarHeatLevel(6), 3);
  assert.equal(getCalendarHeatLevel(7), 4);
});

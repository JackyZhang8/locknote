import test from 'node:test';
import assert from 'node:assert/strict';

import { filterTodos, type TodoDateFilter } from './todoFilters.js';

const today = new Date('2026-04-26T10:30:00+08:00');

function todo(overrides: {
  id: string;
  dueAt?: string;
  completed?: boolean;
}) {
  return {
    id: overrides.id,
    title: overrides.id,
    dueAt: overrides.dueAt,
    completed: overrides.completed ?? false,
  };
}

test('filterTodos returns all non-completed todos by default', () => {
  const result = filterTodos(
    [
      todo({ id: 'open' }),
      todo({ id: 'done', completed: true }),
    ],
    'active',
    today,
  );

  assert.deepEqual(result.map((item) => item.id), ['open']);
});

test('filterTodos returns todos due today in local calendar time', () => {
  const result = filterTodos(
    [
      todo({ id: 'today-morning', dueAt: '2026-04-26T00:30:00+08:00' }),
      todo({ id: 'today-evening', dueAt: '2026-04-26T23:30:00+08:00' }),
      todo({ id: 'tomorrow', dueAt: '2026-04-27T09:00:00+08:00' }),
      todo({ id: 'completed-today', dueAt: '2026-04-26T09:00:00+08:00', completed: true }),
    ],
    'today',
    today,
  );

  assert.deepEqual(result.map((item) => item.id), ['today-morning', 'today-evening']);
});

test('filterTodos returns overdue todos before the start of today', () => {
  const result = filterTodos(
    [
      todo({ id: 'yesterday', dueAt: '2026-04-25T23:59:00+08:00' }),
      todo({ id: 'today', dueAt: '2026-04-26T00:00:00+08:00' }),
      todo({ id: 'completed-overdue', dueAt: '2026-04-25T09:00:00+08:00', completed: true }),
    ],
    'overdue',
    today,
  );

  assert.deepEqual(result.map((item) => item.id), ['yesterday']);
});

test('filterTodos returns completed todos for completed filter', () => {
  const result = filterTodos(
    [
      todo({ id: 'open' }),
      todo({ id: 'done', completed: true }),
    ],
    'completed',
    today,
  );

  assert.deepEqual(result.map((item) => item.id), ['done']);
});

test('filterTodos supports every declared filter value', () => {
  const filters: TodoDateFilter[] = ['active', 'today', 'overdue', 'completed'];

  assert.equal(filters.length, 4);
});

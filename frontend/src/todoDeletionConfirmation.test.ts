import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/TodoWorkspace.tsx', 'utf8');

test('TodoWorkspace uses an in-app confirmation dialog for todo and subtask deletion', () => {
  assert.equal(source.includes('window.confirm'), false);
  assert.equal(/confirmDeleteTarget/.test(source), true);
  assert.equal(/type:\s*'todo'\s*\|\s*'subtask'/.test(source), true);
  assert.equal(/deleteTodoTitle/.test(source), true);
  assert.equal(/deleteSubtaskTitle/.test(source), true);
});

test('TodoWorkspace renders compact priority and due date metadata controls', () => {
  assert.equal(/editingDueDate/.test(source), true);
  assert.equal(/priorityMenuOpen/.test(source), true);
  assert.equal(/getPriorityText\(editPriority\)/.test(source), true);
  assert.equal(/getPrioritySquareClasses\(editPriority\)/.test(source), true);
  assert.equal(/setEditingDueDate\(true\)/.test(source), true);
  assert.equal(/<span>\{t\.todos\.dueDate\}<\/span>/.test(source), true);
  assert.equal(/<span>\{option\.label\}<\/span>/.test(source), true);
});

test('TodoWorkspace reveals the new todo input from a header add button', () => {
  assert.equal(/showNewTodoInput/.test(source), true);
  assert.equal(/setShowNewTodoInput\(true\)/.test(source), true);
  assert.equal(/bg-accent text-white hover:bg-primary-600/.test(source), true);
  assert.equal(/<Plus className="w-5 h-5" \/>/.test(source), true);
  assert.equal(/autoFocus/.test(source), true);
  assert.equal(/setShowNewTodoInput\(false\)/.test(source), true);
});

test('TodoWorkspace edits task and subtask titles only after clicking text', () => {
  assert.equal(/editingTodoTitle/.test(source), true);
  assert.equal(/setEditingTodoTitle\(true\)/.test(source), true);
  assert.equal(/handleSaveTodoTitle/.test(source), true);
  assert.equal(/editingSubtaskId/.test(source), true);
  assert.equal(/handleStartEditSubtask/.test(source), true);
  assert.equal(/handleSaveSubtaskTitle/.test(source), true);
  assert.equal(/UpdateTodoSubtask/.test(source), true);
  assert.equal(/rounded-lg border border-gray-200 bg-white px-3 py-2 text-2xl font-semibold/.test(source), true);
  assert.equal(/rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700/.test(source), true);
});

test('TodoWorkspace includes the seven todo UI polish improvements', () => {
  assert.equal(/getDueDateClasses/.test(source), true);
  assert.equal(/filterToday:\s*'今日到期'/.test(readFileSync('src/i18n/locales/zh-CN.ts', 'utf8')), true);
  assert.equal(/filterActive:\s*'未完成'/.test(readFileSync('src/i18n/locales/zh-CN.ts', 'utf8')), true);
  assert.equal(/hover:bg-gray-50.*setEditingTodoTitle\(true\)/s.test(source), true);
  assert.equal(/showNewSubtaskInput/.test(source), true);
  assert.equal(/recentlyCompletedTodoIds/.test(source), true);
  assert.equal(/text-gray-400 hover:bg-red-50 hover:text-red-500/.test(source), true);
  assert.equal(/left-empty-new-todo/.test(source), false);
  assert.equal(/detail-empty-new-todo/.test(source), false);
  assert.equal(/empty-state-new-todo/.test(source), false);
});

test('TodoWorkspace uses priority dropdown and borderless subtask list', () => {
  assert.equal(/priorityMenuOpen/.test(source), true);
  assert.equal(/setPriorityMenuOpen\(!priorityMenuOpen\)/.test(source), true);
  assert.equal(/priorityMenuRef/.test(source), true);
  assert.equal(/document\.addEventListener\('pointerdown', handlePointerDown, true\)/.test(source), true);
  assert.equal(/getPriorityTitleClasses/.test(source), true);
  assert.equal(/getPriorityText/.test(source), true);
  assert.equal(/t\.todos\.priority\}：/.test(source), true);
  assert.equal(/border-b border-gray-100 px-1 py-2/.test(source), true);
  assert.equal(/rounded-xl border border-gray-200 p-4/.test(source), false);
  assert.equal(/rounded-lg border border-gray-100 px-3 py-2/.test(source), false);
});

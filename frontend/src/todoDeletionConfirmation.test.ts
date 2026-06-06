import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/TodoWorkspace.tsx', 'utf8');
const detailPath = 'src/components/TodoDetailEditor.tsx';
let detailSource = '';
try {
  detailSource = readFileSync(detailPath, 'utf8');
} catch {
  detailSource = '';
}

test('TodoWorkspace delegates task details to the reusable detail editor', () => {
  assert.equal(/import \{ TodoDetailEditor \}/.test(source), true);
  assert.equal(/<TodoDetailEditor[\s\S]*todo=\{selectedTodo\}[\s\S]*onReload=\{loadWorkspace\}/.test(source), true);
  assert.equal(detailSource.length > 0, true);
  assert.equal(/export function TodoDetailEditor/.test(detailSource), true);
});

test('TodoWorkspace uses an in-app confirmation dialog for todo and subtask deletion', () => {
  assert.equal(`${source}\n${detailSource}`.includes('window.confirm'), false);
  assert.equal(/confirmDeleteTarget/.test(detailSource), true);
  assert.equal(/type:\s*'todo'\s*\|\s*'subtask'/.test(detailSource), true);
  assert.equal(/deleteTodoTitle/.test(detailSource), true);
  assert.equal(/deleteSubtaskTitle/.test(detailSource), true);
});

test('TodoWorkspace renders compact priority and due date metadata controls', () => {
  assert.equal(/editingDueDate/.test(detailSource), true);
  assert.equal(/priorityMenuOpen/.test(detailSource), true);
  assert.equal(/getPriorityText\(editPriority\)/.test(detailSource), true);
  assert.equal(/getPrioritySquareClasses\(editPriority\)/.test(detailSource), true);
  assert.equal(/setEditingDueDate\(true\)/.test(detailSource), true);
  assert.equal(/<span>\{t\.todos\.dueDate\}<\/span>/.test(detailSource), true);
  assert.equal(/<span>\{option\.label\}<\/span>/.test(detailSource), true);
});

test('TodoWorkspace reveals the new todo input from a header add button', () => {
  assert.equal(/showNewTodoInput/.test(source), true);
  assert.equal(/setShowNewTodoInput\(true\)/.test(source), true);
  assert.equal(/bg-accent text-white hover:bg-primary-600/.test(source), true);
  assert.equal(/<Plus className="w-5 h-5" \/>/.test(source), true);
  assert.equal(/autoFocus/.test(source), true);
  assert.equal(/setShowNewTodoInput\(false\)/.test(source), true);
});

test('TodoWorkspace places the new todo input below the todo stats', () => {
  const statsGridIndex = source.indexOf('<div className="grid grid-cols-2 gap-2">');
  const newTodoInputIndex = source.indexOf('{showNewTodoInput ? (');

  assert.equal(statsGridIndex > -1, true);
  assert.equal(newTodoInputIndex > -1, true);
  assert.equal(statsGridIndex < newTodoInputIndex, true);
});

test('TodoWorkspace keeps the add subtask action below the subtask list', () => {
  const subtaskListIndex = detailSource.indexOf('{selectedTodoSubtasks.map((subtask) => (');
  const addSubtaskActionIndex = detailSource.indexOf('data-testid="add-subtask-action"');

  assert.equal(subtaskListIndex > -1, true);
  assert.equal(addSubtaskActionIndex > -1, true);
  assert.equal(subtaskListIndex < addSubtaskActionIndex, true);
  assert.equal(/selectedTodoSubtasks\.length === 0 && !showNewSubtaskInput/.test(detailSource), false);
  assert.equal(/data-testid="add-subtask-action"[\s\S]*\{t\.todos\.newSubtaskPlaceholder\}/.test(detailSource), true);
});

test('TodoWorkspace edits task and subtask titles only after clicking text', () => {
  assert.equal(/editingTodoTitle/.test(detailSource), true);
  assert.equal(/setEditingTodoTitle\(true\)/.test(detailSource), true);
  assert.equal(/handleSaveTodoTitle/.test(detailSource), true);
  assert.equal(/editingSubtaskId/.test(detailSource), true);
  assert.equal(/handleStartEditSubtask/.test(detailSource), true);
  assert.equal(/handleSaveSubtaskTitle/.test(detailSource), true);
  assert.equal(/UpdateTodoSubtask/.test(detailSource), true);
  assert.equal(/rounded-lg border border-gray-200 bg-white px-3 py-2 text-2xl font-semibold/.test(detailSource), true);
  assert.equal(/rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700/.test(detailSource), true);
});

test('TodoWorkspace includes the seven todo UI polish improvements', () => {
  assert.equal(/getDueDateClasses/.test(source), true);
  assert.equal(/filterToday:\s*'今日到期'/.test(readFileSync('src/i18n/locales/zh-CN.ts', 'utf8')), true);
  assert.equal(/filterActive:\s*'未完成'/.test(readFileSync('src/i18n/locales/zh-CN.ts', 'utf8')), true);
  assert.equal(/setEditingTodoTitle\(true\)/.test(detailSource), true);
  assert.equal(/hover:bg-gray-50/.test(detailSource), true);
  assert.equal(/showNewSubtaskInput/.test(detailSource), true);
  assert.equal(/recentlyCompletedTodoIds/.test(source), true);
  assert.equal(/text-gray-400 hover:bg-red-50 hover:text-red-500/.test(detailSource), true);
  assert.equal(/left-empty-new-todo/.test(source), false);
  assert.equal(/detail-empty-new-todo/.test(source), false);
  assert.equal(/empty-state-new-todo/.test(source), false);
});

test('TodoWorkspace uses priority dropdown and borderless subtask list', () => {
  assert.equal(/priorityMenuOpen/.test(detailSource), true);
  assert.equal(/setPriorityMenuOpen\(!priorityMenuOpen\)/.test(detailSource), true);
  assert.equal(/priorityMenuRef/.test(detailSource), true);
  assert.equal(/document\.addEventListener\('pointerdown', handlePointerDown, true\)/.test(detailSource), true);
  assert.equal(/getPriorityTitleClasses/.test(source), true);
  assert.equal(/getPriorityText/.test(detailSource), true);
  assert.equal(/t\.todos\.priority\}：/.test(detailSource), true);
  assert.equal(/border-b border-gray-100 px-1 py-2/.test(detailSource), true);
  assert.equal(/rounded-xl border border-gray-200 p-4/.test(detailSource), false);
  assert.equal(/rounded-lg border border-gray-100 px-3 py-2/.test(detailSource), false);
});

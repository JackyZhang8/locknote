import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sidebarSource = readFileSync('src/components/Sidebar.tsx', 'utf8');
const layoutSource = readFileSync('src/components/MainLayout.tsx', 'utf8');
const storeSource = readFileSync('src/store/index.ts', 'utf8');
const calendarViewSource = readFileSync('src/components/CalendarView.tsx', 'utf8');
const noteEditorSource = readFileSync('src/components/NoteEditor.tsx', 'utf8');

test('sidebar exposes the calendar as a primary navigation item', () => {
  assert.equal(/calendar/.test(storeSource), true);
  assert.equal(/id:\s*'calendar'/.test(sidebarSource), true);
  assert.equal(/t\.sidebar\.calendar/.test(sidebarSource), true);
});

test('main layout renders CalendarView for the calendar route', () => {
  assert.equal(/import \{ CalendarView \}/.test(layoutSource), true);
  assert.equal(/case 'calendar':/.test(layoutSource), true);
  assert.equal(/<CalendarView \/>/.test(layoutSource), true);
});

test('calendar view loads notes and todos and supports creation actions', () => {
  assert.equal(/ListNotes/.test(calendarViewSource), true);
  assert.equal(/ListTodos/.test(calendarViewSource), true);
  assert.equal(/CreateNote/.test(calendarViewSource), true);
  assert.equal(/CreateTodo/.test(calendarViewSource), true);
  assert.equal(/buildCalendarDayIndex/.test(calendarViewSource), true);
  assert.equal(/getCalendarHeatLevel/.test(calendarViewSource), true);
});

test('calendar note activity opens and edits notes inside an in-place modal', () => {
  assert.equal(/import \{ NoteEditor \}/.test(calendarViewSource), true);
  assert.equal(/import \{ TodoDetailEditor \}/.test(calendarViewSource), true);
  assert.equal(/const \[modalHeaderNote, setModalHeaderNote\]/.test(calendarViewSource), true);
  assert.equal(/const \[modalNote, setModalNote\]/.test(calendarViewSource), true);
  assert.equal(/const \[isLoadingModalNote, setIsLoadingModalNote\]/.test(calendarViewSource), true);
  assert.equal(/const modalNoteRequestRef = useRef\(0\)/.test(calendarViewSource), true);
  assert.equal(/setEditorMode\('preview'\)/.test(calendarViewSource), true);
  assert.equal(/<NoteEditor[\s\S]*variant="modal"[\s\S]*onRequestClose=\{closeNoteModal\}[\s\S]*closeRequestToken=\{noteModalCloseRequest\}/.test(calendarViewSource), true);
  assert.equal(/fixed inset-0 z-40/.test(calendarViewSource), true);
  assert.equal(/App\.GetNote\(note\.id\)/.test(calendarViewSource), true);
  assert.equal(/isLoadingModalNote && !modalNote/.test(calendarViewSource), true);

  const openNoteStart = calendarViewSource.indexOf('const openNote = ');
  const openNoteEnd = calendarViewSource.indexOf('const openTodo = ', openNoteStart);
  const openNoteSource = calendarViewSource.slice(openNoteStart, openNoteEnd);
  assert.equal(/setCurrentView\('notes'\)/.test(openNoteSource), false);
  assert.equal(/setModalHeaderNote\(note\)/.test(openNoteSource), true);
  assert.equal(/setModalNote\(null\)/.test(openNoteSource), true);
  assert.equal(/const requestId = \+\+modalNoteRequestRef\.current/.test(openNoteSource), true);
  assert.equal(/if \(requestId !== modalNoteRequestRef\.current\) return;/.test(openNoteSource), true);

  const closeNoteStart = calendarViewSource.indexOf('const closeNoteModal = ');
  const closeNoteEnd = calendarViewSource.indexOf('const openTodo = ', closeNoteStart);
  const closeNoteSource = calendarViewSource.slice(closeNoteStart, closeNoteEnd);
  assert.equal(/\+?modalNoteRequestRef\.current/.test(closeNoteSource), true);

  const createNoteStart = calendarViewSource.indexOf('const handleCreateNote = ');
  const createNoteEnd = calendarViewSource.indexOf('const handleCreateTodo = ', createNoteStart);
  const createNoteSource = calendarViewSource.slice(createNoteStart, createNoteEnd);
  assert.equal(/setCurrentView\('notes'\)/.test(createNoteSource), false);
  assert.equal(/setModalNote\(created\)/.test(createNoteSource), true);
});

test('calendar note modal owns the close button in the title bar', () => {
  const noteModalStart = calendarViewSource.indexOf('{modalHeaderNote ? (');
  const noteModalEnd = calendarViewSource.indexOf('{modalTodo ? (', noteModalStart);
  const noteModalSource = calendarViewSource.slice(noteModalStart, noteModalEnd);
  assert.equal(/onClick=\{handleRequestCloseNoteModal\}/.test(noteModalSource), true);
  assert.equal(/aria-label=\{t\.common\.close\}/.test(noteModalSource), true);
  assert.equal(/<NoteEditor[\s\S]*onRequestClose=\{closeNoteModal\}[\s\S]*closeRequestToken=\{noteModalCloseRequest\}/.test(noteModalSource), true);

  const editorCloseStart = noteEditorSource.indexOf('{onRequestClose ? (');
  assert.equal(editorCloseStart, -1);
});

test('modal note editor ignores a stale close request token from a previous mount', () => {
  assert.equal(/const previousCloseRequestTokenRef = useRef\(closeRequestToken\)/.test(noteEditorSource), true);

  const closeTokenEffectStart = noteEditorSource.indexOf('useEffect(() => {\n    if (closeRequestToken === previousCloseRequestTokenRef.current) return;');
  assert.equal(closeTokenEffectStart !== -1, true);
  const closeTokenEffectEnd = noteEditorSource.indexOf('  }, [closeRequestToken', closeTokenEffectStart);
  const closeTokenEffectSource = noteEditorSource.slice(closeTokenEffectStart, closeTokenEffectEnd);
  assert.equal(/previousCloseRequestTokenRef\.current = closeRequestToken/.test(closeTokenEffectSource), true);
  assert.equal(/handleRequestClose\(\)/.test(closeTokenEffectSource), true);
});

test('calendar todo rows open an in-place editor modal instead of navigating to todos', () => {
  assert.equal(/const \[modalTodo, setModalTodo\]/.test(calendarViewSource), true);
  assert.equal(/const \[modalTodoError, setModalTodoError\]/.test(calendarViewSource), true);
  assert.equal(/<TodoDetailEditor[\s\S]*todo=\{modalTodo\}[\s\S]*onReload=\{handleReloadModalTodo\}/.test(calendarViewSource), true);

  const openTodoStart = calendarViewSource.indexOf('const openTodo = ');
  const openTodoEnd = calendarViewSource.indexOf('const handleCreateNote = ', openTodoStart);
  const openTodoSource = calendarViewSource.slice(openTodoStart, openTodoEnd);
  assert.equal(/setCurrentView\('todos'\)/.test(openTodoSource), false);
  assert.equal(/setModalTodo\(todo\)/.test(openTodoSource), true);
  assert.equal(/App\.GetTodo\(todo\.id\)/.test(openTodoSource), true);
});

test('calendar view keeps the month grid compact and moves activity details to the right side', () => {
  assert.equal(/lg:grid-cols-\[minmax\(260px,1fr\)_minmax\(0,3fr\)\]/.test(calendarViewSource), true);

  const monthGridStart = calendarViewSource.indexOf('{monthCells.map');
  const monthGridEnd = calendarViewSource.indexOf('</section>', monthGridStart);
  const monthGridSource = calendarViewSource.slice(monthGridStart, monthGridEnd);
  assert.equal(/day\.noteCount|day\.todoDueCount|day\.todoCompletedCount/.test(monthGridSource), false);
  assert.equal(/getCalendarHeatLevel\(day\.heatScore\)/.test(monthGridSource), true);

  const rightSideStart = calendarViewSource.indexOf('<div className="min-w-0 overflow-y-auto">');
  const rightSideSource = calendarViewSource.slice(rightSideStart);
  assert.equal(rightSideSource.includes('t.calendar.heatMap'), true);
  assert.equal(rightSideSource.indexOf('t.calendar.heatMap') < rightSideSource.indexOf('t.calendar.selectedDay'), true);
});

test('calendar view keeps heatmap collapsed by default and expands it on demand', () => {
  assert.equal(/const \[showHeatMap, setShowHeatMap\] = useState\(false\)/.test(calendarViewSource), true);
  assert.equal(/onClick=\{\(\) => setShowHeatMap\(\(open\) => !open\)\}/.test(calendarViewSource), true);
  assert.equal(/showHeatMap \? t\.calendar\.hideHeatMap : t\.calendar\.showHeatMap/.test(calendarViewSource), true);
  assert.equal(/showHeatMap \? \([\s\S]*heatWeeks\.map/.test(calendarViewSource), true);
});

test('calendar view renders the heatmap with an adaptive right-aligned window', () => {
  assert.equal(/buildHeatMapWeeks/.test(calendarViewSource), true);
  assert.equal(/getHeatMapColumnCapacity/.test(calendarViewSource), true);
  assert.equal(/ResizeObserver/.test(calendarViewSource), true);
  assert.equal(/const \[heatMapColumnCount, setHeatMapColumnCount\]/.test(calendarViewSource), true);
  assert.equal(/buildYearHeatWeeks/.test(calendarViewSource), false);
  assert.equal(/buildHeatMapWeeks\(heatMapAnchorDate, heatMapColumnCount\)/.test(calendarViewSource), true);
  assert.equal(/\[heatMapAnchorDate, heatMapColumnCount\]/.test(calendarViewSource), true);
  assert.equal(/buildHeatMapWeeks\(monthCursor\.getFullYear\(\), monthCursor\.getMonth\(\), heatMapColumnCount\)/.test(calendarViewSource), false);
  assert.equal(/ref=\{heatMapContainerRef\}/.test(calendarViewSource), true);
  assert.equal(/overflow-visible p-5/.test(calendarViewSource), true);
  assert.equal(/justify-end/.test(calendarViewSource), true);
});

test('calendar view shows an immediate custom tooltip for heatmap days', () => {
  const heatMapStart = calendarViewSource.indexOf('{heatWeeks.map');
  const heatMapEnd = calendarViewSource.indexOf('{t.calendar.selectedDay}', heatMapStart);
  const heatMapSource = calendarViewSource.slice(heatMapStart, heatMapEnd);
  assert.equal(/const \[hoveredHeatMapDay, setHoveredHeatMapDay\]/.test(calendarViewSource), true);
  assert.equal(/onMouseEnter=\{\(\) => setHoveredHeatMapDay/.test(heatMapSource), true);
  assert.equal(/onMouseLeave=\{\(\) => setHoveredHeatMapDay\(null\)\}/.test(heatMapSource), true);
  assert.equal(/hoveredHeatMapDay \? \(/.test(heatMapSource), true);
  assert.equal(/absolute bottom-full right-0/.test(heatMapSource), true);
  assert.equal(/title=/.test(heatMapSource), false);
  assert.equal(/monthCursor/.test(heatMapSource), false);
});

test('calendar view places compact creation actions beside the selected day heading', () => {
  const selectedHeaderStart = calendarViewSource.lastIndexOf('justify-between', calendarViewSource.indexOf('{t.calendar.selectedDay}'));
  const selectedHeaderEnd = calendarViewSource.indexOf('grid grid-cols-3', selectedHeaderStart);
  const selectedHeaderSource = calendarViewSource.slice(selectedHeaderStart, selectedHeaderEnd);
  const imageAddButtonClass = 'inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50';
  assert.equal(selectedHeaderSource.includes('justify-between'), true);
  assert.equal(selectedHeaderSource.includes('t.calendar.createNote'), true);
  assert.equal(selectedHeaderSource.includes('t.calendar.createTodo'), true);
  assert.equal(selectedHeaderSource.split(imageAddButtonClass).length - 1, 2);
  assert.equal(selectedHeaderSource.split('className="h-4 w-4"').length - 1, 2);
});

test('calendar due todo rows show priority, subtask progress, and created time metadata', () => {
  const dueTodoStart = calendarViewSource.indexOf('selectedDay.dueTodos.map');
  const dueTodoEnd = calendarViewSource.indexOf('{t.calendar.completedToday}', dueTodoStart);
  const dueTodoSource = calendarViewSource.slice(dueTodoStart, dueTodoEnd);
  assert.equal(/getPriorityLabel\(todo\.priority\)/.test(dueTodoSource), true);
  assert.equal(/getTodoSubtaskProgress\(todo\)/.test(dueTodoSource), true);
  assert.equal(/formatDateTime\(todo\.createdAt, language\)/.test(dueTodoSource), true);
  assert.equal(/t\.todos\.priority/.test(dueTodoSource), true);
  assert.equal(/priorityDotClass\(todo\.priority\)/.test(dueTodoSource), true);
});

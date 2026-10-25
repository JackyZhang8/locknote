import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCROLL_SYNC_ECHO_WINDOW_MS,
  computeSyncedScrollTop,
  getScrollRange,
  shouldIgnoreScrollEcho,
} from './scrollSync.js';

const metrics = (scrollTop: number, scrollHeight: number, clientHeight: number) => ({
  scrollTop,
  scrollHeight,
  clientHeight,
});

test('getScrollRange never returns a negative range', () => {
  assert.equal(getScrollRange(metrics(0, 900, 300)), 600);
  assert.equal(getScrollRange(metrics(0, 200, 300)), 0);
});

test('computeSyncedScrollTop maps scroll progress proportionally between panes', () => {
  // 源码栏滚到一半，预览栏也应该到一半
  assert.equal(computeSyncedScrollTop(metrics(300, 900, 300), { scrollHeight: 2100, clientHeight: 300 }), 900);
  // 顶部和底部对齐
  assert.equal(computeSyncedScrollTop(metrics(0, 900, 300), { scrollHeight: 2100, clientHeight: 300 }), 0);
  assert.equal(computeSyncedScrollTop(metrics(600, 900, 300), { scrollHeight: 2100, clientHeight: 300 }), 1800);
});

test('computeSyncedScrollTop clamps out-of-range offsets instead of overshooting', () => {
  assert.equal(computeSyncedScrollTop(metrics(5000, 900, 300), { scrollHeight: 900, clientHeight: 300 }), 600);
  assert.equal(computeSyncedScrollTop(metrics(-40, 900, 300), { scrollHeight: 900, clientHeight: 300 }), 0);
});

test('computeSyncedScrollTop skips panes that cannot scroll', () => {
  assert.equal(computeSyncedScrollTop(metrics(120, 400, 400), { scrollHeight: 1200, clientHeight: 400 }), null);
  assert.equal(computeSyncedScrollTop(metrics(120, 900, 300), { scrollHeight: 400, clientHeight: 400 }), null);
});

test('shouldIgnoreScrollEcho drops only the echo of our own programmatic scroll', () => {
  const state = { source: 'editor' as const, at: 1000 };
  // 预览栏在 120ms 内回传的 scroll 事件是回声
  assert.equal(shouldIgnoreScrollEcho(state, 'preview', 1050), true);
  // 窗口期过后的滚动是用户操作
  assert.equal(shouldIgnoreScrollEcho(state, 'preview', 1000 + SCROLL_SYNC_ECHO_WINDOW_MS + 1), false);
  // 同一个来源的滚动从来不算回声
  assert.equal(shouldIgnoreScrollEcho(state, 'editor', 1010), false);
  // 没有进行中的同步时，任何滚动都放行
  assert.equal(shouldIgnoreScrollEcho({ source: null, at: 0 }, 'preview', 10), false);
});

/** 分屏模式下左右两栏（Markdown 源码 / 渲染预览）滚动联动。
 *
 * 两栏的排版高度完全不同（等宽纯文本 vs 渲染后的富文本），逐行对齐不现实，
 * 所以按"可滚动比例"同步：一侧滚到 x%，另一侧也滚到 x%。
 */

export type ScrollSyncSource = 'editor' | 'preview';

export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export interface ScrollSyncState {
  source: ScrollSyncSource | null;
  at: number;
}

/** 程序化设置 scrollTop 会触发目标元素自己的 scroll 事件，
 * 这个时间窗内的反向事件视为"回声"，直接忽略，避免两栏互相拉扯。 */
export const SCROLL_SYNC_ECHO_WINDOW_MS = 120;

export function getScrollRange(metrics: { scrollHeight: number; clientHeight: number }): number {
  return Math.max(0, metrics.scrollHeight - metrics.clientHeight);
}

export function computeSyncedScrollTop(
  from: ScrollMetrics,
  to: { scrollHeight: number; clientHeight: number },
): number | null {
  const fromRange = getScrollRange(from);
  const toRange = getScrollRange(to);

  // 任意一侧没有可滚动空间（内容没超出一屏）就不联动，否则会把另一侧顶飞。
  if (fromRange <= 0 || toRange <= 0) {
    return null;
  }

  const ratio = Math.min(1, Math.max(0, from.scrollTop / fromRange));
  return ratio * toRange;
}

export function shouldIgnoreScrollEcho(
  state: ScrollSyncState,
  source: ScrollSyncSource,
  now: number,
  echoWindowMs: number = SCROLL_SYNC_ECHO_WINDOW_MS,
): boolean {
  if (state.source === null || state.source === source) {
    return false;
  }
  return now - state.at < echoWindowMs;
}

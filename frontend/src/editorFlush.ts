type EditorFlushHandler = () => Promise<unknown>;

let editorFlushHandler: EditorFlushHandler | null = null;

export function registerEditorFlush(fn: EditorFlushHandler): () => void {
  editorFlushHandler = fn;
  return () => {
    if (editorFlushHandler === fn) {
      editorFlushHandler = null;
    }
  };
}

export async function flushEditor(): Promise<void> {
  if (!editorFlushHandler) return;
  try {
    await editorFlushHandler();
  } catch (error) {
    console.error('Failed to flush editor:', error);
  }
}

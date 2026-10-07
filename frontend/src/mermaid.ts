export function normalizeMermaidSource(code: string, language: string, metadata = ''): string {
  // `flowchart TD` in a Markdown fence is split into language and metadata;
  // Mermaid expects its direction to be part of the source instead.
  if (language !== 'flowchart' || /^\s*(?:flowchart|graph)\b/m.test(code)) return code;
  const direction = /^(TD|TB|BT|LR|RL)(?:\s|$)/i.exec(metadata.trim())?.[1].toUpperCase() ?? 'TD';
  return `flowchart ${direction}\n${code}`;
}

type MarkdownNode = {
  type: string;
  lang?: string | null;
  meta?: string | null;
  value?: string;
  children?: MarkdownNode[];
};

export function remarkFlowchartFences() {
  return (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (node.type === 'code' && node.lang === 'flowchart') {
        node.value = normalizeMermaidSource(node.value ?? '', node.lang, node.meta ?? '');
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

let libraryPromise: Promise<typeof import('./vendor/mermaid/mermaid.min.js').default> | undefined;
let renderSequence = 0;

export async function renderMermaid(source: string): Promise<string> {
  libraryPromise ??= import('./vendor/mermaid/mermaid.min.js').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: 'neutral',
      fontFamily: 'system-ui, sans-serif',
      flowchart: { htmlLabels: false, useMaxWidth: false },
    });
    return mermaid;
  });
  const mermaid = await libraryPromise;
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-100000px;top:0;opacity:0;pointer-events:none;';
  document.body.appendChild(container);
  try {
    // Mermaid serializes its render queue; unique IDs also isolate markers
    // between different diagrams and cancelled StrictMode render attempts.
    const { svg } = await mermaid.render(`locknote-mermaid-${++renderSequence}`, source, container);
    return svg;
  } finally {
    container.remove();
  }
}

interface Mermaid {
  initialize(config: Record<string, unknown>): void;
  render(id: string, source: string, container?: HTMLElement): Promise<{ svg: string }>;
}

declare const mermaid: Mermaid;
export default mermaid;

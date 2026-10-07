/** Assign real DOM anchors and use those same IDs in the table of contents.
 * A preview-specific prefix keeps history and workspace headings from colliding.
 */
export function indexMarkdownHeadings<T extends { id: string; textContent: string | null; tagName: string }>(
  headings: Iterable<T>,
  prefix: string,
) {
  const used = new Set<string>();
  return Array.from(headings, (element) => {
    const text = element.textContent ?? '';
    const slug = text.trim().toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'heading';
    const base = prefix + '-' + slug;
    let id = base;
    let suffix = 2;
    while (used.has(id)) id = base + '-' + suffix++;
    used.add(id);
    element.id = id;
    return { id, text, level: Number(element.tagName.slice(1)), element };
  });
}

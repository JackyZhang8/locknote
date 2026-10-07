import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Download, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { ExportDiagramSVG } from '../../wailsjs/go/main/App';
import { useI18n } from '../i18n';
import { renderMermaid } from '../mermaid';

const MIN_SCALE = 0.25;
const MAX_SCALE = 3;

export function MermaidDiagram({ code }: { code: string }) {
  const { t } = useI18n();
  const labels = t.editor.diagram;
  const [tab, setTab] = useState<'diagram' | 'code'>('diagram');
  const [scale, setScale] = useState(1);
  const [svg, setSvg] = useState('');
  const [renderError, setRenderError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const svgRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSvg('');
    setRenderError('');
    setSaveError('');
    setSaved(false);
    setScale(1);
    renderMermaid(code).then((result) => {
      if (!cancelled) setSvg(result);
    }).catch((error: unknown) => {
      if (!cancelled) setRenderError(error instanceof Error ? error.message : String(error));
    });
    return () => { cancelled = true; };
  }, [code]);

  useLayoutEffect(() => {
    const element = svgRef.current?.querySelector('svg');
    if (!element) return;
    const { width, height } = element.viewBox.baseVal;
    element.style.maxWidth = 'none';
    element.style.width = `${width * scale}px`;
    element.style.height = `${height * scale}px`;
    element.setAttribute('width', String(width * scale));
    element.setAttribute('height', String(height * scale));
  }, [svg, scale, tab]);

  const zoom = (delta: number) => {
    setScale((value) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((value + delta) * 100) / 100)));
  };

  const reset = () => {
    setScale(1);
    viewportRef.current?.scrollTo({ top: 0, left: 0 });
  };

  const download = async () => {
    if (!svg || saving) return;
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      // Export the original SVG, independently of the current preview zoom.
      const path = await ExportDiagramSVG(svg);
      if (path) setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mermaid-diagram my-4 min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 text-xs">
        <div className="flex gap-1">
          <button type="button" aria-pressed={tab === 'diagram'} className={`rounded px-2 py-1 ${tab === 'diagram' ? 'bg-gray-100 font-medium' : ''}`} onClick={() => setTab('diagram')}>{labels.chart}</button>
          <button type="button" aria-pressed={tab === 'code'} className={`rounded px-2 py-1 ${tab === 'code' ? 'bg-gray-100 font-medium' : ''}`} onClick={() => setTab('code')}>{labels.code}</button>
        </div>
        {tab === 'diagram' && (
          <div className="flex items-center gap-2">
            <button type="button" title={labels.zoomOut} aria-label={labels.zoomOut} className="p-1 disabled:opacity-30" disabled={!svg || scale <= MIN_SCALE} onClick={() => zoom(-0.1)}><ZoomOut className="h-3.5 w-3.5" /></button>
            <span className="w-9 text-center tabular-nums text-gray-500">{Math.round(scale * 100)}%</span>
            <button type="button" title={labels.reset} aria-label={labels.reset} className="p-1 disabled:opacity-30" disabled={!svg} onClick={reset}><RotateCcw className="h-3.5 w-3.5" /></button>
            <button type="button" title={labels.zoomIn} aria-label={labels.zoomIn} className="p-1 disabled:opacity-30" disabled={!svg || scale >= MAX_SCALE} onClick={() => zoom(0.1)}><ZoomIn className="h-3.5 w-3.5" /></button>
            <button type="button" title={labels.save} aria-label={labels.save} className="p-1 disabled:opacity-30" disabled={!svg || saving} onClick={download}><Download className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
      {tab === 'code' ? (
        <pre className="m-0 overflow-auto bg-gray-50 p-4 text-xs"><code>{code}</code></pre>
      ) : renderError ? (
        <div className="p-4">
          <p role="alert" className="text-sm text-red-600">{labels.renderError}: {renderError}</p>
          <pre className="overflow-auto text-xs"><code>{code}</code></pre>
        </div>
      ) : svg ? (
        <div ref={viewportRef} className="max-h-[560px] overflow-auto p-4">
          <div ref={svgRef} role="img" aria-label={labels.chart} dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      ) : (
        <div role="status" className="p-4 text-sm text-gray-500">{t.common.loading}</div>
      )}
      {saveError && <div role="alert" className="px-4 pb-3 text-sm text-red-600">{labels.saveError}: {saveError}</div>}
      {saved && <div role="status" className="px-4 pb-3 text-xs text-gray-500">{labels.saved}</div>}
    </div>
  );
}

// Parser and UI tests without launching a browser. Requires jsdom:
// JSDOM_MODULE=/path/to/jsdom node --test frontend/tests/mermaid_dom.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { MessageChannel } from 'node:worker_threads';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const { JSDOM } = require(process.env.JSDOM_MODULE || 'jsdom');
const parserDOM = new JSDOM('<!doctype html><html><body></body></html>');
for (const key of ['window', 'document', 'Element', 'SVGElement', 'HTMLElement', 'DOMParser']) {
  globalThis[key] = parserDOM.window[key];
}
const { default: mermaid } = await import('../src/vendor/mermaid/mermaid.min.js');
mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', flowchart: { htmlLabels: false } });

test('user example keeps all 22 node labels, 24 edges, diamonds, branch labels and the feedback loop', async () => {
  const source = readFileSync(new URL('./fixtures/skills-flowchart.txt', import.meta.url), 'utf8');
  const diagram = await mermaid.mermaidAPI.getDiagramFromText(source);
  const vertices = diagram.db.getVertices();
  const edges = diagram.db.getEdges();
  assert.equal(vertices.size, 22);
  assert.equal(edges.length, 24);
  assert.equal(vertices.get('B').text, '解析显式 /Skill 指令');
  assert.equal(vertices.get('V').text, '继续下一步或输出答案');
  assert.equal(vertices.get('E').type, 'diamond');
  assert.equal(vertices.get('K').type, 'diamond');
  assert.equal(vertices.get('R').type, 'diamond');
  assert.equal(diagram.db.getDirection(), 'TD');
  assert.equal(edges.find((edge) => edge.start === 'E' && edge.end === 'F').text, '成功');
  assert.equal(edges.find((edge) => edge.start === 'E' && edge.end === 'G').text, '失败或未启用');
  assert.ok(edges.find((edge) => edge.start === 'S' && edge.end === 'Q'));
});

test('successive diagrams parse their own direction and labels', async () => {
  const first = await mermaid.mermaidAPI.getDiagramFromText('flowchart LR\nA[左侧] --> B[右侧]');
  assert.equal(first.db.getDirection(), 'LR');
  assert.equal(first.db.getVertices().get('A').text, '左侧');
  // Mermaid uses a shared parser database; its render() queue serializes
  // parsing and drawing before the next diagram resets that database.
  const second = await mermaid.mermaidAPI.getDiagramFromText('flowchart TD\nA[上方] --> B[下方]');
  assert.equal(second.db.getDirection(), 'TD');
  assert.equal(second.db.getVertices().get('A').text, '上方');
});

test('all diagram buttons update the real component; save uses the native bridge and original SVG', async () => {
  const originalSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="640" viewBox="0 0 320 640"><text>用户输入</text></svg>';
  // JSDOM has no SVG text measurement. Only the renderer is substituted;
  // React state, SVG DOM updates, tab controls and Wails bridge are real.
  const bundle = await build({
    stdin: {
      contents: `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { MermaidDiagram } from './src/components/MermaidDiagram';
        window.testAct = React.act ?? React.unstable_act;
        window.testRoot = createRoot(document.getElementById('root'));
        window.mountDiagram = () => window.testRoot.render(<React.StrictMode><MermaidDiagram code="flowchart TD\\nA --> B" /></React.StrictMode>);
      `,
      resolveDir: new URL('..', import.meta.url).pathname,
      loader: 'tsx',
    },
    bundle: true, write: false, format: 'iife', platform: 'browser',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'headless-svg', setup(builder) {
      builder.onLoad({ filter: /\/src\/mermaid\.ts$/ }, () => ({
        contents: `export async function renderMermaid() { return ${JSON.stringify(originalSVG)}; }`, loader: 'js',
      }));
    } }],
  });
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { runScripts: 'dangerously', url: 'https://locknote.test/' });
  const { window } = dom;
  const channels = [];
  window.MessageChannel = class extends MessageChannel {
    constructor() { super(); channels.push(this); }
  };
  window.IS_REACT_ACT_ENVIRONMENT = true;
  const saved = [];
  let saveFailure = false;
  let cancel = false;
  window.go = { main: { App: { ExportDiagramSVG: async (svg) => {
    if (saveFailure) throw new Error('无法写入文件');
    if (cancel) return '';
    saved.push(svg);
    return '/tmp/flowchart.svg';
  } } } };
  dom.window.eval(bundle.outputFiles[0].text);
  const doc = window.document;
  // scrollTo is absent in JSDOM; verify the reset request separately.
  let resetPosition;
  window.HTMLElement.prototype.scrollTo = (position) => { resetPosition = position; };
  const clickTitle = async (title) => window.testAct(async () => {
    const button = [...doc.querySelectorAll('button')].find((element) => element.title === title);
    assert.ok(button, title);
    button.click();
  });
  const clickTab = async (name) => window.testAct(async () => {
    [...doc.querySelectorAll('button')].find((button) => button.textContent === name).click();
  });
  try {
    await window.testAct(async () => window.mountDiagram());
    const diagram = () => doc.querySelector('[role="img"] svg');
    assert.equal(diagram().style.width, '320px');
    assert.equal(diagram().style.height, '640px');
    await clickTitle('放大');
    assert.equal(diagram().style.width, '352px');
    assert.equal(diagram().style.height, '704px');
    await clickTab('代码');
    assert.match(doc.querySelector('pre').textContent, /A --> B/);
    await clickTab('图表');
    assert.equal(diagram().style.height, '704px');
    await clickTitle('下载 SVG');
    assert.deepEqual(saved, [originalSVG]);
    assert.equal(doc.querySelector('[role="status"]').textContent, '图表已保存');
    await clickTitle('重置');
    assert.equal(diagram().style.height, '640px');
    assert.equal(resetPosition.top, 0);
    assert.equal(resetPosition.left, 0);
    await clickTitle('缩小');
    assert.equal(diagram().style.width, '288px');
    assert.equal(diagram().style.height, '576px');
    for (let i = 0; i < 30; i++) await clickTitle('放大');
    assert.equal(diagram().style.width, '960px');
    assert.equal([...doc.querySelectorAll('button')].find((button) => button.title === '放大').disabled, true);
    for (let i = 0; i < 40; i++) await clickTitle('缩小');
    assert.equal(diagram().style.width, '80px');
    assert.equal([...doc.querySelectorAll('button')].find((button) => button.title === '缩小').disabled, true);
    cancel = true;
    await clickTitle('下载 SVG');
    assert.equal(saved.length, 1);
    assert.equal(doc.querySelector('[role="status"]'), null);
    cancel = false;
    saveFailure = true;
    await clickTitle('下载 SVG');
    assert.match(doc.querySelector('[role="alert"]').textContent, /无法写入文件/);
  } finally {
    await window.testAct(async () => window.testRoot.unmount());
    channels.forEach((channel) => { channel.port1.close(); channel.port2.close(); });
    window.close();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMermaidSource, remarkFlowchartFences } from './mermaid.js';

test('flowchart fence includes direction metadata in Mermaid source', () => {
  assert.equal(normalizeMermaidSource('A[输入] --> B[结果]', 'flowchart', 'TD'), 'flowchart TD\nA[输入] --> B[结果]');
  assert.equal(normalizeMermaidSource('A --> B', 'flowchart', ' LR '), 'flowchart LR\nA --> B');
  assert.equal(normalizeMermaidSource('A --> B', 'flowchart', 'bt'), 'flowchart BT\nA --> B');
});

test('flowchart fence defaults to top down when no direction is supplied', () => {
  assert.equal(normalizeMermaidSource('A --> B', 'flowchart'), 'flowchart TD\nA --> B');
});

test('explicit graph declarations and mermaid blocks remain intact', () => {
  const source = '%% diagram\nflowchart LR\nA --> B';
  assert.equal(normalizeMermaidSource(source, 'flowchart', 'TD'), source);
  assert.equal(normalizeMermaidSource('graph BT\nA --> B', 'flowchart'), 'graph BT\nA --> B');
  assert.equal(normalizeMermaidSource('sequenceDiagram\nA->>B: hi', 'mermaid'), 'sequenceDiagram\nA->>B: hi');
});

test('Markdown plugin normalizes flowchart fences inside nested Markdown blocks', () => {
  const flowchart = { type: 'code', lang: 'flowchart', meta: 'RL', value: 'A --> B' };
  const plain = { type: 'code', lang: 'javascript', value: 'const a = 1;' };
  const tree = { type: 'root', children: [{ type: 'blockquote', children: [flowchart] }, plain] };
  remarkFlowchartFences()(tree);
  assert.equal(flowchart.value, 'flowchart RL\nA --> B');
  assert.equal(plain.value, 'const a = 1;');
});

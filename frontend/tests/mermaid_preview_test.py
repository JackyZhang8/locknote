"""Offline browser regression tests. Run with Python and Playwright installed:
python3 frontend/tests/mermaid_preview_test.py
"""
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

from playwright.sync_api import sync_playwright


FRONTEND = Path(__file__).resolve().parents[1]
FLOWCHART = (FRONTEND / 'tests/fixtures/skills-flowchart.txt').read_text()


class MermaidPreviewTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='locknote-preview-')
        cls.output = Path(cls.temp.name)
        harness = """
import React from 'react';
import { createRoot } from 'react-dom/client';
import { NoteEditor } from './src/components/NoteEditor';
import { useStore } from './src/store';
const root = createRoot(document.getElementById('root'));
window.savedDiagrams = [];
window.saveError = false;
window.go = { main: { App: {
  UpdateNote: async () => window.testNote,
  ListNotes: async () => [window.testNote],
  ExportDiagramSVG: async (svg) => {
    if (window.saveError) throw new Error('无法写入文件');
    window.savedDiagrams.push(svg);
    return '/tmp/flowchart.svg';
  },
} } };
window.renderPreview = (markdown) => {
  window.testNote = { id: 'test', title: '测试笔记', content: markdown,
    tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  useStore.setState({ editorMode: 'preview' });
  root.render(<React.StrictMode><NoteEditor note={window.testNote} /></React.StrictMode>);
};
"""
        build = """
import { build } from 'esbuild';
await build({ stdin: { contents: HARNESS, resolveDir: process.cwd(), loader: 'tsx' },
  outfile: OUTPUT, bundle: true, format: 'iife', platform: 'browser',
  define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'error' });
""".replace('HARNESS', json.dumps(harness)).replace('OUTPUT', json.dumps(str(cls.output / 'bundle.js')))
        subprocess.run(['node', '--input-type=module', '-e', build], cwd=FRONTEND, check=True)
        (cls.output / 'index.html').write_text(
            '<!doctype html><meta charset="utf-8"><style>'
            '#root{height:900px;width:1200px}button{cursor:pointer}'
            '</style><div id="root"></div><script src="bundle.js"></script>'
        )
        cls.playwright = sync_playwright().start()
        try:
            cls.browser = cls.playwright.chromium.launch(headless=True)
        except Exception:
            cls.playwright.stop()
            cls.temp.cleanup()
            raise

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.temp.cleanup()

    def setUp(self):
        self.page = self.browser.new_page(viewport={'width': 1300, 'height': 1000})
        self.page.goto((self.output / 'index.html').as_uri())
        self.page.wait_for_function('typeof window.renderPreview === "function"')

    def tearDown(self):
        self.page.close()

    def render(self, markdown):
        self.page.evaluate('(text) => window.renderPreview(text)', markdown)
        self.page.wait_for_selector('[data-editor-pane="preview"] svg', timeout=15000)

    def test_user_example_preserves_nodes_labels_direction_and_loop(self):
        # This is precisely the user's shorthand fence: its direction lives in the fence metadata.
        self.render('```flowchart TD\n' + FLOWCHART.split('\n', 1)[1] + '\n```')
        svg = self.page.locator('[data-editor-pane="preview"] svg').first
        self.assertEqual(svg.locator('g.node').count(), 22)
        self.assertEqual(svg.locator('.edgePaths path').count(), 24)
        text = svg.text_content()
        for label in ['用户输入', '解析显式 /Skill 指令', 'jev 意图分类是否成功',
                      '成功', '失败或未启用', '继续下一步或输出答案']:
            self.assertIn(label, text)
        self.assertEqual(svg.locator('g.node[id*="flowchart-E-"] polygon').count(), 1)
        first = svg.locator('g.node[id*="flowchart-A-"]').bounding_box()
        last = svg.locator('g.node[id*="flowchart-V-"]').bounding_box()
        self.assertGreater(last['y'], first['y'])

    def test_save_as_sends_complete_unscaled_svg_to_native_bridge(self):
        self.render('```mermaid\n' + FLOWCHART + '\n```')
        self.page.get_by_title('下载 SVG', exact=True).click()
        self.page.wait_for_function('window.savedDiagrams.length === 1', timeout=3000)
        saved = self.page.evaluate('window.savedDiagrams[0]')
        self.assertIn('http://www.w3.org/2000/svg', saved)
        self.assertIn('继续下一步或输出答案', saved)

    def test_zoom_changes_both_dimensions_reset_and_code_switch_preserve_state(self):
        self.render('```mermaid\nflowchart TD\nA[输入] --> B[结果]\n```')
        svg = self.page.locator('[data-editor-pane="preview"] svg').first
        initial = svg.bounding_box()
        self.page.get_by_title('放大', exact=True).click()
        enlarged = svg.bounding_box()
        self.assertGreater(enlarged['width'], initial['width'])
        self.assertGreater(enlarged['height'], initial['height'])
        self.page.get_by_role('button', name='代码', exact=True).click()
        self.assertIn('A[输入] --> B[结果]', self.page.locator('[data-editor-pane="preview"] pre').inner_text())
        self.page.get_by_role('button', name='图表', exact=True).click()
        self.assertAlmostEqual(svg.bounding_box()['height'], enlarged['height'], delta=1)
        self.page.get_by_title('重置', exact=True).click()
        self.assertAlmostEqual(svg.bounding_box()['height'], initial['height'], delta=1)
        self.page.get_by_title('缩小', exact=True).click()
        self.assertLess(svg.bounding_box()['height'], initial['height'])

    def test_two_diagrams_render_independently_and_lr_metadata_is_used(self):
        self.render('```flowchart LR\nA[左侧] --> B[右侧]\n```\n\n```mermaid\nflowchart TD\nA[上方] --> B[下方]\n```')
        self.page.wait_for_function('document.querySelectorAll("svg g.node").length === 4', timeout=10000)
        svgs = self.page.locator('[data-editor-pane="preview"] svg')
        self.assertEqual(svgs.count(), 2)
        self.assertNotEqual(svgs.nth(0).get_attribute('id'), svgs.nth(1).get_attribute('id'))
        left = svgs.nth(0).locator('g.node[id*="flowchart-A-"]').bounding_box()
        right = svgs.nth(0).locator('g.node[id*="flowchart-B-"]').bounding_box()
        self.assertGreater(right['x'], left['x'])

    def test_failed_native_save_reports_error(self):
        self.render('```mermaid\nflowchart TD\nA --> B\n```')
        self.page.evaluate('window.saveError = true')
        self.page.get_by_title('下载 SVG', exact=True).click()
        self.page.wait_for_selector('[role="alert"]', timeout=3000)
        self.assertIn('无法写入文件', self.page.get_by_role('alert').inner_text())


if __name__ == '__main__':
    unittest.main(verbosity=2)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const publicFile = name => readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');

test('home exposes only the two real document workflows in a bright fluid AI studio', async () => {
  const html = await publicFile('index.html');
  const css = await publicFile('styles.css');
  assert.match(html, /<title>IITP AI 문서 플로우 스튜디오<\/title>/);
  assert.match(html, /기술동향·기획보고서를/);
  assert.match(html, /사업설명자료로,/);
  assert.match(html, /RFP·연구개발계획서를/);
  assert.match(html, /과제설명자료로\./);
  assert.doesNotMatch(html, /근거는 선명하게|문서는 유연하게/);
  assert.match(html, /EVIDENCE-LED DOCUMENT FLOW/);
  assert.match(html, /AI DOCUMENT WORKBENCH/);
  assert.match(html, /SOURCE INTAKE/);
  assert.match(html, /SOURCE REVIEW/);
  assert.match(html, /EDIT &amp; EXPORT/);
  assert.match(html, />사업설명자료</);
  assert.match(html, />과제설명자료</);
  assert.match(html, /native HWPX/);
  assert.match(html, /소스 파싱/);
  assert.match(html, /근거 추적/);
  assert.match(html, /편집 가능한 초안/);
  assert.match(html, /Native HWPX/);
  assert.match(html, /class="ai-scene"/);
  assert.match(html, /class="core-wrap"/);
  assert.match(css, /--ivory:#fffdf7/);
  assert.match(css, /--canvas:#f6fbff/);
  assert.match(css, /--navy:#102a56/);
  assert.match(css, /--cobalt:#315ce9/);
  assert.match(css, /--cyan:#27c8ee/);
  assert.match(css, /--lilac:#8b6ce7/);
  assert.match(css, /--mint:#42d3a8/);
  assert.match(css, /--coral:#ff806d/);
  assert.match(css, /--paper:#ffffff/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(html, /class="brand-emblem"/);
  assert.match(html, /<svg class="ai-scene" viewBox="0 0 700 610"/);
  assert.doesNotMatch(html, /CYBER DOCUMENT INTELLIGENCE|SECURE FLOW|AI DOCUMENT CORE/);
  assert.doesNotMatch(css, /--void:#030711|--canvas:#050b18|repeating-linear-gradient\(to bottom/);
  assert.doesNotMatch(html, /API 키|웹 리서치|트렌드 분석|회의록/);
  assert.equal((html.match(/data-workflow=/g) || []).length, 2);
});

test('dynamic document values remain escaped before HTML insertion', async () => {
  const script = await publicFile('app.js');
  assert.match(script, /function escapeHtml/);
  assert.match(script, /escapeHtml\(state\.files\[role\.key\]\?\.name/);
  assert.match(script, /escapeHtml\(doc\.filename\)/);
  assert.match(script, /escapeHtml\(doc\.textPreview\)/);
  assert.match(script, /escapeHtml\(x\.filename\)/);
  assert.match(script, /escapeHtml\(x\.role\)/);
});

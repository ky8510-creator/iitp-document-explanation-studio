import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const publicFile = name => readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');

test('home exposes only the two real document workflows and cyber AI studio identity', async () => {
  const html = await publicFile('index.html');
  const css = await publicFile('styles.css');
  assert.match(html, /IITP AI 문서 스튜디오/);
  assert.match(html, /CYBER DOCUMENT INTELLIGENCE/);
  assert.match(html, /AI DOCUMENT WORKBENCH/);
  assert.match(html, /SECURE SOURCE INTAKE/);
  assert.match(html, /SOURCE INTELLIGENCE/);
  assert.match(html, /PRECISION EDIT &amp; EXPORT/);
  assert.match(html, />사업설명자료</);
  assert.match(html, />과제설명자료</);
  assert.match(html, /native HWPX/);
  assert.match(css, /--canvas:\s*#050b18/);
  assert.match(css, /--navy:\s*#081426/);
  assert.match(css, /--blue:\s*#1976ff/);
  assert.match(css, /--cyan:\s*#41d9ff/);
  assert.match(css, /--paper:\s*#f8fbff/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(html, /class="brand-emblem"/);
  assert.match(html, /<svg viewBox="0 0 44 44"/);
  assert.doesNotMatch(html, /ICT R&amp;D 문서 워크스페이스/);
  assert.doesNotMatch(html, /EDITORIAL RULES|DOCUMENT EDITING ROOM/);
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

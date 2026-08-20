import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const publicFile = name => readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');

test('home exposes only the two real document workflows and redesigned UI labels', async () => {
  const html = await publicFile('index.html');
  const css = await publicFile('styles.css');
  assert.match(html, /IITP 문서 편집실/);
  assert.match(html, /DOCUMENT WORKBENCH/);
  assert.match(html, /SOURCE INTAKE/);
  assert.match(html, /SOURCE REVIEW/);
  assert.match(html, /DRAFT EDIT/);
  assert.match(html, />사업설명자료</);
  assert.match(html, />과제설명자료</);
  assert.match(html, /native HWPX/);
  assert.match(css, /--canvas:\s*#f7f6f2/);
  assert.match(css, /--ink:\s*#14233b/);
  assert.match(css, /--cobalt:\s*#1859d1/);
  assert.match(css, /--coral:\s*#e36945/);
  assert.match(css, /--sage:\s*#5f826b/);
  assert.doesNotMatch(html, /ICT R&amp;D 문서 워크스페이스/);
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

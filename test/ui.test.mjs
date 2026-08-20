import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const publicFile = name => readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');

test('home exposes only the two real document workflows and redesigned UI labels', async () => {
  const html = await publicFile('index.html');
  assert.match(html, /ICT R&amp;D 문서 워크스페이스/);
  assert.match(html, /사업설명자료 만들기/);
  assert.match(html, /과제설명자료 만들기/);
  assert.match(html, /INPUT/);
  assert.match(html, /PROCESS/);
  assert.match(html, /OUTPUT/);
  assert.match(html, /native HWPX/);
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

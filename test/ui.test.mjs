import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const publicFile = name => readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');

test('home exposes two dual-mode document workflows in a bright fluid AI studio', async () => {
  const html = await publicFile('index.html');
  const css = await publicFile('styles.css');
  assert.match(html, /<title>IITP AI 문서 플로우 스튜디오<\/title>/);
  assert.match(html, /AI 기반 사업·과제<br>핵심정보 분석으로<br>/);
  assert.match(html, /부처 보고자료 생성 지원/);
  assert.doesNotMatch(html, /근거는 선명하게|문서는 유연하게/);
  assert.match(html, /EVIDENCE-LED DOCUMENT FLOW/);
  assert.match(html, /AI DOCUMENT WORKBENCH/);
  assert.match(html, /부처 보고용 설명자료 만들기/);
  assert.doesNotMatch(html, /필요한 문서 흐름을 선택하세요/);
  assert.match(html, /사업 및 기획<br>설명을 편리하게/);
  assert.doesNotMatch(html, /근거에서<br>완성본까지/);
  assert.match(html, /SOURCE INTAKE/);
  assert.match(html, /SOURCE REVIEW/);
  assert.match(html, /EDIT &amp; EXPORT/);
  assert.match(html, />사업설명자료</);
  assert.match(html, />과제설명자료</);
  assert.match(html, /RFP \+ 연구개발계획서\(선택\)/);
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
  assert.doesNotMatch(html, /API 키|회의록/);
  assert.match(html, />문서 업로드</);
  assert.match(html, />기술동향 분석</);
  assert.match(html, /AI\/인공지능/);
  assert.match(html, /양자정보통신/);
  assert.match(html, /실시간 공개 웹 \+ 선택 HWPX/);
  assert.match(html, /id="trendMarkdownPreview"/);
  assert.match(html, /id="trendSources"/);
  assert.match(html, /id="trendCreateBtn"/);
  assert.equal((html.match(/data-workflow=/g) || []).length, 2);
});

test('dynamic document values remain escaped before HTML insertion', async () => {
  const script = await publicFile('app.js');
  assert.match(script, /function escapeHtml/);
  assert.match(script, /escapeHtml\(current\.files\[role\.key\]\?\.name/);
  assert.match(script, /escapeHtml\(doc\.filename\)/);
  assert.match(script, /escapeHtml\(doc\.textPreview\)/);
  assert.match(script, /escapeHtml\(source\.title\)/);
  assert.match(script, /escapeHtml\(source\.description/);
  assert.match(script, /escapeHtml\(x\.role\)/);
  assert.match(script, /safeExternalUrl/);
  assert.match(script, /rel="noopener noreferrer"/);
});

test('task upload configuration distinguishes required and optional selected sources', async () => {
  const script = await publicFile('app.js');
  assert.match(script, /key:'rfp', label:'RFP', required:true/);
  assert.match(script, /key:'researchPlan', label:'연구개발계획서', required:false/);
  assert.match(script, /선택 · 연구목표·연구내용·추진체계·성과·기간·예산의 추가 근거/);
  assert.match(script, /filter\(role=>role\.required\)\.every/);
  assert.match(script, /for \(const role of selectedRoles\(\)\)/);
  assert.match(script, /Object\.fromEntries\(selectedRoles\(\)/);
});

test('workflow and mode state are kept independently', async () => {
  const script = await publicFile('app.js');
  assert.match(script, /sessions: \{ business: makeSession\(\), task: makeSession\(\) \}/);
  assert.match(script, /mode: 'upload'/);
  assert.match(script, /upload: \{ stage: 'intake'/);
  assert.match(script, /trend: \{ stage: 'intake'/);
  assert.match(script, /\/api\/trends\/analyze/);
  assert.match(script, /`\/api\/generate\/\$\{state\.workflow\}-trend`/);
});

import { createHash } from 'node:crypto';
import { parseHwpx, markdownToHwpx, validateHwpx } from 'kordoc';
import { resolveSections, selectedStandardKeys } from './sections.mjs';

export const MAX_UPLOAD = 30 * 1024 * 1024;
export const WORKFLOWS = Object.freeze({
  business: { inputs: ['demand', 'planning'], label: '사업설명자료' },
  task: { inputs: ['rfp', 'researchPlan'], label: '과제설명자료' }
});

const escapeMd = value => String(value ?? '').replace(/\|/g, '\\|').trim();
const textOnly = value => String(value ?? '')
  .replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();

export function validateUpload(filename, buffer) {
  if (!filename || !/\.hwpx$/i.test(filename)) throw Object.assign(new Error('확장자가 .hwpx인 파일만 업로드할 수 있습니다.'), { status: 415 });
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw Object.assign(new Error('파일이 비어 있습니다.'), { status: 400 });
  if (buffer.length > MAX_UPLOAD) throw Object.assign(new Error('파일은 30MB 이하여야 합니다.'), { status: 413 });
  if (buffer.subarray(0, 2).toString('ascii') !== 'PK') throw Object.assign(new Error('유효한 HWPX ZIP 패키지가 아닙니다.'), { status: 415 });
}

export function extractRows(markdown) {
  const rows = [];
  for (const match of markdown.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(x => textOnly(x[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function rowValue(rows, patterns) {
  const row = rows.find(cells => patterns.some(re => re.test(cells[0] || '')));
  return row ? row.slice(1).filter(Boolean).join('\n').trim() : '';
}

function tableSection(markdown, patterns, max = 5000) {
  const rows = extractRows(markdown);
  const start = rows.findIndex(cells => patterns.some(re => re.test(cells[0] || '')));
  if (start < 0) return '';
  const parts = [];
  const direct = rows[start].slice(1).filter(Boolean).join('\n');
  if (direct) parts.push(direct);
  for (let i=start+1;i<rows.length;i++) {
    if (/^\d+\.\s*/.test(rows[i][0] || '')) break;
    parts.push(rows[i].filter(Boolean).join('\n'));
  }
  return parts.filter(Boolean).join('\n').slice(0,max);
}

function section(markdown, patterns, max = 2400) {
  const hits = [...markdown.matchAll(/^#{1,6}\s+(.+)$/gm)];
  const found = hits.find(h => patterns.some(re => re.test(h[1])));
  if (found) {
    const level = found[0].match(/^#+/)[0].length;
    const next = hits.find(h => h.index > found.index && h[0].match(/^#+/)[0].length <= level);
    return textOnly(markdown.slice(found.index + found[0].length, next?.index ?? markdown.length)).slice(0, max);
  }
  const row = extractRows(markdown).find(cells => patterns.some(re => re.test(cells[0] || '')));
  return row ? row.slice(1).join('\n').slice(0, max) : '';
}

function inferTitle(markdown, rows, filename) {
  const title = rowValue(rows, [/^수요명$/, /품목.*명/, /^과제명$/, /^사업명$/])
    || markdown.match(/^#\s+(.+)$/m)?.[1]
    || filename.replace(/\.hwpx$/i, '').replace(/^\d+[_-]?/, '');
  return textOnly(title).split('\n')[0].slice(0, 180);
}

function unresolvedFor(markdown) {
  const checks = [
    ['사업기간·단계', /(?:총\s*)?(?:기술|연구)?개발\s*기간|사업기간/],
    ['예산·연차별 배분', /(?:총\s*)?(?:소요\s*금액|사업비|연구개발비|예산)/],
    ['TRL·목표 성숙도', /TRL|기술성숙도/],
    ['실증환경·수요기관', /실증(?:환경|기관|대상|시스템)|수요기관/],
    ['정량 KPI·시험방법', /KPI|성과지표|시험방법|측정방법/],
    ['추진체계·기관별 역할', /추진체계|주관기관|참여기관/]
  ];
  const missing = checks.filter(([, re]) => !re.test(markdown)).map(([label]) => label);
  if (/추가\s*(?:결정|확정)\s*필요|담당자.*(?:결정|확정)|공고\s*전.*(?:결정|확정)|협약\s*시\s*확정|제안.*협약.*확정/.test(markdown)) missing.unshift('원문에 명시된 미확정·제안단계 결정값');
  return [...new Set(missing)];
}

export async function parseDocument(filename, buffer, role) {
  validateUpload(filename, buffer);
  const parsed = await parseHwpx(buffer);
  if (!parsed?.success || !parsed.markdown?.trim()) throw Object.assign(new Error(`Kordoc이 ${filename}의 본문을 추출하지 못했습니다.`), { status: 422 });
  const rows = extractRows(parsed.markdown);
  const digest = createHash('sha256').update(buffer).digest('hex');
  return {
    role, filename, title: inferTitle(parsed.markdown, rows, filename), sha256: digest, bytes: buffer.length,
    metadata: parsed.metadata || {}, outline: (parsed.markdown.match(/^#{1,6}\s+.+$/gm) || []).slice(0, 60),
    fields: rows.slice(0, 40).map(cells => ({ label: cells[0], value: cells.slice(1).join(' / ').slice(0, 500) })),
    markdown: parsed.markdown.slice(0, 250_000), textPreview: textOnly(parsed.markdown).slice(0, 12_000)
  };
}

function sourceTag(doc, locator) { return `[출처: ${doc.filename} · ${locator} · SHA-256 ${doc.sha256.slice(0, 12)}…]`; }
function contentOr(value, fallback) { return value?.trim() || `※ ${fallback} — 담당자 결정 또는 추가 조사 필요`; }
function userMemo(value) {
  return value.split('\n').map(line => `> ${line || ' '}`).join('\n');
}
function numberedSections(items) {
  return items.map((item, index) => `## ${index + 1}. ${item.heading}\n\n${item.body}`).join('\n\n');
}
function supplementalBlock(doc, label, content, locator) {
  if (!doc || !content?.trim()) return '';
  return `\n\n### 연구개발계획서 추가 근거 · ${label}\n\n${content.trim()}\n\n${sourceTag(doc, locator)}`;
}

function researchPlanValue(markdown, patterns, max = 5000) {
  return tableSection(markdown, patterns, max) || section(markdown, patterns, max);
}

export function generateBusiness(demand, planning, options = {}) {
  const selection = resolveSections(options.sections, options.customText);
  const rows = extractRows(demand.markdown);
  const title = inferTitle(demand.markdown, rows, demand.filename);
  const goal = rowValue(rows, [/개발목표/, /사업목표/, /^목표$/]);
  const contents = rowValue(rows, [/개발내용/, /연구내용/, /주요.*내용/]);
  const need = rowValue(rows, [/지원.*필요성/, /기대효과/, /필요성/]);
  const period = rowValue(rows, [/개발\s*기간/, /사업기간/]);
  const budget = rowValue(rows, [/소요\s*금액/, /사업비/, /예산/]);
  const background = section(planning.markdown, [/추진배경/, /현황.*필요성/]);
  const scope = section(planning.markdown, [/개념.*범위/, /사업목표.*범위/]);
  const strategy = section(planning.markdown, [/추진전략/, /추진절차/, /추진체계/]);
  const effects = section(planning.markdown, [/기대효과/]);
  const unresolved = [...new Set([...unresolvedFor(demand.markdown), ...unresolvedFor(planning.markdown)])];
  const items = [
    selection.sections.background && { heading: '추진배경', body: `${contentOr(background, '기술기획보고서의 추진배경 근거 보완')}\n\n${sourceTag(planning, '추진배경')}` },
    selection.sections.overview && { heading: '사업개요', body: `| 구분 | 내용 | 근거 |\n| --- | --- | --- |\n| 사업명 | ${escapeMd(title)} | ${escapeMd(demand.filename)} · 수요명 |\n| 사업기간 | ${escapeMd(contentOr(period, '기간 확정 필요'))} | ${escapeMd(demand.filename)} · 기간 |\n| 추진방식·수행체계 | 담당자 결정 필요 | 업로드 문서 확인 필요 |` },
    selection.sections.goal && { heading: '사업목표', body: `${contentOr(goal, '목표 확정 필요')}\n\n${contentOr(need, '필요성·정부지원 논리의 공식 근거 보완')}\n\n${sourceTag(demand, '개발목표/지원 필요성')}` },
    selection.sections.details && { heading: '상세 추진내용', body: `${contentOr(contents, '주요 연구개발 내용 확정 필요')}\n\n### 사업 범위와 추진전략\n\n${contentOr(scope, '포함·제외 범위 확정 필요')}\n\n${contentOr(strategy, '단계·역할·검증 절차 확정 필요')}\n\n${sourceTag(demand, '개발내용')}\n\n${sourceTag(planning, '개념·범위/추진전략')}` },
    selection.sections.policy && { heading: '관련 주요 정책 및 국정과제', body: `${contentOr(section(planning.markdown, [/사업\s*근거/, /정책.*동향/, /국정과제/, /시장.*기술/]), '공식 정책·국정과제·시장·기술 근거 조사 필요')}\n\n${sourceTag(planning, '사업근거/정책·주요동향')}` },
    selection.sections.budget && { heading: '예산현황', body: `| 구분 | 내용 | 근거 |\n| --- | --- | --- |\n| 총사업비 | ${escapeMd(contentOr(budget, '예산 확정 필요'))} | ${escapeMd(demand.filename)} · 금액 |\n| 사업기간 | ${escapeMd(contentOr(period, '기간 확정 필요'))} | ${escapeMd(demand.filename)} · 기간 |\n| 연차별 배분 | 담당자 결정 또는 추가 조사 필요 | 업로드 문서 확인 필요 |\n\n${sourceTag(planning, '투자계획')}` },
    selection.sections.performance && { heading: '주요성과', body: `${contentOr(effects || need, '기술·산업·공공 파급경로 보완 필요')}\n\nㅇ 성과지표의 목표값·산식·시험환경·검증주체는 근거 확인 후 확정해야 함.\n\n${sourceTag(effects ? planning : demand, '기대효과/성과관리')}` },
    selection.sections.custom && { heading: '사용자 입력/검토 메모', body: `${selection.customText ? userMemo(selection.customText) : '> 입력된 메모 없음'}\n\n> **주의:** 위 메모는 사용자가 직접 입력한 검토용 내용이며, 업로드 문서에서 검증된 출처 사실로 취급하지 않습니다.` }
  ].filter(Boolean);
  const markdown = `# ${title} 사업설명자료\n\n> 본 초안은 업로드된 기술수요조사서와 기술기획보고서만 기술 사실의 근거로 사용했습니다. 기존 사업설명자료는 목차·공공문서 문체·표 구성에만 참고했습니다.\n\n${numberedSections(items)}\n\n## 검토 필요사항\n\n${unresolved.map(x => `- [담당자 결정 필요] ${x}`).join('\n') || '- 업로드 문서에서 주요 결정값을 확인했으며 최종 검토가 필요함'}\n\n## 출처 및 작성 메모\n\n- 기술 사실 1차 근거: ${demand.filename} (SHA-256: ${demand.sha256})\n- 기획 논리 근거: ${planning.filename} (SHA-256: ${planning.sha256})\n- 형식 참고 원칙: 사업설명자료 HWP의 구조·문체·표만 참고하며 기술명·기관명·수치·정책문구는 가져오지 않음\n`;
  return { markdown, title: `${title}_사업설명자료`, unresolved, provenance: [demand, planning].map(({role, filename, sha256}) => ({role, filename, sha256})), selectedSections: [...selectedStandardKeys(selection.sections), ...(selection.sections.custom ? ['custom'] : [])] };
}

export function generateTask(rfp, researchPlan = null, options = {}) {
  const selection = resolveSections(options.sections, options.customText);
  const rows = extractRows(rfp.markdown);
  const title = inferTitle(rfp.markdown, rows, rfp.filename);
  const definition = tableSection(rfp.markdown, [/품목.*정의/, /과제.*정의/]) || section(rfp.markdown, [/품목.*정의/, /과제.*정의/]);
  const status = tableSection(rfp.markdown, [/현황.*필요성/]) || section(rfp.markdown, [/현황.*필요성/]);
  const demand = tableSection(rfp.markdown, [/수요분석/]) || section(rfp.markdown, [/수요분석/]);
  const effects = tableSection(rfp.markdown, [/기대.*효과/]) || section(rfp.markdown, [/기대.*효과/]);
  const execution = tableSection(rfp.markdown, [/개발기간.*예산.*추진체계/, /기간.*예산/, /추진체계/]) || section(rfp.markdown, [/개발기간/, /추진체계/]);
  const requirements = tableSection(rfp.markdown, [/필수.*요구사항/, /주요.*개발내용/, /단계별.*산출물/]) || section(rfp.markdown, [/필수.*요구사항/, /주요.*개발내용/, /단계별.*산출물/]) || definition;
  const planGoal = researchPlan && researchPlanValue(researchPlan.markdown, [/연구개발\s*목표/, /연구\s*목표/, /사업\s*목표/, /최종\s*목표/, /^목표$/]);
  const planContents = researchPlan && researchPlanValue(researchPlan.markdown, [/연구개발\s*내용/, /주요\s*연구\s*내용/, /연구\s*내용/, /개발\s*내용/]);
  const planSystem = researchPlan && researchPlanValue(researchPlan.markdown, [/추진\s*체계/, /수행\s*체계/, /기관별\s*역할/]);
  const planPerformance = researchPlan && researchPlanValue(researchPlan.markdown, [/성과\s*관리/, /성과\s*지표/, /연구개발\s*성과/, /예상\s*성과/, /성과\s*활용/]);
  const planPeriodBudget = researchPlan && researchPlanValue(researchPlan.markdown, [/연구개발\s*기간.*(?:예산|연구개발비)/, /기간.*예산/, /연차별\s*투자/, /연구개발\s*기간/, /연구개발비/, /사업비/, /예산/]);
  const unresolved = unresolvedFor([rfp.markdown, researchPlan?.markdown].filter(Boolean).join('\n'));
  const intro = researchPlan
    ? '본 초안은 RFP를 기술·사업 사실의 1차 근거로, 연구개발계획서를 관련 목표·내용·추진체계·성과·기간·예산의 추가 근거로 사용했습니다. 두 문서의 값을 임의로 합치거나 충돌을 해소하지 않았습니다.'
    : '본 초안은 업로드된 RFP만 기술·사업 사실의 근거로 사용했습니다. 제안자의 구현방법을 새로 강제하거나 RFP에 없는 수치·기관·기술을 임의로 추가하지 않았습니다.';
  const sourceNotes = researchPlan
    ? `- 1차 기술·사업 사실 근거: ${rfp.filename} (SHA-256: ${rfp.sha256})\n- 추가 연구개발 근거: ${researchPlan.filename} (SHA-256: ${researchPlan.sha256})\n- 작성원칙: RFP를 우선해 설명형으로 재배열하고, 연구개발계획서의 관련 내용은 출처를 구분해 보완하며 미확정값은 만들지 않음`
    : `- 유일한 기술·사업 사실 근거: ${rfp.filename}\n- SHA-256: ${rfp.sha256}\n- 작성원칙: RFP의 문제·목표·요구사항을 설명형으로 재배열하며 미확정값은 만들지 않음`;
  const items = [
    selection.sections.background && { heading: '현황 및 지원 필요성', body: `${contentOr(status, '기술현황과 개발 필요성 보완 필요')}\n\n${sourceTag(rfp, '현황 및 필요성')}` },
    selection.sections.overview && { heading: '과제 개요', body: `| 구분 | 내용 |\n| --- | --- |\n| 품목(과제)명 | ${escapeMd(title)} |\n| 공모·기획 유형 | ${escapeMd(contentOr(rowValue(rows, [/공모.*유형/, /기획유형/]), 'RFP 확인 또는 공고 전 결정 필요'))} |\n| 기술분류 | ${escapeMd(contentOr(rowValue(rows, [/기술분류/]), '기술분류 확정 필요'))} |\n| 관리번호 | ${escapeMd(contentOr(rowValue(rows, [/관리번호/]), '관리번호 확정 필요'))} |\n\n${sourceTag(rfp, '상단 식별정보')}` },
    selection.sections.goal && { heading: '해결해야 할 문제와 목표', body: `${contentOr(definition, '품목 정의·최종목표·As-is/To-be 확인 필요')}\n\n${sourceTag(rfp, '품목(문제) 정의')}${supplementalBlock(researchPlan, '연구 목표', planGoal, '연구개발 목표')}` },
    selection.sections.details && { heading: '주요 개발내용과 필수 요구사항', body: `${contentOr(requirements, '기능·비기능 요구사항 확인 필요')}\n\n${sourceTag(rfp, '개발내용/필수 요구사항')}${supplementalBlock(researchPlan, '연구 내용', planContents, '연구개발 내용')}\n\n### 수요처·협력·확산방안\n\n${contentOr(demand, '수요처·협력·확산방안 확인 필요')}\n\n${sourceTag(rfp, '수요분석')}` },
    selection.sections.policy && { heading: '정책·국정과제 연계', body: `${contentOr(section(rfp.markdown, [/정책/, /국정과제/, /법제/, /정부.*지원/]), '관련 부처의 공식 정책·국정과제·법제 원문 추가 조사 필요')}\n\n${sourceTag(rfp, '정책/정부지원 관련 내용')}` },
    selection.sections.budget && { heading: '기간·예산·추진체계', body: `${contentOr(execution, '기간·예산·기관별 역할 확정 필요')}\n\n${sourceTag(rfp, '개발기간/예산/추진체계')}${supplementalBlock(researchPlan, '추진체계', planSystem, '추진체계')}${supplementalBlock(researchPlan, '기간·예산', planPeriodBudget, '연구개발 기간/예산')}` },
    selection.sections.performance && { heading: '성과지표·시험 및 완료판정/기대효과', body: `${contentOr(section(rfp.markdown, [/성과지표/, /시험방법/, /완료판정/]), '제안서에서 지표·목표값·산식·시험환경·검증주체를 제시하고 협약 시 확정')}\n\n${sourceTag(rfp, '성과지표/시험방법')}${supplementalBlock(researchPlan, '성과', planPerformance, '성과/성과관리')}\n\n### 기대효과\n\n${contentOr(effects, '기술·산업·공공 효과 확인 필요')}\n\n${sourceTag(rfp, '기대효과')}` },
    selection.sections.custom && { heading: '사용자 입력/검토 메모', body: `${selection.customText ? userMemo(selection.customText) : '> 입력된 메모 없음'}\n\n> **주의:** 위 메모는 사용자가 직접 입력한 검토용 내용이며, RFP나 연구개발계획서에서 검증된 출처 사실로 취급하지 않습니다.` }
  ].filter(Boolean);
  const markdown = `# ${title} 과제설명자료\n\n> ${intro}\n\n${numberedSections(items)}\n\n## 제안 준비 및 공고 전 확인사항\n\n${unresolved.map(x => `- [공고 전 결정 필요] ${x}`).join('\n') || '- RFP의 확정값과 제안서 제시값을 구분해 최종 확인해야 함'}\n\n## 출처 및 작성 메모\n\n${sourceNotes}\n`;
  const provenance = [rfp, researchPlan].filter(Boolean).map(({ role, filename, sha256 }) => ({ role, filename, sha256 }));
  return { markdown, title: `${title}_과제설명자료`, unresolved, provenance, selectedSections: [...selectedStandardKeys(selection.sections), ...(selection.sections.custom ? ['custom'] : [])] };
}

export async function exportHwpx(markdown) {
  if (typeof markdown !== 'string' || markdown.trim().length < 30) throw Object.assign(new Error('내보낼 편집 내용이 너무 짧습니다.'), { status: 400 });
  if (markdown.length > 500_000) throw Object.assign(new Error('편집 내용은 500,000자 이하여야 합니다.'), { status: 413 });
  const buffer = Buffer.from(await markdownToHwpx(markdown));
  const validation = await validateHwpx(buffer);
  if (!validation?.ok) throw Object.assign(new Error(`생성 HWPX 구조 검증 실패: ${(validation?.errors || []).join(', ')}`), { status: 500 });
  const roundTrip = await parseHwpx(buffer);
  if (!roundTrip?.success || !roundTrip.markdown?.trim()) throw Object.assign(new Error('생성 HWPX의 Kordoc 재추출 검증에 실패했습니다.'), { status: 500 });
  return { buffer, validation, roundTripChars: roundTrip.markdown.length };
}

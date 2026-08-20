import { resolveSections, selectedStandardKeys } from './sections.mjs';

const GOOGLE_NEWS_ORIGIN = 'https://news.google.com';
const GOOGLE_NEWS_PATH = '/rss/search';

export const ICT_FIELDS = Object.freeze({
  ai: { label: 'AI/인공지능', query: 'AI 인공지능', official: ['msit', 'iitp', 'nia', 'etri'] },
  semiconductor: { label: '반도체', query: 'ICT 반도체', official: ['msit', 'iitp', 'etri'] },
  cloud: { label: '클라우드', query: '클라우드 컴퓨팅', official: ['msit', 'iitp', 'nia', 'kisa'] },
  cybersecurity: { label: '사이버보안', query: '사이버보안 정보보호', official: ['msit', 'iitp', 'kisa'] },
  quantum: { label: '양자정보통신', query: '양자정보통신', official: ['msit', 'iitp', 'etri'] },
  network6g: { label: '6G/네트워크', query: '6G 네트워크 통신', official: ['msit', 'iitp', 'etri'] },
  robotics: { label: '로봇/스마트제조', query: '로봇 스마트제조 ICT', official: ['msit', 'iitp', 'etri'] },
  dataSoftware: { label: '데이터/소프트웨어', query: '데이터 소프트웨어 ICT', official: ['msit', 'iitp', 'nia'] },
  other: { label: '기타 ICT', query: 'ICT 기술', official: ['msit', 'iitp', 'etri'] }
});

const OFFICIAL_SOURCES = Object.freeze({
  msit: { title: '과학기술정보통신부', url: 'https://www.msit.go.kr/', description: '정책·보도자료를 직접 확인하기 위한 공식 웹사이트' },
  iitp: { title: '정보통신기획평가원(IITP)', url: 'https://www.iitp.kr/', description: 'ICT R&D 사업·기획 자료를 직접 확인하기 위한 공식 웹사이트' },
  nia: { title: '한국지능정보사회진흥원(NIA)', url: 'https://www.nia.or.kr/', description: '디지털 정책·기술 자료를 직접 확인하기 위한 공식 웹사이트' },
  kisa: { title: '한국인터넷진흥원(KISA)', url: 'https://www.kisa.or.kr/', description: '정보보호·인터넷 관련 자료를 직접 확인하기 위한 공식 웹사이트' },
  etri: { title: '한국전자통신연구원(ETRI)', url: 'https://www.etri.re.kr/', description: 'ICT 연구성과·동향 자료를 직접 확인하기 위한 공식 웹사이트' }
});

const htmlText = value => decodeEntities(decodeEntities(String(value ?? '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')).trim();

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? _;
    const code = entity[1].toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : _;
  });
}

const tagValue = (xml, tag) => xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] ?? '';
const safeHttpUrl = value => {
  try { const url = new URL(htmlText(value)); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
};

export function parseRss(xml, fetchedAt = new Date().toISOString()) {
  if (typeof xml !== 'string' || !/<(?:rss|feed)[\s>]/i.test(xml)) throw new Error('RSS XML 형식을 확인할 수 없습니다.');
  const items = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0, 12);
  return items.map(([, item], index) => {
    const title = htmlText(tagValue(item, 'title')) || `제목 미제공 항목 ${index + 1}`;
    const url = safeHttpUrl(tagValue(item, 'link'));
    const rawDate = htmlText(tagValue(item, 'pubDate'));
    const parsedDate = rawDate && !Number.isNaN(Date.parse(rawDate)) ? new Date(rawDate).toISOString() : null;
    const sourceMatch = item.match(/<source(?:\s+url=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/source>/i);
    return {
      id: `rss-${index + 1}`, title, url, publicationDate: parsedDate,
      description: htmlText(tagValue(item, 'description')).slice(0, 700) || 'RSS 설명 미제공',
      sourceKind: 'news-rss', publisher: htmlText(sourceMatch?.[2] || '') || null,
      publisherUrl: safeHttpUrl(sourceMatch?.[1] || ''), fetchedAt, status: url ? 'available' : 'unavailable',
      error: url ? null : 'RSS 항목 URL이 없거나 공개 HTTP(S) URL이 아닙니다.'
    };
  });
}

export function buildGoogleNewsUrl(field, topic) {
  const selected = ICT_FIELDS[field];
  if (!selected) throw Object.assign(new Error('지원하지 않는 ICT 분야입니다.'), { status: 400 });
  const cleanTopic = String(topic ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanTopic) throw Object.assign(new Error('기술·주제 키워드를 입력해주세요.'), { status: 400 });
  if (cleanTopic.length > 180) throw Object.assign(new Error('기술·주제 키워드는 180자 이하여야 합니다.'), { status: 400 });
  const url = new URL(GOOGLE_NEWS_PATH, GOOGLE_NEWS_ORIGIN);
  url.searchParams.set('q', `${selected.query} ${cleanTopic}`);
  url.searchParams.set('hl', 'ko'); url.searchParams.set('gl', 'KR'); url.searchParams.set('ceid', 'KR:ko');
  return url;
}

export function isAllowedFetchUrl(value) {
  try { const url = value instanceof URL ? value : new URL(value); return url.protocol === 'https:' && url.origin === GOOGLE_NEWS_ORIGIN && url.pathname === GOOGLE_NEWS_PATH; }
  catch { return false; }
}

function officialReferences(field, fetchedAt) {
  return ICT_FIELDS[field].official.map((key, index) => ({
    id: `official-${index + 1}`, ...OFFICIAL_SOURCES[key], publicationDate: null,
    sourceKind: 'official-reference', publisher: OFFICIAL_SOURCES[key].title, publisherUrl: OFFICIAL_SOURCES[key].url,
    fetchedAt, status: 'available', error: null, verificationNote: '고정 공식 링크이며 이 요청에서 본문을 가져오지 않았습니다.'
  }));
}

async function fetchRss(url, { fetchImpl, timeoutMs }) {
  if (!isAllowedFetchUrl(url)) throw new Error('허용되지 않은 수집 URL입니다.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { headers: { 'user-agent': 'IITP-ICT-Trend-Research/1.0', accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8' }, redirect: 'error', signal: controller.signal });
    if (!response.ok) throw new Error(`Google News RSS 응답 오류 (${response.status})`);
    return await response.text();
  } finally { clearTimeout(timer); }
}

const md = value => String(value ?? '').replace(/[\[\]`*_<>|]/g, '\\$&').replace(/\s+/g, ' ').trim();
const sourceLine = (source, index) => {
  const date = source.publicationDate ? source.publicationDate.slice(0, 10) : '발행일 미제공';
  const link = source.url ? `[${md(source.title)}](${source.url})` : md(source.title);
  return `- **웹 근거 W${index + 1}** · ${link} · ${date}${source.publisher ? ` · ${md(source.publisher)}` : ''}\n  - RSS 설명: ${md(source.description)}`;
};

export function buildTrendAnalysis({ field, topic, sourceDocument = null, sources, fetchedAt, webStatus }) {
  const selected = ICT_FIELDS[field];
  const evidenceSources = sourceDocument ? [...sources, { id: 'document-1', title: sourceDocument.filename, url: null, publicationDate: null, description: '사용자가 업로드하고 Kordoc으로 추출한 HWPX 근거', sourceKind: 'uploaded-hwpx', publisher: sourceDocument.filename, publisherUrl: null, fetchedAt, status: 'available', error: null, sha256: sourceDocument.sha256 }] : sources;
  const news = evidenceSources.filter(source => source.sourceKind === 'news-rss' && source.status === 'available');
  const official = evidenceSources.filter(source => source.sourceKind === 'official-reference');
  const errors = evidenceSources.filter(source => source.status === 'error' || source.status === 'unavailable');
  const unresolved = [
    ...(!news.length ? ['실시간 뉴스 RSS 근거를 확보하지 못함 — 네트워크 복구 후 재수집 필요'] : []),
    ...errors.map(source => `${source.title}: ${source.error || '사용 불가'}`),
    ...(!sourceDocument ? ['업로드 HWPX 근거 없음(선택 사항) — 내부 기획·보고서와의 대조 미수행'] : []),
    '정책 연계·법제·정부 방침은 공식 원문 추가 조사 필요',
    '예산·사업기간·KPI·TRL·수행기관·실증/배포 대상·정량값은 근거 확인 및 담당자 결정 필요'
  ];
  const webBlock = news.length ? news.map(sourceLine).join('\n') : '- **수집 불가** · 실시간 RSS 근거가 없어 현재 사실을 서술하지 않음.';
  const docBlock = sourceDocument
    ? `- **문서 근거 D1** · ${md(sourceDocument.filename)} · SHA-256 ${sourceDocument.sha256}\n\n${md(sourceDocument.textPreview || sourceDocument.markdown).slice(0, 6000)}\n\n[출처: ${md(sourceDocument.filename)} · Kordoc 추출 본문 · SHA-256 ${sourceDocument.sha256.slice(0, 16)}…]`
    : '- 선택 HWPX가 업로드되지 않아 문서 근거 분석은 비어 있음.';
  const officialBlock = official.map(source => `- [${md(source.title)}](${source.url}) — ${md(source.description)} · 본문 미수집`).join('\n');
  const markdown = `# ${selected.label} · ${md(topic)} ICT 기술동향 분석\n\n> 분석 기준시각: ${fetchedAt} · 웹 수집 상태: ${webStatus}. RSS 제목·설명과 업로드 문서를 서로 구분해 기록했으며, 근거에 없는 현재 사실을 만들지 않았습니다.\n\n## 1. 분석 범위\n\n- ICT 분야: ${selected.label}\n- 기술·주제 키워드: ${md(topic)}\n- 분석 원칙: RSS의 제목·짧은 설명은 발견 근거이며, 원문 확인 전 확정 사실로 확대 해석하지 않음\n\n## 2. 실시간 공개 웹 근거\n\n${webBlock}\n\n## 3. 업로드 HWPX 근거\n\n${docBlock}\n\n## 4. 근거 기반 관찰\n\n${news.length ? news.map((source, index) => `- W${index + 1}에서 \`${md(source.title)}\` 관련 공개 보도가 발견됨. 세부 사실은 연결된 원문 확인 필요.`).join('\n') : '- 웹 근거가 없어 관찰 결과를 작성하지 않음. 재수집 후 제목·발행일·원문을 검증해야 함.'}\n${sourceDocument ? '- D1은 사용자 업로드 문서의 추출 내용이며, 공개 웹 근거와 일치 여부를 별도로 검토해야 함.' : '- 대조할 업로드 문서가 없음.'}\n\n## 5. 기획 검토 질문\n\n- 어떤 문제와 수요를 공식 통계·현장 자료로 입증할 수 있는가?\n- 후보 기술의 적용 범위, 제약, 상호운용성, 보안·안전 검증 조건은 무엇인가?\n- 국내 정책·법제와 표준화 현황은 어떤 공식 원문으로 확인할 것인가?\n- 목표값·시험환경·검증주체를 어떤 근거로 정할 것인가?\n\n## 6. 공식 원문 추가 확인 링크\n\n${officialBlock}\n\n## 7. 미해결·추가 조사 항목\n\n${unresolved.map(item => `- [확인/조사 필요] ${md(item)}`).join('\n')}\n`;
  return { field, fieldLabel: selected.label, topic: String(topic).trim(), fetchedAt, webStatus, markdown, sources: evidenceSources, unresolved, sourceDocument: sourceDocument ? { role: sourceDocument.role, filename: sourceDocument.filename, sha256: sourceDocument.sha256 } : null };
}

export async function analyzeTrends(input, options = {}) {
  const field = String(input?.field || '');
  const topic = String(input?.topic || '').trim();
  const newsUrl = buildGoogleNewsUrl(field, topic);
  const fetchedAt = (options.now?.() || new Date()).toISOString();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  let news = [], webStatus = 'available';
  try {
    const xml = await fetchRss(newsUrl, { fetchImpl, timeoutMs: options.timeoutMs || 8000 });
    news = parseRss(xml, fetchedAt);
    if (!news.length) {
      webStatus = 'unavailable';
      news = [{ id: 'rss-unavailable', title: 'Google News RSS 수집', url: newsUrl.href, publicationDate: null, description: '검색 결과 RSS 항목이 제공되지 않았습니다.', sourceKind: 'news-rss', publisher: 'Google News', publisherUrl: GOOGLE_NEWS_ORIGIN, fetchedAt, status: 'unavailable', error: '검색 결과가 비어 있습니다.' }];
    }
  } catch (error) {
    webStatus = 'error';
    news = [{ id: 'rss-error', title: 'Google News RSS 수집', url: newsUrl.href, publicationDate: null, description: '실시간 웹 근거를 가져오지 못했습니다.', sourceKind: 'news-rss', publisher: 'Google News', publisherUrl: GOOGLE_NEWS_ORIGIN, fetchedAt, status: 'error', error: error.name === 'AbortError' ? '수집 시간 제한을 초과했습니다.' : error.message }];
  }
  return buildTrendAnalysis({ field, topic, sourceDocument: input?.sourceDocument || null, sources: [...news, ...officialReferences(field, fetchedAt)], fetchedAt, webStatus });
}

const confirmationRows = `| 정책·법제 연계 | [추가 조사 필요] 관련 부처·법령·공식 정책 원문 확인 필요 |\n| 예산 | [담당자 확인 필요] 근거 없는 금액을 산정하지 않음 |\n| 기간·단계 | [담당자 확인 필요] 사업/개발 기간과 단계 확정 필요 |\n| KPI·정량 목표 | [담당자 확인 필요] 기준값·목표값·산식·시험환경·검증주체 확정 필요 |\n| TRL | [추가 조사 필요] 시작·목표 TRL과 판정 근거 확인 필요 |\n| 수행기관 | [담당자 확인 필요] 주관·참여·수요기관 확정 필요 |\n| 실증·배포 대상 | [담당자 확인 필요] 대상·환경·규모·운영주체 확정 필요 |`;

function evidenceDigest(analysis) {
  const usable = (analysis.sources || []).filter(source => source.status === 'available' && source.sourceKind === 'news-rss');
  return usable.length ? usable.map((source, index) => `- **T${index + 1}** · [${md(source.title)}](${source.url}) · ${source.publicationDate?.slice(0, 10) || '발행일 미제공'}\n  - ${md(source.description)}\n  - [출처: ${source.url}]`).join('\n') : '- [추가 조사 필요] 사용 가능한 실시간 웹 근거가 없어 기술동향 사실을 서술하지 않음.';
}

const trendMemo = value => value.split('\n').map(line => `> ${line || ' '}`).join('\n');
const trendSections = items => items.map((item, index) => `## ${index + 1}. ${item.heading}\n\n${item.body}`).join('\n\n');

export function generateTrendMaterial(workflow, analysis, options = {}) {
  if (!['business', 'task'].includes(workflow)) throw Object.assign(new Error('지원하지 않는 생성 유형입니다.'), { status: 400 });
  if (!analysis?.markdown || !Array.isArray(analysis.sources)) throw Object.assign(new Error('먼저 기술동향 분석을 수행해주세요.'), { status: 400 });
  const selection = resolveSections(options.sections, options.customText);
  const isBusiness = workflow === 'business';
  const outputLabel = isBusiness ? '사업설명자료' : '과제설명자료';
  const title = `${analysis.topic || analysis.fieldLabel || 'ICT 기술동향'} 기반 ${outputLabel}`;
  const unresolved = [...new Set([...(analysis.unresolved || []), '정책·예산·기간·KPI·TRL·기관·실증/배포 대상·모든 정량값 최종 확인'])];
  const context = `- ${md(analysis.fieldLabel)} 분야의 \`${md(analysis.topic)}\` 관련 공개 근거를 수집했으며, 아래 출처의 제목·RSS 설명 범위에서만 검토함.\n- [추가 조사 필요] 연결된 원문, 공식 통계와 수요조사를 확인한 뒤 확정 서술해야 함.`;
  const documentEvidence = analysis.sourceDocument ? `- ${md(analysis.sourceDocument.filename)} · SHA-256 ${analysis.sourceDocument.sha256}\n- 사용자 업로드 문서 근거는 공개 웹 근거와 별도로 검증해야 함.` : '- 선택 HWPX가 없어 내부 문서 근거는 포함하지 않음.';
  const items = [
    selection.sections.background && { heading: isBusiness ? '추진배경' : '현황 및 지원 필요성', body: `${context}\n\n### 기술동향 근거\n\n${evidenceDigest(analysis)}` },
    selection.sections.overview && { heading: isBusiness ? '사업개요' : '과제 개요', body: `| 구분 | 내용 |\n| --- | --- |\n| ICT 분야 | ${md(analysis.fieldLabel)} |\n| 기술·주제 | ${md(analysis.topic)} |\n| 웹 수집 상태 | ${md(analysis.webStatus)} |\n| 분석 기준시각 | ${md(analysis.fetchedAt)} |\n\n### 업로드 문서 근거\n\n${documentEvidence}` },
    selection.sections.goal && { heading: isBusiness ? '사업목표' : '해결해야 할 문제와 목표', body: `- [담당자 확인 필요] 해결할 문제, 수요자, 최종 목표와 포함·제외 범위를 확정해야 함.\n- [추가 조사 필요] 동향 근거를 실제 ${isBusiness ? '지원 필요성과 사업목표' : '연구개발 목표'}로 전환할 수 있는지 공식 근거로 검토해야 함.` },
    selection.sections.details && { heading: isBusiness ? '상세 추진내용' : '주요 개발내용과 필수 요구사항', body: `- [추가 조사 필요] 후보 기술의 성능·안전·보안·상호운용 요구사항을 원문과 시험 근거로 구체화해야 함.\n- [담당자 확인 필요] 단계별 활동, 산출물, 검증 절차와 포함·제외 범위를 확정해야 함.\n\n${evidenceDigest(analysis)}` },
    selection.sections.policy && { heading: isBusiness ? '관련 주요 정책 및 국정과제' : '정책·국정과제 연계', body: `- [추가 조사 필요] 관련 부처·법령·공식 정책 및 국정과제 원문을 확인해야 함.\n- 공식기관 링크는 원문 추가 확인용이며, 해당 페이지 본문을 수집하거나 사실로 단정하지 않음.` },
    selection.sections.budget && { heading: isBusiness ? '예산현황' : '기간·예산·추진체계', body: `| 항목 | 상태 |\n| --- | --- |\n${confirmationRows.split('\n').filter(line => /예산|기간·단계|수행기관|실증·배포 대상/.test(line)).join('\n')}` },
    selection.sections.performance && { heading: isBusiness ? '주요성과' : '성과지표·시험 및 완료판정/기대효과', body: `- [추가 조사 필요] 기대효과는 기준선·인과경로·수혜대상 근거를 확보한 뒤 작성해야 함.\n- [담당자 확인 필요] KPI, 목표값, 산식, 시험환경, 검증주체와 완료판정 조건을 확정해야 함.\n- [추가 조사 필요] 시작·목표 TRL과 판정 근거를 확인해야 함.` },
    selection.sections.custom && { heading: '사용자 입력/검토 메모', body: `${selection.customText ? trendMemo(selection.customText) : '> 입력된 메모 없음'}\n\n> **주의:** 위 메모는 사용자가 직접 입력한 검토용 내용이며, RSS나 업로드 HWPX에서 검증된 출처 사실로 취급하지 않습니다.` }
  ].filter(Boolean);
  const sourceList = (analysis.sources || []).map(source => source.url ? `- [${md(source.title)}](${source.url}) · ${md(source.sourceKind)} · ${md(source.status)}` : `- ${md(source.title)} · ${md(source.sourceKind)} · ${md(source.status)}`).join('\n');
  const markdown = `# ${md(title)}\n\n> 본 초안은 기술동향 분석에서 분리 보존한 실시간 RSS 근거와 업로드 HWPX 근거만 사용했습니다. RSS 요약은 원문 발견 근거이며 확정 사실이 아닙니다. 출처 없는 정책, 예산, 기간, KPI, TRL, 기관, 실증·배포 대상 및 정량값은 만들지 않았습니다.\n\n${trendSections(items)}\n\n## 미해결 사항\n\n${unresolved.map(item => `- [확인/조사 필요] ${md(item)}`).join('\n')}\n\n## 출처 및 작성 메모\n\n${sourceList || '- 사용 가능한 외부 출처 없음'}\n`;
  const provenance = (analysis.sources || []).map(source => ({ role: source.sourceKind, filename: source.title, url: source.url, status: source.status, fetchedAt: source.fetchedAt }));
  const uploaded = provenance.find(source => source.role === 'uploaded-hwpx');
  if (uploaded && analysis.sourceDocument) uploaded.sha256 = analysis.sourceDocument.sha256;
  return { markdown, title: title.replace(/[\\/:*?"<>|]/g, '_'), unresolved, provenance, selectedSections: [...selectedStandardKeys(selection.sections), ...(selection.sections.custom ? ['custom'] : [])] };
}

export const generateBusinessTrend = (analysis, options = {}) => generateTrendMaterial('business', analysis, options);
export const generateTaskTrend = (analysis, options = {}) => generateTrendMaterial('task', analysis, options);

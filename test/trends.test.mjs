import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTrends, buildGoogleNewsUrl, generateBusinessTrend, generateTaskTrend, isAllowedFetchUrl, parseRss } from '../lib/trends.mjs';
import { createServer } from '../server.mjs';

const fixture = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item><title>신뢰성 평가 &amp; 공개 시험</title><link>https://news.google.com/rss/articles/example1</link><pubDate>Wed, 19 Aug 2026 03:00:00 GMT</pubDate><description><![CDATA[<a href="https://example.org/a">기관 발표</a>에 관한 RSS 요약]]></description><source url="https://example.org">예시 발행처</source></item>
  <item><title>두 번째 기술 소식</title><link>https://news.google.com/rss/articles/example2</link><description>발행일이 없는 짧은 설명</description></item>
</channel></rss>`;
const now = () => new Date('2026-08-20T00:00:00.000Z');
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => body });

test('RSS parser extracts deterministic evidence without HTML', () => {
  const sources=parseRss(fixture,now().toISOString());
  assert.equal(sources.length,2);
  assert.equal(sources[0].title,'신뢰성 평가 & 공개 시험');
  assert.equal(sources[0].description,'기관 발표 에 관한 RSS 요약');
  assert.equal(sources[0].publicationDate,'2026-08-19T03:00:00.000Z');
  assert.equal(sources[0].publisher,'예시 발행처');
  assert.equal(sources[1].publicationDate,null);
  assert.equal(sources[1].status,'available');
});

test('Google News query is constructed from fields while arbitrary URLs are rejected', () => {
  const url=buildGoogleNewsUrl('cybersecurity','공급망 보안');
  assert.equal(url.origin,'https://news.google.com');
  assert.equal(url.pathname,'/rss/search');
  assert.match(url.searchParams.get('q'),/사이버보안 정보보호 공급망 보안/);
  assert.equal(isAllowedFetchUrl(url),true);
  assert.equal(isAllowedFetchUrl('https://example.com/rss/search?q=x'),false);
  assert.equal(isAllowedFetchUrl('http://news.google.com/rss/search?q=x'),false);
  assert.equal(isAllowedFetchUrl('https://news.google.com/other?q=x'),false);
  assert.throws(()=>buildGoogleNewsUrl('unknown','주제'),/분야/);
});

test('trend analysis keeps live RSS and uploaded HWPX evidence separate', async () => {
  let requested;
  const sourceDocument={role:'trendSource',filename:'기획.hwpx',sha256:'a'.repeat(64),textPreview:'내부 검토 문서의 원문 내용'};
  const result=await analyzeTrends({field:'ai',topic:'모델 신뢰성',sourceDocument},{now,fetchImpl:async url=>{requested=String(url);return response(fixture)}});
  assert.match(requested,/^https:\/\/news\.google\.com\/rss\/search/);
  assert.equal(result.webStatus,'available');
  assert.match(result.markdown,/## 2\. 실시간 공개 웹 근거/);
  assert.match(result.markdown,/## 3\. 업로드 HWPX 근거/);
  assert.match(result.markdown,/웹 근거 W1/);
  assert.match(result.markdown,/문서 근거 D1/);
  assert.match(result.markdown,/https:\/\/news\.google\.com\/rss\/articles\/example1/);
  assert.equal(result.sourceDocument.filename,'기획.hwpx');
  assert.equal(result.sources.at(-1).sourceKind,'uploaded-hwpx');
  assert.equal(result.sources.at(-1).sha256,'a'.repeat(64));
});

test('web failure returns explicit error and evidence-needed scaffold', async () => {
  const result=await analyzeTrends({field:'quantum',topic:'양자 네트워크'},{now,fetchImpl:async()=>{throw Error('offline')}});
  assert.equal(result.webStatus,'error');
  assert.equal(result.sources[0].status,'error');
  assert.match(result.sources[0].error,/offline/);
  assert.match(result.markdown,/수집 불가/);
  assert.match(result.markdown,/현재 사실을 서술하지 않음/);
  assert.match(result.unresolved.join('\n'),/실시간 뉴스 RSS 근거/);
});

test('empty RSS has an explicit unavailable source status', async () => {
  const result=await analyzeTrends({field:'other',topic:'희소 기술'},{now,fetchImpl:async()=>response('<?xml version="1.0"?><rss><channel></channel></rss>')});
  assert.equal(result.webStatus,'unavailable');
  assert.equal(result.sources[0].status,'unavailable');
  assert.match(result.sources[0].error,/비어/);
  assert.match(result.markdown,/수집 불가/);
});

test('both trend generators preserve source links and confirmation markers', async () => {
  const analysis=await analyzeTrends({field:'cloud',topic:'클라우드 네이티브 전환'},{now,fetchImpl:async()=>response(fixture)});
  for(const [label,result] of [['사업설명자료',generateBusinessTrend(analysis)],['과제설명자료',generateTaskTrend(analysis)]]){
    assert.match(result.markdown,new RegExp(label));
    assert.match(result.markdown,/https:\/\/news\.google\.com\/rss\/articles\/example1/);
    for(const marker of ['정책','예산','기간','KPI','TRL','수행기관','실증·배포 대상','정량값'])assert.match(result.markdown,new RegExp(marker));
    assert.match(result.markdown,/\[(?:추가 조사|담당자 확인) 필요\]/);
    assert.ok(result.unresolved.length>0);
  }
});

test('trend API and both generator endpoints work without live network', async t => {
  const fakeAnalyze=input=>analyzeTrends(input,{now,fetchImpl:async()=>response(fixture)});
  const server=createServer({analyzeTrends:fakeAnalyze});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));const base=`http://127.0.0.1:${server.address().port}`;
  const analyzed=await fetch(`${base}/api/trends/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({field:'network6g',topic:'개방형 네트워크'})});
  assert.equal(analyzed.status,200);const analysis=await analyzed.json();assert.equal(analysis.sources[0].status,'available');
  for(const workflow of ['business','task']){const generated=await fetch(`${base}/api/generate/${workflow}-trend`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({analysis})});assert.equal(generated.status,200);assert.match((await generated.json()).markdown,/확인 필요/)}
});

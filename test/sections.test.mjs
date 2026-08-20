import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHwpx, validateHwpx } from 'kordoc';
import { exportHwpx, generateBusiness, generateTask } from '../lib/documents.mjs';
import { generateBusinessTrend, generateTaskTrend } from '../lib/trends.mjs';
import { DEFAULT_SECTIONS } from '../lib/sections.mjs';
import { createServer } from '../server.mjs';

const doc = (role, filename, markdown) => ({ role, filename, markdown, sha256: role[0].repeat(64) });
const demand = doc('demand','demand.hwpx','<table><tr><th>수요명</th><td>선택형 검증 사업</td></tr><tr><th>개발목표</th><td>검증 목표</td></tr><tr><th>개발내용</th><td>검증 세부내용</td></tr><tr><th>개발 기간</th><td>3년</td></tr><tr><th>예산</th><td>미정</td></tr></table>');
const planning = doc('planning','planning.hwpx','# 선택형 검증 사업\n## 추진배경\n현장 공백을 해결한다.\n## 추진전략\n단계별로 검증한다.\n## 정책 동향\n공식 원문 확인이 필요하다.\n## 기대효과\n검증 기반을 확보한다.');
const rfp = doc('rfp','rfp.hwpx','# 선택형 검증 과제\n## 품목 정의\n현장 문제를 해결한다.\n## 현황 및 필요성\n지원 공백이 있다.\n## 주요 개발내용\n시험 기능을 개발한다.\n## 기간 예산 추진체계\n기간과 예산은 협약 시 확정한다.\n## 성과지표\n독립 시험으로 완료를 판정한다.\n## 기대효과\n활용 기반을 확보한다.');
const analysis = {
  fieldLabel:'AI/인공지능', topic:'검증 자동화', fetchedAt:'2026-08-20T00:00:00.000Z', webStatus:'available', markdown:'# 원 분석',
  unresolved:['공식 원문 확인 필요'], sourceDocument:null,
  sources:[{title:'검증 소식',url:'https://news.google.com/rss/articles/fixture',publicationDate:'2026-08-19T00:00:00.000Z',description:'공개 검증 소식',sourceKind:'news-rss',status:'available',fetchedAt:'2026-08-20T00:00:00.000Z'}]
};
const only = key => Object.fromEntries(Object.keys(DEFAULT_SECTIONS).map(item => [item,item===key]));

test('upload generators filter sections and preserve task-specific heading mappings', () => {
  const business=generateBusiness(demand,planning,{sections:only('background')});
  assert.match(business.markdown,/^## 1\. 추진배경$/m);
  assert.doesNotMatch(business.markdown,/^## \d+\. 사업개요$/m);
  assert.doesNotMatch(business.markdown,/^## \d+\. 예산현황$/m);
  assert.deepEqual(business.selectedSections,['background']);

  const task=generateTask(rfp,null,{sections:{...only('goal'),performance:true}});
  assert.match(task.markdown,/^## 1\. 해결해야 할 문제와 목표$/m);
  assert.match(task.markdown,/^## 2\. 성과지표·시험 및 완료판정\/기대효과$/m);
  assert.doesNotMatch(task.markdown,/^## \d+\. 과제 개요$/m);
  assert.doesNotMatch(task.markdown,/^## \d+\. 기간·예산·추진체계$/m);
});

test('both trend generators deterministically emit only selected mapped sections', () => {
  const business=generateBusinessTrend(analysis,{sections:{...only('policy'),budget:true}});
  assert.match(business.markdown,/^## 1\. 관련 주요 정책 및 국정과제$/m);
  assert.match(business.markdown,/^## 2\. 예산현황$/m);
  assert.doesNotMatch(business.markdown,/^## \d+\. 추진배경$/m);

  const task=generateTaskTrend(analysis,{sections:{...only('background'),details:true}});
  assert.match(task.markdown,/^## 1\. 현황 및 지원 필요성$/m);
  assert.match(task.markdown,/^## 2\. 주요 개발내용과 필수 요구사항$/m);
  assert.doesNotMatch(task.markdown,/^## \d+\. 과제 개요$/m);
  assert.deepEqual(task.selectedSections,['background','details']);
});

test('omitted selections keep all standard sections for backward compatibility', () => {
  for (const result of [generateBusiness(demand,planning),generateTask(rfp),generateBusinessTrend(analysis),generateTaskTrend(analysis)]) {
    assert.deepEqual(result.selectedSections,Object.keys(DEFAULT_SECTIONS).filter(key=>key!=='custom'));
    assert.equal((result.markdown.match(/^## \d+\./gm)||[]).length,7);
  }
});

test('custom text is labeled as an unverified user review memo', () => {
  const result=generateBusiness(demand,planning,{sections:Object.fromEntries(Object.keys(DEFAULT_SECTIONS).map(key=>[key,false])),customText:'담당자 가정\n## 검증되지 않은 제목'});
  assert.deepEqual(result.selectedSections,['custom']);
  assert.match(result.markdown,/^## 1\. 사용자 입력\/검토 메모$/m);
  assert.match(result.markdown,/> 담당자 가정\n> ## 검증되지 않은 제목/);
  assert.match(result.markdown,/검증된 출처 사실로 취급하지 않습니다/);
});

test('all four generation APIs reject an empty selection', async t => {
  const server=createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const sections=Object.fromEntries(Object.keys(DEFAULT_SECTIONS).map(key=>[key,false]));
  const requests={business:{demand,planning,sections,customText:''},task:{rfp,sections,customText:''},'business-trend':{analysis,sections,customText:''},'task-trend':{analysis,sections,customText:''}};
  for(const [endpoint,body] of Object.entries(requests)){
    const response=await fetch(`${base}/api/generate/${endpoint}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    assert.equal(response.status,400,endpoint);
    assert.match((await response.json()).error,/섹션을 하나 이상 선택/);
  }
});

test('filtered business and task Markdown survive native HWPX validation and round-trip', async () => {
  const cases=[
    generateBusiness(demand,planning,{sections:{...only('background'),details:true}}),
    generateTask(rfp,null,{sections:{...only('goal'),performance:true}})
  ];
  for(const result of cases){
    const output=await exportHwpx(result.markdown);
    assert.equal((await validateHwpx(output.buffer)).ok,true);
    const roundTrip=await parseHwpx(output.buffer);
    assert.equal(roundTrip.success,true);
    assert.match(roundTrip.markdown,/설명자료/);
  }
});

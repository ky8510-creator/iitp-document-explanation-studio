import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHwpx, validateHwpx } from 'kordoc';
import { WORKFLOWS, exportHwpx, generateBusiness, generateTask, parseDocument, validateUpload } from '../lib/documents.mjs';
import { createServer } from '../server.mjs';

const samples = {
  demand: '/opt/data/IITP/기술수요조사서/01_양자내성암호_클라우드_보안_프레임워크_개발.hwpx',
  planning: '/opt/data/IITP/output/01_기술기획보고서_초안.hwpx',
  rfp: '/opt/data/IITP/output/01_양자내성암호_클라우드_보안_프레임워크_RFP_초안.hwpx',
  researchPlan: '/opt/data/IITP/output/01_기술기획보고서_초안.hwpx'
};

test('upload validation rejects wrong extension and non-ZIP input', () => {
  assert.throws(() => validateUpload('bad.hwp', Buffer.from('PKtest')), /\.hwpx/);
  assert.throws(() => validateUpload('bad.hwpx', Buffer.from('not a zip')), /ZIP/);
});

test('workflow A parses both sources and exports Kordoc-valid native HWPX', async () => {
  const demand=await parseDocument('demand.hwpx',await readFile(samples.demand),'demand');
  const planning=await parseDocument('planning.hwpx',await readFile(samples.planning),'planning');
  assert.equal(demand.role,'demand'); assert.ok(demand.fields.length>0); assert.ok(planning.outline.length>5);
  const result=generateBusiness(demand,planning);
  assert.match(result.markdown,/사업설명자료/); assert.match(result.markdown,/출처/); assert.match(result.markdown,/SHA-256/);
  assert.equal(result.provenance.length,2);
  const output=await exportHwpx(result.markdown);
  assert.equal((await validateHwpx(output.buffer)).ok,true);
  const roundTrip=await parseHwpx(output.buffer); assert.equal(roundTrip.success,true); assert.match(roundTrip.markdown,/사업설명자료/);
});

test('workflow B supports RFP-only and exports Kordoc-valid native HWPX', async () => {
  assert.deepEqual(WORKFLOWS.task.inputs,['rfp','researchPlan']);
  const rfp=await parseDocument('rfp.hwpx',await readFile(samples.rfp),'rfp');
  const result=generateTask(rfp);
  assert.match(result.markdown,/과제설명자료/); assert.match(result.markdown,/해결해야 할 문제/); assert.match(result.markdown,/출처/);
  assert.doesNotMatch(result.markdown,/품목 정의·최종목표·As-is\/To-be 확인 필요/);
  assert.ok(result.markdown.length>3500);
  assert.equal(result.provenance.length,1);
  const output=await exportHwpx(result.markdown);
  assert.equal((await validateHwpx(output.buffer)).ok,true);
  const roundTrip=await parseHwpx(output.buffer); assert.equal(roundTrip.success,true); assert.match(roundTrip.markdown,/과제설명자료/);
});

test('workflow B combines optional research plan with explicit provenance and native HWPX round-trip', async () => {
  const rfp=await parseDocument('rfp.hwpx',await readFile(samples.rfp),'rfp');
  const researchPlan=await parseDocument('research-plan.hwpx',await readFile(samples.researchPlan),'researchPlan');
  const result=generateTask(rfp,researchPlan);
  assert.match(result.markdown,/RFP를 기술·사업 사실의 1차 근거/);
  assert.match(result.markdown,/연구개발계획서 추가 근거 · 연구 목표/);
  assert.match(result.markdown,/연구개발계획서 추가 근거 · 연구 내용/);
  assert.match(result.markdown,/연구개발계획서 추가 근거 · 추진체계/);
  assert.match(result.markdown,/연구개발계획서 추가 근거 · 성과/);
  assert.match(result.markdown,/출처: research-plan\.hwpx/);
  assert.equal(result.provenance.length,2);
  assert.deepEqual(result.provenance.map(x=>x.role),['rfp','researchPlan']);
  const output=await exportHwpx(result.markdown);
  assert.equal((await validateHwpx(output.buffer)).ok,true);
  const roundTrip=await parseHwpx(output.buffer);
  assert.equal(roundTrip.success,true);
  assert.match(roundTrip.markdown,/연구개발계획서 추가 근거/);
  assert.match(roundTrip.markdown,/research-plan\.hwpx/);
});

test('task API requires RFP and accepts an optional research plan', async t => {
  const server=createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}/api/generate/task`;
  const missing=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({researchPlan:{markdown:'# 계획'}})});
  assert.equal(missing.status,400);
  assert.deepEqual(await missing.json(),{error:'RFP가 필요합니다.'});
  const doc=(role,filename,markdown)=>({role,filename,markdown,sha256:role[0].repeat(64)});
  const rfp=doc('rfp','rfp.hwpx','# 새 과제\n## 품목 정의\n원문 문제를 해결한다.');
  const rfpOnly=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({rfp})});
  assert.equal(rfpOnly.status,200);
  assert.equal((await rfpOnly.json()).provenance.length,1);
  const combined=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    rfp,
    researchPlan:doc('researchPlan','plan.hwpx','# 새 과제\n## 연구개발 목표\n검증 가능한 목표를 수행한다.\n## 추진체계\n주관기관과 참여기관의 역할을 구분한다.')
  })});
  assert.equal(combined.status,200);
  const result=await combined.json();
  assert.equal(result.provenance.length,2);
  assert.match(result.markdown,/출처: plan\.hwpx/);
  assert.doesNotMatch(result.unresolved.join('\n'),/추진체계·기관별 역할/);
});

test('generation generalizes from arbitrary Korean fields without a sample title constant', () => {
  const base={sha256:'a'.repeat(64),metadata:{},outline:[],fields:[],role:'demand'};
  const demand={...base,filename:'새기술.hwpx',markdown:'<table><tr><th>수요명</th><td>가상 시험 기술</td></tr><tr><td>개발목표</td><td>시험 가능한 통합 도구 개발</td></tr><tr><td>개발내용</td><td>요구 분석 및 검증</td></tr></table>'};
  const planning={...base,role:'planning',filename:'기획.hwpx',markdown:'# 가상 시험 기술\n## 추진배경\n현장의 검증 공백을 해결한다.\n## 기대효과\n재현 가능한 시험 기반을 확보한다.'};
  const result=generateBusiness(demand,planning);
  assert.match(result.markdown,/가상 시험 기술/);assert.match(result.markdown,/시험 가능한 통합 도구 개발/);assert.doesNotMatch(result.markdown,/양자내성암호/);
});

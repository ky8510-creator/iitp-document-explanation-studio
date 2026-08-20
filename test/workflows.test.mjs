import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHwpx, validateHwpx } from 'kordoc';
import { exportHwpx, generateBusiness, generateTask, parseDocument, validateUpload } from '../lib/documents.mjs';

const samples = {
  demand: '/opt/data/IITP/기술수요조사서/01_양자내성암호_클라우드_보안_프레임워크_개발.hwpx',
  planning: '/opt/data/IITP/output/01_기술기획보고서_초안.hwpx',
  rfp: '/opt/data/IITP/output/01_양자내성암호_클라우드_보안_프레임워크_RFP_초안.hwpx'
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

test('workflow B parses RFP and exports Kordoc-valid native HWPX', async () => {
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

test('generation generalizes from arbitrary Korean fields without a sample title constant', () => {
  const base={sha256:'a'.repeat(64),metadata:{},outline:[],fields:[],role:'demand'};
  const demand={...base,filename:'새기술.hwpx',markdown:'<table><tr><th>수요명</th><td>가상 시험 기술</td></tr><tr><td>개발목표</td><td>시험 가능한 통합 도구 개발</td></tr><tr><td>개발내용</td><td>요구 분석 및 검증</td></tr></table>'};
  const planning={...base,role:'planning',filename:'기획.hwpx',markdown:'# 가상 시험 기술\n## 추진배경\n현장의 검증 공백을 해결한다.\n## 기대효과\n재현 가능한 시험 기반을 확보한다.'};
  const result=generateBusiness(demand,planning);
  assert.match(result.markdown,/가상 시험 기술/);assert.match(result.markdown,/시험 가능한 통합 도구 개발/);assert.doesNotMatch(result.markdown,/양자내성암호/);
});

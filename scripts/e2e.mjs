import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parse, parseHwpx, validateHwpx } from 'kordoc';
import { exportHwpx, generateBusiness, generateTask, parseDocument } from '../lib/documents.mjs';
import { buildTrendAnalysis, generateBusinessTrend, generateTaskTrend } from '../lib/trends.mjs';

const paths={demand:'/opt/data/IITP/기술수요조사서/01_양자내성암호_클라우드_보안_프레임워크_개발.hwpx',planning:'/opt/data/IITP/output/01_기술기획보고서_초안.hwpx',rfp:'/opt/data/IITP/output/01_양자내성암호_클라우드_보안_프레임워크_RFP_초안.hwpx',researchPlan:'/opt/data/IITP/output/01_기술기획보고서_초안.hwpx'};
const out=join(process.cwd(),'tmp','e2e');await mkdir(out,{recursive:true});
const load=async(role,path)=>parseDocument(basename(path),await readFile(path),role);
const filteredBusinessSections={background:true,overview:false,goal:false,details:true,policy:false,budget:false,performance:false,custom:false};
const filteredTaskSections={background:false,overview:false,goal:true,details:false,policy:false,budget:false,performance:true,custom:false};

const demand=await load('demand',paths.demand),planning=await load('planning',paths.planning);
const business=generateBusiness(demand,planning,{sections:filteredBusinessSections}),businessFile=join(out,'workflow-a-filtered-business-explanation.hwpx');
const businessOutput=await exportHwpx(business.markdown);await writeFile(businessFile,businessOutput.buffer);
if(/^## \d+\. 사업목표$/m.test(business.markdown)||business.selectedSections.join(',')!=='background,details')throw Error('workflow A section filtering failed');

const rfp=await load('rfp',paths.rfp),researchPlan=await load('researchPlan',paths.researchPlan),task=generateTask(rfp,researchPlan,{sections:filteredTaskSections}),taskFile=join(out,'workflow-b-filtered-task-explanation.hwpx');
const taskOutput=await exportHwpx(task.markdown);await writeFile(taskFile,taskOutput.buffer);
if(task.provenance.length!==2||!task.markdown.includes('연구개발계획서 추가 근거')||task.markdown.includes('## 1. 과제 개요')||task.selectedSections.join(',')!=='goal,performance')throw Error('workflow B did not combine sources with section filtering');

const fetchedAt='2026-08-20T00:00:00.000Z';
const trendSource={id:'rss-1',title:'검증용 ICT 기술 공개 소식',url:'https://news.google.com/rss/articles/e2e-fixture',publicationDate:'2026-08-19T00:00:00.000Z',description:'네트워크 없이 사용하는 결정적 E2E RSS 설명 fixture',sourceKind:'news-rss',publisher:'fixture',publisherUrl:null,fetchedAt,status:'available',error:null};
const trendAnalysis=buildTrendAnalysis({field:'cybersecurity',topic:'공급망 보안 검증',sourceDocument:null,sources:[trendSource],fetchedAt,webStatus:'available'});
const trendOutputs=[['C',generateBusinessTrend(trendAnalysis),'workflow-c-trend-business-explanation.hwpx'],['D',generateTaskTrend(trendAnalysis),'workflow-d-trend-task-explanation.hwpx']];
for(const [workflow,result,name] of trendOutputs){if(!result.markdown.includes('https://news.google.com/rss/articles/e2e-fixture')||!result.markdown.includes('예산'))throw Error(`trend workflow ${workflow} lost evidence markers`);const file=join(out,name);const output=await exportHwpx(result.markdown);await writeFile(file,output.buffer);const validation=await validateHwpx(output.buffer),roundTrip=await parseHwpx(output.buffer);if(!validation.ok||!roundTrip.success)throw Error(`trend workflow ${workflow} validation failed`);console.log(JSON.stringify({workflow,file,bytes:output.buffer.length,valid:validation.ok,roundTripChars:roundTrip.markdown.length}));}

const referenceFiles=['/opt/data/IITP/사업설명자료/블록체인산업고도화기술개발(R&D)_예정처 설명자료.hwp','/opt/data/IITP/사업설명자료/251001.국방인공지능핵심기술개발 사업설명자료(국방사업팀).hwp'];
const referenceProfiles=[];
for(const file of referenceFiles){const result=await parse(file);referenceProfiles.push({file:basename(file),success:result.success,headings:(result.markdown?.match(/^#{1,6}\s+.+$/gm)||[]).length,tables:(result.markdown?.match(/<table>/g)||[]).length});}

for(const [name,file] of [['A',businessFile],['B',taskFile]]){const buffer=await readFile(file),validation=await validateHwpx(buffer),roundTrip=await parseHwpx(buffer);if(!validation.ok||!roundTrip.success)throw Error(`workflow ${name} validation failed`);console.log(JSON.stringify({workflow:name,file,bytes:buffer.length,valid:validation.ok,roundTripChars:roundTrip.markdown.length}));}
console.log(JSON.stringify({formatOnlyReferenceProfiles:referenceProfiles}));

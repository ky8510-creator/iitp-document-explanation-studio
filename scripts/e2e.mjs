import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parse, parseHwpx, validateHwpx } from 'kordoc';
import { exportHwpx, generateBusiness, generateTask, parseDocument } from '../lib/documents.mjs';

const paths={demand:'/opt/data/IITP/기술수요조사서/01_양자내성암호_클라우드_보안_프레임워크_개발.hwpx',planning:'/opt/data/IITP/output/01_기술기획보고서_초안.hwpx',rfp:'/opt/data/IITP/output/01_양자내성암호_클라우드_보안_프레임워크_RFP_초안.hwpx',researchPlan:'/opt/data/IITP/output/01_기술기획보고서_초안.hwpx'};
const out=join(process.cwd(),'tmp','e2e');await mkdir(out,{recursive:true});
const load=async(role,path)=>parseDocument(basename(path),await readFile(path),role);

const demand=await load('demand',paths.demand),planning=await load('planning',paths.planning);
const business=generateBusiness(demand,planning),businessFile=join(out,'workflow-a-business-explanation.hwpx');
const businessOutput=await exportHwpx(business.markdown);await writeFile(businessFile,businessOutput.buffer);

const rfp=await load('rfp',paths.rfp),researchPlan=await load('researchPlan',paths.researchPlan),task=generateTask(rfp,researchPlan),taskFile=join(out,'workflow-b-combined-task-explanation.hwpx');
const taskOutput=await exportHwpx(task.markdown);await writeFile(taskFile,taskOutput.buffer);
if(task.provenance.length!==2||!task.markdown.includes('연구개발계획서 추가 근거'))throw Error('workflow B did not combine both task sources');

const referenceFiles=['/opt/data/IITP/사업설명자료/블록체인산업고도화기술개발(R&D)_예정처 설명자료.hwp','/opt/data/IITP/사업설명자료/251001.국방인공지능핵심기술개발 사업설명자료(국방사업팀).hwp'];
const referenceProfiles=[];
for(const file of referenceFiles){const result=await parse(file);referenceProfiles.push({file:basename(file),success:result.success,headings:(result.markdown?.match(/^#{1,6}\s+.+$/gm)||[]).length,tables:(result.markdown?.match(/<table>/g)||[]).length});}

for(const [name,file] of [['A',businessFile],['B',taskFile]]){const buffer=await readFile(file),validation=await validateHwpx(buffer),roundTrip=await parseHwpx(buffer);if(!validation.ok||!roundTrip.success)throw Error(`workflow ${name} validation failed`);console.log(JSON.stringify({workflow:name,file,bytes:buffer.length,valid:validation.ok,roundTripChars:roundTrip.markdown.length}));}
console.log(JSON.stringify({formatOnlyReferenceProfiles:referenceProfiles}));

const $ = selector => document.querySelector(selector);
const makeSession = () => ({
  mode: 'upload',
  upload: { stage: 'intake', files: {}, documents: {}, result: null },
  trend: { stage: 'intake', field: 'ai', topic: '', file: null, document: null, analysis: null, result: null }
});
const state = { workflow: 'business', sessions: { business: makeSession(), task: makeSession() } };
const config = {
  business: { title: '두 개의 근거 문서를 올려주세요', output: '사업설명자료', roles: [
    { key:'demand', label:'기술수요조사서', required:true, help:'기술 목표·개발내용·기간·예산의 1차 근거' },
    { key:'planning', label:'기술기획보고서', required:true, help:'배경·범위·타당성·추진전략의 기획 근거' }
  ]},
  task: { title: 'RFP와 선택 사항인 연구개발계획서를 올려주세요', output: '과제설명자료', roles: [
    { key:'rfp', label:'RFP', required:true, help:'필수 · 품목 정의·요구사항·수요·성과·실행조건의 1차 근거' },
    { key:'researchPlan', label:'연구개발계획서', required:false, help:'선택 · 연구목표·연구내용·추진체계·성과·기간·예산의 추가 근거' }
  ]}
};

const session = () => state.sessions[state.workflow];
const uploadState = () => session().upload;
const trendState = () => session().trend;
function escapeHtml(value) { const node=document.createElement('div'); node.textContent=String(value??''); return node.innerHTML; }
function safeExternalUrl(value) { try { const url=new URL(value,window.location.origin); return ['http:','https:'].includes(url.protocol)?url.href:null; } catch { return null; } }
function toast(message,tone='info') { const el=$('#toast'); el.textContent=message; el.dataset.tone=tone; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),2600); }
function setStep(index) { document.querySelectorAll('.stepper li').forEach((el,i)=>{const active=i===index;el.classList.toggle('active',active);el.classList.toggle('done',i<index);if(active)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current')}); }
function show(stage,index,remember=true) {
  ['uploadStage','analysisStage','trendStage','trendAnalysisStage','editorStage'].forEach(id=>$(`#${id}`).classList.toggle('hidden',id!==stage));
  if (remember) (session().mode==='trend'?trendState():uploadState()).stage=stage==='editorStage'?'editor':stage.includes('Analysis')||stage==='analysisStage'?'analysis':'intake';
  setStep(index); window.scrollTo({top:document.querySelector('.workflow-tabs').offsetTop-20,behavior:'smooth'});
}
function selectedRoles() { const files=uploadState().files; return config[state.workflow].roles.filter(role=>files[role.key]); }
function ready() { const files=uploadState().files; return config[state.workflow].roles.filter(role=>role.required).every(role=>files[role.key]); }

function renderUploads() {
  const current=uploadState(),c=config[state.workflow]; $('#uploadTitle').textContent=c.title; const grid=$('#uploadGrid'); grid.classList.toggle('single',c.roles.length===1);
  grid.innerHTML=c.roles.map(role=>`<label class="upload-card" data-role="${role.key}"><div class="upload-icon">⇧</div><h3>${role.label}</h3><p>${role.help}<br>HWPX를 클릭하거나 파일을 끌어놓으세요.</p><input type="file" accept=".hwpx"><div class="selected ${current.files[role.key]?'':'hidden'}">${escapeHtml(current.files[role.key]?.name||'')}</div></label>`).join('');
  grid.querySelectorAll('.upload-card').forEach(card=>{ const key=card.dataset.role,input=card.querySelector('input'); input.onchange=()=>choose(key,input.files[0]); card.ondragover=e=>{e.preventDefault();card.classList.add('drag')};card.ondragleave=()=>card.classList.remove('drag');card.ondrop=e=>{e.preventDefault();card.classList.remove('drag');choose(key,e.dataTransfer.files[0])}; });
  $('#analyzeBtn').disabled=!ready();
}
function validHwpx(file) {
  if (!file) return false;
  if (!/\.hwpx$/i.test(file.name)) { toast('HWPX 파일만 선택할 수 있습니다.','error'); return false; }
  if (file.size>30*1024*1024) { toast('파일은 30MB 이하여야 합니다.','error'); return false; }
  return true;
}
function choose(role,file) { if (!validHwpx(file)) return; const current=uploadState();current.files[role]=file;delete current.documents[role];current.result=null;current.stage='intake';renderUploads(); }
function resetUpload() { const current=uploadState();current.files={};current.documents={};current.result=null;current.stage='intake';renderUploads();show('uploadStage',0); }
async function request(url,options={}) { const response=await fetch(url,options); if(!response.ok){let data={};try{data=await response.json()}catch{}throw Error(data.error||`요청 실패 (${response.status})`)} return response; }
async function parseFile(file,role) { const response=await request('/api/parse',{method:'POST',headers:{'content-type':'application/octet-stream','x-filename':encodeURIComponent(file.name),'x-document-role':role},body:file}); return response.json(); }

async function analyzeUpload() {
  const button=$('#analyzeBtn'); button.classList.add('busy');button.setAttribute('aria-busy','true');button.textContent='Kordoc 분석 중…';
  try {
    const current=uploadState();
    for (const role of selectedRoles()) if (!current.documents[role.key]) current.documents[role.key]=await parseFile(current.files[role.key],role.key);
    renderPreviews();show('analysisStage',1);toast('모든 HWPX를 Kordoc으로 분석했습니다.');
  } catch(error) { toast(error.message,'error'); }
  finally {button.classList.remove('busy');button.removeAttribute('aria-busy');button.innerHTML='문서 분석하기 <span>→</span>';}
}
function renderPreviews() {
  const current=uploadState(),roles=selectedRoles(),grid=$('#previewGrid');grid.innerHTML=roles.map(role=>{const doc=current.documents[role.key];return `<article class="preview-card"><div class="preview-head"><b>${escapeHtml(doc.filename)}</b><small>${role.label} · SHA-256 ${escapeHtml(doc.sha256.slice(0,16))}…</small></div><pre>${escapeHtml(doc.textPreview)}</pre><div class="preview-meta"><span>${doc.bytes.toLocaleString()} bytes</span><span>${doc.metadata.pageCount||'-'} page metadata</span><span>${doc.fields.length} table rows</span><span>${doc.outline.length} headings</span></div></article>`}).join('');grid.style.gridTemplateColumns=roles.length===1?'1fr':'repeat(2,1fr)';
}
async function generateUpload() {
  const button=$('#generateBtn');button.classList.add('busy');button.setAttribute('aria-busy','true');button.textContent='초안 구성 중…';
  try { const current=uploadState(),input=Object.fromEntries(selectedRoles().map(role=>[role.key,current.documents[role.key]]).filter(([,doc])=>doc));const response=await request(`/api/generate/${state.workflow}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});current.result=await response.json();renderEditor();show('editorStage',2);toast(`${config[state.workflow].output} 초안을 만들었습니다.`); }
  catch(error){toast(error.message,'error')}finally{button.classList.remove('busy');button.removeAttribute('aria-busy');button.innerHTML='설명자료 초안 생성 <span>→</span>'}
}

function renderTrendForm() {
  const current=trendState(); $('#trendField').value=current.field; $('#trendTopic').value=current.topic;
  $('#trendSelected').textContent=current.file?.name||''; $('#trendSelected').classList.toggle('hidden',!current.file);
  $('#trendAnalyzeBtn').disabled=!current.topic.trim();
  $('#trendTitle').textContent=`${config[state.workflow].output}용 ICT 기술동향 근거를 모아보세요`;
}
function chooseTrendFile(file) { if (!validHwpx(file)) return; const current=trendState();current.file=file;current.document=null;current.analysis=null;current.result=null;current.stage='intake';renderTrendForm(); }
function resetTrend() { const current=trendState();Object.assign(current,{stage:'intake',field:'ai',topic:'',file:null,document:null,analysis:null,result:null});renderTrendForm();show('trendStage',0); }
async function analyzeTrend() {
  const current=trendState(),button=$('#trendAnalyzeBtn');current.field=$('#trendField').value;current.topic=$('#trendTopic').value.trim();
  if(!current.topic)return;
  button.classList.add('busy');button.setAttribute('aria-busy','true');button.textContent='공개 웹·문서 분석 중…';
  try {
    if(current.file&&!current.document)current.document=await parseFile(current.file,'trendSource');
    const response=await request('/api/trends/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({field:current.field,topic:current.topic,sourceDocument:current.document})});
    current.analysis=await response.json();renderTrendAnalysis();show('trendAnalysisStage',1);toast(current.analysis.webStatus==='available'?'공개 웹과 문서 근거를 분석했습니다.':'웹 수집 상태를 표시한 분석 틀을 만들었습니다.',current.analysis.webStatus==='error'?'error':'info');
  } catch(error){toast(error.message,'error')}finally{button.classList.remove('busy');button.removeAttribute('aria-busy');button.innerHTML='기술동향 분석하기 <span>→</span>'}
}
function sourceCard(source) {
  const href=safeExternalUrl(source.url); const title=href?`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a>`:`<b>${escapeHtml(source.title)}</b>`;
  return `<article class="trend-source-card status-${escapeHtml(source.status)}"><div><span>${escapeHtml(source.sourceKind)}</span><em>${escapeHtml(source.status)}</em></div>${title}<small>${escapeHtml(source.publicationDate?.slice(0,10)||'발행일 미제공')} · 수집 ${escapeHtml(source.fetchedAt||'-')}</small><p>${escapeHtml(source.description||'')}${source.verificationNote?`<br>${escapeHtml(source.verificationNote)}`:''}</p>${source.error?`<strong>${escapeHtml(source.error)}</strong>`:''}</article>`;
}
function renderTrendAnalysis() {
  const result=trendState().analysis,available=result.sources.filter(x=>x.status==='available'&&x.sourceKind==='news-rss').length;
  $('#trendStatus').classList.toggle('warning',result.webStatus!=='available');$('#trendStatus').lastChild.textContent=result.webStatus==='available'?' 분석 완료':' 웹 수집 제한';
  $('#trendSourceSummary').innerHTML=`<span><b>${available}</b> RSS 근거</span><span><b>${result.sources.filter(x=>x.sourceKind==='official-reference').length}</b> 공식 확인 링크</span><span><b>${result.sourceDocument?1:0}</b> HWPX 근거</span><span class="web-${escapeHtml(result.webStatus)}">웹 상태 · ${escapeHtml(result.webStatus)}</span>`;
  $('#trendMarkdownPreview').textContent=result.markdown;$('#trendSources').innerHTML=result.sources.map(sourceCard).join('');
  $('#trendUnresolved').innerHTML=result.unresolved.map(item=>`<div class="notice">확인/조사 필요 · ${escapeHtml(item)}</div>`).join('');
}
async function createTrendMaterial() {
  const current=trendState(),button=$('#trendCreateBtn');button.classList.add('busy');button.setAttribute('aria-busy','true');button.textContent='근거 표시 초안 구성 중…';
  try { const response=await request(`/api/generate/${state.workflow}-trend`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({analysis:current.analysis})});current.result=await response.json();renderEditor();show('editorStage',2);toast(`${config[state.workflow].output} 초안을 만들었습니다.`); }
  catch(error){toast(error.message,'error')}finally{button.classList.remove('busy');button.removeAttribute('aria-busy');button.innerHTML='설명자료 만들기 <span>→</span>'}
}

function currentResult(){return session().mode==='trend'?trendState().result:uploadState().result}
function renderEditor(){const result=currentResult();$('#editorTitle').textContent=config[state.workflow].output+' 초안';$('#editor').value=result.markdown;updateCount();$('#provenance').innerHTML=result.provenance.map(x=>{const href=safeExternalUrl(x.url);const name=href?`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(x.filename)}</a>`:`<b>${escapeHtml(x.filename)}</b>`;return `<div class="source-chip">${name}${escapeHtml(x.role)}${x.status?` · ${escapeHtml(x.status)}`:''}${x.sha256?`<br>SHA-256 ${escapeHtml(x.sha256.slice(0,20))}…`:''}</div>`}).join('');$('#unresolved').innerHTML=result.unresolved.length?result.unresolved.map(x=>`<div class="notice">결정/확인 필요 · ${escapeHtml(x)}</div>`).join(''):'<div class="source-chip">추출된 자동 미결정 항목 없음 · 최종 검토 필요</div>'}
function updateCount(){$('#charCount').textContent=$('#editor').value.length.toLocaleString()+'자'}
async function download(){const result=currentResult(),button=$('#downloadBtn');button.classList.add('busy');button.setAttribute('aria-busy','true');button.textContent='Kordoc 검증·변환 중…';try{const response=await request('/api/export',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({markdown:$('#editor').value,filename:result.title})});const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${result.title}.hwpx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStep(3);toast(`구조 검증 완료 · 재추출 ${response.headers.get('x-kordoc-roundtrip-chars')||'-'}자`)}catch(error){toast(error.message,'error')}finally{button.classList.remove('busy');button.removeAttribute('aria-busy');button.innerHTML='검증 후 HWPX 다운로드 <span>↓</span>'}}

function renderMode() {
  document.querySelectorAll('.mode-tab').forEach(tab=>{const active=tab.dataset.mode===session().mode;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active))});
  renderUploads();renderTrendForm();const current=session().mode==='trend'?trendState():uploadState();
  if(current.stage==='editor'&&current.result){renderEditor();show('editorStage',2,false)}
  else if(session().mode==='trend'&&current.stage==='analysis'&&current.analysis){renderTrendAnalysis();show('trendAnalysisStage',1,false)}
  else if(session().mode==='upload'&&current.stage==='analysis'){renderPreviews();show('analysisStage',1,false)}
  else show(session().mode==='trend'?'trendStage':'uploadStage',0,false);
}
document.querySelectorAll('.tab').forEach(tab=>tab.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>{const active=x===tab;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));x.querySelector('.tab-state').lastChild.textContent=active?' 선택됨':' 선택'});state.workflow=tab.dataset.workflow;renderMode()});
document.querySelectorAll('.mode-tab').forEach(tab=>tab.onclick=()=>{session().mode=tab.dataset.mode;renderMode()});
$('#resetBtn').onclick=resetUpload;$('#analyzeBtn').onclick=analyzeUpload;$('#backBtn').onclick=()=>show('uploadStage',0);$('#generateBtn').onclick=generateUpload;
$('#trendField').onchange=e=>{trendState().field=e.target.value;trendState().analysis=null;trendState().result=null};$('#trendTopic').oninput=e=>{trendState().topic=e.target.value;trendState().analysis=null;trendState().result=null;$('#trendAnalyzeBtn').disabled=!e.target.value.trim()};
$('#trendFile').onchange=e=>chooseTrendFile(e.target.files[0]);$('#trendResetBtn').onclick=resetTrend;$('#trendAnalyzeBtn').onclick=analyzeTrend;$('#trendBackBtn').onclick=()=>show('trendStage',0);$('#trendCreateBtn').onclick=createTrendMaterial;
$('#analysisBackBtn').onclick=()=>show(session().mode==='trend'?'trendAnalysisStage':'analysisStage',1);$('#downloadBtn').onclick=download;$('#editor').oninput=updateCount;renderMode();

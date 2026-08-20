const $ = selector => document.querySelector(selector);
const state = { workflow: 'business', files: {}, documents: {}, result: null };
const config = {
  business: { title: '두 개의 근거 문서를 올려주세요', output: '사업설명자료', roles: [
    { key:'demand', label:'기술수요조사서', help:'기술 목표·개발내용·기간·예산의 1차 근거' },
    { key:'planning', label:'기술기획보고서', help:'배경·범위·타당성·추진전략의 기획 근거' }
  ]},
  task: { title: 'RFP를 올려주세요', output: '과제설명자료', roles: [
    { key:'rfp', label:'RFP', help:'품목 정의·요구사항·수요·성과·실행조건의 유일한 근거' }
  ]}
};

function escapeHtml(value) { const node=document.createElement('div'); node.textContent=String(value??''); return node.innerHTML; }
function toast(message) { const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),2600); }
function setStep(index) { document.querySelectorAll('.stepper li').forEach((el,i)=>{el.classList.toggle('active',i===index);el.classList.toggle('done',i<index)}); }
function show(stage,index) { ['uploadStage','analysisStage','editorStage'].forEach(id=>$(`#${id}`).classList.toggle('hidden',id!==stage)); setStep(index); window.scrollTo({top:document.querySelector('.workflow-tabs').offsetTop-20,behavior:'smooth'}); }
function ready() { return config[state.workflow].roles.every(role=>state.files[role.key]); }

function renderUploads() {
  const c=config[state.workflow]; $('#uploadTitle').textContent=c.title; const grid=$('#uploadGrid'); grid.classList.toggle('single',c.roles.length===1);
  grid.innerHTML=c.roles.map(role=>`<label class="upload-card" data-role="${role.key}"><div class="upload-icon">⇧</div><h3>${role.label} HWPX</h3><p>${role.help}<br>클릭하거나 파일을 끌어놓으세요.</p><input type="file" accept=".hwpx"><div class="selected ${state.files[role.key]?'':'hidden'}">${escapeHtml(state.files[role.key]?.name||'')}</div></label>`).join('');
  grid.querySelectorAll('.upload-card').forEach(card=>{ const key=card.dataset.role,input=card.querySelector('input'); input.onchange=()=>choose(key,input.files[0]); card.ondragover=e=>{e.preventDefault();card.classList.add('drag')};card.ondragleave=()=>card.classList.remove('drag');card.ondrop=e=>{e.preventDefault();card.classList.remove('drag');choose(key,e.dataTransfer.files[0])}; });
  $('#analyzeBtn').disabled=!ready();
}
function choose(role,file) {
  if (!file) return;
  if (!/\.hwpx$/i.test(file.name)) return toast('HWPX 파일만 선택할 수 있습니다.');
  if (file.size>30*1024*1024) return toast('파일은 30MB 이하여야 합니다.');
  state.files[role]=file; delete state.documents[role]; state.result=null; renderUploads();
}
function reset() { state.files={};state.documents={};state.result=null;renderUploads();show('uploadStage',0); }
async function request(url,options={}) { const response=await fetch(url,options); if(!response.ok){let data={};try{data=await response.json()}catch{}throw Error(data.error||`요청 실패 (${response.status})`)} return response; }

async function analyze() {
  const button=$('#analyzeBtn'); button.classList.add('busy');button.textContent='Kordoc 분석 중…';
  try {
    for (const role of config[state.workflow].roles) {
      const file=state.files[role.key]; const response=await request('/api/parse',{method:'POST',headers:{'content-type':'application/octet-stream','x-filename':encodeURIComponent(file.name),'x-document-role':role.key},body:file}); state.documents[role.key]=await response.json();
    }
    renderPreviews();show('analysisStage',1);toast('모든 HWPX를 Kordoc으로 분석했습니다.');
  } catch(error) { toast(error.message); }
  finally {button.classList.remove('busy');button.innerHTML='문서 분석하기 <span>→</span>';}
}
function renderPreviews() {
  const grid=$('#previewGrid');grid.innerHTML=config[state.workflow].roles.map(role=>{const doc=state.documents[role.key];return `<article class="preview-card"><div class="preview-head"><b>${escapeHtml(doc.filename)}</b><small>${role.label} · SHA-256 ${doc.sha256.slice(0,16)}…</small></div><pre>${escapeHtml(doc.textPreview)}</pre><div class="preview-meta"><span>${doc.bytes.toLocaleString()} bytes</span><span>${doc.metadata.pageCount||'-'} page metadata</span><span>${doc.fields.length} table rows</span><span>${doc.outline.length} headings</span></div></article>`}).join('');grid.style.gridTemplateColumns=config[state.workflow].roles.length===1?'1fr':'repeat(2,1fr)';
}
async function generate() {
  const button=$('#generateBtn');button.classList.add('busy');button.textContent='초안 구성 중…';
  try { const response=await request(`/api/generate/${state.workflow}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(state.documents)});state.result=await response.json();renderEditor();show('editorStage',2);toast(`${config[state.workflow].output} 초안을 만들었습니다.`); }
  catch(error){toast(error.message)}finally{button.classList.remove('busy');button.innerHTML='설명자료 초안 생성 <span>→</span>'}
}
function renderEditor(){const result=state.result;$('#editorTitle').textContent=config[state.workflow].output+' 초안';$('#editor').value=result.markdown;updateCount();$('#provenance').innerHTML=result.provenance.map(x=>`<div class="source-chip"><b>${escapeHtml(x.filename)}</b>${escapeHtml(x.role)}<br>SHA-256 ${x.sha256.slice(0,20)}…</div>`).join('');$('#unresolved').innerHTML=result.unresolved.length?result.unresolved.map(x=>`<div class="notice">결정/확인 필요 · ${escapeHtml(x)}</div>`).join(''):'<div class="source-chip">추출된 자동 미결정 항목 없음 · 최종 검토 필요</div>'}
function updateCount(){$('#charCount').textContent=$('#editor').value.length.toLocaleString()+'자'}
async function download(){const button=$('#downloadBtn');button.classList.add('busy');button.textContent='Kordoc 검증·변환 중…';try{const response=await request('/api/export',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({markdown:$('#editor').value,filename:state.result.title})});const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${state.result.title}.hwpx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStep(3);toast(`구조 검증 완료 · 재추출 ${response.headers.get('x-kordoc-roundtrip-chars')||'-'}자`)}catch(error){toast(error.message)}finally{button.classList.remove('busy');button.innerHTML='검증 후 HWPX 다운로드 <span>↓</span>'}}

document.querySelectorAll('.tab').forEach(tab=>tab.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===tab));state.workflow=tab.dataset.workflow;reset()});
$('#resetBtn').onclick=reset;$('#analyzeBtn').onclick=analyze;$('#backBtn').onclick=()=>show('uploadStage',0);$('#generateBtn').onclick=generate;$('#analysisBackBtn').onclick=()=>show('analysisStage',1);$('#downloadBtn').onclick=download;$('#editor').oninput=updateCount;renderUploads();

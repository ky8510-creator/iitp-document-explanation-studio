import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateBusiness, generateTask, parseDocument, exportHwpx, MAX_UPLOAD } from './lib/documents.mjs';
import { analyzeTrends, generateBusinessTrend, generateTaskTrend } from './lib/trends.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicRoot = join(root, 'public');
const port = Number(process.env.PORT || 3000);
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml' };
const sendJson = (res, value, status=200) => { const data=Buffer.from(JSON.stringify(value)); res.writeHead(status, {'content-type':'application/json; charset=utf-8','content-length':data.length}); res.end(data); };
const readBody = (req, limit) => new Promise((resolve,reject)=>{ const chunks=[]; let size=0; let failed=false; req.on('data',chunk=>{ if(failed)return; size+=chunk.length; if(size>limit){failed=true;reject(Object.assign(new Error('요청 크기 제한을 초과했습니다.'),{status:413}));}else chunks.push(chunk)});req.on('end',()=>{if(!failed)resolve(Buffer.concat(chunks))});req.on('error',reject); });
const safeName = value => String(value || 'IITP_설명자료').replace(/[\\/:*?"<>|\r\n]/g,'_').slice(0,120);

export function createServer(options = {}) {
  return http.createServer(async (req,res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      if (req.method === 'GET' && url.pathname === '/api/health') return sendJson(res,{ok:true,engine:'kordoc',workflows:['business','task'],modes:['upload','trend']});
      if (req.method === 'POST' && url.pathname === '/api/parse') {
        const filename = decodeURIComponent(req.headers['x-filename'] || '');
        const role = String(req.headers['x-document-role'] || 'document');
        return sendJson(res, await parseDocument(filename, await readBody(req, MAX_UPLOAD + 1), role));
      }
      if (req.method === 'POST' && url.pathname === '/api/generate/business') {
        const input=JSON.parse((await readBody(req,2_000_000)).toString('utf8'));
        if (!input.demand?.markdown || !input.planning?.markdown) return sendJson(res,{error:'기술수요조사서와 기술기획보고서가 모두 필요합니다.'},400);
        return sendJson(res,generateBusiness(input.demand,input.planning));
      }
      if (req.method === 'POST' && url.pathname === '/api/generate/task') {
        const input=JSON.parse((await readBody(req,2_000_000)).toString('utf8'));
        if (!input.rfp?.markdown) return sendJson(res,{error:'RFP가 필요합니다.'},400);
        return sendJson(res,generateTask(input.rfp,input.researchPlan || null));
      }
      if (req.method === 'POST' && url.pathname === '/api/trends/analyze') {
        const input=JSON.parse((await readBody(req,2_000_000)).toString('utf8'));
        return sendJson(res,await (options.analyzeTrends || analyzeTrends)(input));
      }
      if (req.method === 'POST' && url.pathname === '/api/generate/business-trend') {
        const input=JSON.parse((await readBody(req,2_000_000)).toString('utf8'));
        return sendJson(res,generateBusinessTrend(input.analysis));
      }
      if (req.method === 'POST' && url.pathname === '/api/generate/task-trend') {
        const input=JSON.parse((await readBody(req,2_000_000)).toString('utf8'));
        return sendJson(res,generateTaskTrend(input.analysis));
      }
      if (req.method === 'POST' && url.pathname === '/api/export') {
        const input=JSON.parse((await readBody(req,1_000_000)).toString('utf8'));
        const output=await exportHwpx(input.markdown);
        const filename=encodeURIComponent(`${safeName(input.filename)}.hwpx`);
        res.writeHead(200,{
          'content-type':'application/vnd.hancom.hwpx',
          'content-disposition':`attachment; filename*=UTF-8''${filename}`,
          'content-length':output.buffer.length,
          'x-kordoc-validation':'ok',
          'x-kordoc-roundtrip-chars':String(output.roundTripChars)
        });
        return res.end(output.buffer);
      }
      if (req.method === 'GET') {
        const requested = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const path = normalize(join(publicRoot, requested));
        if (path !== publicRoot && !path.startsWith(`${publicRoot}/`)) return sendJson(res,{error:'Not found'},404);
        try { const data=await readFile(path); res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream','content-length':data.length}); return res.end(data); }
        catch { return sendJson(res,{error:'Not found'},404); }
      }
      return sendJson(res,{error:'Not found'},404);
    } catch (error) {
      if (!res.headersSent) sendJson(res,{error:error instanceof SyntaxError?'요청 JSON 형식이 올바르지 않습니다.':error.message},error.status||500);
    }
  });
}

const app = createServer();
export default app;

if (process.argv[1] === fileURLToPath(import.meta.url)) app.listen(port,'0.0.0.0',()=>console.log(`IITP document app listening on http://0.0.0.0:${port}`));

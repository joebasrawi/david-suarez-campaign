// Local-only QA server: node scripts/preview-loading.mjs 4174 6000 [fail-json]
// Never deployed as a runtime service. Useful for inspecting real loading states.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const port=Number(process.argv[2]||4174),delay=Number(process.argv[3]||0),fail=process.argv.includes('fail-json');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png'};
http.createServer(async(req,res)=>{
 try {
  let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(path.endsWith('/'))path+='index.html';
  const file=resolve(root,'.'+path);
  if(!file.startsWith(resolve(root)+sep)){res.writeHead(403).end();return;}
  const data=await readFile(file),ext=extname(file);
  const send=()=>{if(res.destroyed)return;if(fail&&ext==='.json'){res.writeHead(503).end('QA: source unavailable');return;}res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'}).end(data);};
  if(ext==='.json')setTimeout(send,delay);else send();
 }catch{res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`QA preview on http://127.0.0.1:${port}; JSON delay ${delay}ms; failure ${fail}`));

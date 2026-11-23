import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import OBSWebSocket from 'obs-websocket-js';
import {configureMove} from '../move-layouts.mjs';
import {SCENES,names} from '../studio.mjs';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url))),cfg=JSON.parse(fs.readFileSync(path.join(base,'private/studio.json'),'utf8'));
const obs=new OBSWebSocket();
for(let i=0;i<40;i++){try{await obs.connect(`ws://127.0.0.1:${cfg.obsPort}`,cfg.obsPassword);break;}catch(e){if(i===39)throw e;await new Promise(r=>setTimeout(r,500));}}
try{
  if((await obs.call('GetStreamStatus')).outputActive||(await obs.call('GetRecordStatus')).outputActive)throw Error('Aguarde o fim da transmissão/gravação.');
  const ready=await configureMove((r,d)=>obs.call(r,d),SCENES,names,cfg.port);if(!ready)throw Error('A transição Move não foi carregada.');
  console.log(JSON.stringify(await obs.call('GetCurrentSceneTransition')));
  console.log('Câmeras, molduras e nomes configurados para o Move.');
}finally{await obs.disconnect();}

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import OBSWebSocket from 'obs-websocket-js';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url))),cfg=JSON.parse(fs.readFileSync(path.join(base,'private/studio.json'),'utf8'));
const obs=new OBSWebSocket();await obs.connect(`ws://127.0.0.1:${cfg.obsPort}`,cfg.obsPassword);
try{
  const [stream,record]=await Promise.all([obs.call('GetStreamStatus'),obs.call('GetRecordStatus')]);if(stream.outputActive||record.outputActive)throw Error('Transmissão ou gravação ativa. Não reiniciar o OBS.');
  const dir=path.join(base,'private/backups/move-3.2.2');fs.mkdirSync(dir,{recursive:true});
  const info={scene:await obs.call('GetCurrentProgramScene'),transition:await obs.call('GetCurrentSceneTransition'),transitions:await obs.call('GetSceneTransitionList'),inputs:await obs.call('GetInputList')};
  fs.writeFileSync(path.join(dir,'estado-antes.json'),JSON.stringify(info,null,2),'utf8');
  console.log('Estado salvo. Nenhuma transmissão ou gravação ativa.');
}finally{await obs.disconnect();}

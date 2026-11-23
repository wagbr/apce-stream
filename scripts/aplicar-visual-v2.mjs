import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import OBSWebSocket from 'obs-websocket-js';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cfg=JSON.parse(fs.readFileSync(path.join(base,'private/studio.json'),'utf8'));
const obs=new OBSWebSocket();
await obs.connect(`ws://127.0.0.1:${cfg.obsPort}`,cfg.obsPassword);
try{
  const stream=await obs.call('GetStreamStatus'),record=await obs.call('GetRecordStatus');
  if(stream.outputActive||record.outputActive)throw Error('Aguarde o fim da transmissão/gravação antes de aplicar o visual.');
  const {inputs}=await obs.call('GetInputList');
  const overlays=inputs.filter(i=>i.inputKind==='browser_source'&&/^APCE · (Fundo|Legendas) /.test(i.inputName));
  const backup=[];
  for(const input of overlays){
    const {inputSettings}=await obs.call('GetInputSettings',{inputName:input.inputName});
    backup.push({inputName:input.inputName,url:inputSettings.url});
    const url=new URL(inputSettings.url);url.pathname='/overlay-v2.html';
    await obs.call('SetInputSettings',{inputName:input.inputName,inputSettings:{url:url.toString()},overlay:true});
    await obs.call('PressInputPropertiesButton',{inputName:input.inputName,propertyName:'refreshnocache'}).catch(()=>{});
  }
  const file=path.join(base,'backups/interface-v1/fontes-overlays.json');if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify(backup,null,2),'utf8');
  console.log(`${overlays.length} fontes visuais atualizadas; câmeras, áudio e conta preservados.`);
}finally{await obs.disconnect();}

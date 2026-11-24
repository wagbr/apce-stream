import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';import OBSWebSocket from 'obs-websocket-js';import {SCENES,names} from '../studio.mjs';import {configureSceneBackgrounds} from '../scene-backgrounds.mjs';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url))),cfg=JSON.parse(fs.readFileSync(path.join(base,'private/studio.json'),'utf8')),obs=new OBSWebSocket();
const api=(type,data={})=>obs.call(type,data),hash=data=>crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
async function protectedState(){
 const result={};for(const inputName of Object.values(names).filter(n=>n!==names.audioScene)){
  const settings=await api('GetInputSettings',{inputName}).catch(()=>null);if(settings)result[inputName]={settings:settings.inputSettings};
  for(const request of ['GetInputMute','GetInputVolume','GetInputAudioTracks','GetInputAudioMonitorType']){const value=await api(request,{inputName}).catch(()=>null);if(value)result[inputName][request]=value;}
 }return hash(result);
}
try{
 await obs.connect('ws://127.0.0.1:'+cfg.obsPort,cfg.obsPassword);assert(!(await api('GetStreamStatus')).outputActive);assert(!(await api('GetRecordStatus')).outputActive);
 const originalScene=(await api('GetCurrentProgramScene')).currentProgramSceneName,protectedBefore=await protectedState(),before=(await api('GetInputList')).inputs.filter(i=>!i.inputName.endsWith(' · imagem areia')).length;
 const backups=path.join(base,'private/backups');fs.mkdirSync(backups,{recursive:true});fs.copyFileSync(path.join(base,'obs/config/obs-studio/basic/scenes/APCE.json'),path.join(backups,'cenas-antes-areia-'+Date.now()+'.json'));
 const applied=await configureSceneBackgrounds(api,{base,scenes:SCENES});
 for(const input of (await api('GetInputList')).inputs){
  if(input.inputKind!=='browser_source'||!/^APCE · (Legendas |Moldura |Nome )/.test(input.inputName))continue;
  await api('PressInputPropertiesButton',{inputName:input.inputName,propertyName:'refreshnocache'});
 }
 await api('PressInputPropertiesButton',{inputName:names.room,propertyName:'refreshnocache'});
 assert.equal(await protectedState(),protectedBefore,'A configuração das câmeras ou do áudio mudou.');assert.equal((await api('GetCurrentProgramScene')).currentProgramSceneName,originalScene);
 let count;for(let n=0;n<20;n++){count=(await api('GetInputList')).inputs.length;if(count===before)break;await new Promise(r=>setTimeout(r,100));}assert.equal(count,before);
 const folder=path.join(base,'evidencias/areia-v3');fs.mkdirSync(folder,{recursive:true});
 for(const mode of ['wait','solo','duo','room','media','end']){
  const inputName=`APCE · Fundo ${mode}`,s=await api('GetInputSettings',{inputName});assert.equal(s.inputKind,'image_source');
  let capture;for(let n=0;n<20;n++){try{capture=await api('GetSourceScreenshot',{sourceName:inputName,imageFormat:'jpg',imageWidth:960});break;}catch(error){if(error.code!==702||n===19)throw error;await new Promise(r=>setTimeout(r,200));}}
  fs.writeFileSync(path.join(folder,'obs-fundo-'+mode+'.jpg'),Buffer.from(capture.imageData.split(',')[1],'base64'));
 }
 const report={passed:true,...applied,camerasAndAudioPreserved:true,programScenePreserved:true,publicStreamStarted:false};fs.writeFileSync(path.join(folder,'aplicacao.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await obs.disconnect();}

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import OBSWebSocket from 'obs-websocket-js';
import {MOVE,participantLayers} from '../move-layouts.mjs';
import {SCENES,names} from '../studio.mjs';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url))),cfg=JSON.parse(fs.readFileSync(path.join(base,'private/studio.json'),'utf8'));
const obs=new OBSWebSocket(),report={checks:[],events:[],date:new Date().toISOString(),plugin:'Move 3.2.2',duration:MOVE.duration};
const testScenes=['_APCE_TESTE_Move_Solo','_APCE_TESTE_Move_Entrevista','_APCE_TESTE_Move_Midia'],testInputs=['_APCE_TESTE_Move_Fundo','_APCE_TESTE_Move_Camera1','_APCE_TESTE_Move_Camera2'];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const note=s=>{report.checks.push(s);console.log('OK:',s);};
let originalScene,recordingStarted=false;
const createdScenes=[],createdInputs=[];
obs.on('SceneTransitionStarted',e=>report.events.push({type:'start',name:e.transitionName,at:Date.now()}));obs.on('SceneTransitionEnded',e=>report.events.push({type:'end',name:e.transitionName,at:Date.now()}));
await obs.connect(`ws://127.0.0.1:${cfg.obsPort}`,cfg.obsPassword,{eventSubscriptions:0x7ff});
const call=(r,d={})=>obs.call(r,d);
async function place(scene,source,box){
  let item=(await call('GetSceneItemList',{sceneName:scene})).sceneItems.find(i=>i.sourceName===source);
  if(!item)item=await call('CreateSceneItem',{sceneName:scene,sourceName:source,sceneItemEnabled:true});
  const [x,y,w,h]=box;await call('SetSceneItemTransform',{sceneName:scene,sceneItemId:item.sceneItemId,sceneItemTransform:{positionX:x,positionY:y,alignment:5,boundsType:'OBS_BOUNDS_STRETCH',boundsWidth:w,boundsHeight:h}});
}
async function switchScene(scene){await call('SetCurrentProgramScene',{sceneName:scene});await wait(1200);assert.equal((await call('GetCurrentProgramScene')).currentProgramSceneName,scene);}
try{
  assert.equal((await call('GetStreamStatus')).outputActive,false);assert.equal((await call('GetRecordStatus')).outputActive,false);
  originalScene=(await call('GetCurrentProgramScene')).currentProgramSceneName;
  const transition=await call('GetCurrentSceneTransition');assert.equal(transition.transitionKind,MOVE.id);assert.equal(transition.transitionName,MOVE.name);assert.equal(transition.transitionDuration,MOVE.duration);note('Move instalado e ativo em 650 ms');
  const sourceIds=[];
  for(const scene of [SCENES.solo,SCENES.duo,SCENES.media]){
    const items=(await call('GetSceneItemList',{sceneName:scene})).sceneItems;const host=items.find(i=>i.sourceName===names.host);assert(host);sourceIds.push(host.sourceUuid);
    const frame=items.find(i=>i.sourceName===participantLayers.hostFrame);assert(frame);assert(frame.sceneItemIndex<host.sceneItemIndex);
  }
  assert.equal(new Set(sourceIds).size,1);note('Mesma câmera e moldura reutilizadas em Solo, Entrevista e Mídia');
  const filter=await call('GetSourceFilter',{sourceName:participantLayers.mediaName,filterName:'APCE · Regras Move'});assert.equal(filter.filterSettings.match_source,participantLayers.hostName);note('Nome do apresentador acompanha a mudança para o layout compacto');
  for(const n of [names.host,names.guest,names.room]){const t=(await call('GetInputAudioTracks',{inputName:n})).inputAudioTracks;assert(t['1']);assert(!t['2']);}note('Trilhas das vozes preservadas');
  const existing=(await call('GetSceneList')).scenes.map(s=>s.sceneName);assert(!testScenes.some(s=>existing.includes(s)),'Já existe uma cena com o nome reservado do teste.');
  for(const scene of testScenes){await call('CreateScene',{sceneName:scene});createdScenes.push(scene);}
  await call('CreateInput',{sceneName:testScenes[0],inputName:testInputs[0],inputKind:'color_source_v3',inputSettings:{color:0xff241c1c,width:1920,height:1080},sceneItemEnabled:true});
  createdInputs.push(testInputs[0]);
  for(const [i,name] of testInputs.slice(1).entries()){
    await call('CreateInput',{sceneName:testScenes[0],inputName:name,inputKind:'browser_source',inputSettings:{url:`http://127.0.0.1:${cfg.port}/move-demo.html?person=${i===0?'host':'guest'}`,width:1280,height:720,shutdown:false,fps:30,reroute_audio:true},sceneItemEnabled:true});
    createdInputs.push(name);
    await call('SetInputAudioTracks',{inputName:name,inputAudioTracks:{'1':false,'2':false,'3':false,'4':false,'5':false,'6':false}});
  }
  for(const scene of testScenes)await place(scene,testInputs[0],[0,0,1920,1080]);
  const boxes=[[240,144,1440,810],[64,260,880,495],[1536,390,320,180]];
  for(let i=0;i<3;i++)await place(testScenes[i],testInputs[1],boxes[i]);
  await place(testScenes[0],testInputs[2],[2100,260,880,495]);await place(testScenes[1],testInputs[2],[976,260,880,495]);await place(testScenes[2],testInputs[2],[2100,260,880,495]);
  await switchScene(testScenes[0]);await wait(2000);
  await call('StartRecord');recordingStarted=true;await wait(1200);
  for(const scene of [testScenes[1],testScenes[2],testScenes[0]]){await call('SetCurrentProgramScene',{sceneName:scene});await wait(220);const cursor=await call('GetCurrentSceneTransitionCursor');report.transitionCursorSamples??=[];report.transitionCursorSamples.push(cursor.transitionCursor);await wait(1180);}
  const recording=await call('StopRecord');recordingStarted=false;report.recordingPath=recording.outputPath;assert(report.transitionCursorSamples.some(v=>v>0&&v<1),'Nenhum quadro intermediário da transição foi observado.');note('Quadros intermediários do movimento capturados em gravação local');
  assert(report.events.filter(e=>e.type==='start'&&e.name===MOVE.name).length>=3);note('Eventos nativos confirmam o Move nas três trocas de layout');
  for(const scene of [SCENES.solo,SCENES.duo,SCENES.media])await switchScene(scene);note('Layouts reais alternados com o Move');
  await switchScene(SCENES.intro);const media=await call('GetMediaInputStatus',{inputName:names.intro});assert.equal(media.mediaState,'OBS_MEDIA_STATE_PLAYING');await call('SetMediaInputCursor',{inputName:names.intro,mediaCursor:media.mediaDuration-1500});
  for(let i=0;i<30;i++){await wait(300);if((await call('GetCurrentProgramScene')).currentProgramSceneName===cfg.afterIntro)break;}
  assert.equal((await call('GetCurrentProgramScene')).currentProgramSceneName,cfg.afterIntro);note('Vinheta leve e avanço automático continuam funcionando');
  const state=await(await fetch(`http://127.0.0.1:${cfg.port}/api/state`)).json();assert.equal(state.youtube.accountConnected,true);assert.equal((await call('GetStreamStatus')).outputActive,false);note('Conta APCE preservada e nenhuma transmissão pública iniciada');
  report.passed=true;
}catch(e){report.passed=false;report.error=e.message;console.log('FALHA:',e.message);process.exitCode=1;}
finally{
  if(recordingStarted){try{const r=await call('StopRecord');report.recordingPath=r.outputPath;}catch{}}
  if(originalScene){try{await switchScene(originalScene);}catch{}}
  for(const scene of [...createdScenes].reverse()){try{await call('RemoveScene',{sceneName:scene});}catch{}}
  for(const inputName of [...createdInputs].reverse()){try{await call('RemoveInput',{inputName});}catch{}}
  await obs.disconnect();fs.writeFileSync(path.join(base,'evidencias/verificacao-move.json'),JSON.stringify(report,null,2),'utf8');
}

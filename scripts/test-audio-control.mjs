import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createAudioControl} from '../audio-control.mjs';
import {createBroadcastControl} from '../broadcast-control.mjs';
import {names,SCENES} from '../studio.mjs';

function fixture(){
  const cfg={},inputs=new Map(['intro','video','room','share','host','guest'].map(id=>[names[id],{muted:false,volume:1,monitor:'OBS_MONITORING_TYPE_NONE',tracks:{'1':false,'2':false}}]));
  const sceneItems=new Map([SCENES.solo,SCENES.duo,SCENES.media,names.audioScene].map(scene=>[scene,scene===SCENES.duo?[]:[{sourceName:names.audioScene,sceneItemId:1,sceneItemEnabled:true}]]));
  let now=10000,saves=0;const calls=[];
  const api=async(type,data={})=>{
    calls.push({type,...data});const input=inputs.get(data.inputName||data.sourceName);
    if(type==='GetInputList')return {inputs:[...inputs.keys()].map(inputName=>({inputName}))};
    if(type==='GetSceneList')return {scenes:[...sceneItems.keys()].map(sceneName=>({sceneName}))};
    if(type==='GetSceneItemList')return {sceneItems:sceneItems.get(data.sceneName)};
    if(type==='CreateSceneItem'){sceneItems.get(data.sceneName).push({...data,sceneItemId:2});return {};}
    if(type==='SetSceneItemEnabled'){sceneItems.get(data.sceneName).find(item=>item.sceneItemId===data.sceneItemId).sceneItemEnabled=data.sceneItemEnabled;return {};}
    if(!input)throw Error('Input ausente');
    if(type==='SetInputAudioTracks')input.tracks=data.inputAudioTracks;
    else if(type==='SetInputAudioMonitorType')input.monitor=data.monitorType;
    else if(type==='SetInputMute')input.muted=data.inputMuted;
    else if(type==='SetInputVolume')input.volume=data.inputVolumeMul;
    else if(type==='GetInputMute')return {inputMuted:input.muted};
    else if(type==='GetInputVolume')return {inputVolumeMul:input.volume};
    else if(type==='GetInputAudioMonitorType')return {monitorType:input.monitor};
    else if(type==='GetInputAudioTracks')return {inputAudioTracks:input.tracks};
    else if(type==='GetSourceActive')return {videoActive:true};
    else throw Error('Chamada inesperada: '+type);
    return {};
  };
  const audio=createAudioControl({api,isConnected:()=>true,cfg,names,scenes:SCENES,saveConfig:()=>saves++,clock:()=>now});
  return {audio,cfg,inputs,sceneItems,calls,advance:ms=>now+=ms,get saves(){return saves;}};
}
test('abertura e mídias saem na transmissão e no retorno, com escuta local; vozes entram na Entrevista',async()=>{
  const f=fixture();await f.audio.configure();
  for(const id of ['intro','video','share']){const input=f.inputs.get(names[id]);assert(input.tracks['1']);assert(input.tracks['2']);assert.equal(input.monitor,'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT');assert.equal(input.muted,false);}
  const room=f.inputs.get(names.room);assert(room.tracks['1']);assert(!room.tracks['2']);assert.equal(room.monitor,'OBS_MONITORING_TYPE_NONE');
  assert(f.sceneItems.get(SCENES.duo).some(item=>item.sourceName===names.audioScene&&item.sceneItemEnabled));
  for(const id of ['host','guest'])assert(Object.values(f.inputs.get(names[id]).tracks).every(value=>!value));
});
test('mute explícito e volume persistem; reparar o áudio respeita a escolha do usuário',async()=>{
  const f=fixture();await f.audio.configure();await f.audio.action({action:'mute',channel:'intro',muted:true});await f.audio.action({action:'volume',channel:'intro',volume:.4});
  assert.deepEqual(f.cfg.audioMix.intro,{muted:true,volume:.4,monitor:true});assert.equal(f.saves,2);await f.audio.configure();
  assert(f.inputs.get(names.intro).muted);assert.equal(f.inputs.get(names.intro).volume,.4);assert(!f.inputs.get(names.video).muted);
});
test('desligar escuta local não retira o áudio da transmissão nem do retorno',async()=>{
  const f=fixture();await f.audio.configure();await f.audio.action({action:'monitor',channel:'video',enabled:false});
  const video=f.inputs.get(names.video);assert.equal(video.monitor,'OBS_MONITORING_TYPE_NONE');assert(video.tracks['1']);assert(video.tracks['2']);assert(!video.muted);
});
test('medidores usam o pico efetivo e descartam amostras antigas ou silenciadas',async()=>{
  const f=fixture();await f.audio.configure();f.audio.receiveMeters({inputs:[{inputName:names.room,inputLevelsMul:[[.1,.5,.8],[.1,.2,.5]]}]});
  let room=(await f.audio.state()).channels.find(c=>c.id==='room');assert.equal(room.peak,.5);assert(room.db<-6&&room.db>-7);
  await f.audio.action({action:'mute',channel:'room',muted:true});assert.equal((await f.audio.state()).channels.find(c=>c.id==='room').peak,0);
  await f.audio.action({action:'mute',channel:'room',muted:false});f.advance(2100);assert.equal((await f.audio.state()).channels.find(c=>c.id==='room').peak,0);
});
test('valida controles e não desliga fontes para valores inválidos',async()=>{
  const f=fixture();for(const data of [{action:'mute',channel:'intro',muted:'true'},{action:'volume',channel:'video',volume:-1},{action:'monitor',channel:'room',enabled:1},{action:'mute',channel:'invalid',muted:true}])await assert.rejects(f.audio.action(data));assert.equal(f.saves,0);
});
test('arquivo de transmissão corrompido é preservado e não impede o painel nem atribui posse de sinal',async t=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'apce-recover-'));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));fs.mkdirSync(path.join(base,'private'));
  const file=path.join(base,'private/broadcast.json');fs.writeFileSync(file,Buffer.alloc(91));
  const control=createBroadcastControl({base,youtube:{},api:async()=>{throw Error('Não deve controlar o OBS');},isConnected:()=>false});
  const state=await control.state();assert(!state.ingestOwned);assert.equal(state.selected,null);assert.match(state.error,/recuperada/);assert.deepEqual(JSON.parse(fs.readFileSync(file)),{});
  const backup=fs.readdirSync(path.join(base,'private')).find(name=>name.startsWith('broadcast.json.corrupt-'));assert(backup);assert.equal(fs.readFileSync(path.join(base,'private',backup)).length,91);
});

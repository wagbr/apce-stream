import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {configureSceneBackgrounds} from '../scene-backgrounds.mjs';import {SCENES} from '../studio.mjs';
test('fundos não são alterados durante transmissão ou gravação',async()=>{
 for(const active of ['GetStreamStatus','GetRecordStatus']){
  const writes=[];await assert.rejects(configureSceneBackgrounds(async type=>{if(type===active)return {outputActive:true};if(type.startsWith('Get'))return {};writes.push(type);},{base:os.tmpdir(),scenes:SCENES}),/Encerre/);assert.deepEqual(writes,[]);
 }
});
test('arquivo ausente impede qualquer remoção de fundos',async()=>{
 const calls=[];await assert.rejects(configureSceneBackgrounds(async type=>{calls.push(type);return {outputActive:false};},{base:path.join(os.tmpdir(),'apce-missing-wallpapers-fixture'),scenes:SCENES}),/Fundo APCE ausente/);assert(calls.every(c=>c.startsWith('Get')));
});
test('migra apenas fundos, preserva nomes e câmera; repetir não recria fontes',async t=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'apce-background-test-'));t.after(()=>{const safe=path.resolve(base);assert(safe.startsWith(path.resolve(os.tmpdir())+path.sep+'apce-background-test-'));fs.rmSync(safe,{recursive:true,force:true});});
 const folder=path.join(base,'public/assets/areia-v3');fs.mkdirSync(folder,{recursive:true});for(const name of ['espera','estudio','sala','midia'])fs.writeFileSync(path.join(folder,'fundo-'+name+'.webp'),'fixture');
 let seq=1;const calls=[],sources=new Map([['Câmera real',{inputName:'Câmera real',inputKind:'browser_source',scene:'solo',id:0}]]);
 for(const mode of ['wait','solo','duo','room','media','end'])sources.set(`APCE · Fundo ${mode}`,{inputName:`APCE · Fundo ${mode}`,inputKind:'browser_source',scene:SCENES[mode],id:seq++});
 const api=async(type,data)=>{
  calls.push({type,data});if(['GetStreamStatus','GetRecordStatus'].includes(type))return {outputActive:false};
  if(type==='GetInputList')return {inputs:[...sources.values()]};
  if(type==='GetSceneItemList')return {sceneItems:[...sources.values()].filter(s=>s.scene===data.sceneName).map(s=>({sourceName:s.inputName,sceneItemId:s.id}))};
  if(type==='CreateInput'){const s={...data,id:seq++,scene:data.sceneName};sources.set(s.inputName,s);return {sceneItemId:s.id};}
  if(type==='SetInputName'){const s=sources.get(data.inputName);sources.delete(data.inputName);s.inputName=data.newInputName;sources.set(s.inputName,s);}
  if(type==='RemoveSceneItem'){for(const [key,s] of sources)if(s.id===data.sceneItemId)sources.delete(key);}
  if(type==='RemoveInput'&&!sources.has(data.inputName))throw Object.assign(new Error('A última referência já foi removida.'),{code:600});
  return {};
 };
 await configureSceneBackgrounds(api,{base,scenes:SCENES});assert.equal(sources.size,7);assert.equal(sources.get('Câmera real').inputKind,'browser_source');assert([...sources.values()].filter(s=>s.inputName.startsWith('APCE · Fundo ')).every(s=>s.inputKind==='image_source'));
 const index=calls.length;await configureSceneBackgrounds(api,{base,scenes:SCENES});assert(!calls.slice(index).some(c=>['CreateInput','RemoveInput','SetInputName'].includes(c.type)));assert(calls.filter(c=>c.type==='SetSceneItemTransform').every(c=>c.data.sceneItemId!==0));
});

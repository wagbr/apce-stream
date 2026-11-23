import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {Readable} from 'node:stream';
import {createMediaLibrary,serveMediaFile} from '../media-library.mjs';
import {SCENES,names} from '../studio.mjs';

function fixture(t){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'apce-media-test-'));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
  const native={scene:SCENES.wait,settings:{image:{},video:{},share:{}},items:['video','image','share'].map((kind,i)=>({sourceName:names[kind],sceneItemId:i,sceneItemIndex:i,sceneItemEnabled:false})),calls:[],volume:1,muted:false,state:'OBS_MEDIA_STATE_STOPPED',cursor:0,connected:true,fail:false};
  const kind=name=>Object.keys(native.settings).find(k=>names[k]===name);
  async function api(request,params={}){
    native.calls.push({request,params});
    if(request==='GetCurrentProgramScene')return {currentProgramSceneName:native.scene};
    if(request==='GetSceneItemList')return {sceneItems:structuredClone(native.items)};
    if(request==='GetInputSettings')return {inputSettings:structuredClone(native.settings[kind(params.inputName)])};
    if(request==='GetMediaInputStatus')return {mediaState:native.state,mediaCursor:native.cursor,mediaDuration:5000};
    if(request==='GetInputVolume')return {inputVolumeMul:native.volume};
    if(request==='GetInputMute')return {inputMuted:native.muted};
    if(request==='SetInputSettings'){Object.assign(native.settings[kind(params.inputName)],params.inputSettings);return {};}
    if(request==='SetSceneItemEnabled'){native.items.find(i=>i.sceneItemId===params.sceneItemId).sceneItemEnabled=params.sceneItemEnabled;return {};}
    if(request==='SetCurrentProgramScene'){native.scene=params.sceneName;return {};}
    if(request==='TriggerMediaInputAction'){native.state=params.mediaAction.endsWith('PAUSE')?'OBS_MEDIA_STATE_PAUSED':params.mediaAction.endsWith('STOP')?'OBS_MEDIA_STATE_STOPPED':'OBS_MEDIA_STATE_PLAYING';return {};}
    if(request==='SetMediaInputCursor'){native.cursor=params.mediaCursor;return {};}
    if(request==='SetInputVolume'){native.volume=params.inputVolumeMul;return {};}
    if(request==='SetInputMute'){native.muted=params.inputMuted;return {};}
    throw Error('Unexpected OBS request: '+request);
  }
  const opts={base,api,isConnected:()=>native.connected,scenes:SCENES,names,cfg:{},saveConfig(){},prepare:async(item,progress)=>{
    if(native.fail)throw Error('Arquivo simulado inválido');const folder=path.join(base,'Biblioteca de mídias/Prévias',item.id);fs.mkdirSync(folder,{recursive:true});const count=item.kind==='pdf'?3:1;
    for(let i=0;i<count;i++){progress({progress:i+1,pageCount:count});const suffix=String(i+1).padStart(4,'0');fs.writeFileSync(path.join(folder,item.kind==='pdf'?`page-${suffix}.png`:'image.png'),'test-image-'+i);fs.writeFileSync(path.join(folder,item.kind==='pdf'?`thumb-${suffix}.jpg`:'thumb.jpg'),'thumb-'+i);}
    return {pageCount:count,width:1280,height:720,duration:item.kind==='video'?5:0,poster:true,hasAudio:item.kind==='video'};
  }};
  const library=createMediaLibrary(opts);
  const upload=async(name,content)=>{const stream=Readable.from([Buffer.from(content||'%PDF-1.7\nTEST')]);stream.headers={};const r=await library.upload(stream,name);await library.waitForIdle();return r;};
  return {library,native,upload,opts,base};
}
test('upload preserva originais, sanitiza nomes e não muda o programa',async t=>{
  const {library:l,native,upload,base}=fixture(t);const {item}=await upload('../../Conversa com acentuação.pdf');assert.equal(native.calls.length,0);const detail=l.detail(item.id);assert.equal(detail.status,'ready');assert.equal(detail.originalName,'Conversa com acentuação.pdf');assert.equal(detail.pages.length,3);assert.equal(fs.readdirSync(path.join(base,'Biblioteca de mídias/Arquivos')).length,1);assert.equal(native.scene,SCENES.wait);
});
test('rejeita formatos, arquivos vazios, PDF falso e tamanho excessivo',async t=>{
  const {library:l,upload}=fixture(t);await assert.rejects(upload('script.html','<script>'));await assert.rejects(upload('fake.pdf','not-a-pdf'));const empty=Readable.from([]);empty.headers={};await assert.rejects(l.upload(empty,'empty.png'));const big=Readable.from([]);big.headers={'content-length':101*1024*1024};await assert.rejects(l.upload(big,'big.pdf'),{status:413});assert.equal((await l.state()).items.length,0);
});
test('deduplica bytes idênticos e arquiva com possibilidade de desfazer',async t=>{
  const {library:l,upload,base}=fixture(t);const first=await upload('one.png','same-image'),second=await upload('two.png','same-image');assert.equal(second.reused,true);assert.equal(first.item.id,second.item.id);await l.control({action:'archive',id:first.item.id});assert.equal((await l.state()).items.length,0);assert.equal(fs.readdirSync(path.join(base,'Biblioteca de mídias/Arquivos')).length,1);await l.control({action:'restore',id:first.item.id});assert.equal((await l.state()).items.length,1);
});
test('erro de preparação é apresentado e impede exibição',async t=>{
  const {library:l,native,upload}=fixture(t);native.fail=true;const {item}=await upload('bad.png','broken');assert.equal(l.detail(item.id).status,'failed');await assert.rejects(l.control({action:'take',id:item.id}));assert.equal(native.scene,SCENES.wait);
});
test('apresenta PDF, navega por páginas e retorna à cena anterior',async t=>{
  const {library:l,native,upload}=fixture(t);const {item}=await upload('Slides.pdf');const shown=await l.control({action:'take',id:item.id,page:0});assert.equal(native.scene,SCENES.media);assert.equal(shown.program.id,item.id);assert.equal(shown.program.page,0);await l.control({action:'slide',id:item.id,page:2});assert.match(native.settings.image.file,/page-0003\.png$/);await assert.rejects(l.control({action:'slide',id:item.id,page:3}));await l.control({action:'hide'});assert.equal(native.scene,SCENES.wait);assert.ok(!native.calls.some(c=>c.request==='StartStream'||c.request==='SetInputAudioTracks'));
});
test('navegação não recoloca apresentação que saiu do programa',async t=>{
  const {library:l,native,upload}=fixture(t);const {item}=await upload('Slides.pdf');await l.control({action:'take',id:item.id,page:0});native.scene=SCENES.duo;const before=native.calls.filter(c=>c.request==='SetCurrentProgramScene').length;await assert.rejects(l.control({action:'slide',id:item.id,page:1}),{status:409});assert.equal(native.scene,SCENES.duo);assert.equal(native.calls.filter(c=>c.request==='SetCurrentProgramScene').length,before);
});
test('monta, ordena e preserva imagens de apresentações; bloqueia edição no programa',async t=>{
  const {library:l,native,upload}=fixture(t);const a=(await upload('A.png','image-a')).item,b=(await upload('B.png','image-b')).item;const deck=(await l.control({action:'deck',title:'Minha sequência',slides:[b.id,a.id]})).item;assert.equal(deck.pageCount,2);await l.control({action:'take',id:deck.id,page:0});assert.match(native.settings.image.file,new RegExp(b.id));assert.equal((await l.program(true)).kind,'deck');await assert.rejects(l.control({action:'archive',id:deck.id}),{status:409});await assert.rejects(l.control({action:'deck',id:deck.id,title:'Alteração',slides:[a.id]}),{status:409});await l.control({action:'archive',id:b.id});assert.ok(fs.existsSync(l.file(deck.id,'page',0).file));await l.control({action:'hide'});const oldUrl=l.detail(deck.id).pages[0].imageUrl;await l.control({action:'deck',id:deck.id,title:'Nova ordem',slides:[a.id,b.id]});assert.notEqual(l.detail(deck.id).pages[0].imageUrl,oldUrl);await l.control({action:'deck',id:deck.id,title:'Nova ordem',slides:[a.id]});assert.equal(l.detail(deck.id).pageCount,1);
});
test('controles de vídeo validam posição e volume e mantêm as trilhas de áudio',async t=>{
  const {library:l,native,upload}=fixture(t);const {item}=await upload('video.mp4','sample-video');await assert.rejects(l.control({action:'playback',id:item.id,command:'play'}));await l.control({action:'take',id:item.id});await l.control({action:'playback',id:item.id,command:'pause'});assert.equal(native.state,'OBS_MEDIA_STATE_PAUSED');await l.control({action:'seek',id:item.id,position:1500});assert.equal(native.cursor,1500);await assert.rejects(l.control({action:'seek',id:item.id,position:6000}));await assert.rejects(l.control({action:'volume',id:item.id,volume:2}));await l.control({action:'volume',id:item.id,volume:.4});await l.control({action:'mute',id:item.id,muted:true});await l.control({action:'loop',id:item.id,loop:true});assert.equal(native.volume,.4);assert.equal(native.muted,true);assert.equal(native.settings.video.looping,true);assert.ok(!native.calls.some(c=>/AudioTracks|StartStream/.test(c.request)));
});
test('catálogo e página ativa permanecem após reiniciar o módulo',async t=>{
  const {library:l,upload,opts}=fixture(t);const {item}=await upload('Slides.pdf');await l.control({action:'take',id:item.id,page:1});const restarted=createMediaLibrary(opts);assert.equal((await restarted.state()).items.length,1);assert.equal((await restarted.program(true)).page,1);assert.throws(()=>l.file('../../studio.json'),{status:404});
});
test('arquivo de vídeo atende Range e rejeita intervalos inválidos',async t=>{
  const {library:l,upload}=fixture(t);const {item}=await upload('Video.mp4','0123456789');const server=http.createServer((req,res)=>serveMediaFile(req,res,l.file(item.id,'original')));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const url=`http://127.0.0.1:${server.address().port}`;const r=await fetch(url,{headers:{Range:'bytes=2-5'}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 2-5/10');assert.equal(await r.text(),'2345');const suffix=await fetch(url,{headers:{Range:'bytes=-3'}});assert.equal(await suffix.text(),'789');assert.equal((await fetch(url,{headers:{Range:'bytes=100-200'}})).status,416);
});

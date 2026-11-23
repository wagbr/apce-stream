import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import OBSWebSocket from 'obs-websocket-js';
import {SCENES,names} from '../studio.mjs';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cfg=JSON.parse(fs.readFileSync(path.join(base,'private/studio.json'),'utf8'));
const url='http://127.0.0.1:3210';
const report={checks:[],date:new Date().toISOString()};
const check=(name)=>{report.checks.push(name);console.log('OK:',name)};
const obs=new OBSWebSocket();
await obs.connect('ws://127.0.0.1:'+cfg.obsPort,cfg.obsPassword);
const act=async(data)=>{const r=await fetch(url+'/api/action',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(data)});const j=await r.json();assert.equal(r.status,200,j.error);return j;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
  await act({action:'setup'});check('Coleção criada e reparada pelo painel');
  const sceneList=await obs.call('GetSceneList');for(const name of Object.values(SCENES))assert(sceneList.scenes.some(s=>s.sceneName===name));check('Sete cenas esperadas presentes');
  for(const source of [names.host,names.guest]){const {inputAudioTracks:t}=await obs.call('GetInputAudioTracks',{inputName:source});assert(Object.values(t).every(v=>v===false));}
  const {inputAudioTracks:voices}=await obs.call('GetInputAudioTracks',{inputName:names.room});assert.equal(voices['1'],true);assert.equal(voices['2'],false);
  const audioItems=(await obs.call('GetSceneItemList',{sceneName:names.audioScene})).sceneItems;assert(audioItems.some(i=>i.sourceName===names.room));assert(!audioItems.some(i=>[names.host,names.guest].includes(i.sourceName)));
  for(const source of [names.intro,names.video,names.share]){const {inputAudioTracks:t}=await obs.call('GetInputAudioTracks',{inputName:source});assert.equal(t['1'],true);assert.equal(t['2'],true);}check('Vozes excluídas da trilha 2; abertura e mídia nas trilhas 1 e 2');
  const forbidden=await fetch(url+'/api/action',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:JSON.stringify({action:'scene',scene:SCENES.end})});assert.equal(forbidden.status,403);check('Comandos de outra origem recusados');
  const traversal=await fetch(url+'/private/studio.json');assert.equal(traversal.status,404);check('Credenciais não servidas pelo painel');
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1050}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await page.waitForSelector('.scene');await page.screenshot({path:path.join(base,'evidencias/painel.png'),fullPage:true});
    await page.getByRole('button',{name:'03 Entrevista',exact:false}).click();await wait(2200);
    assert.equal((await obs.call('GetCurrentProgramScene')).currentProgramSceneName,SCENES.duo);
    await page.locator('.sand-nav a[href="#agendador"]').click();await page.waitForSelector('#agendador:visible');await page.getByRole('link',{name:'Voltar ao estúdio',exact:true}).click();
    await page.setViewportSize({width:760,height:1000});await page.screenshot({path:path.join(base,'evidencias/painel-compacto.png'),fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);check('Painel desktop e compacto, troca de cena e ajuda de login sem erros');
    for(const mode of ['wait','solo','duo','room','media','end']){
      await page.setViewportSize({width:1920,height:1080});await page.goto(url+'/overlay.html?mode='+mode+'&layer=back');await wait(1000);await page.screenshot({path:path.join(base,'evidencias/overlay-'+mode+'.png')});
    }check('Overlays renderizados em 1920 × 1080');
  }finally{await browser.close();}
  await obs.call('SetCurrentProgramScene',{sceneName:SCENES.intro});await wait(1500);
  const media=await obs.call('GetMediaInputStatus',{inputName:names.intro});assert(media.mediaDuration>130000);assert.equal(media.mediaState,'OBS_MEDIA_STATE_PLAYING');
  await obs.call('SetMediaInputCursor',{inputName:names.intro,mediaCursor:media.mediaDuration-1800});
  for(let i=0;i<20;i++){await wait(500);if((await obs.call('GetCurrentProgramScene')).currentProgramSceneName===cfg.afterIntro)break;}
  assert.equal((await obs.call('GetCurrentProgramScene')).currentProgramSceneName,cfg.afterIntro);check('Abertura leve reproduz e avança automaticamente ao terminar');
  await act({action:'scene',scene:SCENES.wait});
  const status=await obs.call('GetStreamStatus');assert.equal(status.outputActive,false);check('Nenhuma transmissão pública iniciada');
}finally{await obs.disconnect();fs.writeFileSync(path.join(base,'evidencias/verificacao.json'),JSON.stringify(report,null,2),'utf8');}

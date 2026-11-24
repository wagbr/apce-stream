import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {chromium} from 'playwright';import OBSWebSocket from 'obs-websocket-js';import {SCENES} from '../studio.mjs';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url))),cfg=JSON.parse(fs.readFileSync(path.join(base,'private/studio.json'),'utf8')),obs=new OBSWebSocket(),report={passed:false,localAudioPlayback:false,publicStreamStarted:false,checks:[]};let browser;
try{
 await obs.connect('ws://127.0.0.1:'+cfg.obsPort,cfg.obsPassword);assert(!(await obs.call('GetStreamStatus')).outputActive);assert(!(await obs.call('GetRecordStatus')).outputActive);
 const current=(await obs.call('GetCurrentProgramScene')).currentProgramSceneName;
 const backgrounds=(await obs.call('GetInputList')).inputs.filter(i=>/^APCE · Fundo /.test(i.inputName));assert.equal(backgrounds.length,6);assert(backgrounds.every(i=>i.inputKind==='image_source'));
 for(const [mode,sceneName] of Object.entries(SCENES).filter(([m])=>m!=='intro')){
  const inputName=`APCE · Fundo ${mode}`,s=await obs.call('GetInputSettings',{inputName});assert(s.inputSettings.file.replaceAll('\\','/').includes('/areia-v3/'));
  const item=(await obs.call('GetSceneItemList',{sceneName})).sceneItems.find(i=>i.sourceName===inputName);assert(item);assert.equal(item.sceneItemIndex,0);
  const t=(await obs.call('GetSceneItemTransform',{sceneName,sceneItemId:item.sceneItemId})).sceneItemTransform;assert.equal(t.boundsWidth,1920);assert.equal(t.boundsHeight,1080);
 }
 report.checks.push('Seis fundos nativos em 1080p no fundo das respectivas cenas');
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio']});const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/labels',route=>route.fulfill({json:{host:'Nome do apresentador',guest:'Nome do convidado',topic:'Tema definido pelo operador'}}));
 for(const mode of ['wait','intro','solo','duo','room','media','end']){
  await page.goto(`http://127.0.0.1:3210/overlay-v2.html?mode=${mode}&layer=back`);await page.locator('.back').waitFor();assert.equal((await page.locator('#root').textContent()).trim(),'');
  assert((await page.locator('.back').evaluate(el=>getComputedStyle(el).backgroundImage)).includes('/areia-v3/'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),1920);
  const r=await page.request.get(`http://127.0.0.1:3210/assets/areia-v3/scene-${mode}-v3.webp`);assert.equal(r.status(),200);
 }
 report.checks.push('Fundos sem texto nos sete modos e sete miniaturas disponíveis');
 await page.goto('http://127.0.0.1:3210/overlay-v2.html?mode=duo&layer=front');await page.getByText('Nome do apresentador',{exact:true}).waitFor();assert(await page.getByText('Nome do convidado',{exact:true}).isVisible());assert(await page.getByText('Tema definido pelo operador',{exact:true}).isVisible());
 for(const mode of ['wait','end']){await page.goto(`http://127.0.0.1:3210/overlay-v2.html?mode=${mode}&layer=front`);assert.equal((await page.locator('#root').textContent()).trim(),'');}
 report.checks.push('Nomes e tema opcionais preservados em camadas próprias; espera e encerramento somente com arte');
 await page.route('**/api/room/stage',route=>route.fulfill({json:{participants:[],mixUrl:''}}));await page.goto('http://127.0.0.1:3210/stage.html');await page.locator('#empty').waitFor();assert.equal((await page.locator('body').innerText()).trim(),'');
 await page.goto('http://127.0.0.1:3210/overlay.html?mode=duo&layer=back');await page.waitForURL('**/overlay-v2.html?mode=duo&layer=back');assert.equal((await page.locator('#root').textContent()).trim(),'');
 report.checks.push('Sala vazia sem frases e endereço antigo compatível com o novo visual');assert.deepEqual(errors,[]);assert.equal((await obs.call('GetCurrentProgramScene')).currentProgramSceneName,current);report.passed=true;console.log(JSON.stringify(report));
}finally{await browser?.close();await obs.disconnect();const dir=path.join(base,'evidencias/areia-v3');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'verificacao.json'),JSON.stringify(report,null,2));}

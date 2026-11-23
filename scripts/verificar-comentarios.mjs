import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import OBSWebSocket from 'obs-websocket-js';
import {createCommentControl} from '../comment-control.mjs';
import {SCENES} from '../studio.mjs';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url))),url='http://127.0.0.1:3210';
const cfg=JSON.parse(fs.readFileSync(path.join(base,'private/studio.json'),'utf8'));
const inputName='APCE · Comentário em destaque',report={date:new Date().toISOString(),publicStreamStarted:false,simulatedComments:true,checks:[]};
const note=s=>{report.checks.push(s);console.log('OK:',s);};
const broadcast={id:'apceLive001',title:'Ensaio de comentários · validação local',lifeCycleStatus:'live',privacy:'private'};
const raw=(id,name,message)=>({id,snippet:{type:1,displayMessage:message,hasDisplayContent:true},authorDetails:{displayName:name,channelId:id+'-author'}});
const control=createCommentControl({selection:()=>broadcast,youtube:{info:async()=>({snippet:{liveChatId:'local-only'}}),watch:async({onData})=>{setTimeout(()=>onData({items:[raw('local-1','Maria da Conceição','Que conversa boa! Ciência, laicidade e respeito. 🧠'),raw('local-2','Ensaio de segurança','<img src=x onerror="window.__xss=true"> Texto literal, sem executar HTML.')] }),30);return ()=>{};}}});
const harness=http.createServer((req,res)=>{
  if(req.url==='/api/chat/overlay'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(control.overlay()));return;}
  const files={'/comment-overlay.html':['text/html','comment-overlay.html'],'/comment-overlay.css':['text/css','comment-overlay.css'],'/comment-overlay.js':['text/javascript','comment-overlay.js']};
  const file=files[req.url];if(!file){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':file[0]+'; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(path.join(base,'public',file[1])));
});
await new Promise(r=>harness.listen(0,'127.0.0.1',r));const local='http://127.0.0.1:'+harness.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true}),obs=new OBSWebSocket();let oldScene,settings;
try{
  await obs.connect('ws://127.0.0.1:'+cfg.obsPort,cfg.obsPassword);
  assert.equal((await obs.call('GetStreamStatus')).outputActive,false);assert.equal((await obs.call('GetRecordStatus')).outputActive,false);
  oldScene=(await obs.call('GetCurrentProgramScene')).currentProgramSceneName;
  const prepared=await fetch(url+'/api/chat/action',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:'{"action":"prepare"}'});assert.equal(prepared.status,200);
  settings=(await obs.call('GetInputSettings',{inputName})).inputSettings;
  for(const sceneName of Object.values(SCENES)){
    const items=(await obs.call('GetSceneItemList',{sceneName})).sceneItems,entry=items.find(i=>i.sourceName===inputName);assert(entry,sceneName);
    assert.equal(entry.sceneItemIndex,Math.max(...items.map(i=>i.sceneItemIndex)));assert.equal(entry.sceneItemEnabled,true);
  }note('Comentário instalado acima das demais fontes nas sete cenas do OBS');
  await obs.call('SetInputSettings',{inputName,inputSettings:{url:local+'/comment-overlay.html'},overlay:true});
  await obs.call('SetCurrentProgramScene',{sceneName:SCENES.wait});
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/broadcast/*',route=>route.fulfill({json:{selected:broadcast,options:[broadcast],phase:'live',obsConnected:true,ingestOwned:false,busy:false}}));
  await page.route('**/api/chat/*',async route=>{
    try{const action=route.request().method()==='POST';const value=action?control.action(route.request().postDataJSON()):route.request().url().endsWith('/overlay')?control.overlay():control.state();await route.fulfill({json:value});}
    catch(e){await route.fulfill({status:e.status||400,json:{error:e.message}});}
  });
  await page.goto(url+'/#programa');await page.waitForSelector('.comment-message');
  const left=await page.locator('.comments-column').boundingBox(),program=await page.locator('.program-card').boundingBox();assert(left.x+left.width<=program.x);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);note('Coluna de comentários fica à esquerda, sem cobrir a prévia');
  await page.locator('.comment-message').first().click();await page.waitForFunction(()=>document.querySelector('.comment-message[aria-pressed="true"]'));
  const overlay=await browser.newPage({viewport:{width:1920,height:1080}});await overlay.goto(local+'/comment-overlay.html');await overlay.waitForSelector('#comment:not([hidden])');
  assert.equal(await overlay.locator('#author').textContent(),'Maria da Conceição');assert((await overlay.locator('#message').textContent()).includes('🧠'));
  await overlay.screenshot({path:path.join(base,'evidencias/comentario-overlay.png'),omitBackground:true});
  await page.screenshot({path:path.join(base,'evidencias/painel-comentarios.png')});note('Clique no comentário exibe nome, mensagem, acentos e emoji no overlay');
  async function pinkPixels(){const image=await obs.call('GetSourceScreenshot',{sourceName:inputName,imageFormat:'png',imageWidth:1280});return page.evaluate(data=>new Promise(resolve=>{const img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const c=canvas.getContext('2d');c.drawImage(img,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>200&&pixels[i+1]>40&&pixels[i+1]<120&&pixels[i+2]>60&&pixels[i+2]<150)count++;resolve(count);};img.src=data;}),image.imageData);}
  for(let n=0;n<25;n++){report.nativePinkPixels=await pinkPixels();if(report.nativePinkPixels>1500)break;await page.waitForTimeout(500);}
  assert(report.nativePinkPixels>1500,'O destaque não chegou ao navegador nativo do OBS.');
  await obs.call('SetCurrentProgramScene',{sceneName:SCENES.duo});await page.waitForTimeout(1100);
  const capture=await obs.call('GetSourceScreenshot',{sourceName:SCENES.duo,imageFormat:'png',imageWidth:1280});fs.writeFileSync(path.join(base,'evidencias/comentario-no-obs.png'),Buffer.from(capture.imageData.split(',')[1],'base64'));note('Comentário renderizado pelo OBS e preservado na troca para Entrevista');
  await page.locator('#comments-hide').click();await page.waitForFunction(()=>document.querySelector('#comments-hide').disabled);
  await overlay.waitForFunction(()=>document.querySelector('#comment').hidden);
  for(let n=0;n<20&&await pinkPixels()>100;n++)await page.waitForTimeout(400);assert.equal(await pinkPixels(),0);note('Retirar da tela remove o comentário também do OBS');
  await page.locator('#comments-search').fill('segurança');assert.equal(await page.locator('.comment-message').count(),1);await page.locator('.comment-message').click();
  await overlay.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('<img'));assert.equal(await overlay.evaluate(()=>window.__xss),undefined);assert.equal(await overlay.locator('#message img').count(),0);note('Busca funciona e conteúdo do chat é exibido como texto seguro');
  await page.locator('#comments-hide').click();await page.locator('#comments-search').fill('');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('#sand-chat').click();await page.waitForSelector('.comments-open');
  await page.waitForFunction(()=>document.getElementById('comments-column').getBoundingClientRect().x>=0);
  const mobile=await page.locator('.comments-column').boundingBox();assert(mobile.x>=0&&mobile.x+mobile.width<=390);await page.screenshot({path:path.join(base,'evidencias/painel-comentarios-celular.png')});await page.keyboard.press('Escape');assert.equal(await page.locator('#comments-toggle').getAttribute('aria-expanded'),'false');note('Comentários acessíveis no celular, com fechamento por Escape e sem rolagem horizontal');
  await page.setViewportSize({width:1440,height:1050});await page.goto(url+'/#estudio');await page.waitForSelector('.comments-column');assert.equal(await page.locator('.comments-column').isVisible(),true);note('Coluna continua disponível na página da sala e dos convidados');
  assert.deepEqual(errors,[]);assert.equal((await obs.call('GetStreamStatus')).outputActive,false);report.passed=true;note('Interface sem erros de JavaScript e nenhuma transmissão pública iniciada');
}catch(e){report.passed=false;report.error=String(e);console.log(report.error);process.exitCode=1;}
finally{
  control.action({action:'hide'});control.close();
  if(settings)await obs.call('SetInputSettings',{inputName,inputSettings:settings,overlay:false}).catch(()=>{});
  if(oldScene)await obs.call('SetCurrentProgramScene',{sceneName:oldScene}).catch(()=>{});
  await obs.disconnect();await browser.close();harness.closeAllConnections();await new Promise(r=>harness.close(r));
  fs.writeFileSync(path.join(base,'evidencias/verificacao-comentarios.json'),JSON.stringify(report,null,2),'utf8');
}

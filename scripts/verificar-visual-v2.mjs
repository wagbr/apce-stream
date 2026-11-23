import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import OBSWebSocket from 'obs-websocket-js';
import {SCENES} from '../studio.mjs';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url))),url='http://127.0.0.1:3210';
const cfg=JSON.parse(fs.readFileSync(path.join(base,'private/studio.json'),'utf8'));
const report={checks:[],date:new Date().toISOString()};
const note=text=>{report.checks.push(text);console.log('OK:',text);};
const browser=await chromium.launch({channel:'msedge',headless:true}),obs=new OBSWebSocket();
let originalScene;
try{
  await obs.connect('ws://127.0.0.1:'+cfg.obsPort,cfg.obsPassword);
  originalScene=(await obs.call('GetCurrentProgramScene')).currentProgramSceneName;
  assert.equal((await obs.call('GetStreamStatus')).outputActive,false,'Uma live está ativa. Teste de cenas cancelado.');
  assert.equal((await obs.call('GetRecordStatus')).outputActive,false,'Uma gravação está ativa. Teste de cenas cancelado.');
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(url+'/'))failed.push({path:new URL(r.url()).pathname,status:r.status()});});
  await page.goto(url);await page.waitForSelector('.scene');assert.equal(await page.locator('.scene').count(),7);
  assert.match(await page.title(),/Ideias em órbita/);note('Novo HUD carregado com sete miniaturas');
  const countBefore=(await obs.call('GetInputList')).inputs.length;
  const sources=(await obs.call('GetInputList')).inputs.filter(i=>/^APCE · (Fundo|Legendas) /.test(i.inputName));
  for(const input of sources){const s=await obs.call('GetInputSettings',{inputName:input.inputName});assert(new URL(s.inputSettings.url).pathname==='/overlay-v2.html');}note('Dez fontes visuais do OBS usam os novos overlays');
  await page.getByRole('button',{name:'03 Entrevista',exact:true}).click();assert.equal((await obs.call('GetCurrentProgramScene')).currentProgramSceneName,SCENES.duo);
  await page.keyboard.press('3');await page.waitForTimeout(700);assert.equal((await obs.call('GetCurrentProgramScene')).currentProgramSceneName,SCENES.solo);
  const input=page.locator('input[name=host]');await input.focus();await page.keyboard.press('7');assert.equal((await obs.call('GetCurrentProgramScene')).currentProgramSceneName,SCENES.solo);await input.fill(cfg.labels.host||'');await input.blur();note('Troca por miniatura e teclado; atalhos suspensos nos campos');
  await page.getByRole('button',{name:/YouTube/}).click();assert(await page.locator('dialog').isVisible());await page.keyboard.press('4');assert.equal((await obs.call('GetCurrentProgramScene')).currentProgramSceneName,SCENES.solo);await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').isVisible(),false);note('Ajuda acessível; modal não aciona atalhos de cena');
  await page.getByRole('button',{name:'00 Preparação',exact:true}).click();await page.waitForTimeout(3000);
  const layouts=[[1920,1080,'amplo'],[1440,1050,'desktop'],[1024,900,'tablet'],[768,1000,'compacto'],[375,900,'celular'],[320,900,'dock']];
  for(const [width,height,name] of layouts){await page.setViewportSize({width,height});await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Rolagem horizontal em ${width}px`);await page.screenshot({path:path.join(base,'evidencias',`painel-orbital-v2-${name}.png`),fullPage:true});}note('Layout sem rolagem horizontal de 320 a 1920 px');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');note('Preferência por movimento reduzido respeitada');
  await page.setViewportSize({width:1920,height:1080});
  for(const mode of ['wait','solo','duo','room','media','end']){await page.goto(`${url}/overlay-v2.html?mode=${mode}&layer=back`);await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight].join('x')),'1920x1080');await page.screenshot({path:path.join(base,'evidencias',`cena-orbital-v2-${mode}.png`)});}
  await page.goto(url+'/overlay-v2.html?mode=duo&layer=front');assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');note('Seis cenas renderizadas em 1080p e tarjas com fundo transparente');
  assert.equal((await obs.call('GetInputList')).inputs.length,countBefore);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);note('Sem erros JavaScript, assets ausentes ou fontes extras no OBS');
  const png=await obs.call('GetSourceScreenshot',{sourceName:SCENES.wait,imageFormat:'jpg',imageWidth:1280,imageCompressionQuality:85});fs.writeFileSync(path.join(base,'evidencias/obs-orbital-v2.jpg'),Buffer.from(png.imageData.split(',')[1],'base64'));
  report.passed=true;
}catch(e){report.passed=false;report.error=e.message;console.log('FALHA:',e.message);process.exitCode=1;}
finally{try{if(originalScene)await obs.call('SetCurrentProgramScene',{sceneName:originalScene});await obs.disconnect();}catch{}await browser.close();fs.writeFileSync(path.join(base,'evidencias/verificacao-visual-v2.json'),JSON.stringify(report,null,2),'utf8');}

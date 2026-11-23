import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url))),root='http://127.0.0.1:3210';
const browser=await chromium.launch({channel:'msedge',headless:true});const checks=[],errors=[],writes=[];
const event={id:'apceLive001',title:'Live simulada · teste da interface',privacy:'private',scheduledStartTime:'2026-11-21T21:30:00Z',lifeCycleStatus:'ready'};
let control={busy:false,phase:'idle',error:'',selected:null,options:[event],ingestOwned:false,obsConnected:true};
try{
  const page=await browser.newPage({viewport:{width:1536,height:1050}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/broadcast/**',async route=>{
    if(route.request().method()==='POST'){
      const d=route.request().postDataJSON();writes.push(d.action);
      if(d.action==='select')control={...control,selected:{...event}};
      if(d.action==='start')control={...control,selected:{...event,lifeCycleStatus:'live'},phase:'live',ingestOwned:true};
      if(d.action==='stop')control={...control,selected:{...event,lifeCycleStatus:'complete'},phase:'complete',ingestOwned:false};
    }
    await route.fulfill({json:control});
  });
  await page.goto(root);await page.waitForSelector('body[data-sand-ready=true]');await page.locator('#sand-event').click();await page.locator('#broadcast-select').waitFor();assert(await page.locator('#broadcast-start').isDisabled());
  await page.locator('#broadcast-select').selectOption(event.id);await page.waitForFunction(()=>!document.querySelector('#broadcast-start').disabled);await page.locator('#sand-panel-close').click();
  await page.locator('#broadcast-start').click();assert(await page.locator('#broadcast-confirm').isVisible());assert.match(await page.locator('#broadcast-confirm-event').textContent(),/Privada/);assert(!writes.includes('start'));
  await page.locator('#broadcast-confirm-go').click();await page.waitForFunction(()=>document.querySelector('#broadcast-badge').textContent==='Ao vivo');checks.push('Seleção, confirmação com título e privacidade e início pelo painel');
  await page.locator('#broadcast-stop').click();assert.equal(writes.filter(x=>x==='stop').length,0);await page.locator('#broadcast-confirm-go').click();await page.waitForFunction(()=>document.querySelector('#broadcast-message').textContent.includes('encerrada'));assert.equal(writes.filter(x=>x==='start').length,1);assert.equal(writes.filter(x=>x==='stop').length,1);checks.push('Encerramento exige comando explícito e atualiza estado confirmado');
  await page.screenshot({path:path.join(base,'evidencias/controles-transmissao.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks.push('Painel de transmissão sem rolagem horizontal no celular');
  const stage=await browser.newPage({viewport:{width:1792,height:816}});
  const participants=Array.from({length:12},(_,i)=>({id:'testcam'+i,label:i===0?'Apresentador':'Convidado '+i,muted:i===11,url:'https://vdo.ninja/?view=testcam'+i}));
  const mixUrl='https://vdo.ninja/?'+new URLSearchParams({view:participants.map(p=>p.id).join(','),scene:''});
  await stage.route('**/api/room/stage',route=>route.fulfill({json:{participants,mixUrl,capacity:12}}));
  const fakeMixer=`<body style="margin:0;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);height:100vh;color:#e6d3cb;background:#3b3c46;font:24px Arial">${participants.map(p=>'<div class="tile" style="border:2px solid #ef4d63;display:grid;place-content:center">'+p.label+'</div>').join('')}<script>window.commands=[];addEventListener('message',e=>{commands.push(e.data);if(e.data.getDetailedState)parent.postMessage({cib:e.data.cib,detailedState:Object.fromEntries(new URL(location).searchParams.get('view').split(',').map(id=>[id,{streamID:id,localStream:false}]))},e.origin)})<\/script>`;
  await stage.route('https://vdo.ninja/**',route=>route.fulfill({contentType:'text/html',body:fakeMixer}));
  await stage.goto(root+'/stage.html');await stage.waitForFunction(()=>document.querySelector('#stage iframe')?.style.opacity==='1');
  await stage.waitForTimeout(400);assert.equal(await stage.locator('#stage iframe').count(),1);
  const mixer=stage.frames().find(f=>f.url().startsWith('https://vdo.ninja/'));assert.equal(await mixer.locator('.tile').count(),12);
  assert(await mixer.evaluate(()=>[...document.querySelectorAll('.tile')].every(t=>{const b=t.getBoundingClientRect();return b.left>=0&&b.top>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1;})));
  assert(await mixer.evaluate(()=>commands.some(c=>c.target==='testcam11'&&c.volume===0)&&commands.some(c=>c.target==='testcam0'&&c.volume===1)));checks.push('Um receptor exibe 12 posições e aplica o silêncio por participante');
  await stage.screenshot({path:path.join(base,'evidencias/grade-12-interface.png')});
  assert.deepEqual(errors,[]);checks.push('Interface sem erros de JavaScript');
  fs.writeFileSync(path.join(base,'evidencias/verificacao-controles-ui.json'),JSON.stringify({passed:true,mockedBroadcastWrites:true,publicStreamStarted:false,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser.close();}

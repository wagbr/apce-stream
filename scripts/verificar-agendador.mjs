import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const base=path.resolve('.'),url='http://127.0.0.1:3210',checks=[],errors=[];
const mark=(name,details)=>checks.push({name,passed:true,...(details?{details}:{})});
const realState=await (await fetch(url+'/api/youtube/state')).json();
assert.equal(typeof realState.clientConfigured,'boolean'); // Não substitui credenciais reais; a interface usa rotas simuladas abaixo.
const scheduleDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.now()+2*86400000),scheduledLocal=scheduleDay+'T18:30',scheduledISO=new Date(scheduledLocal+'-03:00').toISOString();
assert.equal((await fetch(url+'/api/youtube/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
assert.equal((await fetch(url+'/api/youtube/connect',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:'{}'})).status,403);
assert.equal((await fetch(url+'/private/youtube/connection.dpapi')).status,404);
const invalid=await fetch(url+'/api/youtube/callback?code=forged&state=forged',{redirect:'manual'});assert.equal(invalid.status,303);assert.equal(invalid.headers.get('location'),url+'/?youtube=error#agendador');
mark('Servidor restringe escrita à origem local e não expõe credenciais');
const protectedRoundTrip=await new Promise((resolve,reject)=>{
  const run=(operation,value)=>new Promise((ok,no)=>{const p=spawn('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(base,'scripts/dpapi.ps1')],{windowsHide:true});let out='',err='';p.stdout.on('data',d=>out+=d.toString('utf8'));p.stderr.on('data',d=>err+=d.toString('utf8'));p.on('error',no);p.on('exit',code=>code===0?ok(out):no(Error(err)));p.stdin.end(JSON.stringify({operation,value}));});
  const message='APCE · ciência, razão e ação — çãõ';run('protect',message).then(async encrypted=>{assert.ok(!encrypted.includes('APCE'));assert.equal(await run('unprotect',encrypted),message);resolve(true);}).catch(reject);
});assert.ok(protectedRoundTrip);mark('DPAPI real do Windows preserva UTF-8 no armazenamento protegido');

const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1100},locale:'pt-BR',timezoneId:'Asia/Tokyo'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const openForm=async()=>{await page.locator('#sand-new-live').waitFor();await page.locator('#sand-new-live').click();};
  await page.route('**/api/youtube/state',route=>route.fulfill({json:{clientConfigured:true,clientType:'broker',centralAuth:true,connected:false,error:'',events:[],upcoming:[]}}));
  await page.goto(url+'/#agendador');await page.locator('#scheduler-connection-text').filter({hasText:'Conecte'}).waitFor();
  await assert.equal(await page.locator('#schedule-submit').isDisabled(),true);await page.locator('#scheduler-settings').click();await page.locator('#scheduler-setup[open]').waitFor();assert.equal(await page.locator('#scheduler-login').isDisabled(),false);assert.equal(await page.locator('#scheduler-oauth-file').isVisible(),false);await page.screenshot({path:'evidencias/agendador-conexao.png',fullPage:true});await page.locator('#scheduler-close').click();
  mark('Sem autorização, oferece login Google sem JSON e impede agendamento');
  await page.unroute('**/api/youtube/state');

  let calls=[],events=[],upcoming=[],connected=true,phase='complete',defer=0;
  await page.route('**/api/youtube/**',async route=>{
    const u=new URL(route.request().url()),data=route.request().method()==='POST'?route.request().postDataJSON():{};const endpoint=u.pathname.split('/').at(-1);calls.push({endpoint,data});
    let body={};
    if(endpoint==='state')body={clientConfigured:true,clientType:'broker',centralAuth:true,connected,account:connected?{id:'UC_APCE_TEST',title:'APCE · ambiente de teste local',handle:'@apcedf'}:null,error:'',events,upcoming};
    else if(endpoint==='refresh')body={upcoming};
    else if(endpoint==='schedule'){
      await new Promise(r=>setTimeout(r,defer));
      body={requestId:data.requestId,id:'apceLive001',title:data.title,scheduledStartTime:scheduledISO,privacy:data.privacy,phase,error:phase==='complete'?'':'Falha simulada no envio da thumb.',url:'https://www.youtube.com/watch?v=apceLive001',studioUrl:'https://studio.youtube.com/video/apceLive001/livestreaming'};events=[body];
    }else if(endpoint==='retry'){body={...events[0],phase:'complete',error:''};events=[body];}
    else if(endpoint==='thumbnail'){await route.fulfill({status:200,contentType:'image/png',body:fs.readFileSync('public/assets/orbital-v2/orbital-hero-v2.png')});return;}
    else throw Error('Rota inesperada no teste: '+endpoint);
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.reload();await openForm();await page.locator('#schedule-submit:not([disabled])').waitFor();
  assert.equal(await page.getByLabel('Não, não é feita para crianças',{exact:true}).isChecked(),true);
  assert.match(await page.locator('#schedule-interaction-hint').textContent(),/ativado por padrão/);
  await page.locator('#schedule-privacy').selectOption('private');assert.match(await page.locator('#schedule-interaction-hint').textContent(),/Não listada/);
  await page.getByLabel('Sim, é feita para crianças',{exact:true}).check();assert.match(await page.locator('#schedule-interaction-hint').textContent(),/desativa chat/);
  await page.getByLabel('Não, não é feita para crianças',{exact:true}).check();await page.locator('#schedule-privacy').selectOption('public');
  mark('Chat padrão e avisos de privacidade e audiência aparecem antes do agendamento');
  await page.locator('#schedule-submit').click();assert.equal(calls.filter(c=>c.endpoint==='schedule').length,0);
  await page.locator('#schedule-title').fill('Prévia do agendador · teste local');await page.locator('#schedule-description').fill('Ciência, laicidade e boas conversas.\nEste é um ensaio local da interface; nenhum evento será publicado.');await page.locator('#schedule-start').fill(scheduledLocal);await page.getByLabel('Não, não é feita para crianças',{exact:true}).check();
  await page.locator('#schedule-thumb').setInputFiles('public/assets/orbital-v2/orbital-hero-v2.png');await page.locator('#thumb-filename').filter({hasText:'orbital-hero-v2.png'}).waitFor();
  assert.match(await page.locator('#schedule-preview-date').textContent(),/18:30.*Brasília/);assert.equal(await page.locator('#schedule-preview-title').textContent(),'Prévia do agendador · teste local');assert.equal(await page.locator('#schedule-thumb-preview').isVisible(),true);await page.waitForTimeout(500);
  await page.reload();await openForm();await page.locator('#schedule-title').filter({visible:true}).waitFor();assert.equal(await page.locator('#schedule-title').inputValue(),'Prévia do agendador · teste local');await page.locator('#schedule-thumb-preview:not([hidden])').waitFor();
  mark('Valida campos obrigatórios e restaura texto, audiência, horário e thumb do rascunho');

  const screenshots=[];for(const width of [320,375,768,1280,1920]){await page.setViewportSize({width,height:1050});await page.waitForTimeout(50);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${width}`);if([375,1920].includes(width)){const name=`evidencias/agendador-${width}.png`;await page.screenshot({path:name,fullPage:true});screenshots.push(name);}}
  await page.setViewportSize({width:1440,height:1100});await page.locator('body').click({position:{x:900,y:100}});await page.keyboard.press('3');assert.equal(calls.filter(c=>c.endpoint==='schedule').length,0);mark('Layout de 320 a 1920 px sem rolagem horizontal; atalhos de cena suspensos na agenda',screenshots);

  defer=500;await page.evaluate(()=>{const f=document.getElementById('schedule-form');f.requestSubmit();f.requestSubmit();});await page.locator('#schedule-submit[aria-busy=true]').waitFor();assert.equal(await page.locator('#schedule-title').isDisabled(),true);await page.locator('#schedule-result h3').filter({hasText:'Encontro marcado.'}).waitFor();assert.equal(calls.filter(c=>c.endpoint==='schedule').length,1);const payload=calls.find(c=>c.endpoint==='schedule').data;assert.equal(payload.startLocal,scheduledLocal);assert.equal(payload.madeForKids,false);assert.equal(payload.privacy,'public');assert.equal(payload.thumbnail.type,'image/png');assert.ok(payload.thumbnail.data.length>1000);assert.equal(await page.locator('#schedule-title').inputValue(),'Prévia do agendador · teste local');assert.equal(await page.locator('#schedule-events h3').count(),1);
  await page.reload();await openForm();await page.locator('#schedule-result h3').filter({hasText:'Encontro marcado.'}).waitFor();assert.equal(await page.locator('#schedule-title').inputValue(),'Prévia do agendador · teste local');mark('Envio único, retorno do link, dados mantidos após conclusão e recarga');

  phase='thumbnail_failed';defer=0;await page.locator('#schedule-title').fill('Falha simulada de thumbnail · teste local');await page.locator('#schedule-submit').click();await page.locator('#schedule-result h3').filter({hasText:'thumb pendente'}).waitFor();const before=calls.filter(c=>c.endpoint==='schedule').length;await page.locator('#schedule-result button').click();await page.locator('#schedule-result h3').filter({hasText:'Encontro marcado.'}).waitFor();assert.equal(calls.filter(c=>c.endpoint==='schedule').length,before);assert.equal(calls.filter(c=>c.endpoint==='retry').length,1);mark('Falha parcial aparece como pendente e o botão reenvia somente a thumb');
  await page.getByRole('button',{name:'Agendar outra live',exact:true}).click();assert.equal(await page.locator('#schedule-title').inputValue(),'');assert.equal(await page.locator('#schedule-thumb-placeholder').isVisible(),true);await page.locator('#sand-panel-close').click();await page.locator('#scheduler-settings').click();await page.screenshot({path:'evidencias/agendador-configuracao.png',fullPage:true});await page.locator('#scheduler-close').click();await page.locator('.scheduler-back').click();assert.equal(await page.locator('.workspace-grid').isVisible(),true);assert.equal(await page.locator('#agendador').isVisible(),false);assert.equal(await page.locator('#scenes button').count(),7);mark('Navegação devolve o estúdio com suas sete cenas');
  assert.deepEqual(errors,[]);mark('Nenhum erro JavaScript');await context.close();
}finally{await browser.close();}
fs.writeFileSync('evidencias/verificacao-agendador.json',JSON.stringify({at:new Date().toISOString(),mode:'Google simulado; nenhuma live real criada',passed:true,checks},null,2),'utf8');
console.log(JSON.stringify({passed:true,checks:checks.map(c=>c.name)},null,2));

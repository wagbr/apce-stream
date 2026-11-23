import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {SCENES} from '../studio.mjs';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url))),url='http://127.0.0.1:3210';
const report={date:new Date().toISOString(),simulatedWrites:true,checks:[]},calls=[];
const note=s=>{report.checks.push(s);console.log('OK:',s);};
const browser=await chromium.launch({channel:'msedge',headless:true});
const state={connected:true,currentScene:SCENES.wait,scenes:SCENES,labels:{host:'Apresentador',guest:'Convidado',topic:''},afterIntro:SCENES.duo,hostMuted:false,guestMuted:false,recording:false,streaming:false,youtube:{schedulerConnected:true,accountName:'APCE'},links:{host:'https://example.invalid/host',guest:'https://example.invalid/guest',invite:'https://example.invalid/invite',director:'https://example.invalid/director',monitor:'https://example.invalid/return'}};
const event={id:'apceLive001',title:'Ensaio local da interface',privacy:'private',lifeCycleStatus:'ready',scheduledStartTime:''};
const broadcast={selected:null,options:[event],phase:'idle',busy:false,obsConnected:true,ingestOwned:false,error:''};
const comments={broadcast:event,status:'connected',error:'',messages:[{id:'comment-local',author:'Equipe APCE',text:'Ensaio local de comentários.',avatar:''}],selected:null,revision:0};
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const wallpaper=fs.readFileSync(path.join(base,'public/assets/wallpaper-apce.png'));
  assert.equal(crypto.createHash('sha256').update(wallpaper).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync(path.join(base,'../Identidade Visual APCE/Assets/Wallpaper APCE.png'))).digest('hex'));note('Wallpaper original copiado sem alterações');
  await context.route('**/api/**',async route=>{
    const req=route.request(),u=new URL(req.url()),post=req.method()==='POST',d=post?req.postDataJSON():{},p=u.pathname;let value={};
    if(post)calls.push({route:p,...d});
    if(p==='/api/state')value=state;
    else if(p==='/api/preview')value={image:'data:image/png;base64,'+wallpaper.toString('base64')};
    else if(p==='/api/broadcast/state')value=broadcast;
    else if(p==='/api/broadcast/action'){
      if(d.action==='select')broadcast.selected={...event};
      if(d.action==='start'){broadcast.selected.lifeCycleStatus='live';broadcast.phase='live';state.streaming=true;}
      if(d.action==='stop'){broadcast.selected.lifeCycleStatus='complete';broadcast.phase='complete';state.streaming=false;}
      value=broadcast;
    }else if(p==='/api/chat/state')value=comments;
    else if(p==='/api/chat/overlay')value={selected:comments.selected};
    else if(p==='/api/chat/action'){comments.selected=d.action==='show'?comments.messages[0]:null;comments.revision++;value=comments;}
    else if(p==='/api/youtube/state')value={connected:true,clientConfigured:true,clientType:'web',account:{title:'APCE'},events:[],upcoming:[],oauth:{origin:url,webRedirectUri:url+'/api/youtube/callback'}};
    else if(p==='/api/youtube/refresh')value={upcoming:[]};
    else if(p==='/api/media/state')value={items:[],program:{connected:true,visible:false}};
    else if(p==='/api/room/state')value={stage:[],guests:[],online:false,capacity:12,links:state.links};
    else if(p==='/api/room/return')value={running:d.action==='start',status:''};
    else if(p==='/api/action'){
      if(d.action==='labels'){for(const key of ['host','guest','topic'])state.labels[key]=d[key];state.afterIntro=d.afterIntro;}
      if(d.action==='mute')state[d.input+'Muted']=!state[d.input+'Muted'];
      if(d.action==='scene')state.currentScene=d.scene;
      if(d.action==='record')state.recording=!state.recording;
      value={ok:true};
    }else if(post)throw Error('Escrita de teste inesperada: '+p);
    await route.fulfill({json:value});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForSelector('body[data-sand-ready=true]');await page.waitForSelector('.scene');
  assert.equal(await page.locator('form:visible').count(),0);assert.equal(await page.locator('select:visible').count(),0);
  const commentsBox=await page.locator('.comments-column').boundingBox(),program=await page.locator('.program-card').boundingBox();assert(commentsBox.x+commentsBox.width<program.x);note('Mesa inicial sem formulários abertos e comentários à esquerda');
  await page.screenshot({path:path.join(base,'evidencias/painel-areia-desktop.png')});
  await page.getByRole('button',{name:'Identificação',exact:true}).click();await page.waitForSelector('#studio-panel[open]');
  await page.locator('#labels [name=host]').fill('Apresentador de teste');
  const before=await page.locator('#studio-panel').boundingBox(),header=await page.locator('#sand-panel-handle').boundingBox();
  await page.mouse.move(header.x+130,header.y+25);await page.mouse.down();await page.mouse.move(header.x-80,header.y+80,{steps:8});await page.mouse.up();
  const after=await page.locator('#studio-panel').boundingBox();assert(Math.abs(after.x-before.x)>100);note('Painel pode ser arrastado e permanece dentro da janela');
  await page.locator('#sand-panel-handle').focus();await page.keyboard.press('Home');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:'Identificação',exact:true}).click();
  assert.equal(await page.locator('#labels [name=host]').inputValue(),'Apresentador de teste');
  await page.screenshot({path:path.join(base,'evidencias/painel-areia-identificacao.png')});
  await page.locator('#labels [type=submit]').click();await page.waitForFunction(()=>document.getElementById('toast-message').textContent.includes('Assinatura atualizada'));assert(calls.some(c=>c.action==='labels'&&c.host==='Apresentador de teste'));await page.locator('#sand-panel-close').click();note('Campos preservados ao fechar e reabrir; atualização continua ligada ao comando original');
  await page.locator('#sand-event').click();await page.locator('#broadcast-select').selectOption(event.id);await page.waitForFunction(()=>document.getElementById('sand-event-title').textContent==='Ensaio local da interface');await page.locator('#sand-panel-close').click();
  await page.locator('#broadcast-start').click();await page.waitForSelector('#broadcast-confirm[open]');assert((await page.locator('#broadcast-confirm-event').textContent()).includes(event.title));await page.locator('#broadcast-confirm-go').click();await page.waitForFunction(()=>document.getElementById('broadcast-badge').textContent==='Ao vivo');
  await page.locator('#broadcast-stop').click();await page.locator('#broadcast-confirm-go').click();await page.waitForFunction(()=>document.getElementById('broadcast-start').disabled);assert(calls.some(c=>c.action==='start'&&c.route==='/api/broadcast/action'));assert(calls.some(c=>c.action==='stop'&&c.route==='/api/broadcast/action'));note('Início e fim continuam acessíveis na mesa, com confirmação e pedidos simulados');
  await page.locator('#host-mute').click();await page.waitForFunction(()=>document.getElementById('host-mute').getAttribute('aria-pressed')==='true');assert(calls.some(c=>c.action==='mute'&&c.input==='host'));await page.locator('#host-mute').click();
  await page.locator('.scene[data-layout=duo]').click();await page.waitForFunction(()=>document.querySelector('.scene[data-layout=duo]').getAttribute('aria-pressed')==='true');note('Microfones e cenas continuam operacionais');
  await page.locator('.sand-nav a[href="#agendador"]').click();await page.waitForSelector('#agendador:visible');assert.equal(await page.locator('#schedule-form').isVisible(),false);await page.locator('#sand-new-live').click();await page.locator('#schedule-title').fill('Rascunho de ensaio local');
  for(const id of ['schedule-title','schedule-description','schedule-start','schedule-privacy']){const colors=await page.locator('#'+id).evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}));assert(+colors.background.match(/\d+/)[0]>220,id+' precisa de fundo claro');assert(+colors.color.match(/\d+/)[0]<100,id+' precisa de texto grafite');}
  await page.screenshot({path:path.join(base,'evidencias/painel-areia-agendamento.png')});await page.keyboard.press('Escape');await page.locator('#sand-new-live').click();assert.equal(await page.locator('#schedule-title').inputValue(),'Rascunho de ensaio local');await page.keyboard.press('Escape');assert(!calls.some(c=>c.route==='/api/youtube/schedule'));note('Agenda mostra os eventos; formulário claro abre por Nova transmissão e preserva o rascunho');
  await page.locator('.sand-nav a[href="#biblioteca"]').click();await page.waitForSelector('#biblioteca:visible');assert.equal(await page.locator('#library-drop').isVisible(),false);await page.locator('#sand-upload').click();assert(await page.locator('#library-drop').isVisible());await page.screenshot({path:path.join(base,'evidencias/painel-areia-midias.png')});await page.keyboard.press('Escape');note('Importação de arquivos fica em painel próprio');
  await page.locator('.sand-nav a[href="#estudio"]').click();await page.getByRole('button',{name:'Retorno do estúdio',exact:true}).click();assert(await page.locator('#room-return-start').isVisible());await page.keyboard.press('Escape');assert.equal(await page.locator('#room-return-start').isVisible(),false);note('Retorno privado acessível sem ocupar a página dos convidados');
  for(const width of [1920,1440,1100,1024,900,768,550,390,375]){
    await page.setViewportSize({width,height:width<600?844:1000});await page.locator('.sand-nav a[href="#programa"]').click();await page.waitForTimeout(80);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Rolagem horizontal em '+width);
  }note('Layout conferido de 375 a 1920 pixels, sem rolagem horizontal');
  await page.getByRole('button',{name:'Identificação',exact:true}).click();assert.equal(await page.locator('#studio-panel').evaluate(e=>e.matches(':modal')),true);await page.screenshot({path:path.join(base,'evidencias/painel-areia-celular-formulario.png')});await page.keyboard.press('Escape');
  await page.locator('#sand-chat').click();await page.waitForSelector('.comments-open');await page.screenshot({path:path.join(base,'evidencias/painel-areia-celular-comentarios.png')});await page.locator('#comments-close').click();await page.locator('.comments-column').waitFor({state:'hidden'});
  await page.screenshot({path:path.join(base,'evidencias/painel-areia-celular.png')});note('No celular, painéis abrem como folhas modais e comentários pelo botão do cabeçalho');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#sand-settings').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');assert.deepEqual(errors,[]);note('Movimento reduzido respeitado e interface sem erros JavaScript');
  report.passed=true;report.simulatedActions=calls.map(c=>({route:c.route,action:c.action}));
}catch(e){report.passed=false;report.error=String(e);console.log(report.error);process.exitCode=1;}
finally{await browser.close();fs.writeFileSync(path.join(base,'evidencias/verificacao-painel-areia.json'),JSON.stringify(report,null,2),'utf8');}

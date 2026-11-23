import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import OBSWebSocket from 'obs-websocket-js';
import {SCENES,names} from '../studio.mjs';
import crypto from 'node:crypto';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url))),url='http://127.0.0.1:3210';
if(!process.argv.includes('--autorizado'))throw Error('Use somente com autorização para testar links privados e dispositivos simulados.');
const cfg=JSON.parse(fs.readFileSync(path.join(base,'private/studio.json'),'utf8'));
const backupFile=path.join(base,'private/stage.json'),backup=fs.existsSync(backupFile)?fs.readFileSync(backupFile):null;
const report={date:new Date().toISOString(),publicStreamStarted:false,simulatedDevices:true,checks:[]},note=s=>{report.checks.push(s);console.log('OK:',s);};
const launchOptions={channel:'msedge',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required','--disable-background-media-suspend','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-features=WebRtcHideLocalIpsWithMdns']};
const browser=await chromium.launch(launchOptions),publisherBrowsers=[];
const obs=new OBSWebSocket();let panel,director,oldScene;
async function post(route,data){const res=await fetch(url+route,{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(data)});const value=await res.json();if(!res.ok)throw Error(value.error);return value;}
async function join(link){
  // Cada convidado representa um dispositivo independente, incluindo a câmera
  // simulada e o serviço de captura do navegador, não apenas os cookies.
  const publisher=await chromium.launch(launchOptions);publisherBrowsers.push(publisher);
  const context=await publisher.newContext({permissions:['camera','microphone'],viewport:{width:1000,height:750}}),p=await context.newPage();
  const u=new URL(link);u.searchParams.set('push','apcetest'+crypto.randomBytes(6).toString('hex'));u.searchParams.set('width','320');u.searchParams.set('height','180');u.searchParams.set('fps','10');u.searchParams.set('bitrate','150');
  if(!u.searchParams.get('label'))u.searchParams.set('label','Convidado simulado');
  await p.goto(u.toString(),{waitUntil:'domcontentloaded',timeout:60000});
  const choice=p.locator('#container-3');if(await choice.isVisible())await choice.click();
  await p.locator('#gowebcam').waitFor({state:'visible',timeout:30000});
  if(!u.searchParams.has('videodevice'))await p.locator('#videoSourceSelect').selectOption({label:'fake_device_0'});
  try{await p.waitForFunction(()=>!document.querySelector('#gowebcam')?.disabled,null,{timeout:30000});}catch(e){report.captureSetupFailure=true;await p.screenshot({path:path.join(base,'evidencias/falha-dispositivo-simulado.png')});throw e;}await p.locator('#gowebcam').evaluate(b=>b.click());
  return p;
}
async function approve(){
  for(let n=0;n<20;n++){
    const pending=await director.evaluate(()=>session.pendingJoinRequests?.length||0);
    if(pending){await director.evaluate(()=>{for(const m of document.querySelectorAll('.promptModal'))if(m.textContent.includes('approval')||m.textContent.includes('admitted'))m.querySelector('button[id^="submit_"]')?.click();for(const r of [...session.pendingJoinRequests])approveJoinRequest(r.UUID);});return;}
    await panel.waitForTimeout(500);
  }
}
try{
  await obs.connect('ws://127.0.0.1:'+cfg.obsPort,cfg.obsPassword);assert.equal((await obs.call('GetStreamStatus')).outputActive,false);assert.equal((await obs.call('GetRecordStatus')).outputActive,false);
  oldScene=(await obs.call('GetCurrentProgramScene')).currentProgramSceneName;
  for(const p of (await(await fetch(url+'/api/room/state')).json()).stage)await post('/api/room/action',{action:'remove',id:p.id});
  panel=await browser.newPage({viewport:{width:1600,height:1100}});const errors=[];panel.on('pageerror',e=>errors.push(e.message));
  await panel.goto(url+'/#estudio');await panel.locator('#room-open').click();
  for(let n=0;n<30;n++){director=panel.frames().find(f=>f.url().startsWith('https://vdo.ninja/'));if(director&&await director.evaluate(()=>typeof session!=='undefined'&&!!session.director).catch(()=>false))break;await panel.waitForTimeout(1000);}
  assert(director);await director.waitForFunction(()=>session.directorState===true,{timeout:20000});const admission=await director.evaluate(()=>({approval:session.requireServerApproval,cap:session.claimRoomCap,director:!!session.director,claimed:session.directorState}));report.admission=admission;assert(admission.approval);note('Direção integrada com aprovação de entrada e limite de sala configurado');
  await panel.locator('#room-invite').waitFor({state:'visible'});await panel.waitForFunction(()=>!document.querySelector('#room-invite').disabled,{timeout:20000});
  const links=(await(await fetch(url+'/api/room/state')).json()).links;
  const host=await join(links.host);await approve();
  await panel.waitForFunction(()=>document.querySelectorAll('.studio-person').length>=1,{timeout:30000});
  const hostId=await host.evaluate(()=>session.streamID);await post('/api/room/action',{action:'add',id:hostId});note('Apresentador aprovado e contado entre os lugares do estúdio');
  const guest=await join(links.invite);await approve();
  await panel.waitForFunction(()=>document.querySelectorAll('.studio-person').length>=2,{timeout:30000});
  await panel.getByRole('button',{name:'Adicionar ao estúdio',exact:true}).first().click();
  await panel.waitForFunction(()=>document.querySelector('#room-count').textContent.startsWith('2 /'),{timeout:15000});note('Convidado entrou pelo convite público e foi adicionado ao estúdio pelo painel');
  report.identities=await Promise.all([host,guest].map(p=>p.evaluate(expected=>({hostMatches:session.streamID===expected,streamIdLength:session.streamID?.length,videoCount:[...document.querySelectorAll('video')].filter(v=>v.videoWidth>0).length,connected:session.ws?.readyState}),cfg.host)));
  report.roster=await panel.evaluate(expected=>({count:document.querySelectorAll('.studio-person').length,hostPresent:document.querySelector('#room-count').textContent}),cfg.host);
  await obs.call('SetCurrentProgramScene',{sceneName:SCENES.room});
  const stage=await browser.newPage();await stage.goto(url+'/stage.html');await stage.waitForFunction(()=>document.querySelector('#stage iframe'));
  let decoded=false;
  for(let n=0;n<45;n++){const views=stage.frames().filter(f=>f.url().startsWith('https://vdo.ninja/'));const metrics=await Promise.all(views.map(f=>f.evaluate(()=>[...document.querySelectorAll('video')].filter(v=>v.videoWidth>0&&v.currentTime>1).length).catch(()=>0)));if(metrics.some(count=>count>=2)){decoded=true;break;}await panel.waitForTimeout(1000);}
  report.stageMetrics=await Promise.all(stage.frames().filter(f=>f.url().startsWith('https://vdo.ninja/')).map(f=>f.evaluate(()=>({videos:[...document.querySelectorAll('video')].map(v=>({width:v.videoWidth,height:v.videoHeight,time:v.currentTime})),peers:Object.keys(session.rpcs||{}).length})).catch(()=>null)));
  await stage.screenshot({path:path.join(base,'evidencias/sala-v2-grade.png')});
  assert(decoded,'As câmeras não chegaram à grade.');note('Grade da sala recebeu e decodificou as duas câmeras');
  const guestId=await guest.evaluate(()=>session.streamID),mixer=stage.frames().find(f=>f.url().startsWith('https://vdo.ninja/'));
  await post('/api/room/action',{action:'mute',id:guestId});
  await mixer.waitForFunction(id=>getDetailedState()[id]?.videoVolume===0,guestId,{timeout:15000});
  await post('/api/room/action',{action:'mute',id:guestId});
  await mixer.waitForFunction(id=>getDetailedState()[id]?.videoVolume===1,guestId,{timeout:15000});note('Silêncio por participante aplicado e desfeito no receptor do mosaico');
  for(let n=0;n<30;n++){
    const capture=await obs.call('GetSourceScreenshot',{sourceName:names.room,imageFormat:'png',imageWidth:640});
    report.nativeHalves=await panel.evaluate(data=>new Promise(resolve=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height).data;const counts=[0,0];for(let y=0;y<c.height;y++)for(let z=0;z<c.width;z++){const i=(y*c.width+z)*4;if(d[i+1]>45&&d[i+1]>d[i]*1.6&&d[i+1]>d[i+2]*1.6)counts[z<c.width/2?0:1]++;}resolve(counts.map(v=>v/(c.width*c.height/2)));};img.src=data;}),capture.imageData);
    if(report.nativeHalves.every(v=>v>.25))break;await panel.waitForTimeout(1000);
  }
  assert(report.nativeHalves.every(v=>v>.25),'Uma câmera ainda não chegou à composição nativa do OBS.');note('As duas imagens chegaram à cena nativa do OBS, conferidas por pixels');
  const returned=async p=>p.evaluate(()=>[...document.querySelectorAll('video')].filter(v=>v.id!=='previewWebcam'&&v.srcObject&&v.videoWidth>=600&&v.currentTime>1).length);
  const releaseReturn=p=>p.evaluate(()=>{for(const v of document.querySelectorAll('video'))if(v.videoWidth>=600&&v.id!=='videosource'){v.pause();v.srcObject=null;}});
  for(let n=0;n<30&&!await returned(guest);n++)await panel.waitForTimeout(1000);
  report.guestReturnVideos=await returned(guest);report.guestMetrics=await guest.evaluate(()=>[...document.querySelectorAll('video')].map(v=>({id:v.id,width:v.videoWidth,height:v.videoHeight,time:v.currentTime,tracks:v.srcObject?.getTracks().map(t=>t.kind)})));
  assert(report.guestReturnVideos>0,'O convidado não recebeu o retorno do programa.');note('Convidado recebeu o vídeo do estúdio enquanto participava da sala');
  if(process.argv.includes('--12')){
    await stage.close();
    await releaseReturn(host);await releaseReturn(guest);
    const extras=[];report.extraReturns=[];report.twelveMode=process.argv.includes('--audio-guests')?'2 câmeras e 10 convidados de áudio':'12 câmeras';
    for(let i=0;i<10;i++){
      const link=new URL(links.invite);link.searchParams.set('label','Teste '+String(i+3).padStart(2,'0'));
      if(process.argv.includes('--audio-guests'))link.searchParams.set('videodevice','0');
      const page=await join(link.toString());await approve();const id=await page.evaluate(()=>session.streamID);extras.push(page);
      for(let n=0;n<60;n++){await director.evaluate(()=>{for(const r of [...(session.pendingJoinRequests||[])])approveJoinRequest(r.UUID);});await panel.evaluate(()=>document.querySelector('#room-director iframe').contentWindow.postMessage({getDetailedState:true,cib:'apce-roster'},'https://vdo.ninja'));const room=await(await fetch(url+'/api/room/state')).json();if(room.guests.some(g=>g.id===id))break;await panel.waitForTimeout(500);}
      try{await post('/api/room/action',{action:'add',id});}catch(e){const room=await(await fetch(url+'/api/room/state')).json();report.failedJoin={attempt:i+3,online:room.online,heartbeatAge:Date.now()-room.lastSeen,guests:room.guests.length,listed:room.guests.some(p=>p.id===id)};await page.screenshot({path:path.join(base,'evidencias/entrada-nao-concluida.png')});throw e;}
      for(let n=0;n<30&&!await returned(page);n++)await panel.waitForTimeout(500);
      report.extraReturns.push(await returned(page));await releaseReturn(page);note(`${i+3} participantes simulados adicionados à sala`);
    }
    await panel.waitForFunction(()=>document.querySelector('#room-count').textContent.startsWith('12 /'),{timeout:15000});
    await panel.waitForTimeout(15000);
    assert(report.extraReturns.every(v=>v>0),'Algum dos 12 participantes não recebeu o retorno.');
    report.participantCount=(await(await fetch(url+'/api/room/state')).json()).stage.length;assert.equal(report.participantCount,12);
    note('12 pessoas conectadas, incluindo apresentador; todos os convidados extras decodificaram o retorno do estúdio');
  }
  const image=await obs.call('GetSourceScreenshot',{sourceName:SCENES.room,imageFormat:'png',imageWidth:1280});fs.writeFileSync(path.join(base,'evidencias/sala-v2-obs.png'),Buffer.from(image.imageData.split(',')[1],'base64'));
  await panel.screenshot({path:path.join(base,'evidencias/sala-v2-painel.png'),fullPage:true,mask:[panel.locator('#room-director iframe')],maskColor:'#232329'});
  assert.deepEqual(errors,[]);note('Painel sem erros de JavaScript');report.passed=true;
}catch(e){report.passed=false;report.error=String(e).replace(/https:\/\/vdo\.ninja\/\?[^\s"']+/g,'[link privado omitido]');console.log(report.error);}
finally{
  if(oldScene)await obs.call('SetCurrentProgramScene',{sceneName:oldScene}).catch(()=>{});
  await Promise.allSettled(publisherBrowsers.flatMap(p=>p.contexts().flatMap(c=>c.pages().map(page=>page.evaluate(()=>session.hangup()).catch(()=>{})))));
  await Promise.allSettled(publisherBrowsers.map(p=>p.close()));await browser.close();await obs.disconnect();
  if(backup)fs.writeFileSync(backupFile,backup);else fs.writeFileSync(backupFile,'[]','utf8');
  fs.writeFileSync(path.join(base,'evidencias/verificacao-sala-v2.json'),JSON.stringify(report,null,2),'utf8');
}
if(!report.passed)process.exitCode=1;

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import OBSWebSocket from 'obs-websocket-js';
import {SCENES,names} from '../studio.mjs';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
if (!process.argv.includes('--autorizado')) throw new Error('Obtenha autorização explícita para abrir os links privados da sala no VDO.Ninja.');
const state=await(await fetch('http://127.0.0.1:3210/api/state')).json();
const cfg=JSON.parse(fs.readFileSync(path.join(base,'private/studio.json'),'utf8'));
const report={date:new Date().toISOString(),simulatedDevices:true,publicStreamStarted:false,checks:[]};
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
const obs=new OBSWebSocket();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const note=s=>{report.checks.push(s);console.log('OK:',s);};
async function probeSource(probePage,source){
  const s=await obs.call('GetSourceScreenshot',{sourceName:source,imageFormat:'png',imageWidth:160});
  return probePage.evaluate(data=>new Promise((resolve,reject)=>{
    const img=new Image();img.onerror=reject;img.onload=()=>{
      const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let green=0;
      for(let i=0;i<d.length;i+=4)if(d[i+1]>45&&d[i+1]>d[i]*1.6&&d[i+1]>d[i+2]*1.6)green++;
      resolve(green/(d.length/4));
    };img.src=data;
  }),s.imageData);
}
async function metrics(page){
  return page.evaluate(async()=>{
    const videos=[...document.querySelectorAll('video')].map(v=>({width:v.videoWidth,height:v.videoHeight,playing:!v.paused,time:v.currentTime,tracks:v.srcObject?.getTracks().map(t=>({kind:t.kind,enabled:t.enabled,readyState:t.readyState}))||[]}));
    const peers=Object.values(window.session?.rpcs||{});
    const pcs=peers.flatMap(p=>Object.values(p||{}).filter(v=>v instanceof RTCPeerConnection));
    const inbound=[];
    for(const pc of pcs){try{for(const s of (await pc.getStats()).values()){if(s.type==='inbound-rtp')inbound.push({kind:s.kind,framesDecoded:s.framesDecoded,packetsReceived:s.packetsReceived});}}catch{}}
    return {videos,peerCount:peers.length,inbound,rpcFields:Object.keys(peers[0]||{})};
  });
}
async function join(context,link){
  const page=await context.newPage();
  await page.goto(link,{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('#container-3').click();
  await page.locator('#gowebcam').waitFor({state:'visible',timeout:30000});
  await page.locator('#videoSourceSelect').selectOption({label:'fake_device_0'});
  await page.waitForFunction(()=>!document.querySelector('#gowebcam')?.disabled,{timeout:30000});
  await page.locator('#gowebcam').evaluate(button=>button.click());
  await page.waitForTimeout(5000);
  return page;
}
try{
  await obs.connect('ws://127.0.0.1:'+cfg.obsPort,cfg.obsPassword);
  assert.equal((await obs.call('GetStreamStatus')).outputActive,false,'Uma live está ativa; teste cancelado.');
  const options={permissions:['camera','microphone'],viewport:{width:1280,height:720}};
  const context=await browser.newContext(options);
  const guestContext=await browser.newContext(options);
  const monitorContext=await browser.newContext();
  const host=await join(context,state.links.host);
  const guest=await join(guestContext,state.links.guest);
  report.hostIdentityMatches=await host.evaluate(expected=>session.streamID.startsWith(expected),cfg.host);
  report.guestIdentityMatches=await guest.evaluate(expected=>session.streamID.startsWith(expected),cfg.guest);
  assert(report.hostIdentityMatches&&report.guestIdentityMatches,'Uma identidade fixa foi alterada ao entrar na sala.');
  await wait(8000);
  report.host=await metrics(host);report.guest=await metrics(guest);
  assert(report.host.videos.some(v=>v.width>0&&v.tracks.some(t=>t.kind==='video')),'Câmera simulada do apresentador indisponível.');
  assert(report.guest.videos.some(v=>v.width>0&&v.tracks.some(t=>t.kind==='video')),'Câmera simulada do convidado indisponível.');
  note('Apresentador e convidado entraram com câmera e microfone simulados');
  await obs.call('SetCurrentProgramScene',{sceneName:SCENES.duo});await wait(6000);
  const probe=await monitorContext.newPage();
  for(let i=0;i<20;i++){
    report.hostImageRatio=await probeSource(probe,names.host);report.guestImageRatio=await probeSource(probe,names.guest);
    if(report.hostImageRatio>.15&&report.guestImageRatio>.15)break;
    await wait(1500);
  }
  assert(report.hostImageRatio>.15&&report.guestImageRatio>.15,'As duas câmeras simuladas ainda não chegaram ao OBS.');
  note('As duas câmeras receberam imagem no OBS, verificadas por pixels do sinal de teste');
  for(const [source,file] of [[SCENES.duo,'entrevista-simulada.jpg'],[names.host,'camera-simulada-host.jpg'],[names.guest,'camera-simulada-guest.jpg']]){
    const s=await obs.call('GetSourceScreenshot',{sourceName:source,imageFormat:'jpg',imageWidth:1280,imageCompressionQuality:80});
    fs.writeFileSync(path.join(base,'evidencias',file),Buffer.from(s.imageData.split(',')[1],'base64'));
  }
  note('Composição e fontes individuais capturadas no OBS');
  const monitor=await monitorContext.newPage();await monitor.goto(state.links.monitor,{waitUntil:'domcontentloaded',timeout:60000});
  for(let i=0;i<25;i++){report.monitor=await metrics(monitor);if(report.monitor.videos.some(v=>v.width>0&&v.time>0))break;await wait(1000);}
  report.returnVideoDecoded=report.monitor.videos.some(v=>v.width>0&&v.time>0);
  if(report.returnVideoDecoded)note('Retorno do programa recebido e decodificado no navegador');
  else console.log('Retorno ainda não decodificado; verifique se Guest Return está ativo.');
  report.passed=report.returnVideoDecoded;
}catch(e){report.passed=false;report.error=String(e).replace(/https:\/\/vdo\.ninja\/\?[^\s"']+/g,'[link privado omitido]');console.log(report.error);}
finally{
  try{await obs.call('SetCurrentProgramScene',{sceneName:SCENES.wait});await obs.disconnect();}catch{}
  await browser.close();
  fs.writeFileSync(path.join(base,'evidencias/convidados.json'),JSON.stringify(report,null,2),'utf8');
}
if(!report.passed)process.exitCode=1;

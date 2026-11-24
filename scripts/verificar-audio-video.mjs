import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
import OBSWebSocket from 'obs-websocket-js';
import {names,SCENES} from '../studio.mjs';

if(!process.argv.includes('--autorizado'))throw Error('Este ensaio usa a sala privada com câmera e microfone simulados. Execute somente com autorização.');
const base=process.cwd(),url='http://127.0.0.1:3210',cfg=JSON.parse(fs.readFileSync('private/studio.json','utf8'));
const evidence=path.join(base,'evidencias/audio-video');fs.mkdirSync(evidence,{recursive:true});
const ffmpeg=path.join(base,'runtime/ffmpeg/bin/ffmpeg.exe'),obs=new OBSWebSocket(),browsers=[];
const report={passed:false,simulatedDevices:true,publicStreamStarted:false,checks:[],recordings:[]};
let oldScene,oldDirectory,videoSettings,mediaItems,oldAudio,oldMutes=[],recording=false,hostId,guestId,panel,director;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const post=async(route,data)=>{const response=await fetch(url+route,{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw Error(result.error);return result;};
const room=async()=>await(await fetch(url+'/api/room/state')).json();
const check=message=>{report.checks.push(message);console.log('OK:',message);};
function media(args){const result=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...args],{windowsHide:true,encoding:'utf8'});if(result.status!==0)throw Error('Não foi possível preparar o áudio de ensaio.');}
const hostTone=path.join(evidence,'host.wav'),guestTone=path.join(evidence,'guest.wav'),clip=path.join(evidence,'video-com-audio.mp4');
media(['-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=10','-af','volume=0.6',hostTone]);
media(['-f','lavfi','-i','sine=frequency=880:sample_rate=48000:duration=10','-af','volume=0.6',guestTone]);
media(['-f','lavfi','-i','color=c=0x3B3C46:s=640x360:r=15:d=30','-f','lavfi','-i','sine=frequency=660:sample_rate=48000:duration=30','-c:v','libx264','-preset','ultrafast','-c:a','aac','-shortest',clip]);
async function browser(tone){const instance=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required','--use-file-for-fake-audio-capture='+tone,'--disable-background-media-suspend','--disable-background-timer-throttling','--disable-renderer-backgrounding']});browsers.push(instance);return instance;}
async function join(frame){
  await frame.waitForFunction(()=>typeof session!=='undefined',{timeout:45000});
  const choice=frame.locator('#container-3');if(await choice.isVisible())await choice.click();
  await frame.locator('#gowebcam').waitFor({state:'visible',timeout:30000});
  const camera=frame.locator('#videoSourceSelect');if(await camera.count())await camera.selectOption({label:'fake_device_0'});
  await frame.waitForFunction(()=>!document.querySelector('#gowebcam')?.disabled,{timeout:30000});await frame.locator('#gowebcam').evaluate(button=>button.click());
}
async function approveOne(){
  for(let attempt=0;attempt<30;attempt++){
    const count=await director.evaluate(()=>session.pendingJoinRequests?.length||0);
    if(count){assert.equal(count,1,'Há outro pedido de entrada; o ensaio não aprova pessoas externas.');await director.evaluate(()=>{for(const modal of document.querySelectorAll('.promptModal'))if(/approval|admitted/.test(modal.textContent))modal.querySelector('button[id^="submit_"]')?.click();approveJoinRequest(session.pendingJoinRequests[0].UUID);});return;}
    await sleep(300);
  }
}
async function waitStage(id){for(let n=0;n<40;n++){if((await room()).stage.some(person=>person.id===id))return;await sleep(500);}throw Error('A pessoa não foi adicionada ao estúdio.');}
async function picture(inputName){
  let ratio=0;
  for(let n=0;n<40;n++){
    const capture=await obs.call('GetSourceScreenshot',{sourceName:inputName,imageFormat:'png',imageWidth:640});
    ratio=await panel.evaluate(data=>new Promise(resolve=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;let green=0;for(let p=0;p<pixels.length;p+=4)if(pixels[p+1]>45&&pixels[p+1]>pixels[p]*1.6&&pixels[p+1]>pixels[p+2]*1.6)green++;resolve(green/(canvas.width*canvas.height));};image.src=data;}),capture.imageData);
    if(ratio>.2)return ratio;await sleep(500);
  }
  throw Error('A câmera simulada não chegou à fonte '+inputName+'; proporção='+ratio);
}
async function record(label,scene,{silent=false}={}){
  await obs.call('SetCurrentProgramScene',{sceneName:scene});await sleep(1800);
  await obs.call('StartRecord');recording=true;await sleep(3500);const result=await obs.call('StopRecord');recording=false;
  const destination=result.outputPath;let lastSize=-1,stable=0;
  for(let attempt=0;attempt<60;attempt++){const size=fs.statSync(destination).size;stable=size>1024&&size===lastSize?stable+1:0;lastSize=size;if(stable>=3)break;await sleep(300);}
  assert(fs.statSync(destination).size>1024,'O arquivo de gravação ainda não foi finalizado pelo OBS.');
  const measured=spawnSync(ffmpeg,['-hide_banner','-i',destination,'-map','0:a:0','-af','astats=metadata=0:reset=0','-f','null','NUL'],{windowsHide:true,encoding:'utf8'});
  assert.equal(measured.status,0,'A gravação não tem uma trilha de áudio decodificável.');
  const values=[...measured.stderr.matchAll(/RMS level dB:\s*(-?inf|[-\d.]+)/g)].map(match=>match[1]==='-inf'?-100:Number(match[1]));const rms=Math.max(-100,...values);
  report.recordings.push({label,file:path.basename(destination),rmsDb:rms,silent});assert(silent?rms<-50:rms>-45,`${label}: RMS ${rms} dB não corresponde ao áudio esperado.`);check(label+(silent?' sem áudio após mute':' com áudio na gravação nativa'));
}
try{
  await obs.connect('ws://127.0.0.1:'+cfg.obsPort,cfg.obsPassword);
  assert(!(await obs.call('GetStreamStatus')).outputActive);assert(!(await obs.call('GetRecordStatus')).outputActive);
  assert.equal((await room()).stage.length,0,'O ensaio exige o estúdio vazio.');
  oldScene=(await obs.call('GetCurrentProgramScene')).currentProgramSceneName;oldDirectory=(await obs.call('GetRecordDirectory')).recordDirectory;
  videoSettings=await obs.call('GetInputSettings',{inputName:names.video});mediaItems=(await obs.call('GetSceneItemList',{sceneName:SCENES.media})).sceneItems;
  oldAudio=await(await fetch(url+'/api/audio/state')).json();
  for(const inputName of [names.host,names.guest]){oldMutes.push({inputName,...await obs.call('GetInputMute',{inputName})});await obs.call('SetInputMute',{inputName,inputMuted:false});}
  await post('/api/audio/action',{action:'mute',channel:'room',muted:false});
  await obs.call('SetRecordDirectory',{recordDirectory:evidence});
  const primary=await browser(hostTone),context=await primary.newContext({permissions:['camera','microphone'],viewport:{width:1440,height:1000}});
  const syntheticAudio=()=>{if(!navigator.mediaDevices?.getUserMedia)return;const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=constraints=>capture({...constraints,...(constraints.audio?{audio:{...(typeof constraints.audio==='object'?constraints.audio:{}),echoCancellation:false,noiseSuppression:false,autoGainControl:false}}:{})});};
  await context.addInitScript(syntheticAudio);
  panel=await context.newPage();await panel.goto(url);await panel.locator('body[data-sand-ready=true]').waitFor();await panel.locator('#host-entry-shortcut').click();
  await panel.locator('#host-entry[open]').waitFor();assert.equal(await panel.locator('#host-entry-frame iframe').getAttribute('allow'),'camera; microphone; autoplay; fullscreen; display-capture');
  const host=await(await panel.locator('#host-entry-frame iframe').elementHandle()).contentFrame();
  for(let n=0;n<40;n++){director=panel.frames().find(frame=>frame.url().startsWith('https://vdo.ninja/')&&new URL(frame.url()).searchParams.has('director'));if(director&&await director.evaluate(()=>typeof session!=='undefined'&&session.directorState===true).catch(()=>false))break;await sleep(500);}
  assert(director,'A direção integrada não conectou.');assert.equal((await room()).guests.length,0,'Há participantes externos na sala.');
  await join(host);hostId=await host.evaluate(()=>session.streamID);assert.equal(hostId,cfg.host,'A identificação da câmera não coincide com a fonte do apresentador.');await approveOne();await waitStage(hostId);
  await panel.locator('#host-entry-close').click();await picture(names.host);check('Câmera do apresentador entrou pelo painel e chegou à fonte nativa do OBS');
  const secondary=await browser(guestTone),guestContext=await secondary.newContext({permissions:['camera','microphone']});await guestContext.addInitScript(syntheticAudio);const guest=await guestContext.newPage();
  const guestUrl=new URL((await room()).links.guest);guestUrl.searchParams.set('push',cfg.interviewGuest||cfg.guest);guestUrl.searchParams.set('label','Ensaio de áudio');await guest.goto(guestUrl.toString(),{waitUntil:'domcontentloaded'});await join(guest);guestId=await guest.evaluate(()=>session.streamID);await approveOne();
  for(let n=0;n<40&&!(await room()).guests.some(person=>person.id===guestId);n++)await sleep(500);
  if(!(await room()).stage.some(person=>person.id===guestId))await post('/api/room/action',{action:'add',id:guestId});
  await obs.call('SetCurrentProgramScene',{sceneName:SCENES.duo});await picture(names.guest);check('Câmera do convidado chegou à entrevista');
  await record('solo-vozes',SCENES.solo);await record('entrevista-vozes',SCENES.duo);await record('sala-vozes',SCENES.room);
  await post('/api/room/action',{action:'mute',id:hostId});await post('/api/room/action',{action:'mute',id:guestId});await sleep(1600);await record('entrevista-mute',SCENES.duo,{silent:true});
  await obs.call('SetInputSettings',{inputName:names.video,inputSettings:{local_file:clip,is_local_file:true,looping:true},overlay:true});
  for(const item of mediaItems)if([names.video,names.image,names.share].includes(item.sourceName))await obs.call('SetSceneItemEnabled',{sceneName:SCENES.media,sceneItemId:item.sceneItemId,sceneItemEnabled:item.sourceName===names.video});
  await post('/api/audio/action',{action:'mute',channel:'video',muted:false});await record('midia-audio',SCENES.media);
  await post('/api/audio/action',{action:'mute',channel:'video',muted:true});await record('midia-mute',SCENES.media,{silent:true});
  await post('/api/audio/action',{action:'mute',channel:'intro',muted:false});await obs.call('SetCurrentProgramScene',{sceneName:SCENES.intro});await obs.call('TriggerMediaInputAction',{inputName:names.intro,mediaAction:'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART'});await record('abertura-audio',SCENES.intro);
  report.passed=true;
}catch(error){report.error=String(error).replace(/https:\/\/vdo\.ninja\/\?[^\s"']+/g,'[link privado omitido]');console.error(report.error);process.exitCode=1;}
finally{
  if(recording)await obs.call('StopRecord').catch(()=>{});
  for(const id of [hostId,guestId].filter(Boolean))await post('/api/room/action',{action:'remove',id}).catch(()=>{});
  await Promise.allSettled(browsers.map(instance=>instance.close()));
  if(videoSettings)await obs.call('SetInputSettings',{inputName:names.video,inputSettings:videoSettings.inputSettings,overlay:false}).catch(()=>{});
  for(const item of mediaItems||[])if([names.video,names.image,names.share].includes(item.sourceName))await obs.call('SetSceneItemEnabled',{sceneName:SCENES.media,sceneItemId:item.sceneItemId,sceneItemEnabled:item.sceneItemEnabled}).catch(()=>{});
  for(const channel of oldAudio?.channels||[])if(channel.available){await post('/api/audio/action',{action:'mute',channel:channel.id,muted:channel.muted}).catch(()=>{});await post('/api/audio/action',{action:'volume',channel:channel.id,volume:channel.volume}).catch(()=>{});await post('/api/audio/action',{action:'monitor',channel:channel.id,enabled:channel.monitor}).catch(()=>{});}
  for(const mute of oldMutes)await obs.call('SetInputMute',mute).catch(()=>{});
  if(oldScene)await obs.call('SetCurrentProgramScene',{sceneName:oldScene}).catch(()=>{});if(oldDirectory)await obs.call('SetRecordDirectory',{recordDirectory:oldDirectory}).catch(()=>{});
  await obs.disconnect();fs.writeFileSync(path.join(evidence,'resultado.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks,error:report.error}));
}

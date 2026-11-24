import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SCENES} from '../studio.mjs';
const url='http://127.0.0.1:3210',browser=await chromium.launch({channel:'msedge',headless:true});
const links={host:'https://vdo.ninja/?push=host_fixture&room=fixture',director:'https://vdo.ninja/?director=fixture',invite:'https://example.invalid/invite',guest:'https://example.invalid/guest'};
const channels=['intro','video','room','share'].map((id,i)=>({id,label:['Abertura','Vídeos e áudios','Conversa no programa','Tela compartilhada'][i],available:true,muted:false,volume:1,monitor:id!=='room',streamTrack:true,returnTrack:id!=='room',active:true,peak:.1,db:-20}));
const changes=[],errors=[];const event={id:'apceLive001',title:'Ensaio local',privacy:'private',lifeCycleStatus:'ready'};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('https://vdo.ninja/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Captura simulada</title><p>Prévia de teste sem dispositivos.</p>'}));
 await context.route('**/api/**',async route=>{
  const pathname=new URL(route.request().url()).pathname,post=route.request().method()==='POST';let body={};
  if(pathname==='/api/state')body={connected:true,scenes:SCENES,labels:{host:'',guest:'',topic:''},afterIntro:SCENES.duo,hostMuted:false,guestMuted:false,hostConnected:false,guestConnected:false,currentScene:SCENES.solo,streaming:false,recording:false,youtube:{schedulerConnected:false},links};
  else if(pathname==='/api/room/state')body={stage:[],guests:[],online:false,capacity:12,lastSeen:0,links};
  else if(pathname==='/api/youtube/state')body={clientConfigured:true,centralAuth:true,connected:false,events:[],upcoming:[]};
  else if(pathname==='/api/media/state')body={items:[],program:{connected:true,visible:false}};
  else if(pathname==='/api/chat/state')body={messages:[],status:'idle',selected:null,revision:0};
  else if(pathname==='/api/broadcast/state')body={selected:event,options:[event],busy:false,phase:'idle',obsConnected:true,ingestOwned:false,error:''};
  else if(pathname==='/api/broadcast/action'){assert.equal(route.request().postDataJSON().action,'refresh');body={selected:event,options:[event],busy:false,phase:'idle',obsConnected:true,ingestOwned:false,error:''};}
  else if(pathname==='/api/preview')body={image:'data:image/png;base64,'+fs.readFileSync('public/assets/apce.png').toString('base64')};
  else if(pathname==='/api/audio/state')body={connected:true,channels};
  else if(pathname==='/api/audio/action'){
   const data=route.request().postDataJSON();changes.push(data);const channel=channels.find(item=>item.id===data.channel);if(data.action==='mute')channel.muted=data.muted;if(data.action==='monitor')channel.monitor=data.enabled;if(data.action==='volume')channel.volume=data.volume;body={connected:true,channels};
  }else if(post)throw Error('Escrita inesperada no ensaio: '+pathname);
  await route.fulfill({json:body});
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(url);await page.locator('#audio-open').waitFor();
 await page.locator('#audio-open').click();await page.locator('.audio-channel').first().waitFor();assert.equal(await page.locator('.audio-channel').count(),4);
 const intro=page.locator('[data-channel=intro]');await intro.locator('.audio-mute').click();await page.waitForFunction(()=>document.querySelector('[data-channel=intro] .audio-mute').getAttribute('aria-pressed')==='true');assert.equal(channels[0].muted,true);
 await intro.locator('.audio-monitor input').uncheck();assert.equal(channels[0].streamTrack,true);assert.equal(channels[0].returnTrack,true);
 await intro.locator('.audio-volume').fill('40');await intro.locator('.audio-volume').dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('[data-channel=intro] .audio-volume').value==='40');
 await page.screenshot({path:'evidencias/audio-painel-desktop.png'});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'evidencias/audio-painel-celular.png'});await page.locator('#audio-close').click();
 await page.setViewportSize({width:1440,height:1000});await page.locator('#host-entry-shortcut').click();await page.locator('#host-entry[open]').waitFor();
 assert.match(await page.locator('#host-entry-frame iframe').getAttribute('allow'),/camera; microphone/);const initial=await page.locator('#host-entry-frame iframe').getAttribute('src');
 await page.locator('#host-entry-close').click();assert.equal(await page.locator('#host-entry-frame iframe').count(),1);await page.locator('#host-entry-shortcut').click();assert.equal(await page.locator('#host-entry-frame iframe').getAttribute('src'),initial);
 await page.locator('#host-entry-leave').click();assert.equal(await page.locator('#host-entry-frame iframe').count(),0);assert.equal(await page.locator('#library-video-preview').evaluate(video=>video.defaultMuted),false);
 await page.locator('#broadcast-start').click();await page.locator('#broadcast-confirm[open]').waitFor();assert.match(await page.locator('#broadcast-confirm-copy').textContent(),/ainda não confirmou/);await page.locator('#broadcast-close').click();
 assert(changes.some(change=>change.action==='mute'&&change.muted));assert(changes.some(change=>change.action==='monitor'&&!change.enabled));assert(changes.some(change=>change.action==='volume'&&change.volume===.4));assert.deepEqual(errors,[]);const report={passed:true,mutingExplicit:true,monitorSeparateFromStream:true,volumeControl:true,embeddedCapturePermissions:true,capturePreservedOnClose:true,previewStartsUnmuted:true,mobile:true,allWritesMocked:true};fs.writeFileSync('evidencias/audio-ui.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}

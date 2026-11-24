import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createBroadcastControl} from '../broadcast-control.mjs';
import {createRoomControl} from '../room-control.mjs';
import {createYouTubeScheduler} from '../youtube-scheduler.mjs';
import {buildLinks} from '../studio.mjs';

function temporary(t){const base=fs.mkdtempSync(path.join(os.tmpdir(),'apce-live-test-'));t.after(()=>fs.rmSync(base,{recursive:true,force:true}));fs.mkdirSync(path.join(base,'private'));return base;}
test('contrato VDO: captura é cena; convite público não recebe acesso técnico',()=>{
  const cfg={room:'room-test',password:'test-password',host:'host123',guest:'guest123',return:'return123',roomApi:'private-test-key',roomSourceKey:'private-admission-key',labels:{}};
  const links=buildLinks(cfg),params=k=>new URL(links[k]).searchParams;
  for(const key of ['hostView','guestView']){assert(params(key).has('scene'));assert.equal(params(key).get('roomkey'),cfg.roomSourceKey);}
  assert.equal(params('monitor').get('view'),cfg.return);assert.equal(params('monitor').get('password'),cfg.password);
  for(const key of ['room','roomkey','scene','push'])assert(!params('monitor').has(key));
  assert.equal(params('host').get('roomkey'),cfg.roomSourceKey);assert(!params('host').has('api'));
  assert(!params('invite').has('roomkey'));assert(!params('invite').has('api'));assert.equal(params('invite').get('broadcast'),cfg.return);
  assert(params('director').has('requireapproval'));assert(!params('director').has('novideo'));assert(!params('director').has('noaudio'));assert(!params('director').has('autostart'));
});
function fixture(t){
  const base=temporary(t),calls=[],s={active:false,status:'ready',stream:'inactive',connected:true,failStop:false,hold:null};
  const item=()=>({id:'apceLive001',snippet:{title:'Teste local',channelId:'UC_APCE'},status:{lifeCycleStatus:s.status,privacyStatus:'private'}});
  const youtube={safeEvent:b=>({id:b.id,title:b.snippet.title,lifeCycleStatus:b.status.lifeCycleStatus}),options:async()=>[],broadcast:async()=>item(),ingest:async()=>({streamId:'stream123',key:'secret-test-key',server:'rtmps://test.invalid'}),streamInfo:async()=>{if(s.hold)await s.hold;return {status:{streamStatus:s.stream}};},transition:async(id,value)=>{calls.push('transition:'+value);if(value==='complete'&&s.failStop)throw Error('API indisponível');s.status=value;return item();}};
  const api=async(name,data)=>{calls.push(name);if(name==='GetStreamStatus')return {outputActive:s.active};if(name==='GetProfileList')return {currentProfileName:'Outro perfil'};if(name==='SetStreamServiceSettings'){assert.equal(data.streamServiceType,'rtmp_custom');assert.equal(data.streamServiceSettings.key,'secret-test-key');}if(name==='StartStream'){s.active=true;s.stream='active';}if(name==='StopStream')s.active=false;return {};};
  const options={base,youtube,api,isConnected:()=>s.connected,delay:async()=>{},attempts:2};
  return {control:createBroadcastControl(options),s,calls,options,base};
}
test('iniciar verifica seleção, envia OBS e só publica depois do sinal ativo',async t=>{
  const {control:c,s,calls}=fixture(t);await assert.rejects(c.start('apceLive001'));await c.select('apceLive001');await c.start('apceLive001');assert.equal(s.status,'live');assert.ok(calls.indexOf('StartStream')<calls.indexOf('transition:live'));assert.ok(!JSON.stringify(await c.state()).includes('secret-test-key'));
  await c.stop('apceLive001');assert.equal(s.active,false);assert.equal(s.status,'complete');assert.ok(calls.indexOf('transition:complete')<calls.indexOf('StopStream'));
});
test('reinício recupera a live e o sinal pertencente ao painel',async t=>{const f=fixture(t);await f.control.select('apceLive001');await f.control.start('apceLive001');const c=createBroadcastControl(f.options);await c.refresh();assert.equal((await c.state()).selected.lifeCycleStatus,'live');await c.stop('apceLive001');assert.equal(f.s.active,false);});
test('não troca evento nem adota sinal iniciado fora do painel',async t=>{const {control:c,s,calls}=fixture(t);await c.select('apceLive001');s.active=true;await assert.rejects(c.select('apceLive002'));await assert.rejects(c.start('apceLive001'));assert.ok(!calls.includes('SetStreamServiceSettings'));assert.ok(!calls.includes('StopStream'));});
test('falha Google no encerramento ainda corta sinal e permite repetir encerramento',async t=>{const {control:c,s}=fixture(t);await c.select('apceLive001');await c.start('apceLive001');s.failStop=true;await assert.rejects(c.stop('apceLive001'));assert.equal(s.active,false);assert.equal((await c.state()).ingestOwned,true);s.failStop=false;await c.stop('apceLive001');assert.equal(s.status,'complete');});
test('sinal inativo não aciona a publicação e botão repetido é bloqueado',async t=>{const {control:c,s,calls}=fixture(t);await c.select('apceLive001');let release;s.hold=new Promise(r=>release=r);const first=c.start('apceLive001');await new Promise(r=>setImmediate(r));await assert.rejects(c.start('apceLive001'));s.stream='inactive';release();await assert.rejects(first);assert.ok(!calls.includes('transition:live'));assert.equal(s.active,true);});
test('encerrar antes de iniciar preserva o agendamento',async t=>{const {control:c,calls}=fixture(t);await c.select('apceLive001');await assert.rejects(c.stop('apceLive001'));assert.ok(!calls.includes('transition:complete'));});
test('perfil nativo com fluxo de autorização próprio é recusado antes do envio',async t=>{const f=fixture(t),c=createBroadcastControl({...f.options,expectedProfile:'APCE Painel'});await c.select('apceLive001');await assert.rejects(c.start('apceLive001'),/APCE Painel/);assert.ok(!f.calls.includes('SetStreamServiceSettings'));});

test('12 lugares incluem apresentador; 13º bloqueado e origem do retorno excluída',async t=>{
  const cfg={room:'room-test',password:'test-password',host:'host123',guest:'guest123',return:'return123',labels:{host:'Apresentador',guest:'Convidado'},port:3210};let clock=100000;
  const base=temporary(t),room=createRoomControl({base,cfg,names:{guest:'Guest'},api:async()=>{},saveConfig:()=>{},now:()=>clock});
  const guests=[{id:cfg.host,label:'Apresentador'},...Array.from({length:12},(_,n)=>({id:'guest'+n,label:'Convidado '+n})),{id:cfg.return,label:'Retorno'}];
  await room.action({action:'sync',guests});assert.equal(room.state().guests.length,13);
  for(let n=0;n<11;n++)await room.action({action:'add',id:'guest'+n});
  assert.equal(room.state().stage.length,12);await assert.rejects(room.action({action:'add',id:'guest11'}));
  await room.action({action:'remove',id:'guest0'});await room.action({action:'add',id:'guest11'});assert.equal(room.state().stage.length,12);
  assert.equal(room.stageState().participants.length,12);assert.ok(room.stageState().participants.every(p=>new URL(p.url).searchParams.get('view')===p.id));
  const mix=new URL(room.stageState().mixUrl);assert.equal(mix.searchParams.get('view').split(',').length,12);assert(mix.searchParams.has('scene'));assert(!mix.searchParams.has('solo'));
  await room.action({action:'mute',id:'guest11'});assert.equal(room.state().stage.find(p=>p.id==='guest11').muted,true);
  clock+=91000;assert.equal(room.state().online,false);await assert.rejects(room.action({action:'add',id:'guest0'}));
});

test('silêncio do apresentador e da entrevista acompanha o lugar no estúdio',async t=>{
  const base=temporary(t),cfg={room:'room-test',password:'test-password',host:'host123',guest:'guest123',return:'return123',labels:{}},calls=[];
  const room=createRoomControl({base,cfg,names:{host:'Host',guest:'Guest'},api:async(name,data)=>{calls.push({name,data});return {};},saveConfig:()=>{}});
  await room.action({action:'sync',guests:[{id:cfg.host,label:'Apresentador'},{id:cfg.guest,label:'Entrevistado'}]});await room.action({action:'add',id:cfg.guest});
  await room.setMute(cfg.host,true);assert.equal(room.state().stage.find(p=>p.id===cfg.host).muted,true);assert(calls.some(c=>c.name==='SetInputMute'&&c.data.inputName==='Host'&&c.data.inputMuted));
  await room.action({action:'mute',id:cfg.host});assert.equal(room.state().stage.find(p=>p.id===cfg.host).muted,false);
  await room.action({action:'interview',id:cfg.guest});await room.setMute(cfg.guest,true);assert.equal(room.state().stage.find(p=>p.id===cfg.guest).muted,true);assert(calls.some(c=>c.name==='SetInputMute'&&c.data.inputName==='Guest'&&c.data.inputMuted));
});

test('aba sem a direção não apaga os participantes da direção conectada',async t=>{
  const base=temporary(t),cfg={room:'room-test',password:'test-password',host:'host123',guest:'guest123',return:'return123',labels:{}};let now=10000;
  const room=createRoomControl({base,cfg,names:{host:'Host',guest:'Guest'},api:async()=>({}),saveConfig:()=>{},now:()=>now});
  await room.action({action:'sync',claimed:true,guests:[{id:cfg.host,label:'Apresentador'}]});
  await room.action({action:'sync',claimed:false,guests:[]});assert(room.state().online);assert.equal(room.state().guests.length,1);assert(room.state().stage[0].connected);
  now+=91000;assert(!room.state().online);
});

test('API Google vincula entrada, protege chave, verifica canal e não publica ao preparar',async t=>{
  const base=temporary(t),calls=[],event={id:'apceLive001',snippet:{title:'Teste',channelId:'UC_APCE'},status:{lifeCycleStatus:'ready'},contentDetails:{}};
  const protectedValue={credentials:{type:'web',client_id:'123-test.apps.googleusercontent.com',client_secret:'test-secret'},tokens:{access_token:'access-test',refresh_token:'refresh-test',expires_at:Date.now()+3600000},account:{id:'UC_APCE',handle:'@apcedf'}};
  fs.mkdirSync(path.join(base,'private/youtube'));fs.writeFileSync(path.join(base,'private/youtube/connection.dpapi'),'test-protected');
  const fetchImpl=async(url,opts={})=>{const u=new URL(url);calls.push(u.pathname);let value={};
    if(u.pathname.endsWith('/channels'))value={items:[{id:'UC_APCE'}]};
    else if(u.pathname.endsWith('/liveBroadcasts'))value={items:[event]};
    else if(u.pathname.endsWith('/liveStreams')&&opts.method==='POST')value={id:'stream123'};
    else if(u.pathname.endsWith('/liveStreams'))value={items:[{id:'stream123',cdn:{ingestionInfo:{streamName:'test-secret-key'}},status:{streamStatus:'active'}}]};
    else if(u.pathname.endsWith('/bind')){event.contentDetails.boundStreamId='stream123';value=event;}
    else if(u.pathname.endsWith('/transition')){event.status.lifeCycleStatus=u.searchParams.get('broadcastStatus');value=event;}
    else throw Error('Unexpected endpoint');
    return {ok:true,status:200,json:async()=>value};
  };
  const scheduler=createYouTubeScheduler({base,port:3210,fetchImpl,unprotect:async()=>JSON.stringify(protectedValue),protect:async()=>''});
  const ingest=await scheduler.live.ingest(event.id);assert.equal(ingest.key,'test-secret-key');assert.equal(calls.filter(p=>p.endsWith('/bind')).length,1);assert.ok(!calls.some(p=>p.endsWith('/transition')));
  await scheduler.live.ingest(event.id);assert.equal(calls.filter(p=>p.endsWith('/bind')).length,1);assert.ok(!JSON.stringify(await scheduler.status()).includes('test-secret-key'));
  await scheduler.live.transition(event.id,'live');assert.equal(event.status.lifeCycleStatus,'live');
  event.snippet.channelId='UC_WRONG';await assert.rejects(scheduler.live.broadcast(event.id),{code:'WRONG_CHANNEL'});
});

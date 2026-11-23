import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import OBSWebSocket from 'obs-websocket-js';
import { SCENES, names, buildLinks } from './studio.mjs';
import { configureMove } from './move-layouts.mjs';
import { createYouTubeScheduler } from './youtube-scheduler.mjs';
import { createMediaLibrary, serveMediaFile } from './media-library.mjs';
import {createBroadcastControl} from './broadcast-control.mjs';
import {createRoomControl} from './room-control.mjs';
import {createCommentControl} from './comment-control.mjs';
import crypto from 'node:crypto';

const BASE = path.dirname(fileURLToPath(import.meta.url));
const cfgPath = path.join(BASE, 'private/studio.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const youtubeScheduler = createYouTubeScheduler({base:BASE,port:cfg.port});
const obs = new OBSWebSocket();
let connected = false, connecting = false, lastError = '', introArmed = false;
let snapshot = null, snapshotAt = 0;
let commentsPrepared=false,commentsPreparing=null;
const api = (request, data = {}) => obs.call(request, data);
const save = () => fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
if(!cfg.roomApi){cfg.roomApi=crypto.randomBytes(18).toString('hex');save();}
if(!cfg.roomSourceKey){cfg.roomSourceKey=crypto.randomBytes(18).toString('hex');save();}
const mediaLibrary = createMediaLibrary({base:BASE,api,isConnected:()=>connected,scenes:SCENES,names,cfg,saveConfig:save});
const broadcasts=createBroadcastControl({base:BASE,youtube:youtubeScheduler.live,api,isConnected:()=>connected,expectedProfile:'APCE Painel'});
const room=createRoomControl({base:BASE,cfg,api,names,saveConfig:save});
const comments=createCommentControl({youtube:youtubeScheduler.chat,selection:broadcasts.selection});
setInterval(()=>comments.tick(),2000).unref();

function guestReturn(action){
  if(!['status','start','stop'].includes(action))throw Error('Comando de retorno inválido.');
  if(!connected)throw Error('Abra o OBS APCE antes de ligar o retorno.');
  return new Promise((resolve,reject)=>{
    const child=spawn('python',[path.join(BASE,'scripts/guest-return.py'),action],{windowsHide:true});
    let output='';const timer=setTimeout(()=>{child.kill();reject(Error('O OBS não respondeu ao comando de retorno. Abra Ferramentas → VDO.Ninja Studio → Guest Return.'));},20000);
    child.stdout.on('data',d=>output+=d);child.stderr.resume();child.on('error',reject);
    child.on('close',code=>{clearTimeout(timer);try{const result=JSON.parse(output);if(code||result.error)reject(Error(result.error||'Não foi possível controlar o retorno.'));else resolve(result);}catch{reject(Error('Não foi possível acessar o retorno no OBS.'));}});
  });
}

async function connect() {
  if (connected || connecting) return;
  connecting = true;
  try {
    await obs.connect(`ws://127.0.0.1:${cfg.obsPort}`, cfg.obsPassword, {eventSubscriptions: 0x7ff});
    connected = true; lastError = '';
  } catch (e) { lastError = e.message; }
  finally { connecting = false; }
}
obs.on('ConnectionClosed', () => { connected = false; introArmed = false; commentsPrepared=false; });
obs.on('MediaInputPlaybackEnded', async ({inputName}) => {
  if (inputName !== names.intro || !introArmed) return;
  introArmed = false;
  try {
    const {currentProgramSceneName} = await api('GetCurrentProgramScene');
    if (currentProgramSceneName === SCENES.intro) await api('SetCurrentProgramScene', {sceneName: cfg.afterIntro});
  } catch (e) { lastError = e.message; }
});
obs.on('CurrentProgramSceneChanged', ({sceneName}) => {
  introArmed = sceneName === SCENES.intro;
});
setInterval(connect, 3000).unref();
setInterval(async () => {
  if (!connected || !introArmed) return;
  try {
    const status = await api('GetMediaInputStatus', {inputName: names.intro});
    if (status.mediaState === 'OBS_MEDIA_STATE_ENDED') {
      introArmed = false;
      const {currentProgramSceneName} = await api('GetCurrentProgramScene');
      if (currentProgramSceneName === SCENES.intro) await api('SetCurrentProgramScene', {sceneName: cfg.afterIntro});
    }
  } catch (e) { console.error('Abertura:', e.message); }
}, 1000).unref();
await connect();

async function createInput(scene, name, kind, settings, tracks) {
  let list = await api('GetInputList');
  if (!list.inputs.some(i => i.inputName === name)) {
    await api('CreateInput', {sceneName: scene, inputName: name, inputKind: kind, inputSettings: settings, sceneItemEnabled: true});
  } else {
    const items = await api('GetSceneItemList', {sceneName: scene});
    if (!items.sceneItems.some(i => i.sourceName === name)) await api('CreateSceneItem', {sceneName: scene, sourceName: name, sceneItemEnabled: true});
    await api('SetInputSettings', {inputName: name, inputSettings: settings, overlay: true});
  }
  if (tracks) {
    await api('SetInputAudioTracks', {inputName: name, inputAudioTracks: {'1': true, '2': tracks === 'both', '3': false, '4': false, '5': false, '6': false}});
    await api('SetInputAudioMonitorType', {inputName: name, monitorType: 'OBS_MONITORING_TYPE_NONE'});
  }
}
async function attach(scene, source, x = 0, y = 0, width = 1920, height = 1080, enabled = true) {
  let {sceneItems} = await api('GetSceneItemList', {sceneName: scene});
  let item = sceneItems.find(i => i.sourceName === source);
  if (!item) {
    const result = await api('CreateSceneItem', {sceneName: scene, sourceName: source, sceneItemEnabled: enabled});
    item = {sceneItemId: result.sceneItemId};
  }
  const data = {sceneName: scene, sceneItemId: item.sceneItemId};
  await api('SetSceneItemEnabled', {...data, sceneItemEnabled: enabled});
  await api('SetSceneItemTransform', {...data, sceneItemTransform: {positionX: x, positionY: y, alignment: 5, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsAlignment: 0, boundsWidth: width, boundsHeight: height}});
  await api('SetSceneItemLocked', {...data, sceneItemLocked: true});
}
const browser = (url, width = 1920, height = 1080) => ({url, width, height, reroute_audio: true, shutdown: false, restart_when_active: false, fps: 30, css: 'body { background-color: rgba(0,0,0,0); margin:0; overflow:hidden; }'});

async function ensureCommentOverlay(force=false){
  if(!connected)throw new Error('Abra o OBS APCE para exibir comentários na transmissão.');
  if(force)commentsPrepared=false;
  if(commentsPreparing)return commentsPreparing;
  const inputName='APCE · Comentário em destaque',url=`http://127.0.0.1:${cfg.port}/comment-overlay.html`;
  if(commentsPrepared){const current=await api('GetInputSettings',{inputName}).catch(()=>null);if(current?.inputSettings?.url===url)return {ok:true};commentsPrepared=false;}
  commentsPreparing=(async()=>{
  const scenes=(await api('GetSceneList')).scenes.map(s=>s.sceneName);
  const targets=Object.values(SCENES).filter(s=>scenes.includes(s));
  if(!targets.length)throw new Error('Use Reparar cenas para preparar o estúdio APCE.');
  await createInput(targets[0],inputName,'browser_source',{...browser(url),reroute_audio:false});
  for(const sceneName of targets){
    await attach(sceneName,inputName);
    const items=(await api('GetSceneItemList',{sceneName})).sceneItems;
    await api('SetSceneItemIndex',{sceneName,sceneItemId:items.find(i=>i.sourceName===inputName).sceneItemId,sceneItemIndex:items.length-1});
  }
  commentsPrepared=true;return {ok:true};
  })();
  try{return await commentsPreparing;}finally{commentsPreparing=null;}
}

async function setup() {
  if (!connected) throw new Error('Abra o OBS APCE e aguarde a conexão.');
  const stream = await api('GetStreamStatus');
  const record = await api('GetRecordStatus');
  if (stream.outputActive || record.outputActive) throw new Error('Encerre a transmissão e a gravação antes de configurar as cenas.');
  const existing = (await api('GetSceneList')).scenes.map(s => s.sceneName);
  for (const scene of [...Object.values(SCENES), names.audioScene]) {
    if (!existing.includes(scene)) await api('CreateScene', {sceneName: scene});
  }
  const links = buildLinks(cfg);
  await createInput(SCENES.solo, names.host, 'browser_source', browser(links.hostView, 1280, 720), 'public');
  await createInput(SCENES.duo, names.guest, 'browser_source', browser(buildLinks({...cfg,guest:cfg.interviewGuest||cfg.guest}).guestView, 1280, 720), 'public');
  await createInput(SCENES.room, names.room, 'browser_source', browser(`http://127.0.0.1:${cfg.port}/stage.html?v=14`, 1792, 816), 'public');
  // O mosaico fornece as vozes também em Solo, Entrevista e Mídia. As duas
  // câmeras individuais ficam sem trilha de áudio para preservar uma só cópia.
  for(const inputName of [names.host,names.guest])await api('SetInputAudioTracks',{inputName,inputAudioTracks:{'1':false,'2':false,'3':false,'4':false,'5':false,'6':false}});
  for(const item of (await api('GetSceneItemList',{sceneName:names.audioScene})).sceneItems){if([names.host,names.guest].includes(item.sourceName))await api('RemoveSceneItem',{sceneName:names.audioScene,sceneItemId:item.sceneItemId});}
  await attach(names.audioScene,names.room,-3000,-3000,1792,816);
  await createInput(SCENES.intro, names.intro, 'ffmpeg_source', {is_local_file: true, local_file: cfg.intro, looping: false, restart_on_activate: true, close_when_inactive: true, clear_on_media_end: true}, 'both');
  await createInput(SCENES.media, names.video, 'ffmpeg_source', {is_local_file: true, local_file: cfg.mediaFile || '', looping: false, restart_on_activate: true, close_when_inactive: true}, 'both');
  await createInput(SCENES.media, names.image, 'image_source', {file: cfg.imageFile || '', unload: false});
  await createInput(SCENES.media, names.share, 'browser_source', browser(links.shareView, 1600, 900), 'both');
  for (const [scene, mode] of [[SCENES.wait, 'wait'], [SCENES.solo, 'solo'], [SCENES.duo, 'duo'], [SCENES.room, 'room'], [SCENES.media, 'media'], [SCENES.end, 'end']]) {
    const input = `APCE · Fundo ${mode}`;
    await createInput(scene, input, 'browser_source', browser(`http://127.0.0.1:${cfg.port}/overlay-v2.html?mode=${mode}&layer=back`));
    const items = await api('GetSceneItemList', {sceneName: scene});
    await api('SetSceneItemIndex', {sceneName: scene, sceneItemId: items.sceneItems.find(i => i.sourceName === input).sceneItemId, sceneItemIndex: 0});
  }
  await attach(SCENES.intro, names.intro);
  await attach(SCENES.solo, names.host, 240, 144, 1440, 810);
  await attach(SCENES.solo, names.audioScene);
  await attach(SCENES.duo, names.host, 64, 260, 880, 495);
  await attach(SCENES.duo, names.guest, 976, 260, 880, 495);
  await attach(SCENES.room, names.room, 64, 144, 1792, 816);
  await attach(SCENES.media, names.video, 64, 144, 1440, 810, !!cfg.mediaFile);
  await attach(SCENES.media, names.image, 64, 144, 1440, 810, !!cfg.imageFile);
  await attach(SCENES.media, names.share, 64, 144, 1440, 810, false);
  await attach(SCENES.media, names.host, 1536, 390, 320, 180);
  await attach(SCENES.media, names.audioScene);
  for (const [scene, mode] of [[SCENES.solo, 'solo'], [SCENES.duo, 'duo'], [SCENES.room, 'room'], [SCENES.media, 'media']]) {
    const input = `APCE · Legendas ${mode}`;
    await createInput(scene, input, 'browser_source', browser(`http://127.0.0.1:${cfg.port}/overlay-v2.html?mode=${mode}&layer=front`));
    const items = await api('GetSceneItemList', {sceneName: scene});
    await api('SetSceneItemIndex', {sceneName: scene, sceneItemId: items.sceneItems.find(i => i.sourceName === input).sceneItemId, sceneItemIndex: items.sceneItems.length - 1});
  }
  await selectMedia(cfg.mediaKind|| (cfg.mediaFile?'video':'image'));
  await api('SetCurrentProgramScene', {sceneName: SCENES.wait});
  const moveReady = await configureMove(api, SCENES, names, cfg.port);
  if (!moveReady) {
    const transitions = await api('GetSceneTransitionList');
    const fade = transitions.transitions.find(t => t.transitionKind === 'fade_transition');
    if (fade) {
      await api('SetCurrentSceneTransition', {transitionName: fade.transitionName});
      await api('SetCurrentSceneTransitionDuration', {transitionDuration: 300});
    }
  }
  await ensureCommentOverlay(true);
  return {ok: true, scenes: Object.values(SCENES)};
}

async function state() {
  let channelName = '';
  try {
    const profile = fs.readFileSync(path.join(BASE, 'obs/config/obs-studio/basic/profiles/APCE/basic.ini'), 'utf8');
    const section = profile.match(/\[YouTube\]\r?\n([\s\S]*?)(?=\r?\n\[|$)/)?.[1] || '';
    channelName = section.match(/^ChannelName=(.+)$/m)?.[1].trim() || '';
  } catch {}
  const result = {connected, error: connected ? '' : 'Abra o OBS APCE para conectar o painel.', scenes: SCENES, labels: cfg.labels, afterIntro: cfg.afterIntro, links: buildLinks(cfg), youtube: {service: 'YouTube - RTMPS', configured: false, accountConnected: !!channelName, channelName}, mediaFile: cfg.mediaFile || '', imageFile: cfg.imageFile || ''};
  const schedulerAccount=await youtubeScheduler.status();
  result.youtube.schedulerConnected=schedulerAccount.connected;result.youtube.accountName=schedulerAccount.account?.title||'';
  if (!connected) return result;
  try {
    const [scene, stream, recording, service, hostMute, guestMute] = await Promise.all([
      api('GetCurrentProgramScene'), api('GetStreamStatus'), api('GetRecordStatus'), api('GetStreamServiceSettings'),
      api('GetInputMute', {inputName: names.host}).catch(() => ({})), api('GetInputMute', {inputName: names.guest}).catch(() => ({}))
    ]);
    result.currentScene = scene.currentProgramSceneName;
    result.streaming = stream.outputActive; result.recording = recording.outputActive;
    result.youtube.configured = !!service.streamServiceSettings?.key;
    result.youtube.service = service.streamServiceSettings?.service;
    result.hostMuted = hostMute.inputMuted; result.guestMuted = guestMute.inputMuted;
  } catch (e) { result.error = e.message; }
  return result;
}
function pickFile(kind) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', path.join(BASE, 'scripts/pick-file.ps1'), '-Kind', kind], {windowsHide: true});
    let data = ''; child.stdout.on('data', d => { data += d; });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve(data.trim().replace(/^\uFEFF/, '')) : reject(new Error('Não foi possível abrir o seletor de arquivo.')));
  });
}
async function action(data) {
  if (data.action === 'labels') {
    cfg.labels = Object.fromEntries(['host','guest','topic'].map(k => [k, String(data[k] || '').slice(0, 160)]));
    if ([SCENES.solo,SCENES.duo,SCENES.room].includes(data.afterIntro)) cfg.afterIntro = data.afterIntro;
    save(); return {ok: true};
  }
  if (data.action === 'setup') return setup();
  if (!connected) throw new Error('O OBS APCE está desconectado.');
  if (data.action === 'scene') {
    if (!Object.values(SCENES).includes(data.scene)) throw new Error('Cena inválida.');
    await api('SetCurrentProgramScene', {sceneName: data.scene});
    introArmed = data.scene === SCENES.intro;
    if (introArmed) await api('TriggerMediaInputAction', {inputName: names.intro, mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART'});
  } else if (data.action === 'mute') {
    if (!['host','guest'].includes(data.input)) throw new Error('Participante inválido.');
    const current=await api('GetInputMute',{inputName:names[data.input]});
    await room.setMute(data.input==='host'?cfg.host:(cfg.interviewGuest||cfg.guest),!current.inputMuted);
  } else if (data.action === 'pick-media') {
    const kind = data.kind === 'image' ? 'image' : 'video';
    const file = await pickFile(kind);
    if (!file) return {ok: true, cancelled: true};
    const source = names[kind];
    await api('SetInputSettings', {inputName: source, inputSettings: kind === 'image' ? {file} : {local_file: file}, overlay: true});
    cfg[kind === 'image' ? 'imageFile' : 'mediaFile'] = file; save();
    await selectMedia(kind);
    return {ok: true, file};
  } else if (data.action === 'media-type') {
    if (!['video','image','share'].includes(data.kind)) throw new Error('Tipo inválido.');
    await selectMedia(data.kind);
  } else if (data.action === 'media-control') {
    if (!['RESTART','PAUSE','PLAY','STOP'].includes(data.command)) throw new Error('Comando inválido.');
    await api('TriggerMediaInputAction', {inputName: names.video, mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_' + data.command});
  } else if (data.action === 'record') {
    const r = await api('GetRecordStatus'); await api(r.outputActive ? 'StopRecord' : 'StartRecord');
  } else throw new Error('Ação desconhecida.');
  return {ok: true};
}
async function selectMedia(kind) {
  const {sceneItems} = await api('GetSceneItemList', {sceneName: SCENES.media});
  for (const k of ['video','image','share']) {
    await api('SetSceneItemEnabled', {sceneName: SCENES.media, sceneItemId: sceneItems.find(i => i.sourceName === names[k]).sceneItemId, sceneItemEnabled: k === kind});
  }
  cfg.mediaKind=kind;save();
}
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
function json(res, status, body) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(body)); }
const server = http.createServer(async (req, res) => {
  try {
    if (![`127.0.0.1:${cfg.port}`, `localhost:${cfg.port}`].includes(req.headers.host)) return json(res, 403, {error:'Acesso local obrigatório.'});
    const url = new URL(req.url, `http://127.0.0.1:${cfg.port}`);
    if (req.method === 'POST') {
      if (![`http://127.0.0.1:${cfg.port}`, `http://localhost:${cfg.port}`].includes(req.headers.origin)) return json(res, 403, {error:'Origem inválida.'});
      if(url.pathname==='/api/media/upload'){
        if(req.headers['content-type']!=='application/octet-stream')return json(res,415,{error:'Envie o arquivo pelo upload da biblioteca.'});
        const result=await mediaLibrary.upload(req,url.searchParams.get('name'));return json(res,result.reused?200:202,result);
      }
      if(req.headers['content-type']!=='application/json')return json(res,403,{error:'Formato de pedido inválido.'});
      const routes={
        '/api/chat/action':async d=>{if(d.action==='prepare')return ensureCommentOverlay();if(d.action==='show')await ensureCommentOverlay();return comments.action(d);},
        '/api/broadcast/action':d=>{const handlers={refresh:()=>broadcasts.refresh(),select:()=>broadcasts.select(d.id),start:()=>broadcasts.start(d.id),stop:()=>broadcasts.stop(d.id)};if(!handlers[d.action])throw Error('Comando de transmissão inválido.');return handlers[d.action]();},
        '/api/room/action':d=>room.action(d),
        '/api/room/return':d=>guestReturn(d.action),
        '/api/action':action,
        '/api/media/action':d=>mediaLibrary.control(d),
        '/api/youtube/credentials':async d=>{const result=await youtubeScheduler.importCredentials(d.credentials);comments.reset();return result;},
        '/api/youtube/connect':()=>youtubeScheduler.beginAuth(),
        '/api/youtube/disconnect':async()=>{const result=await youtubeScheduler.disconnect();comments.reset();return result;},
        '/api/youtube/schedule':d=>youtubeScheduler.schedule(d),
        '/api/youtube/retry':d=>youtubeScheduler.retry(d.requestId),
        '/api/youtube/refresh':async()=>({upcoming:await youtubeScheduler.upcoming(true)}),
      };
      if(!routes[url.pathname])return json(res,404,{error:'Rota inexistente.'});
      const limit=url.pathname==='/api/youtube/schedule'?3*1024*1024:65536;
      const chunks=[];let size=0;for await (const chunk of req) {size+=chunk.length;if(size>limit)throw new Error('Pedido muito grande. A thumb deve ter até 2 MB.');chunks.push(chunk);}
      let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('Pedido JSON inválido.');}
      if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Pedido JSON inválido.');
      return json(res, 200, await routes[url.pathname](data));
    }
    if (req.method !== 'GET') return json(res, 405, {error:'Método não permitido.'});
    if(url.pathname==='/api/health')return json(res,200,{ok:true,app:'APCE Studio'});
    if(url.pathname==='/api/chat/state')return json(res,200,comments.state());
    if(url.pathname==='/api/chat/overlay')return json(res,200,comments.overlay());
    if(url.pathname==='/api/broadcast/state')return json(res,200,await broadcasts.state());
    if(url.pathname==='/api/room/state')return json(res,200,room.state());
    if(url.pathname==='/api/room/stage')return json(res,200,room.stageState());
    if(url.pathname==='/api/media/state')return json(res,200,await mediaLibrary.state());
    if(url.pathname==='/api/media/item')return json(res,200,mediaLibrary.detail(url.searchParams.get('id')));
    if(url.pathname==='/api/media/file')return serveMediaFile(req,res,mediaLibrary.file(url.searchParams.get('id'),url.searchParams.get('variant')||'page',Number(url.searchParams.get('page')||0)));
    if(url.pathname==='/api/youtube/callback'||(url.pathname==='/'&&url.searchParams.has('state')&&(url.searchParams.has('code')||url.searchParams.has('error')))){
      let outcome='connected';try{await youtubeScheduler.callback(url.searchParams);}catch{outcome='error';}
      res.writeHead(303,{'Location':`http://127.0.0.1:${cfg.port}/?youtube=${outcome}#agendador`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();
    }
    if(url.pathname==='/api/youtube/state')return json(res,200,await youtubeScheduler.status());
    if(url.pathname==='/api/youtube/thumbnail'){
      const image=youtubeScheduler.thumbnailFile(url.searchParams.get('requestId'));
      if(!image||!fs.existsSync(image.file))return json(res,404,{error:'Thumb não encontrada.'});
      res.writeHead(200,{'Content-Type':image.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return fs.createReadStream(image.file).pipe(res);
    }
    if (url.pathname === '/api/state') return json(res, 200, await state());
    if (url.pathname === '/api/labels') return json(res, 200, cfg.labels);
    if (url.pathname === '/api/preview') {
      if (!connected) return json(res, 503, {error:'OBS desconectado.'});
      if (!snapshot || Date.now() - snapshotAt > 1400) {
        const {currentProgramSceneName} = await api('GetCurrentProgramScene');
        snapshot = (await api('GetSourceScreenshot', {sourceName: currentProgramSceneName, imageFormat:'jpg', imageWidth: 960, imageCompressionQuality: 75})).imageData;
        snapshotAt = Date.now();
      }
      return json(res, 200, {image: snapshot});
    }
    let target = path.resolve(BASE, 'public', '.' + (url.pathname === '/' ? '/index-v2.html' : decodeURIComponent(url.pathname)));
    if (!target.startsWith(path.join(BASE, 'public') + path.sep)) return json(res, 403, {error:'Acesso negado.'});
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return json(res, 404, {error:'Arquivo inexistente.'});
    res.writeHead(200, {'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'});
    fs.createReadStream(target).pipe(res);
  } catch(e) { json(res, e.status||400, {error:e.message,code:e.code||'INVALID'}); }
});
server.listen(cfg.port, '127.0.0.1', () => console.log(`Estúdio APCE: http://127.0.0.1:${cfg.port}`));

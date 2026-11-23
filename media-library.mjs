import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

const formats={'.pdf':['pdf','application/pdf',100],'.png':['image','image/png',25],'.jpg':['image','image/jpeg',25],'.jpeg':['image','image/jpeg',25],'.webp':['image','image/webp',25],'.mp4':['video','video/mp4',1024],'.m4v':['video','video/mp4',1024],'.mov':['video','video/quicktime',1024],'.webm':['video','video/webm',1024],'.mkv':['video','video/x-matroska',1024],'.avi':['video','video/x-msvideo',1024]};
const validId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id);
const error=(message,status=400)=>Object.assign(new Error(message),{status});
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(value,null,2),'utf8');fs.renameSync(file+'.tmp',file);}
const sameFile=(a,b)=>a&&b&&path.resolve(a).toLocaleLowerCase()===path.resolve(b).toLocaleLowerCase();

export function createMediaLibrary({base,api,isConnected,scenes,names,cfg,saveConfig,python='python',prepare}={}){
  const root=path.join(base,'Biblioteca de mídias'),originals=path.join(root,'Arquivos'),previews=path.join(root,'Prévias'),indexFile=path.join(base,'private/media-library.json');
  fs.mkdirSync(originals,{recursive:true});fs.mkdirSync(previews,{recursive:true});
  let data={version:1,items:[],active:null,returnScene:scenes.solo};
  try{data=JSON.parse(fs.readFileSync(indexFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const save=()=>atomic(indexFile,data);
  let workerRunning=false,mutation=Promise.resolve(),programCache=null,programAt=0;
  const serial=fn=>{const result=mutation.then(fn);mutation=result.catch(()=>{});return result;};
  const get=(id,archived=false)=>{const item=data.items.find(r=>r.id===id&&(archived||!r.archived));if(!validId(id)||!item)throw error('Mídia não encontrada.',404);return item;};
  function asset(item,page=0,thumb=false){
    if(!Number.isInteger(page)||page<0||page>=item.pageCount)throw error('Slide inválido.');
    if(item.kind==='deck')return asset(get(item.slides[page],true),0,thumb);
    const dir=path.join(previews,item.id);
    if(item.kind==='pdf')return path.join(dir,`${thumb?'thumb':'page'}-${String(page+1).padStart(4,'0')}.${thumb?'jpg':'png'}`);
    if(thumb)return path.join(dir,'thumb.jpg');
    return item.kind==='image'?path.join(dir,'image.png'):path.join(originals,item.file);
  }
  function view(item){
    const ready=item.status==='ready',revision=item.revision||1;return {id:item.id,title:item.title,revision,originalName:item.originalName||'',kind:item.kind,status:item.status,size:item.size||0,createdAt:item.createdAt,pageCount:item.pageCount||0,progress:item.progress||0,error:item.error||'',width:item.width,height:item.height,duration:item.duration||0,hasAudio:!!item.hasAudio,codec:item.codec||'',coverUrl:ready&&(item.kind!=='video'||item.poster)?`/api/media/file?id=${item.id}&variant=thumb&page=0&v=${revision}`:'',previewUrl:ready?`/api/media/file?id=${item.id}&variant=${item.kind==='video'?'original':'page'}&page=0&v=${revision}`:'',...(item.kind==='deck'?{slides:item.slides}:{} )};
  }
  async function runPreparation(item,onProgress){
    if(prepare)return prepare(item,onProgress);
    return new Promise((resolve,reject)=>{
      const child=spawn(python,[path.join(base,'scripts/preparar-midia.py')],{windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});
      let buffer='',result=null,problem='';
      child.stdout.setEncoding('utf8');
      const timer=setTimeout(()=>{child.kill();reject(error('A preparação demorou demais. Divida o PDF ou tente outro arquivo.'));},300000);
      child.stdout.on('data',chunk=>{buffer+=chunk;let line;while((line=buffer.indexOf('\n'))>=0){const text=buffer.slice(0,line);buffer=buffer.slice(line+1);try{const event=JSON.parse(text);if(event.error)problem=event.error;if(event.done)result=event;if(event.progress)onProgress(event);}catch{}}});
      child.stderr.resume();child.on('error',()=>{clearTimeout(timer);reject(error('Não foi possível abrir o preparador de mídias. Confira a instalação do Python.'));});
      child.on('close',code=>{clearTimeout(timer);code===0&&result?resolve(result):reject(error(problem||'Não foi possível preparar esta mídia.'));});
      child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({source:path.join(originals,item.file),output:path.join(previews,item.id),kind:item.kind,tools:path.join(os.homedir(),'.codex/skills/ffmpeg-skill/scripts')}));
    });
  }
  async function work(){
    if(workerRunning)return;workerRunning=true;
    try{let item;while((item=data.items.find(r=>r.status==='processing'&&!r.archived))){
      try{const metadata=await runPreparation(item,event=>{item.progress=event.progress;item.pageCount=event.pageCount;});Object.assign(item,metadata,{status:'ready',error:''});delete item.done;save();}
      catch(e){item.status='failed';item.error=e.message;save();}
    }}finally{workerRunning=false;}
  }
  queueMicrotask(work);
  async function upload(req,filename){
    const name=path.basename(String(filename||'').replaceAll('\\','/')).replace(/[\x00-\x1f]/g,' ').trim().slice(0,240),extension=path.extname(name).toLowerCase(),format=formats[extension];
    if(!format)throw error('Use PDF, JPG, PNG, WebP ou vídeo MP4, MOV, WebM, MKV ou AVI.');
    const [kind,mime,mb]=format,limit=mb*1024*1024;
    if(Number(req.headers?.['content-length']||0)>limit)throw error(`Este ${kind==='pdf'?'PDF':kind==='image'?'arquivo de imagem':'vídeo'} ultrapassa o limite de ${mb} MB.`,413);
    const id=crypto.randomUUID(),part=path.join(originals,id+'.part'),file=id+extension,hash=crypto.createHash('sha256');let size=0,head=Buffer.alloc(0);
    const inspect=new Transform({transform(chunk,encoding,callback){size+=chunk.length;if(size>limit)return callback(error(`O arquivo ultrapassa ${mb} MB.`,413));hash.update(chunk);if(head.length<1024)head=Buffer.concat([head,chunk.subarray(0,1024-head.length)]);callback(null,chunk);}});
    try{
      await pipeline(req,inspect,fs.createWriteStream(part,{flags:'wx'}));
      if(!size)throw error('O arquivo está vazio.');
      if(kind==='pdf'&&head.indexOf(Buffer.from('%PDF-'))<0)throw error('O conteúdo do arquivo não é um PDF válido.');
      const digest=hash.digest('hex'),existing=data.items.find(r=>r.hash===digest&&r.kind===kind&&!r.archived&&r.status!=='failed');
      if(existing){fs.unlinkSync(part);return {item:view(existing),reused:true};}
      fs.renameSync(part,path.join(originals,file));
      const item={id,title:name.slice(0,-extension.length).slice(0,160),originalName:name,kind,mime,file,size,hash:digest,status:'processing',pageCount:0,createdAt:new Date().toISOString()};
      data.items.unshift(item);save();work();return {item:view(item),reused:false};
    }catch(e){try{fs.unlinkSync(part);}catch{}throw e;}
  }
  async function program(force=false){
    if(!isConnected())return {connected:false,visible:false,id:null};
    if(!force&&programCache&&Date.now()-programAt<400)return programCache;
    try{
      const {currentProgramSceneName}=await api('GetCurrentProgramScene');
      if(currentProgramSceneName!==scenes.media){programCache={connected:true,visible:false,id:null,scene:currentProgramSceneName};programAt=Date.now();return programCache;}
      const {sceneItems}=await api('GetSceneItemList',{sceneName:scenes.media});
      const top=sceneItems.filter(i=>i.sceneItemEnabled&&['image','video','share'].some(k=>i.sourceName===names[k])).sort((a,b)=>b.sceneItemIndex-a.sceneItemIndex)[0];
      const kind=['image','video','share'].find(k=>top?.sourceName===names[k]);let active=null;
      if(kind==='image'||kind==='video'){
        const settings=(await api('GetInputSettings',{inputName:names[kind]})).inputSettings;
        const file=kind==='image'?settings.file:settings.local_file;
        if(data.active){const item=data.items.find(i=>i.id===data.active.id&&i.status==='ready');if(item&&sameFile(asset(item,data.active.page),file))active={item,page:data.active.page};}
        if(!active){const item=data.items.find(i=>!i.archived&&i.status==='ready'&&i.kind===kind&&sameFile(asset(i,0),file));if(item)active={item,page:0};}
      }
      const result={connected:true,visible:true,scene:currentProgramSceneName,id:active?.item.id||null,page:active?.page||0,pageCount:active?.item.pageCount||0,kind:active?.item.kind||kind||'',title:active?.item.title||'Mídia selecionada no OBS'};
      if(kind==='video'){
        const [playback,volume,muted,settings]=await Promise.all([api('GetMediaInputStatus',{inputName:names.video}),api('GetInputVolume',{inputName:names.video}),api('GetInputMute',{inputName:names.video}),api('GetInputSettings',{inputName:names.video})]);
        Object.assign(result,{mediaState:playback.mediaState,position:playback.mediaCursor||0,duration:playback.mediaDuration||0,volume:volume.inputVolumeMul,muted:muted.inputMuted,loop:!!settings.inputSettings.looping});
      }
      programCache=result;programAt=Date.now();return result;
    }catch{return {connected:isConnected(),visible:false,id:null,error:'Não foi possível consultar a mídia no OBS.'};}
  }
  async function state(){return {items:data.items.filter(i=>!i.archived).map(view),program:await program(),limits:{pdfMB:100,imageMB:25,videoMB:1024,pdfPages:200}};}
  function detail(id){const item=get(id);const result=view(item);if(item.status==='ready'&&item.kind!=='video')result.pages=Array.from({length:item.pageCount},(_,index)=>({index,label:item.kind==='deck'?get(item.slides[index],true).title:`${item.kind==='image'?'Imagem':'Página'} ${index+1}`,imageUrl:`/api/media/file?id=${id}&variant=page&page=${index}&v=${result.revision}`,thumbnailUrl:`/api/media/file?id=${id}&variant=thumb&page=${index}&v=${result.revision}`}));return result;}
  async function select(kind){
    const {sceneItems}=await api('GetSceneItemList',{sceneName:scenes.media});
    for(const k of ['video','image','share']){const item=sceneItems.find(i=>i.sourceName===names[k]);if(!item)throw error('As fontes da cena Mídia precisam ser reparadas pelo painel.');await api('SetSceneItemEnabled',{sceneName:scenes.media,sceneItemId:item.sceneItemId,sceneItemEnabled:k===kind});}
    cfg.mediaKind=kind;
  }
  async function take(id,page=0,onlyIfCurrent=false){
    if(!isConnected())throw error('Abra o OBS APCE para exibir a mídia.',409);
    const item=get(id);if(item.status!=='ready')throw error('Aguarde a preparação desta mídia.');
    const file=asset(item,page),current=await program(true);
    if(onlyIfCurrent&&(!current.visible||current.id!==id))throw error('Esta apresentação saiu do programa. Use Exibir no programa para colocá-la novamente.',409);
    if(!fs.existsSync(file))throw error('O arquivo de exibição não está disponível. Importe a mídia novamente.');
    if(!onlyIfCurrent&&!current.visible){data.returnScene=current.scene&&Object.values(scenes).includes(current.scene)?current.scene:scenes.solo;}
    const kind=item.kind==='video'?'video':'image';
    await api('SetInputSettings',{inputName:names[kind],inputSettings:kind==='video'?{local_file:file,is_local_file:true,looping:false,restart_on_activate:true,close_when_inactive:true,clear_on_media_end:false}:{file,unload:false},overlay:true});
    if(!onlyIfCurrent)await select(kind);
    if(kind==='video')cfg.mediaFile=file;else cfg.imageFile=file;
    saveConfig();data.active={id,page};save();
    if(!onlyIfCurrent)await api('SetCurrentProgramScene',{sceneName:scenes.media});
    if(kind==='video')await api('TriggerMediaInputAction',{inputName:names.video,mediaAction:'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART'});
    programAt=0;return {ok:true,program:await program(true)};
  }
  async function control(input){return serial(async()=>{
    const {action,id}=input;
    if(action==='take')return take(id,input.page??0);
    if(action==='slide')return take(id,input.page,true);
    if(action==='deck'){
      const title=String(input.title||'').trim().slice(0,160);if(!title)throw error('Dê um nome à apresentação.');
      if(!Array.isArray(input.slides)||!input.slides.length||input.slides.length>200)throw error('Escolha de 1 a 200 imagens para os slides.');
      const retained=new Set(id&&get(id).kind==='deck'?get(id).slides:[]);
      for(const slide of input.slides){const r=get(slide,retained.has(slide));if(r.kind!=='image'||r.status!=='ready')throw error('Os slides precisam ser imagens já preparadas na biblioteca.');}
      let item;
      if(id){item=get(id);if(item.kind!=='deck')throw error('Esta mídia não é uma apresentação de imagens.');if((await program(true)).id===id)throw error('Retire a apresentação do programa antes de reorganizar seus slides.',409);item.title=title;item.slides=[...input.slides];item.pageCount=input.slides.length;item.revision=(item.revision||1)+1;if(data.active?.id===id)data.active=null;}
      else{item={id:crypto.randomUUID(),title,kind:'deck',status:'ready',slides:[...input.slides],pageCount:input.slides.length,createdAt:new Date().toISOString()};data.items.unshift(item);}
      save();return {ok:true,item:detail(item.id)};
    }
    if(action==='rename'){const item=get(id);const title=String(input.title||'').trim();if(!title||title.length>160)throw error('Use um nome entre 1 e 160 caracteres.');item.title=title;save();return {ok:true};}
    if(action==='restore'){const item=get(id,true);item.archived=false;save();if(item.status==='processing')work();return {ok:true};}
    if(action==='archive'){const item=get(id);if((await program(true)).id===id)throw error('Retire esta mídia do programa antes de removê-la da biblioteca.',409);item.archived=true;save();return {ok:true};}
    if(!isConnected())throw error('O OBS APCE está desconectado.',409);
    const current=await program(true);
    if(action==='hide'){
      if(current.visible){await api('SetCurrentProgramScene',{sceneName:Object.values(scenes).includes(data.returnScene)?data.returnScene:scenes.solo});await api('TriggerMediaInputAction',{inputName:names.video,mediaAction:'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP'}).catch(()=>{});}
      programAt=0;return {ok:true,program:await program(true)};
    }
    if(!current.visible||current.kind!=='video'||current.id!==id)throw error('Coloque este vídeo no programa para controlar a reprodução.',409);
    if(action==='playback'){
      const commands={play:'PLAY',pause:'PAUSE',restart:'RESTART',stop:'STOP'};if(!commands[input.command])throw error('Comando inválido.');
      await api('TriggerMediaInputAction',{inputName:names.video,mediaAction:'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_'+commands[input.command]});
    }else if(action==='seek'){
      if(!Number.isFinite(input.position)||input.position<0||input.position>current.duration)throw error('Posição do vídeo inválida.');
      // O reprodutor nativo busca o quadro-chave anterior, sem mudar pausa ou áudio.
      await api('SetMediaInputCursor',{inputName:names.video,mediaCursor:Math.round(input.position)});
    }else if(action==='volume'){
      if(!Number.isFinite(input.volume)||input.volume<0||input.volume>1)throw error('Volume inválido.');await api('SetInputVolume',{inputName:names.video,inputVolumeMul:input.volume});
    }else if(action==='mute'){if(typeof input.muted!=='boolean')throw error('Estado de áudio inválido.');await api('SetInputMute',{inputName:names.video,inputMuted:input.muted});}
    else if(action==='loop'){if(typeof input.loop!=='boolean')throw error('Repetição inválida.');await api('SetInputSettings',{inputName:names.video,inputSettings:{looping:input.loop},overlay:true});}
    else throw error('Ação de mídia desconhecida.');
    programAt=0;return {ok:true,program:await program(true)};
  });}
  function file(id,variant='page',page=0){
    const item=get(id);if(item.status!=='ready')throw error('Mídia em preparação.',409);
    if(!['page','thumb','original'].includes(variant))throw error('Arquivo inválido.');
    const original=variant==='original';if(original&&item.kind==='deck')throw error('Esta apresentação é uma sequência de imagens.');
    return {file:original?path.join(originals,item.file):asset(item,page,variant==='thumb'),type:original||(item.kind==='video'&&variant==='page')?item.mime:variant==='thumb'?'image/jpeg':'image/png',name:item.originalName,attachment:original&&item.kind==='pdf'};
  }
  return {upload,state,detail,control,file,program,waitForIdle:async()=>{while(workerRunning)await new Promise(r=>setTimeout(r,20));}};
}

export function serveMediaFile(req,res,descriptor){
  const {file,type,name,attachment}=descriptor;if(!fs.existsSync(file))throw error('Arquivo não encontrado.',404);
  const size=fs.statSync(file).size;let start=0,end=size-1,status=200;
  const headers={'Content-Type':type,'X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Cache-Control':'private, max-age=3600'};
  if(attachment)headers['Content-Disposition']=`attachment; filename*=UTF-8''${encodeURIComponent(name)}`;
  if(req.headers.range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}
    if(match[1]){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;}else start=Math.max(0,size-Number(match[2]));
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}
    status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length']=end-start+1;res.writeHead(status,headers);const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());stream.pipe(res);
}

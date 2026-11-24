import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {openYouTubeChat} from './youtube-chat-stream.mjs';

const API='https://www.googleapis.com/youtube/v3/';
const SCOPE='https://www.googleapis.com/auth/youtube.force-ssl';
const oauthMessages={invalid_client:'A credencial OAuth não foi aceita pelo Google. Baixe o JSON completo do cliente correto e importe novamente.',unauthorized_client:'O tipo deste cliente OAuth não permite este login. Use Aplicativo Web ou Aplicativo para computador.',redirect_uri_mismatch:'O endereço de retorno não está autorizado no Google. Confira a URI mostrada na configuração do agendador.',invalid_grant:'O código de login expirou ou foi recusado. Inicie um novo login pelo painel.',access_denied:'O login não foi autorizado. Confira os usuários de teste do projeto e a conta selecionada.',admin_policy_enforced:'A política da conta Google bloqueou o aplicativo. Verifique a autorização com o administrador.'};
export const MAX_THUMB=2*1024*1024;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idPattern=/^[\w-]{11}$/;
const fail=(message,code='INVALID',status=400)=>Object.assign(new Error(message),{code,status});
function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',data,'utf8');fs.renameSync(file+'.tmp',file);}
function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
function dpapi(base,operation,value){return new Promise((resolve,reject)=>{
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(base,'scripts/dpapi.ps1')],{windowsHide:true});
  let output='';const timer=setTimeout(()=>{child.kill();reject(fail('Não foi possível abrir o armazenamento protegido do Windows.','STORAGE'));},15000);
  child.stdout.on('data',d=>output+=d.toString('utf8'));child.stderr.resume();child.on('error',()=>{clearTimeout(timer);reject(fail('Não foi possível acessar a proteção de credenciais do Windows.','STORAGE'));});
  child.on('close',code=>{clearTimeout(timer);code===0?resolve(output):reject(fail('Não foi possível abrir a conexão protegida. Conecte o YouTube novamente neste usuário do Windows.','STORAGE'));});
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({operation,value}));
});}

// A data do formulário sempre usa Brasília, mesmo se o navegador estiver em outro fuso.
export function brasiliaISO(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw fail('Informe data e horário completos.');
  const numbers=value.match(/\d+/g).map(Number),[y,m,d,h,min]=numbers;
  let ms=Date.UTC(y,m-1,d,h,min);
  const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  for(let n=0;n<3;n++){
    const parts=Object.fromEntries(fmt.formatToParts(ms).map(p=>[p.type,p.value]));
    const local=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute);
    ms+=Date.UTC(y,m-1,d,h,min)-local;
  }
  const p=Object.fromEntries(fmt.formatToParts(ms).map(p=>[p.type,p.value]));
  if(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`!==value)throw fail('Data ou horário inválido.');
  return new Date(ms).toISOString();
}
function thumbnail(input){
  if(!input||!['image/jpeg','image/png'].includes(input.type)||typeof input.data!=='string')throw fail('Escolha uma thumb JPG ou PNG.');
  if(input.data.length>Math.ceil(MAX_THUMB/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))throw fail('A thumb deve ter até 2 MB.');
  const bytes=Buffer.from(input.data,'base64');
  if(!bytes.length||bytes.length>MAX_THUMB||bytes.toString('base64')!==input.data)throw fail('Arquivo de thumb inválido.');
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg=bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217;
  if((input.type==='image/png'&&!png)||(input.type==='image/jpeg'&&!jpg))throw fail('O conteúdo da thumb não corresponde a JPG ou PNG.');
  return {bytes,type:input.type,extension:png?'png':'jpg'};
}
const googleMessages={
  accessNotConfigured:'Ative a YouTube Data API v3 no projeto Google Cloud e tente novamente.',
  serviceDisabled:'Ative a YouTube Data API v3 no projeto Google Cloud e tente novamente.',
  liveStreamingNotEnabled:'Ative as transmissões ao vivo no YouTube Studio deste canal antes de agendar.',
  livePermissionBlocked:'O YouTube bloqueou a permissão de transmitir ao vivo neste canal.',
  insufficientPermissions:'Conecte novamente o YouTube e autorize o acesso solicitado.',
  quotaExceeded:'A cota diária da API do YouTube acabou. Tente novamente após a renovação da cota.',
  forbidden:'O YouTube recusou esta operação. Confira as permissões do canal e os recursos de lives e thumbnails.',
  uploadRateLimitExceeded:'O YouTube limitou o envio de thumbs. Aguarde antes de reenviar.',
  invalidScheduledStartTime:'O YouTube recusou a data e hora. Escolha um horário futuro.',
  invalidImage:'O YouTube recusou a thumb. Escolha outro arquivo JPG ou PNG.',
  invalidTitle:'O YouTube recusou o título. Revise o texto e remova os sinais < e >.',
};
function safeEvent(item){return {id:item.id,title:item.snippet?.title||'',description:item.snippet?.description||'',scheduledStartTime:item.snippet?.scheduledStartTime||'',privacy:item.status?.privacyStatus||'private',madeForKids:item.status?.madeForKids??item.status?.selfDeclaredMadeForKids??null,hasLiveChat:!!item.snippet?.liveChatId,lifeCycleStatus:item.status?.lifeCycleStatus||'',thumbnail:item.snippet?.thumbnails?.medium?.url||'',url:`https://www.youtube.com/watch?v=${item.id}`,studioUrl:`https://studio.youtube.com/video/${item.id}/livestreaming`};}

export function createYouTubeScheduler({base,port,fetchImpl=fetch,clock=()=>Date.now(),protect,unprotect,watchChat=openYouTubeChat,authFile:externalAuthFile,broker=null}={}){
  const dir=path.join(base,'private/youtube'),legacyAuthFile=path.join(dir,'connection.dpapi'),authFile=externalAuthFile||legacyAuthFile,journalFile=path.join(dir,'schedules.json');
  let auth=null,loaded=false,loading=null,pending=null,authError='',authErrorCode='',refreshing=null,listing=null,listCache=null,listAt=0,busy=false,oauthBusy=false;
  const origin=`http://127.0.0.1:${port}`;
  const redirectFor=credentials=>['web','broker'].includes(credentials?.type)?`${origin}/api/youtube/callback`:`${origin}/`;
  const redirectUri=()=>redirectFor(auth?.credentials);
  const clientReady=()=>!!auth?.credentials&&(['web','broker'].includes(auth.credentials.type)||auth.credentials.desktopLoopback===true);
  const clientWarning='O JSON importado não confirma um cliente de computador com retorno local. Importe o JSON completo de um cliente Aplicativo Web ou Aplicativo para computador criado para este painel.';
  let journal=read(journalFile,{});
  const secure=protect||((s)=>dpapi(base,'protect',s));const unlock=unprotect||((s)=>dpapi(base,'unprotect',s));
  const saveJournal=()=>atomic(journalFile,JSON.stringify(journal,null,2));
  let brokerAttempt=-Infinity;
  async function prepareBroker(){
    if(!broker||auth?.credentials||clock()-brokerAttempt<30000)return;
    brokerAttempt=clock();
    try{auth={credentials:await broker.credentials(),tokens:null,account:null};await saveAuth();authError='';}
    catch(e){authError=e.message;}
  }
  async function load(){
    if(loaded)return;if(loading)return loading;
    loading=(async()=>{
      const source=fs.existsSync(authFile)?authFile:legacyAuthFile;
      if(fs.existsSync(source)){
        try{
          const encrypted=fs.readFileSync(source,'utf8');auth=JSON.parse(await unlock(encrypted));
          if(!auth||typeof auth!=='object'||Array.isArray(auth))throw Error('Armazenamento inválido');
          if(source!==authFile)atomic(authFile,encrypted);
        }catch{auth=null;authError='Reconecte o YouTube neste usuário do Windows.';}
      }
      await prepareBroker();loaded=true;
    })();return loading;
  }
  async function saveAuth(){atomic(authFile,await secure(JSON.stringify(auth)));}
  async function httpJSON(url,options={}){
    let response;try{response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(30000)});}catch{throw fail('Não foi possível confirmar a resposta do YouTube. Confira sua conexão.','NETWORK',502);}
    let data;try{data=await response.json();}catch{throw fail('O YouTube retornou uma resposta incompleta.','NETWORK',502);}
    if(!response.ok){
      const reason=data.error?.errors?.[0]?.reason||data.error?.details?.find?.(d=>d.reason)?.reason||data.error;
      const code=response.status===401?'AUTH_REQUIRED':response.status>=500?'REMOTE_UNCERTAIN':'YOUTUBE_ERROR';
      let message=typeof data.error==='string'?oauthMessages[reason]:'';
      if(typeof data.error==='string'&&/client_secret/i.test(data.error_description||''))message='O Google exige o client_secret deste cliente. Baixe o JSON completo no Google Cloud e importe novamente; não envie o segredo pelo chat.';
      throw Object.assign(fail(message||(response.status===401?'Conecte novamente o agendador ao YouTube.':googleMessages[reason]||`O YouTube recusou a solicitação (HTTP ${response.status}). Confira a conexão e as permissões do projeto.`),code,response.status>=500?502:400),{googleReason:typeof reason==='string'&&/^[a-zA-Z0-9_.-]{1,80}$/.test(reason)?reason:''});
    }
    return data;
  }
  async function token(force=false){
    await load();if(!auth?.tokens)throw fail('Conecte o agendador ao YouTube.','AUTH_REQUIRED',401);
    if(!force&&auth.tokens.access_token&&auth.tokens.expires_at>clock()+60000)return auth.tokens.access_token;
    if(!auth.tokens.refresh_token)throw fail('Conecte novamente o YouTube para renovar o acesso.','AUTH_REQUIRED',401);
    if(refreshing)return refreshing;
    refreshing=(async()=>{
      try{
        const data=auth.credentials.type==='broker'
          ?await broker.refresh(auth.tokens)
          :await httpJSON('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:auth.credentials.client_id,...(auth.credentials.client_secret?{client_secret:auth.credentials.client_secret}:{}),refresh_token:auth.tokens.refresh_token,grant_type:'refresh_token'})});
        if(!data.access_token)throw fail('Conecte novamente o YouTube.','AUTH_REQUIRED',401);
        auth.tokens={...auth.tokens,...data,expires_at:clock()+Number(data.expires_in||3600)*1000};await saveAuth();authError='';return auth.tokens.access_token;
      }catch(e){if(['YOUTUBE_ERROR','AUTH_REQUIRED','invalid_grant'].includes(e.code)){auth.tokens=null;authError='A autorização expirou ou foi revogada. Conecte novamente.';await saveAuth();throw fail(authError,'AUTH_REQUIRED',401);}throw e;}
      finally{refreshing=null;}
    })();return refreshing;
  }
  async function request(resource,options={},retry=true){
    const access=await token();
    try{return await httpJSON(resource.startsWith('https://')?resource:API+resource,{...options,headers:{...options.headers,Authorization:`Bearer ${access}`}});}
    catch(e){if(e.code==='AUTH_REQUIRED'&&retry){await token(true);return request(resource,options,false);}throw e;}
  }
  async function requireChannel(){
    await load();if(!auth?.account?.id)throw fail('Conecte o canal @apcedf ao agendador.','AUTH_REQUIRED',401);
    const mine=await request('channels?part=snippet&mine=true');
    if(!mine.items?.some(i=>i.id===auth.account.id))throw fail('A conexão não corresponde ao canal APCE. Conecte novamente.','WRONG_CHANNEL',403);
    return auth.account;
  }
  function publicRecord(r){return {requestId:r.requestId,id:r.id||'',title:r.title,scheduledStartTime:r.scheduledStartTime,privacy:r.privacy,phase:r.phase,error:r.error||'',url:r.id?`https://www.youtube.com/watch?v=${r.id}`:'',studioUrl:r.id?`https://studio.youtube.com/video/${r.id}/livestreaming`:'https://studio.youtube.com',thumbnailReady:r.phase==='complete'};}
  async function status(){await load();await prepareBroker();const incompatible=!!auth?.credentials&&!clientReady()&&!auth?.tokens;return {clientConfigured:clientReady(),clientType:auth?.credentials?.type||'installed',centralAuth:!!broker,oauth:{origin,redirectUri:redirectUri(),webRedirectUri:`${origin}/api/youtube/callback`,scope:SCOPE},connected:!!auth?.tokens&&!!auth?.account,account:auth?.tokens?auth.account:null,error:authError||(incompatible?clientWarning:''),errorCode:authErrorCode||(incompatible?'CLIENT_TYPE_REQUIRED':''),connecting:!!pending&&pending.expires>clock(),busy:busy||oauthBusy,events:Object.values(journal).map(publicRecord).sort((a,b)=>b.scheduledStartTime.localeCompare(a.scheduledStartTime)),upcoming:listCache||[]};}
  async function importCredentials(data){
    await load();if(busy||oauthBusy)throw fail('Aguarde a operação em andamento.','BUSY',409);
    const type=data?.web?'web':'installed',c=data?.web||data?.installed;
    if(data?.web&&data?.installed)throw fail('Importe o JSON de um único cliente OAuth.');
    if(!c||typeof c.client_id!=='string'||!/^\d+-[\w-]+\.apps\.googleusercontent\.com$/.test(c.client_id)||(c.client_secret!==undefined&&(typeof c.client_secret!=='string'||c.client_secret.length<8||c.client_secret.length>512))||(type==='web'&&!c.client_secret))throw fail('Importe o JSON completo de um cliente OAuth Aplicativo Web ou Aplicativo para computador. Chaves de API e contas de serviço não conectam o canal.');
    if(type==='web'&&(!Array.isArray(c.redirect_uris)||!c.redirect_uris.includes(`${origin}/api/youtube/callback`)))throw fail(`Neste cliente Web, adicione a URI de redirecionamento ${origin}/api/youtube/callback no Google Cloud e baixe o JSON atualizado. Preserve os outros endereços já cadastrados.`);
    const desktopLoopback=type==='installed'&&Array.isArray(c.redirect_uris)&&c.redirect_uris.some(value=>{try{const u=new URL(value);return u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);}catch{return false;}});
    if(type==='installed'&&!desktopLoopback)throw fail(clientWarning,'CLIENT_TYPE_REQUIRED');
    oauthBusy=true;try{auth={credentials:{type,...(desktopLoopback?{desktopLoopback:true}:{}),client_id:c.client_id,...(c.client_secret?{client_secret:c.client_secret}:{})},tokens:null,account:null};pending=null;authError='';authErrorCode='';listCache=null;await saveAuth();return {ok:true};}finally{oauthBusy=false;}
  }
  async function beginAuth(){
    await load();await prepareBroker();if(!auth?.credentials)throw fail(broker?'O serviço de conexão da APCE está indisponível. Tente novamente.':'Importe primeiro o arquivo JSON OAuth do Google.','CLIENT_REQUIRED');
    if(!clientReady())throw fail(clientWarning,'CLIENT_TYPE_REQUIRED');
    if(busy||oauthBusy)throw fail('Aguarde a operação em andamento.','BUSY',409);
    const verifier=crypto.randomBytes(48).toString('base64url'),state=crypto.randomBytes(32).toString('base64url');
    const credentials=broker?await broker.credentials():auth.credentials;
    pending={verifier,state,credentials,redirectUri:redirectFor(credentials),expires:clock()+10*60000};authError='';authErrorCode='';
    const params=new URLSearchParams({client_id:credentials.client_id,redirect_uri:pending.redirectUri,response_type:'code',scope:SCOPE,access_type:'offline',prompt:'consent select_account',state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
    return {url:'https://accounts.google.com/o/oauth2/v2/auth?'+params};
  }
  async function callback(params){
    await load();const state=params.get('state')||'';
    if(!pending||pending.expires<clock()||Buffer.byteLength(state)!==Buffer.byteLength(pending.state)||!crypto.timingSafeEqual(Buffer.from(state),Buffer.from(pending.state)))throw fail('Este login expirou ou não foi iniciado pelo painel. Volte ao agendador e conecte novamente.','OAUTH_STATE');
    const session=pending;pending=null;oauthBusy=true;
    try{
      if(params.get('error'))throw Object.assign(fail(oauthMessages[params.get('error')]||'A conexão ao YouTube não foi autorizada. Tente novamente no agendador.','AUTH_REQUIRED'),{googleReason:oauthMessages[params.get('error')]?params.get('error'):'AUTH_REQUIRED'});
      const code=params.get('code');if(!code||code.length>4096)throw fail('O Google não retornou um código válido.');
      const data=session.credentials.type==='broker'
        ?await broker.exchange({code,verifier:session.verifier,redirectUri:session.redirectUri})
        :await httpJSON('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:session.credentials.client_id,...(session.credentials.client_secret?{client_secret:session.credentials.client_secret}:{}),code,code_verifier:session.verifier,grant_type:'authorization_code',redirect_uri:session.redirectUri})});
      if(!data.access_token||!data.refresh_token)throw fail('O Google não concedeu acesso contínuo. Conecte novamente e autorize o acesso.','AUTH_REQUIRED');
      if(!String(data.scope||'').split(/\s+/).includes(SCOPE))throw fail('Autorize a permissão de acesso ao YouTube solicitada pelo agendador.','AUTH_REQUIRED');
      const headers={Authorization:`Bearer ${data.access_token}`};
      const mine=await httpJSON(API+'channels?part=snippet&mine=true',{headers});
      const target=await httpJSON(API+'channels?part=snippet&forHandle=apcedf',{headers});
      const account=mine.items?.find(i=>i.id===target.items?.[0]?.id);
      if(!account)throw fail('O canal selecionado não é @apcedf. Conecte novamente e escolha o canal da APCE.','WRONG_CHANNEL');
      auth={credentials:session.credentials,tokens:{...data,expires_at:clock()+Number(data.expires_in||3600)*1000},account:{id:account.id,title:account.snippet.title,handle:'@apcedf'}};authError='';authErrorCode='';listCache=null;await saveAuth();return {ok:true};
    }catch(e){authError=e.message;authErrorCode=e.googleReason||e.code||'OAUTH_ERROR';throw e;}finally{oauthBusy=false;}
  }
  async function disconnect(){await load();if(busy||oauthBusy)throw fail('Aguarde a operação em andamento.','BUSY',409);if(auth){auth.tokens=null;auth.account=null;await saveAuth();}pending=null;listCache=null;authError='';return {ok:true};}
  async function upcoming(force=false){
    if(!force&&listCache&&clock()-listAt<60000)return listCache;
    if(listing)return listing;
    listing=(async()=>{try{await requireChannel();let page='',items=[];do{const data=await request('liveBroadcasts?'+new URLSearchParams({part:'snippet,status,contentDetails',broadcastStatus:'upcoming',broadcastType:'all',maxResults:'50',...(page?{pageToken:page}:{})}));items.push(...(data.items||[]));page=data.nextPageToken||'';}while(page&&items.length<500);listCache=items.map(safeEvent).sort((a,b)=>a.scheduledStartTime.localeCompare(b.scheduledStartTime));listAt=clock();return listCache;}finally{listing=null;}})();return listing;
  }
  async function finish(r){
    try{
      r.phase='thumbnail';r.error='';saveJournal();
      const bytes=fs.readFileSync(path.join(dir,r.thumbFile));
      await request('https://www.googleapis.com/upload/youtube/v3/thumbnails/set?'+new URLSearchParams({videoId:r.id,uploadType:'media'}),{method:'POST',headers:{'Content-Type':r.thumbType},body:bytes});
      r.phase='complete';r.error='';saveJournal();listCache=null;return publicRecord(r);
    }catch(e){r.phase='thumbnail_failed';r.error='A live foi criada, mas a thumb não foi confirmada. '+e.message;saveJournal();return publicRecord(r);}
  }
  async function recover(r){
    // Nunca repetimos um insert cuja resposta pode ter se perdido.
    const data=await request('liveBroadcasts?part=snippet,status&broadcastStatus=upcoming&broadcastType=all&maxResults=50');
    const matches=(data.items||[]).filter(i=>!r.beforeIds.includes(i.id)&&i.snippet?.title===r.title&&i.snippet?.description===r.description&&new Date(i.snippet.scheduledStartTime).getTime()===new Date(r.scheduledStartTime).getTime()&&i.status?.privacyStatus===r.privacy);
    if(matches.length===1&&idPattern.test(matches[0].id)){r.id=matches[0].id;saveJournal();return finish(r);}
    r.phase='uncertain';r.error='A criação ficou sem confirmação. Confira o YouTube Studio antes de tentar criar outra live. Nenhum novo evento foi enviado nesta tentativa.';saveJournal();return publicRecord(r);
  }
  async function schedule(input){
    if(busy)throw fail('Já há um agendamento em envio. Aguarde a conclusão.','BUSY',409);busy=true;
    try{
      if(!input||typeof input!=='object')throw fail('Pedido inválido.');
      const requestId=String(input.requestId||'');if(!uuid.test(requestId))throw fail('Identificador de envio inválido. Recarregue o painel.');
      const title=String(input.title||'').trim(),description=String(input.description||'').trim();
      if(!title||title.length>100||/[<>]/.test(title))throw fail('Informe um título de até 100 caracteres, sem < ou >.');
      if(!description||description.length>5000||/[<>]/.test(description))throw fail('Informe uma descrição de até 5.000 caracteres, sem < ou >.');
      if(!['public','unlisted','private'].includes(input.privacy))throw fail('Escolha a visibilidade.');
      if(typeof input.madeForKids!=='boolean')throw fail('Informe se a live é feita para crianças.');
      const scheduledStartTime=brasiliaISO(input.startLocal),thumb=thumbnail(input.thumbnail);
      const hash=crypto.createHash('sha256').update(JSON.stringify({title,description,scheduledStartTime,privacy:input.privacy,madeForKids:input.madeForKids})).update(thumb.bytes).digest('hex');
      let r=journal[requestId]||Object.values(journal).find(r=>r.hash===hash);
      if(r&&r.hash!==hash)throw fail('Este envio já foi usado com outros dados. Inicie um novo agendamento.','CONFLICT',409);
      if(r?.phase==='complete')return publicRecord(r);
      await requireChannel();
      if(r?.id)return finish(r);
      if(r&&['creating','uncertain'].includes(r.phase))return recover(r);
      if(new Date(scheduledStartTime).getTime()<clock()+60000)throw fail('Escolha um horário pelo menos um minuto no futuro.');
      // A lista anterior permite identificar um insert concluído mesmo após perda da resposta.
      const before=await upcoming(true);
      if(!r){r={requestId,hash,title,description,scheduledStartTime,privacy:input.privacy,madeForKids:input.madeForKids,thumbFile:`thumbs/${requestId}.${thumb.extension}`,thumbType:thumb.type,createdAt:new Date(clock()).toISOString()};journal[requestId]=r;}
      fs.mkdirSync(path.join(dir,'thumbs'),{recursive:true});fs.writeFileSync(path.join(dir,r.thumbFile),thumb.bytes);
      r.beforeIds=before.map(i=>i.id);r.phase='creating';r.error='';saveJournal();
      try{
        const data=await request('liveBroadcasts?part=snippet,status,contentDetails',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({snippet:{title,description,scheduledStartTime},status:{privacyStatus:input.privacy,selfDeclaredMadeForKids:input.madeForKids},contentDetails:{enableAutoStart:false,enableAutoStop:false,enableDvr:true,monitorStream:{enableMonitorStream:false}}})});
        if(!idPattern.test(data.id||''))throw fail('A criação não retornou um identificador válido.','REMOTE_UNCERTAIN',502);
        r.id=data.id;saveJournal();return finish(r);
      }catch(e){r.phase=['NETWORK','REMOTE_UNCERTAIN'].includes(e.code)?'uncertain':'rejected';r.error=e.message;saveJournal();return publicRecord(r);}
    }finally{busy=false;}
  }
  async function retry(requestId){
    if(busy)throw fail('Aguarde o envio em andamento.','BUSY',409);busy=true;
    try{if(!uuid.test(requestId||'')||!journal[requestId])throw fail('Agendamento não encontrado.');const r=journal[requestId];if(r.phase==='complete')return publicRecord(r);await requireChannel();if(r.id)return finish(r);if(['creating','uncertain'].includes(r.phase))return recover(r);throw fail('Revise os dados e envie o formulário novamente.');}finally{busy=false;}
  }
  function thumbnailFile(requestId){const r=journal[requestId];if(!r||!uuid.test(requestId))return null;return {file:path.join(dir,r.thumbFile),type:r.thumbType};}
  // Uso exclusivo do servidor: a chave de ingestão nunca faz parte do estado público.
  async function broadcast(id){
    if(!idPattern.test(id||''))throw fail('Selecione uma live válida.');
    const account=await requireChannel();
    const data=await request('liveBroadcasts?'+new URLSearchParams({part:'id,snippet,status,contentDetails',id}));
    const item=data.items?.find(i=>i.id===id&&i.snippet?.channelId===account.id);
    if(!item)throw fail('Esta live não pertence ao canal conectado.','WRONG_CHANNEL',403);
    return item;
  }
  async function liveOptions(){
    await requireChannel();
    const data=await request('liveBroadcasts?part=id,snippet,status,contentDetails&broadcastStatus=active&broadcastType=all&maxResults=50');
    return [...(data.items||[]).map(safeEvent),...await upcoming(true)];
  }
  async function ingest(id){
    const item=await broadcast(id);
    if(!['created','ready','testing'].includes(item.status?.lifeCycleStatus))throw fail('Esta live já começou ou foi encerrada. Atualize a lista.','LIVE_STATE',409);
    let streamId=item.contentDetails?.boundStreamId;
    if(!streamId){
      // Registro sem chave: permite reutilizar a entrada se a resposta do bind se perder.
      const file=path.join(dir,'ingest.json'),entries=read(file,{});
      streamId=entries[id];
      if(!streamId){
        const created=await request('liveStreams?part=id,snippet,cdn,contentDetails',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({snippet:{title:`APCE · ${id}`},cdn:{frameRate:'variable',resolution:'variable',ingestionType:'rtmp'},contentDetails:{isReusable:false}})});
        if(!created.id)throw fail('O YouTube não confirmou a entrada de vídeo. Atualize antes de tentar novamente.');
        streamId=created.id;entries[id]=streamId;atomic(file,JSON.stringify(entries));
      }
      await request('liveBroadcasts/bind?'+new URLSearchParams({id,streamId,part:'id,status,contentDetails'}),{method:'POST'});
    }
    const stream=await streamInfo(streamId);
    const key=stream.cdn?.ingestionInfo?.streamName;
    if(!key)throw fail('O YouTube não retornou a entrada de vídeo da live.');
    return {id,streamId,key,server:'rtmps://a.rtmps.youtube.com:443/live2'};
  }
  async function streamInfo(id){
    if(typeof id!=='string'||!id||id.length>200||!/^[\w-]+$/.test(id))throw fail('Entrada de vídeo inválida.');
    const data=await request('liveStreams?'+new URLSearchParams({part:'id,cdn,status',id}));
    if(!data.items?.[0])throw fail('Entrada de vídeo não encontrada.');return data.items[0];
  }
  async function transition(id,value){
    if(!['live','complete'].includes(value))throw fail('Estado de transmissão inválido.');
    const item=await broadcast(id);
    if(item.status.lifeCycleStatus===value)return item;
    const result=await request('liveBroadcasts/transition?'+new URLSearchParams({id,broadcastStatus:value,part:'id,snippet,status,contentDetails'}),{method:'POST'});
    listCache=null;return result;
  }
  return {status,importCredentials,beginAuth,callback,disconnect,upcoming,schedule,retry,thumbnailFile,
    chat:{info:broadcast,watch:async options=>{
      if(typeof options.chatId!=='string'||!options.chatId||options.chatId.length>2048)throw fail('Chat da transmissão inválido.');
      return watchChat({...options,access:await token(options.forceToken)});
    }},
    live:{options:liveOptions,broadcast,ingest,streamInfo,transition,safeEvent}};
}

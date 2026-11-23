import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

export const SCOPE='https://www.googleapis.com/auth/youtube.force-ssl';
export const REDIRECT='http://127.0.0.1:3210/api/youtube/callback';
const failure=(message,status=400,code='INVALID')=>Object.assign(new Error(message),{status,code});
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
const limited=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;

export function createAuthService({config,fetchImpl=fetch,clock=Date.now,rateLimit=30,rateCapacity=10000}={}){
  if(!/^\d+-[\w-]+\.apps\.googleusercontent\.com$/.test(config?.client_id||'')||!limited(config?.client_secret,512)||!limited(config?.channel_id,64)||!limited(config?.ticket_key,512)||config.ticket_key.length<43)throw Error('Configuração privada do serviço OAuth incompleta.');
  const rates=new Map();
  function ticket(refreshToken){
    const body=Buffer.from(JSON.stringify({v:1,channel:config.channel_id,client:config.client_id,token:digest(refreshToken),expires:clock()+365*86400000})).toString('base64url');
    return body+'.'+crypto.createHmac('sha256',config.ticket_key).update(body).digest('base64url');
  }
  function verifyTicket(proof,refreshToken){
    if(!limited(proof,2048)||!limited(refreshToken,8192))throw failure('Conecte novamente o YouTube no painel.',401,'AUTH_REQUIRED');
    const parts=proof.split('.');
    if(parts.length!==2||!equal(parts[1],crypto.createHmac('sha256',config.ticket_key).update(parts[0]).digest('base64url')))throw failure('Conexão não reconhecida. Autorize o canal novamente.',401,'AUTH_REQUIRED');
    let data;try{data=JSON.parse(Buffer.from(parts[0],'base64url').toString());}catch{throw failure('Conexão inválida.',401,'AUTH_REQUIRED');}
    if(data.v!==1||data.channel!==config.channel_id||data.client!==config.client_id||data.expires<=clock()||!equal(data.token,digest(refreshToken)))throw failure('A conexão expirou. Autorize o canal novamente.',401,'AUTH_REQUIRED');
  }
  async function google(url,options){
    let response,data;
    try{response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(20000)});data=await response.json();}catch{throw failure('O Google não respondeu. Tente novamente.',502,'NETWORK');}
    if(!response.ok){
      const reason=typeof data.error==='string'?data.error:data.error?.errors?.[0]?.reason;
      const known=['invalid_grant','invalid_client','access_denied','insufficientPermissions','accessNotConfigured','quotaExceeded'];
      throw failure(reason==='invalid_grant'?'A autorização expirou ou foi revogada. Conecte novamente.':'O Google recusou a autorização. Confira o projeto e as permissões do canal.',response.status>=500?502:400,known.includes(reason)?reason:'GOOGLE_ERROR');
    }
    return data;
  }
  const exchangeToken=body=>google('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...body,client_id:config.client_id,client_secret:config.client_secret})});
  async function exchange(data){
    if(data.redirect_uri!==REDIRECT||!limited(data.code,4096)||!/^[-._~A-Za-z0-9]{43,128}$/.test(data.code_verifier||''))throw failure('Solicitação de autorização inválida.');
    const tokens=await exchangeToken({code:data.code,code_verifier:data.code_verifier,grant_type:'authorization_code',redirect_uri:REDIRECT});
    if(!tokens.access_token||!tokens.refresh_token||!String(tokens.scope||'').split(/\s+/).includes(SCOPE))throw failure('Autorize o acesso ao YouTube solicitado pelo painel.',400,'AUTH_REQUIRED');
    const mine=await google('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',{headers:{Authorization:'Bearer '+tokens.access_token}});
    const channel=mine.items?.find(item=>item.id===config.channel_id);
    if(!channel)throw failure('O canal selecionado não é @apcedf. Escolha o canal da APCE.',403,'WRONG_CHANNEL');
    return {access_token:tokens.access_token,refresh_token:tokens.refresh_token,expires_in:tokens.expires_in||3600,token_type:'Bearer',scope:tokens.scope,broker_ticket:ticket(tokens.refresh_token),account:{id:channel.id,title:channel.snippet.title,handle:'@apcedf'}};
  }
  async function refresh(data){
    verifyTicket(data.broker_ticket,data.refresh_token);
    const tokens=await exchangeToken({refresh_token:data.refresh_token,grant_type:'refresh_token'});
    if(!tokens.access_token)throw failure('O Google não renovou a conexão.',401,'AUTH_REQUIRED');
    const refreshToken=tokens.refresh_token||data.refresh_token;
    return {access_token:tokens.access_token,refresh_token:refreshToken,expires_in:tokens.expires_in||3600,token_type:'Bearer',scope:tokens.scope||SCOPE,broker_ticket:ticket(refreshToken)};
  }
  const respond=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(data));};
  return http.createServer(async(req,res)=>{
    try{
      const pathname=new URL(req.url,'http://localhost').pathname;
      if(pathname==='/health'&&req.method==='GET')return respond(res,200,{ok:true,service:'APCE Stream OAuth',version:1});
      if(req.headers.origin)throw failure('Use a conexão pelo painel local.',403,'ORIGIN');
      const key=String(req.headers['x-apce-client-ip']||req.socket.remoteAddress).slice(0,128),minute=Math.floor(clock()/60000);
      if(rates.size>=rateCapacity)for(const [k,v]of rates)if(v.minute!==minute)rates.delete(k);
      const rate=rates.get(key);if(rate?.minute===minute&&rate.count>=rateLimit)throw failure('Aguarde um minuto antes de tentar novamente.',429,'RATE_LIMIT');
      if(!rate&&rates.size>=rateCapacity)throw failure('Tente novamente em um minuto.',429,'RATE_LIMIT');
      rates.set(key,{minute,count:rate?.minute===minute?rate.count+1:1});
      if(pathname==='/v1/config'&&req.method==='GET')return respond(res,200,{version:1,client_id:config.client_id,redirect_uri:REDIRECT,scope:SCOPE,channel:'@apcedf'});
      if(req.method!=='POST'||!['/v1/exchange','/v1/refresh'].includes(pathname))throw failure('Endereço não encontrado.',404,'NOT_FOUND');
      if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw failure('Envie os dados em JSON.',415);
      let body='';for await(const chunk of req){body+=chunk.toString('utf8');if(Buffer.byteLength(body)>16384)throw failure('Solicitação grande demais.',413);}
      let data;try{data=JSON.parse(body);}catch{throw failure('JSON inválido.');}
      if(!data||Array.isArray(data)||typeof data!=='object')throw failure('Solicitação inválida.');
      respond(res,200,pathname==='/v1/exchange'?await exchange(data):await refresh(data));
    }catch(error){respond(res,error.status||500,{error:error.status?error.message:'Não foi possível concluir a autorização.',code:error.code||'INTERNAL'});}
  });
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===fs.realpathSync(process.argv[1])){
  const config=JSON.parse(fs.readFileSync(process.env.APCE_AUTH_CONFIG||'/run/secrets/oauth.json','utf8'));
  const server=createAuthService({config});
  server.requestTimeout=30000;server.headersTimeout=15000;server.maxConnections=100;
  server.listen(Number(process.env.PORT||3291),'0.0.0.0',()=>console.log('APCE Stream OAuth disponível.'));
  process.on('SIGTERM',()=>{server.close();setTimeout(()=>process.exit(0),3000).unref();});
}

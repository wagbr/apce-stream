import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {createYouTubeScheduler,brasiliaISO} from '../youtube-scheduler.mjs';

const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=';
const credentials={installed:{client_id:'12345-test-client.apps.googleusercontent.com',client_secret:'test-secret-only',redirect_uris:['http://localhost']}};
const initial=Date.parse('2026-11-20T12:00:00Z');
function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'apce-scheduler-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const state={now:initial,calls:[],events:[],uploads:0,inserts:0,wrong:false,thumbFail:false,createTimeout:false,createReject:false,createDrop:false,refreshFail:false,hold:null};
  const reply=(data,status=200)=>({ok:status<400,status,json:async()=>data});
  const fetchImpl=async(url,options={})=>{
    const u=new URL(url);state.calls.push({url:u.toString(),...options});
    if(u.hostname==='oauth2.googleapis.com'){
      const params=new URLSearchParams(options.body);if(params.get('grant_type')==='authorization_code')assert.ok(params.get('code_verifier').length>=43);
      if(state.oauthError)return reply(state.oauthError,400);
      if(state.refreshFail&&params.get('grant_type')==='refresh_token')return reply({error:'invalid_grant'},400);
      return reply({access_token:'test-access-token',refresh_token:'test-refresh-token',expires_in:3600,scope:'https://www.googleapis.com/auth/youtube.force-ssl'});
    }
    assert.equal(options.headers.Authorization,'Bearer test-access-token');
    if(u.pathname.endsWith('/channels'))return reply({items:[{id:state.wrong&&u.searchParams.has('mine')?'UC_WRONG':'UC_APCE_TEST',snippet:{title:'APCE — Associação',customUrl:'@apcedf'}}]});
    if(u.pathname.endsWith('/thumbnails/set')){state.uploads++;assert.equal(options.headers['Content-Type'],'image/png');assert.ok(Buffer.isBuffer(options.body));if(state.thumbFail)return reply({error:{errors:[{reason:'forbidden'}]}},403);return reply({items:[{}]});}
    if(u.pathname.endsWith('/liveBroadcasts')){
      if(options.method==='POST'){
        state.inserts++;if(state.hold)await state.hold;
        if(state.createReject)return reply({error:{errors:[{reason:'liveStreamingNotEnabled'}]}},403);
        const body=JSON.parse(options.body);assert.equal(body.contentDetails.enableAutoStart,false);assert.equal(body.contentDetails.enableAutoStop,false);assert.equal(body.snippet.scheduledStartTime,'2026-11-21T21:30:00.000Z');
        const e={id:'apceLive001',...body};if(!state.createDrop)state.events.push(e);
        if(state.createTimeout)throw Error('Simulated response lost');return reply(e);
      }
      assert.equal(u.searchParams.get('broadcastStatus'),'upcoming');assert.equal(u.searchParams.has('mine'),false);return reply({items:state.events});
    }
    throw Error('Unexpected Google endpoint: '+u.pathname);
  };
  const opts={base:dir,port:3210,fetchImpl,clock:()=>state.now,protect:async s=>'protected:'+Buffer.from(s).toString('base64'),unprotect:async s=>Buffer.from(s.slice(10),'base64').toString()};
  const scheduler=createYouTubeScheduler(opts);
  const input=()=>({requestId:crypto.randomUUID(),title:'Ciência, laicidade e razão',description:'Uma conversa sobre ciência.\nCom acentuação correta.',startLocal:'2026-11-21T18:30',privacy:'public',madeForKids:false,thumbnail:{type:'image/png',data:PNG}});
  const login=async(s=scheduler)=>{await s.importCredentials(credentials);const {url}=await s.beginAuth();const u=new URL(url);assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('redirect_uri'),'http://127.0.0.1:3210/');return s.callback(new URLSearchParams({state:u.searchParams.get('state'),code:'fake-code'}));};
  return {scheduler,state,input,login,opts,dir};
}
test('Brasília independe do fuso do computador e rejeita datas inválidas',()=>{
  assert.equal(brasiliaISO('2026-11-21T18:30'),'2026-11-21T21:30:00.000Z');
  for(const x of ['2026-02-30T10:00','2026-13-01T10:00','2026-11-21T25:00','2026-1-2T10:00',''])assert.throws(()=>brasiliaISO(x));
});
test('OAuth com PKCE, estado de uso único, canal APCE e nenhum segredo no status',async t=>{
  const {scheduler:s,login,dir}=fixture(t);await assert.rejects(s.importCredentials({web:credentials.installed}));await login();const status=await s.status();assert.equal(status.connected,true);assert.equal(status.account.handle,'@apcedf');assert.ok(!/test-secret|test-access-token|test-refresh-token/.test(JSON.stringify(status)));assert.ok(fs.readFileSync(path.join(dir,'private/youtube/connection.dpapi'),'utf8').startsWith('protected:'));await assert.rejects(s.callback(new URLSearchParams({state:'replayed',code:'code'})),{code:'OAUTH_STATE'});
});
test('rejeita callback forjado e canal que não é @apcedf',async t=>{
  const {scheduler:s,state,login}=fixture(t);await s.importCredentials(credentials);await s.beginAuth();await assert.rejects(s.callback(new URLSearchParams({state:'forged',code:'code'})),{code:'OAUTH_STATE'});state.wrong=true;await assert.rejects(login(),{code:'WRONG_CHANNEL'});assert.equal((await s.status()).connected,false);
});
test('agenda título, descrição, Brasília, público e thumb sem iniciar transmissão',async t=>{
  const {scheduler:s,state,input,login}=fixture(t);await login();const r=await s.schedule(input());assert.equal(r.phase,'complete');assert.equal(r.url,'https://www.youtube.com/watch?v=apceLive001');assert.equal(state.inserts,1);assert.equal(state.uploads,1);const body=JSON.parse(state.calls.find(c=>c.url.includes('/liveBroadcasts?')&&c.method==='POST').body);assert.equal(body.status.selfDeclaredMadeForKids,false);assert.equal(body.status.privacyStatus,'public');assert.ok(!state.calls.some(c=>/liveStreams|\/bind|\/transition/.test(c.url)));
});
test('dois cliques, nova chave e reinício não duplicam o mesmo agendamento',async t=>{
  const {scheduler:s,state,input,login,opts}=fixture(t);await login();const data=input();await s.schedule(data);await s.schedule(data);await s.schedule({...data,requestId:crypto.randomUUID()});const restarted=createYouTubeScheduler(opts);await restarted.schedule(data);assert.equal(state.inserts,1);assert.equal(state.uploads,1);
});
test('falha de thumb preserva ID e repete somente upload após reiniciar',async t=>{
  const {scheduler:s,state,input,login,opts}=fixture(t);await login();state.thumbFail=true;const data=input(),r=await s.schedule(data);assert.equal(r.phase,'thumbnail_failed');assert.equal(r.id,'apceLive001');state.thumbFail=false;const restarted=createYouTubeScheduler(opts);const retried=await restarted.retry(data.requestId);assert.equal(retried.phase,'complete');assert.equal(state.inserts,1);assert.equal(state.uploads,2);
});
test('resposta perdida do insert recupera a live em vez de criar outra',async t=>{
  const {scheduler:s,state,input,login,opts}=fixture(t);await login();state.createTimeout=true;const data=input();assert.equal((await s.schedule(data)).phase,'uncertain');state.createTimeout=false;const restarted=createYouTubeScheduler(opts);assert.equal((await restarted.retry(data.requestId)).phase,'complete');assert.equal(state.inserts,1);
});
test('criação sem confirmação nunca repete insert automaticamente',async t=>{
  const {scheduler:s,state,input,login}=fixture(t);await login();state.createTimeout=true;state.createDrop=true;const data=input();assert.equal((await s.schedule(data)).phase,'uncertain');assert.equal((await s.retry(data.requestId)).phase,'uncertain');assert.equal((await s.schedule(data)).phase,'uncertain');assert.equal(state.inserts,1);assert.equal(state.uploads,0);
});
test('erro definitivo do YouTube pode ser corrigido e reenviado',async t=>{
  const {scheduler:s,state,input,login}=fixture(t);await login();state.createReject=true;const data=input();const r=await s.schedule(data);assert.equal(r.phase,'rejected');assert.match(r.error,/Ative as transmissões/);state.createReject=false;assert.equal((await s.schedule(data)).phase,'complete');
});
test('valida horário futuro, limite, tipo de thumb e conflitos sem criar eventos',async t=>{
  const {scheduler:s,state,input,login}=fixture(t);await login();for(const diff of [{title:'x'.repeat(101)},{title:'<invalido>'},{description:''},{startLocal:'2026-11-19T18:30'},{madeForKids:null},{thumbnail:{type:'image/svg+xml',data:PNG}},{thumbnail:{type:'image/jpeg',data:PNG}},{privacy:'invalid'}])await assert.rejects(s.schedule({...input(),...diff}));assert.equal(state.inserts,0);const data=input();await s.schedule(data);await assert.rejects(s.schedule({...data,title:'Outro título'}),{code:'CONFLICT'});
});
test('renova token expirado e informa autorização revogada',async t=>{
  const {scheduler:s,state,input,login}=fixture(t);await login();state.now+=3600000;await s.schedule(input());assert.equal(state.calls.filter(c=>c.url==='https://oauth2.googleapis.com/token').length,2);state.now+=3600000;state.refreshFail=true;await assert.rejects(s.upcoming(true),{code:'AUTH_REQUIRED'});assert.equal((await s.status()).connected,false);
});
test('bloqueia envios paralelos e mantém a chave de submissão',async t=>{
  const {scheduler:s,state,input,login}=fixture(t);await login();let release;state.hold=new Promise(r=>release=r);const data=input(),pending=s.schedule(data);await new Promise(r=>setTimeout(r,20));await assert.rejects(s.schedule(data),{code:'BUSY'});release();assert.equal((await pending).phase,'complete');assert.equal(state.inserts,1);
});
test('cliente público pode omitir client_secret, mantendo PKCE e renovação',async t=>{
  const {scheduler:s,state}=fixture(t);await s.importCredentials({installed:{client_id:credentials.installed.client_id,redirect_uris:['http://localhost']}});const {url}=await s.beginAuth();await s.callback(new URLSearchParams({state:new URL(url).searchParams.get('state'),code:'fake-code'}));state.now+=3600000;await s.upcoming(true);const requests=state.calls.filter(c=>c.url==='https://oauth2.googleapis.com/token');assert.equal(requests.length,2);assert.ok(requests.every(r=>!new URLSearchParams(r.body).has('client_secret')));
});
test('cliente Web usa a URI cadastrada tanto no login quanto na troca do código',async t=>{
  const {scheduler:s,state}=fixture(t);const redirect='http://127.0.0.1:3210/api/youtube/callback';
  await s.importCredentials({web:{...credentials.installed,redirect_uris:[redirect,'https://example.com/old-callback']}});
  const status=await s.status();assert.equal(status.clientType,'web');assert.equal(status.oauth.origin,'http://127.0.0.1:3210');assert.equal(status.oauth.redirectUri,redirect);
  const {url}=await s.beginAuth();const u=new URL(url);assert.equal(u.searchParams.get('redirect_uri'),redirect);await s.callback(new URLSearchParams({state:u.searchParams.get('state'),code:'fake-code'}));
  const exchange=state.calls.find(c=>c.url==='https://oauth2.googleapis.com/token');assert.equal(new URLSearchParams(exchange.body).get('redirect_uri'),redirect);assert.equal((await s.status()).connected,true);
});
test('cliente Web sem retorno correto não substitui a configuração existente',async t=>{
  const {scheduler:s}=fixture(t);await s.importCredentials(credentials);
  await assert.rejects(s.importCredentials({web:{...credentials.installed,redirect_uris:['http://localhost:3210/api/youtube/callback']}}),/adicione a URI/);
  assert.equal((await s.status()).clientType,'installed');
});
test('mensagem de client_secret ausente explica a correção sem expor dados',async t=>{
  const {scheduler:s,state}=fixture(t);await s.importCredentials({installed:{client_id:credentials.installed.client_id,redirect_uris:['http://localhost']}});const {url}=await s.beginAuth();state.oauthError={error:'invalid_request',error_description:'client_secret is missing.'};
  await assert.rejects(s.callback(new URLSearchParams({state:new URL(url).searchParams.get('state'),code:'fake-code'})),/JSON completo/);
  const status=await s.status();assert.equal(status.errorCode,'invalid_request');assert.equal(status.connected,false);assert.ok(!JSON.stringify(status).includes('test-secret-only'));
});
test('recusa de consentimento preserva o código de erro útil ao usuário',async t=>{
  const {scheduler:s}=fixture(t);await s.importCredentials(credentials);const {url}=await s.beginAuth();await assert.rejects(s.callback(new URLSearchParams({state:new URL(url).searchParams.get('state'),error:'access_denied'})),/usuários de teste/);assert.equal((await s.status()).errorCode,'access_denied');
});
test('JSON instalado sem retorno de computador é rejeitado antes do login',async t=>{
  const {scheduler:s,state}=fixture(t);await assert.rejects(s.importCredentials({installed:{client_id:credentials.installed.client_id}}),{code:'CLIENT_TYPE_REQUIRED'});assert.equal((await s.status()).clientConfigured,false);assert.equal(state.calls.length,0);
});

test('migra OAuth legado para armazenamento persistente e reutiliza em outra instalação',async t=>{
  const f=fixture(t);await f.login();
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'apce-persistent-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const authFile=path.join(root,'user-data/youtube/connection.dpapi');
  const migrated=createYouTubeScheduler({...f.opts,authFile});assert.equal((await migrated.status()).connected,true);assert(fs.existsSync(authFile));
  assert(fs.existsSync(path.join(f.dir,'private/youtube/connection.dpapi')));
  const clean=path.join(root,'new-install');fs.mkdirSync(clean);
  const reinstalled=createYouTubeScheduler({...f.opts,base:clean,authFile});
  const status=await reinstalled.status();assert(status.clientConfigured);assert(status.connected);assert.equal(status.account.handle,'@apcedf');
  assert(!JSON.stringify(status).includes('test-secret-only'));
  await reinstalled.disconnect();assert.equal((await reinstalled.status()).connected,false);assert.equal((await reinstalled.status()).clientConfigured,true);
});

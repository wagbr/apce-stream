import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createAuthService,SCOPE,REDIRECT} from '../auth-service/server.mjs';
import {createOAuthBroker} from '../oauth-broker.mjs';
import {createYouTubeScheduler} from '../youtube-scheduler.mjs';

async function fixture(t,{rateLimit=100,rateCapacity=10000}={}){
  const config={client_id:'123456-fixture.apps.googleusercontent.com',client_secret:'fixture-private-secret',channel_id:'UC_APCE_FIXTURE',ticket_key:'a'.repeat(64)};
  const state={now:100000,wrong:false,refreshFail:false,calls:[]};
  const google=async(url,options)=>{
    state.calls.push({url,options});
    if(url.includes('/token')){
      const params=new URLSearchParams(options.body);assert.equal(params.get('client_secret'),config.client_secret);
      if(state.refreshFail&&params.get('grant_type')==='refresh_token')return Response.json({error:'invalid_grant'},{status:400});
      return Response.json({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,scope:SCOPE});
    }
    assert.equal(options.headers.Authorization,'Bearer fixture-access');
    if(url.includes('/channels'))return Response.json({items:[{id:state.wrong?'UC_OTHER':config.channel_id,snippet:{title:'APCE'}}]});
    return Response.json({items:[]});
  };
  const server=createAuthService({config,fetchImpl:google,clock:()=>state.now,rateLimit,rateCapacity});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const url=`http://127.0.0.1:${server.address().port}`;
  const broker=createOAuthBroker({url});
  const exchange=()=>broker.exchange({code:'fixture-code',verifier:'v'.repeat(64),redirectUri:REDIRECT});
  return {config,state,server,url,broker,exchange,google};
}

test('configuração pública dispensa JSON e nunca revela o segredo Web',async t=>{
  const f=await fixture(t);const credentials=await f.broker.credentials();
  assert.equal(credentials.type,'broker');assert.equal(credentials.client_id,f.config.client_id);
  const response=await fetch(f.url+'/v1/config');const body=await response.text();
  assert(!body.includes(f.config.client_secret));assert(!body.includes(f.config.ticket_key));
  assert.equal(response.headers.get('cache-control'),'no-store');
});
test('troca valida PKCE, retorno fixo e canal APCE; renovação exige comprovante vinculado',async t=>{
  const f=await fixture(t);const tokens=await f.exchange();assert(tokens.broker_ticket);
  assert.equal((await f.broker.refresh(tokens)).access_token,'fixture-access');
  const calls=f.state.calls.length;
  await assert.rejects(f.broker.refresh({...tokens,refresh_token:'different-token'}),{code:'AUTH_REQUIRED'});
  await assert.rejects(f.broker.refresh({...tokens,broker_ticket:tokens.broker_ticket+'x'}),{code:'AUTH_REQUIRED'});
  assert.equal(f.state.calls.length,calls);
  await assert.rejects(f.broker.exchange({code:'fixture-code',verifier:'short',redirectUri:REDIRECT}));
  await assert.rejects(f.broker.exchange({code:'fixture-code',verifier:'v'.repeat(64),redirectUri:'https://example.invalid'}));
  assert.equal(f.state.calls.length,calls);
});
test('outro canal, autorização revogada e comprovante expirado são recusados',async t=>{
  const f=await fixture(t);f.state.wrong=true;await assert.rejects(f.exchange(),{code:'WRONG_CHANNEL'});
  f.state.wrong=false;const tokens=await f.exchange();f.state.refreshFail=true;
  await assert.rejects(f.broker.refresh(tokens),{code:'invalid_grant'});
  f.state.now+=366*86400000;await assert.rejects(f.broker.refresh(tokens),{code:'AUTH_REQUIRED'});
});
test('serviço limita corpo, origem de navegador, métodos e tentativas',async t=>{
  const f=await fixture(t,{rateLimit:5});
  assert.equal((await fetch(f.url+'/v1/config',{headers:{Origin:'https://example.invalid'}})).status,403);
  assert.equal((await fetch(f.url+'/v1/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(17000)})).status,413);
  assert.equal((await fetch(f.url+'/v1/exchange',{method:'POST',body:'{}'})).status,415);
  assert.equal((await fetch(f.url+'/other')).status,404);
  await f.broker.credentials();await f.broker.credentials();
  await assert.rejects(f.broker.credentials(),{code:'RATE_LIMIT'});
});
test('limite de memória de IPs libera entradas antigas na próxima janela',async t=>{
  const f=await fixture(t,{rateCapacity:2});
  const get=ip=>fetch(f.url+'/v1/config',{headers:{'X-APCE-Client-IP':ip}});
  assert.equal((await get('192.0.2.1')).status,200);assert.equal((await get('192.0.2.2')).status,200);
  assert.equal((await get('192.0.2.3')).status,429);
  f.state.now+=60000;assert.equal((await get('192.0.2.3')).status,200);
});
test('instalação nova autoriza via servidor, renova e reconecta sem JSON ou segredo local',async t=>{
  const f=await fixture(t);const base=fs.mkdtempSync(path.join(os.tmpdir(),'apce-broker-'));
  t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
  const authFile=path.join(base,'user-data/connection.dpapi');
  const opts={base,port:3210,authFile,broker:f.broker,fetchImpl:f.google,clock:()=>f.state.now,protect:async s=>'encrypted:'+Buffer.from(s).toString('base64'),unprotect:async s=>Buffer.from(s.slice(10),'base64').toString()};
  const scheduler=createYouTubeScheduler(opts);assert((await scheduler.status()).clientConfigured);
  const {url}=await scheduler.beginAuth();assert.equal(new URL(url).searchParams.get('redirect_uri'),REDIRECT);
  await scheduler.callback(new URLSearchParams({code:'fixture-code',state:new URL(url).searchParams.get('state')}));
  assert((await scheduler.status()).connected);
  const stored=JSON.parse(await opts.unprotect(fs.readFileSync(authFile,'utf8')));assert.equal(stored.credentials.type,'broker');assert(!JSON.stringify(stored).includes(f.config.client_secret));
  f.state.now+=3600000;await scheduler.upcoming(true);
  await scheduler.disconnect();assert((await scheduler.status()).clientConfigured);
  const reinstall=createYouTubeScheduler({...opts,base:path.join(base,'new-install')});assert((await reinstall.status()).clientConfigured);assert(!(await reinstall.status()).connected);
  const retry=await reinstall.beginAuth();assert(new URL(retry.url).searchParams.get('code_challenge'));
});

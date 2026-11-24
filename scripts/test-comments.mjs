import test from 'node:test';
import assert from 'node:assert/strict';
import grpc from '@grpc/grpc-js';
import {createCommentControl,normalizeComment,avatarUrl} from '../comment-control.mjs';
import {chatDefinition,openYouTubeChat,chatStreamError} from '../youtube-chat-stream.mjs';

const flush=()=>new Promise(r=>setImmediate(r));
const item=(id='message-1',authorId='viewer-1',text='Ciência e boas conversas!')=>({id,snippet:{type:1,displayMessage:text,hasDisplayContent:true,publishedAt:'2026-11-20T18:00:00Z'},authorDetails:{channelId:authorId,displayName:'Maria da Conceição',profileImageUrl:'https://yt3.ggpht.com/avatar-test'}});
async function fixture(t,extra={}){
  let current={id:'apceLive001',title:'Ensaio local',lifeCycleStatus:'live'},clock=100000;const calls=[],stops=[];
  const youtube={info:async id=>({id,snippet:{liveChatId:'chat-'+id},status:{lifeCycleStatus:'live'}}),watch:async options=>{calls.push(options);return ()=>stops.push(options.chatId);},...extra};
  const control=createCommentControl({youtube,selection:()=>current,now:()=>clock});t.after(()=>control.close());
  control.state();await flush();
  return {control,calls,stops,setTarget:value=>current=value,advance:ms=>clock+=ms};
}
test('uma conexão atende leituras do painel e do overlay; seleção só aceita IDs reais',async t=>{
  const {control:c,calls}=await fixture(t);for(let n=0;n<20;n++){c.state();c.overlay();c.tick();}assert.equal(calls.length,1);
  assert.throws(()=>c.action({action:'show',id:'inventado',broadcastId:'apceLive001'}));
  calls[0].onData({items:[item()]});c.action({action:'show',id:'message-1',broadcastId:'apceLive001'});
  assert.equal(c.overlay().selected.author,'Maria da Conceição');assert.equal(c.overlay().selected.text,'Ciência e boas conversas!');
  assert(!JSON.stringify(c.state()).includes('chat-apceLive001'));c.action({action:'hide'});assert.equal(c.overlay().selected,null);
});
test('deduplica, atualiza a mensagem destacada e mantém memória limitada',async t=>{
  const {control:c,calls}=await fixture(t);calls[0].onData({items:[item()]});c.action({action:'show',id:'message-1',broadcastId:'apceLive001'});
  calls[0].onData({items:[item('message-1','viewer-1','Atualização do comentário')]});assert.equal(c.state().messages.length,1);assert.equal(c.overlay().selected.text,'Atualização do comentário');
  calls[0].onData({items:Array.from({length:320},(_,n)=>item('m-'+n))});assert.equal(c.state().messages.length,300);
});
test('troca de live limpa destaque e ignora respostas atrasadas do chat anterior',async t=>{
  const {control:c,calls,stops,setTarget}=await fixture(t);calls[0].onData({items:[item()]});c.action({action:'show',id:'message-1',broadcastId:'apceLive001'});
  setTarget({id:'apceLive002',lifeCycleStatus:'ready'});assert.equal(c.overlay().selected,null);assert.equal(stops.length,1);c.state();await flush();
  calls[0].onData({items:[item('atrasada')]});assert.equal(c.state().messages.length,0);assert.equal(calls.length,2);
  calls[1].onData({items:[item('nova')]});assert.throws(()=>c.action({action:'show',id:'nova',broadcastId:'apceLive001'}));
});
test('remoção de mensagem e banimento retiram também o destaque',async t=>{
  const {control:c,calls}=await fixture(t);calls[0].onData({items:[item()]});c.action({action:'show',id:'message-1',broadcastId:'apceLive001'});
  calls[0].onData({items:[{id:'message-1',snippet:{type:2}}]});assert.equal(c.state().messages.length,0);assert.equal(c.overlay().selected,null);
  calls[0].onData({items:[item('segunda')]});c.action({action:'show',id:'segunda',broadcastId:'apceLive001'});
  calls[0].onData({items:[{id:'ban',snippet:{type:10,userBannedDetails:{bannedUserDetails:{channelId:'viewer-1'}}}}]});assert.equal(c.state().messages.length,0);assert.equal(c.overlay().selected,null);
});
test('reconecta com continuação e renovação OAuth; não abre conexões em repetição',async t=>{
  const {control:c,calls,advance}=await fixture(t);calls[0].onData({items:[item()],nextPageToken:'resume-test'});calls[0].onError(Object.assign(new Error('Renovar'),{code:'AUTH_REQUIRED'}));
  c.state();assert.equal(calls.length,1);advance(5001);c.tick();await flush();assert.equal(calls.length,2);assert.equal(calls[1].pageToken,'resume-test');assert.equal(calls[1].forceToken,true);
  assert.throws(()=>c.action({action:'retry'}),/Aguarde/);
});
test('overlay sozinho não mantém leitura remota; fechar painel pausa e reabrir retoma',async t=>{
  const {control:c,calls,stops,advance}=await fixture(t);calls[0].onData({items:[item()],nextPageToken:'resume-test'});advance(91000);c.overlay();c.tick();assert.equal(stops.length,1);assert.equal(calls.length,1);
  c.state();await flush();assert.equal(calls.length,2);assert.equal(calls[1].pageToken,'resume-test');
});
test('fim da live apaga destaque e não abre novas conexões',async t=>{
  const {control:c,calls,setTarget}=await fixture(t);calls[0].onData({items:[item()]});c.action({action:'show',id:'message-1',broadcastId:'apceLive001'});
  setTarget({id:'apceLive001',lifeCycleStatus:'complete'});c.tick();assert.equal(c.overlay().selected,null);assert.equal(c.state().status,'ended');await flush();assert.equal(calls.length,1);
});
test('chat indisponível informa espera; erros terminais aguardam reconexão manual',async t=>{
  const f=await fixture(t,{info:async()=>({snippet:{},status:{lifeCycleStatus:'ready'}})});assert.equal(f.control.state().status,'waiting');assert.equal(f.calls.length,0);
  const g=await fixture(t);g.calls[0].onError(chatStreamError({code:9,details:'segredo que não pode vazar'}));g.advance(120000);g.control.state();await flush();assert.equal(g.calls.length,1);assert(!g.control.state().error.includes('segredo'));
});

test('audiência infantil explica a restrição e não tenta ler um chat desativado',async t=>{
  const f=await fixture(t,{info:async()=>({snippet:{liveChatId:'unavailable'},status:{lifeCycleStatus:'ready',madeForKids:true,privacyStatus:'public'}})});
  assert.equal(f.control.state().status,'restricted');assert.match(f.control.state().error,/crianças/);assert.equal(f.calls.length,0);
});
test('mensagens preservam texto literal e emoji; foto aceita somente hosts de avatar do YouTube',()=>{
  assert.equal(avatarUrl('https://yt3.ggpht.com/foto'),'https://yt3.ggpht.com/foto');
  for(const bad of ['javascript:alert(1)','http://yt3.ggpht.com/foto','https://yt3.ggpht.com.evil.test/foto','https://127.0.0.1:3210/private'])assert.equal(avatarUrl(bad),'');
  const m=normalizeComment(item('html','v','<img src=x onerror=alert(1)> Olá! 🧠'));assert.equal(m.text,'<img src=x onerror=alert(1)> Olá! 🧠');assert.equal(normalizeComment({id:'silent',snippet:{hasDisplayContent:false}}),null);
  assert.equal([...normalizeComment(item('long','v','🧠'.repeat(2001))).text].length,2000);
});
test('retomada inválida pode reiniciar o histórico; desconexão limpa dados e destaque',async t=>{
  const {control:c,calls,advance}=await fixture(t);calls[0].onData({items:[item()],nextPageToken:'expired-token'});c.action({action:'show',id:'message-1',broadcastId:'apceLive001'});
  calls[0].onError(chatStreamError({code:3}));advance(5001);c.action({action:'retry'});await flush();assert.equal(calls.length,2);assert.equal(calls[1].pageToken,'');
  c.reset();assert.equal(c.overlay().selected,null);assert.equal(c.state().messages.length,0);
});
test('transporte gRPC local recebe os campos reais do protocolo e cancela a conexão',async t=>{
  const server=new grpc.Server();let request,authorization;
  server.addService(chatDefinition.V3DataLiveChatMessageService.service,{streamList:call=>{request=call.request;authorization=call.metadata.get('authorization')[0];call.write({nextPageToken:'next-wire',items:[item()]});}});
  const port=await new Promise((resolve,reject)=>server.bindAsync('127.0.0.1:0',grpc.ServerCredentials.createInsecure(),(e,p)=>e?reject(e):resolve(p)));
  t.after(()=>server.forceShutdown());let close;
  const received=await new Promise((resolve,reject)=>{close=openYouTubeChat({access:'local-test-token',chatId:'chat-local',pageToken:'before-wire',address:'127.0.0.1:'+port,credentials:grpc.credentials.createInsecure(),onData:resolve,onError:reject});});
  close();assert.equal(authorization,'Bearer local-test-token');assert.equal(request.liveChatId,'chat-local');assert.equal(request.pageToken,'before-wire');assert.deepEqual(request.part,['id','snippet','authorDetails']);assert.equal(received.nextPageToken,'next-wire');assert.equal(received.items[0].authorDetails.displayName,'Maria da Conceição');
});

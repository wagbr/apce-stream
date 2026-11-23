import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import OBSWebSocket from 'obs-websocket-js';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url))),cfg=JSON.parse(fs.readFileSync(path.join(base,'private/studio.json'),'utf8'));
const obs=new OBSWebSocket();let original,socket,started=false,received=false;
const server=net.createServer(client=>{socket=client;client.on('data',data=>{if(data[0]===3)received=true;});client.on('error',()=>{});});
try{
  await obs.connect('ws://127.0.0.1:'+cfg.obsPort,cfg.obsPassword);
  assert.equal((await obs.call('GetStreamStatus')).outputActive,false);assert.equal((await obs.call('GetRecordStatus')).outputActive,false);
  await obs.call('SetCurrentProfile',{profileName:'APCE Painel'});assert.equal((await obs.call('GetProfileList')).currentProfileName,'APCE Painel');
  original=await obs.call('GetStreamServiceSettings');
  await new Promise(resolve=>server.listen(19880,'127.0.0.1',resolve));
  await obs.call('SetStreamServiceSettings',{streamServiceType:'rtmp_custom',streamServiceSettings:{server:'rtmp://127.0.0.1:19880/live',key:'teste-local',use_auth:false}});
  started=true;await obs.call('StartStream');
  for(let n=0;n<40&&!received;n++)await new Promise(r=>setTimeout(r,500));
  assert(received,'O OBS não iniciou a conexão RTMP local; confira se há uma janela nativa bloqueando o início.');
  const report={passed:true,profile:'APCE Painel',nativeStartStream:true,rtmpHandshakeReceived:true,endpoint:'127.0.0.1',youtubeContacted:false,publicStreamStarted:false};
  fs.writeFileSync(path.join(base,'evidencias/envio-local.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{
  if(started)await obs.call('StopStream').catch(()=>{});socket?.destroy();server.close();
  if(original)await obs.call('SetStreamServiceSettings',original).catch(()=>{});
  await obs.disconnect();
}

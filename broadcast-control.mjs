import fs from 'node:fs';
import path from 'node:path';

const fail=message=>Object.assign(new Error(message),{status:409});
export function createBroadcastControl({base,youtube,api,isConnected,expectedProfile,delay=ms=>new Promise(r=>setTimeout(r,ms)),attempts=24}){
  const file=path.join(base,'private/broadcast.json');
  let saved={},recovered=false;try{saved=JSON.parse(fs.readFileSync(file,'utf8'));if(!saved||Array.isArray(saved)||typeof saved!=='object')throw new SyntaxError('Estado inválido');}catch(e){
    if(e instanceof SyntaxError){fs.copyFileSync(file,file+'.corrupt-'+Date.now());saved={};recovered=true;}
    else if(e.code!=='ENOENT')throw e;
  }
  let busy=false,phase='idle',error=recovered?'A seleção local da última live foi recuperada após uma falha. Atualize a lista e selecione a transmissão novamente.':'',options=[],selected=null,updated=0;
  const persist=()=>{fs.mkdirSync(path.dirname(file),{recursive:true});const fd=fs.openSync(file+'.tmp','w');try{fs.writeFileSync(fd,JSON.stringify(saved),'utf8');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(file+'.tmp',file);};
  if(recovered)persist();
  async function inspect(){
    if(saved.id){selected=youtube.safeEvent(await youtube.broadcast(saved.id));updated=Date.now();}
    return selected;
  }
  async function refresh(){
    if(busy)return state();
    options=await youtube.options();await inspect();error='';return state();
  }
  async function state(){
    const follow=!selected||saved.ownsIngest||['live','liveStarting','testing','testStarting'].includes(selected.lifeCycleStatus);
    if(saved.id&&follow&&!busy&&Date.now()-updated>15000){try{await inspect();}catch(e){error=e.message;updated=Date.now();}}
    return {busy,phase,error,selected,options,ingestOwned:!!saved.ownsIngest,updated,obsConnected:isConnected()};
  }
  async function select(id){
    if(busy)throw fail('Aguarde a operação atual.');
    if(isConnected()&&(await api('GetStreamStatus')).outputActive)throw fail('Encerre a transmissão atual antes de trocar de live.');
    const item=await youtube.broadcast(id);
    if(!['created','ready','testing','live','liveStarting','testStarting'].includes(item.status?.lifeCycleStatus))throw fail('A live já foi encerrada. Escolha outra.');
    saved={id};persist();selected=youtube.safeEvent(item);phase='idle';error='';return state();
  }
  async function until(read,accept,message){
    for(let n=0;n<attempts;n++){const value=await read();if(accept(value))return value;await delay(2000);}
    throw fail(message);
  }
  async function start(id){
    if(busy)throw fail('Aguarde a operação atual.');
    if(!isConnected())throw fail('Abra o Estúdio APCE para conectar o OBS.');
    if(expectedProfile&&(await api('GetProfileList')).currentProfileName!==expectedProfile)throw fail(`Abra o perfil ${expectedProfile} no OBS antes de iniciar pelo painel.`);
    if(!id||id!==saved.id)throw fail('Selecione e confira a live antes de iniciar.');
    busy=true;error='';
    try{
      phase='checking';const item=await youtube.broadcast(id);selected=youtube.safeEvent(item);
      const obsStatus=await api('GetStreamStatus');
      if(item.status.lifeCycleStatus==='complete')throw fail('Esta live já foi encerrada.');
      if(obsStatus.outputActive&&!saved.ownsIngest)throw fail('O OBS já envia uma transmissão iniciada fora do painel. Encerre-a antes de usar este comando.');
      if(!obsStatus.outputActive){
        if(['live','liveStarting'].includes(item.status.lifeCycleStatus))throw fail('A live já está no ar. Reconecte a entrada pelo OBS ou encerre a live pelo painel.');
        phase='preparing';const input=await youtube.ingest(id);
        // A chave permanece somente entre a API Google e a conexão local com o OBS.
        await api('SetStreamServiceSettings',{streamServiceType:'rtmp_custom',streamServiceSettings:{server:input.server,key:input.key,use_auth:false}});
        saved={id,streamId:input.streamId,ownsIngest:true};persist();
        phase='sending';await api('StartStream');
      }
      if(!saved.streamId)throw fail('A entrada de vídeo não foi identificada.');
      phase='waiting';await until(()=>youtube.streamInfo(saved.streamId),s=>s.status?.streamStatus==='active','O YouTube ainda não confirmou o sinal. O OBS continua enviando; verifique a conexão e tente iniciar novamente ou encerre pelo painel.');
      const current=await youtube.broadcast(id);
      if(!['live','liveStarting'].includes(current.status.lifeCycleStatus)){
        phase='starting';await youtube.transition(id,'live');
      }
      const live=await until(()=>youtube.broadcast(id),b=>b.status?.lifeCycleStatus==='live','O YouTube ainda está iniciando a live. Atualize o estado antes de repetir.');
      selected=youtube.safeEvent(live);phase='live';return state();
    }catch(e){error=e.message;phase='error';throw e;}finally{busy=false;}
  }
  async function stop(id){
    if(busy)throw fail('Aguarde a operação atual.');
    if(!id||id!==saved.id)throw fail('Confira a live selecionada antes de encerrar.');
    busy=true;phase='stopping';error='';let remoteError=null;
    try{
      try{
        const item=await youtube.broadcast(id);
        if(['live','liveStarting','testing','testStarting'].includes(item.status.lifeCycleStatus)){
          await youtube.transition(id,'complete');
          await until(()=>youtube.broadcast(id),b=>b.status?.lifeCycleStatus==='complete','O YouTube ainda não confirmou o encerramento. Atualize e tente encerrar novamente.');
        }else if(item.status.lifeCycleStatus!=='complete'&&!saved.ownsIngest)throw fail('Esta live ainda não começou. Nenhum agendamento foi encerrado.');
      }catch(e){remoteError=e;}
      // Cortar o sinal continua disponível mesmo se a API Google estiver indisponível.
      if(isConnected()&&saved.ownsIngest&&(await api('GetStreamStatus')).outputActive)await api('StopStream');
      if(remoteError)throw remoteError;
      saved.ownsIngest=false;persist();await inspect();phase=selected?.lifeCycleStatus==='complete'?'complete':'idle';return state();
    }catch(e){error=e.message;phase='error';throw e;}finally{busy=false;}
  }
  const selection=()=>saved.id?{id:saved.id,title:selected?.title||'',lifeCycleStatus:selected?.lifeCycleStatus||''}:null;
  return {state,refresh,select,start,stop,selection};
}

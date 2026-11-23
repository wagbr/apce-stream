const problem=(text)=>Object.assign(new Error(text),{status:409});
const text=(value,max)=>[...String(value||'').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'')].slice(0,max).join('');
export function avatarUrl(value){
  try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&['ggpht.com','googleusercontent.com'].some(host=>u.hostname===host||u.hostname.endsWith('.'+host)))return u.href;}catch{}
  return '';
}
export function normalizeComment(item){
  const s=item.snippet||{},a=item.authorDetails||{},kind=s.type;
  if(s.hasDisplayContent===false||[2,4,10,'tombstone','chatEndedEvent','userBannedEvent'].includes(kind))return null;
  const message=text(s.displayMessage||s.textMessageDetails?.messageText,2000).trim();
  if(!item.id||!message)return null;
  return {id:text(item.id,512),text:message,author:text(a.displayName||'Participante',120),authorId:text(a.channelId||s.authorChannelId,128),avatar:avatarUrl(a.profileImageUrl),publishedAt:text(s.publishedAt,40),owner:!!a.isChatOwner,moderator:!!a.isChatModerator,member:!!a.isChatSponsor,paid:[15,16,'superChatEvent','superStickerEvent'].includes(kind)};
}

export function createCommentControl({youtube,selection,now=()=>Date.now(),leaseMs=90000,maxMessages=300}){
  let target=null,messages=[],selected=null,status='idle',error='',pageToken='',lastSeen=0,retryAt=0,attempts=0,ended=false;
  let generation=0,opening=false,cancel=null,forceToken=false,revision=0,lastAttempt=-Infinity;
  function close(){generation++;const stop=cancel;cancel=null;opening=false;stop?.();}
  function reconcile(){
    const next=selection();
    if((next?.id||'')!==(target?.id||'')){
      close();target=next?.id?{...next}:null;messages=[];selected=null;status=target?'waiting':'idle';error='';pageToken='';retryAt=0;attempts=0;ended=false;revision++;
    }else if(target&&next)target={...target,...next};
    if(target?.lifeCycleStatus==='complete'&&!ended){close();ended=true;selected=null;status='ended';revision++;}
  }
  function ingest(batch){
    pageToken=batch.nextPageToken||pageToken;
    for(const item of batch.items||[]){
      const s=item.snippet||{};
      if([4,'chatEndedEvent'].includes(s.type)){ended=true;status='ended';selected=null;revision++;continue;}
      const removed=[2,'tombstone'].includes(s.type)?item.id:null;
      const banned=[10,'userBannedEvent'].includes(s.type)?s.userBannedDetails?.bannedUserDetails?.channelId:null;
      if(removed||banned){
        messages=messages.filter(m=>m.id!==removed&&(!banned||m.authorId!==banned));
        if(selected&&(selected.id===removed||(banned&&selected.authorId===banned)))selected=null;
        revision++;continue;
      }
      const value=normalizeComment(item);if(!value)continue;
      const existing=messages.findIndex(m=>m.id===value.id);
      if(existing>=0)messages[existing]=value;else messages.push(value);
      if(selected?.id===value.id)selected=value;
      revision++;
    }
    messages=messages.slice(-maxMessages);
    if(batch.offlineAt){ended=true;status='ended';selected=null;revision++;}
    if(ended){close();}else{status='connected';error='';attempts=0;}
  }
  function failed(e,version){
    if(version!==generation)return;
    close();error=e.message;status='error';forceToken=e.code==='AUTH_REQUIRED';attempts++;
    if(e.grpcCode===3)pageToken='';
    retryAt=e.terminal?Infinity:now()+Math.min(60000,5000*2**Math.min(attempts-1,4));
  }
  async function pump(){
    reconcile();if(!target||ended||cancel||opening||now()-lastSeen>=leaseMs||now()<retryAt)return;
    opening=true;status='connecting';lastAttempt=now();const version=generation,id=target.id;
    try{
      const item=await youtube.info(id);if(version!==generation)return;
      if(item.status?.lifeCycleStatus==='complete'){ended=true;selected=null;status='ended';opening=false;revision++;return;}
      const chatId=item.snippet?.liveChatId;
      if(!chatId){status='waiting';error='O chat ainda não está disponível. Ele será conferido novamente.';retryAt=now()+30000;opening=false;return;}
      const stop=await youtube.watch({chatId,pageToken,forceToken,onReady:()=>{if(version===generation){status='connected';error='';}},onData:data=>{if(version===generation)ingest(data);},onError:e=>failed(e,version),onEnd:()=>failed(new Error('Reconectando aos comentários do YouTube…'),version)});
      if(version!==generation){stop();return;}
      cancel=stop;opening=false;forceToken=false;
    }catch(e){failed(e,version);}
  }
  function tick(){reconcile();if(now()-lastSeen>=leaseMs){if(cancel||opening)close();if(target&&!ended)status='paused';return;}void pump();}
  function state(){lastSeen=now();reconcile();void pump();return {broadcast:target,status,error,messages,selected,revision};}
  function overlay(){reconcile();return {selected,revision};}
  function action(data){
    reconcile();
    if(data.action==='hide'){selected=null;revision++;}
    else if(data.action==='show'){
      if(!target||data.broadcastId!==target.id||ended)throw problem('Selecione um comentário da live atual.');
      const message=messages.find(m=>m.id===data.id);if(!message)throw problem('Este comentário não está mais na lista.');
      selected=message;revision++;
    }else if(data.action==='retry'){
      if(now()-lastAttempt<5000)throw problem('Aguarde alguns segundos antes de reconectar.');
      close();error='';retryAt=0;ended=false;lastSeen=now();void pump();
    }else throw problem('Comando de comentário inválido.');
    return state();
  }
  function reset(){close();messages=[];selected=null;pageToken='';status='waiting';error='';retryAt=0;ended=false;revision++;}
  return {state,overlay,action,tick,close,reset};
}

const stage=document.getElementById('stage'),empty=document.getElementById('empty'),origin='https://vdo.ninja';
let active=null,incoming=null,participants=[],pending=false;
const send=(entry,data)=>entry?.frame.contentWindow?.postMessage(data,origin);
const volumes=entry=>{for(const id of entry?.ids||[]){const p=participants.find(p=>p.id===id);send(entry,{volume:p&&!p.muted?1:0,target:id});}};
function discard(entry){
  if(!entry||entry.closing)return;entry.closing=true;
  clearTimeout(entry.timeout);clearTimeout(entry.readyTimer);clearInterval(entry.probe);
  entry.frame.style.opacity='0';send(entry,{mute:true});send(entry,{hangup:true});
  // O VDO.Ninja termina as conexões antes de o contexto do iframe desaparecer.
  setTimeout(()=>entry.frame.remove(),1200);
}
function reveal(entry){
  if(incoming!==entry)return;clearTimeout(entry.timeout);clearInterval(entry.probe);
  send(active,{mute:true});volumes(entry);send(entry,{mute:false});
  const old=active;active=entry;incoming=null;entry.frame.style.opacity='1';
  setTimeout(()=>discard(old),300);
}
function create(mixUrl){
  discard(incoming);
  const frame=document.createElement('iframe');frame.title='Mosaico dos participantes APCE';frame.allow='autoplay; fullscreen';frame.referrerPolicy='no-referrer';frame.style.opacity='0';
  const entry={frame,url:mixUrl,ids:participants.map(p=>p.id)};incoming=entry;
  frame.onload=()=>{
    if(incoming!==entry)return;
    send(entry,{pauseinvisible:false});volumes(entry);send(entry,{mute:true});
    send(entry,{style:'body{background:transparent!important} .label,.video-label,.overlayLabel,[id^="label_"]{color:#e6d3cb!important;background:#3b3c46e8!important;border-top:3px solid #ef4d63;border-radius:0 10px 0 0;font-family:Segoe UI,Arial,sans-serif!important}'});
    const probe=()=>send(entry,{getDetailedState:true,cib:'apce-stage-ready'});
    probe();entry.probe=setInterval(probe,500);
    entry.timeout=setTimeout(()=>reveal(entry),12000);
  };
  frame.src=mixUrl;stage.append(frame);
}
window.addEventListener('message',event=>{
  const entry=incoming;
  if(!entry||event.origin!==origin||event.source!==entry.frame.contentWindow||event.data?.cib!=='apce-stage-ready'||!event.data.detailedState)return;
  const ids=new Set(Object.values(event.data.detailedState).filter(p=>p&&!p.localStream).map(p=>p.streamID));
  if(entry.ids.every(id=>ids.has(id))&&!entry.readyTimer)entry.readyTimer=setTimeout(()=>reveal(entry),900);
});
async function refresh(){
  if(pending)return;pending=true;
  try{
    const response=await fetch('/api/room/stage');if(!response.ok)return;const state=await response.json();participants=state.participants;
    empty.style.display=participants.length?'none':'grid';
    if(!participants.length){discard(incoming);discard(active);incoming=active=null;return;}
    // Um receptor VDO.Ninja recebe os doze vídeos. A troca de integrantes
    // prepara outro mosaico; microfones mudam sem reconectar os participantes.
    volumes(active);volumes(incoming);send(incoming,{mute:true});
    if(active?.ids.some(id=>!participants.some(p=>p.id===id)))active.frame.style.opacity='0';
    if(state.mixUrl!==active?.url&&state.mixUrl!==incoming?.url)create(state.mixUrl);
  }catch{}finally{pending=false;}
}
await refresh();setInterval(refresh,1000);

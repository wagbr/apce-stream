import {syncPanelViews} from './panel-views.js';
const $=id=>document.getElementById(id),origin='https://vdo.ninja';let state,frame,lastMessage=0,pending=false,signature='';
document.querySelector('.rail-links').insertAdjacentHTML('beforeend','<a class="rail-link" href="#estudio" aria-label="Sala e convidados" title="Sala e convidados"><svg class="icon" aria-hidden="true"><use href="/icons.svg#users"/></svg></a>');
document.querySelector('main').insertAdjacentHTML('beforeend',`
<section id="estudio" class="studio-room" hidden><div class="studio-room-header"><div><span class="eyebrow">BASTIDORES · ATÉ 12 PESSOAS</span><h1>Puxe uma <span>cadeira.</span></h1><p>Aprove a entrada. Escolha quem aparece. Todo mundo acompanha o programa.</p></div><a href="#programa" class="beige-button">Voltar ao programa</a></div>
<div class="card" style="padding:24px"><div class="studio-room-tools"><button id="room-open" class="primary">Abrir sala e direção</button><button id="room-invite" class="beige-button" disabled>Copiar link para o chat</button><button id="room-host" class="beige-button">Entrar como apresentador</button><button id="room-return-start" class="beige-button">Ligar retorno do estúdio</button><button id="room-return-stop" class="text-button">Desligar retorno</button></div><div class="studio-room-status"><strong id="room-count">0 / 12 no estúdio</strong><span id="room-status">Sala fechada neste painel.</span><span id="room-return-status" class="return-status">Retorno ainda não conferido.</span></div><p class="studio-warning">Copie o convite e cole no chat da live. Na direção abaixo, aprove ou recuse os pedidos. Depois, adicione a pessoa ao estúdio; ela aparece na cena Sala aberta. Escolha Entrevista para usar a segunda câmera. Os apresentadores também ocupam lugares entre os 12.</p><p id="room-message" role="status" aria-live="polite"></p></div>
<h2>Participantes e bastidores</h2><div id="room-roster" class="studio-roster"></div><div id="room-empty" class="studio-empty">Abra a sala e entre com a câmera. Os participantes aprovados aparecem aqui.</div>
<div id="room-director-wrap" class="studio-director" hidden><div class="studio-director-header"><h2>Direção da sala</h2><p class="hint">Mantenha este painel aberto. Na direção, o botão de pedidos mostra quem aguarda: abra-o e use Approve/Aprovar ou Deny/Recusar. Depois, adicione a pessoa ao estúdio nos cartões acima. Use fones.</p></div><div id="room-director"></div></div></section>`);
const shortcut=document.createElement('a');shortcut.href='#estudio';shortcut.className='beige-button full';shortcut.textContent='Gerenciar sala · até 12 pessoas';document.querySelector('.guests-card').append(shortcut);
const oldDirector=document.querySelector('[data-open="director"]');oldDirector.removeAttribute('data-open');oldDirector.onclick=()=>{location.hash='#estudio';openRoom();};
document.querySelector('[data-copy="invite"]').onclick=async()=>{if(!state?.online){location.hash='#estudio';openRoom();message('Aguarde a direção conectar para copiar o convite.');return;}try{await navigator.clipboard.writeText(state.links.invite);message('Convite copiado.');}catch(e){message(e.message,true);}};
document.querySelector('.invite-heading p').textContent='Até 12 pessoas, incluindo apresentadores.';
document.querySelector('.headphones-note').textContent='Gerencie a entrada e ligue o retorno em Sala e convidados. Use fones de ouvido.';
document.querySelector('.output-bottom>span').textContent='Inicie e encerre pelo painel.';
async function post(url,data){const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const body=await res.json();if(!res.ok)throw Error(body.error);return body;}
const message=(text,error=false)=>{$('room-message').textContent=text;$('room-message').classList.toggle('live-error',error);};
async function run(action,id){try{render(await post('/api/room/action',{action,id}));message(action==='interview'?'Segunda câmera da entrevista atualizada.':'Estúdio atualizado.');}catch(e){message(e.message,true);}}
function openRoom(){
  if(frame||!state)return;
  frame=document.createElement('iframe');frame.title='Direção privada de convidados APCE';frame.allow='autoplay; fullscreen';frame.referrerPolicy='no-referrer';frame.src=state.links.director;
  $('room-director').append(frame);$('room-director-wrap').hidden=false;$('room-open').disabled=true;$('room-open').textContent='Direção aberta neste painel';
  frame.onload=()=>{frame.contentWindow.postMessage({mute:true,pauseinvisible:false},origin);frame.contentWindow.postMessage({getDetailedState:true,cib:'apce-roster'},origin);};
}
function render(s){
  state=s;$('room-count').textContent=`${s.stage.length} / 12 no estúdio`;$('room-status').textContent=s.online?'Direção conectada · entrada com aprovação':'Abra a direção e aguarde a conexão.';$('room-invite').disabled=!s.online;
  const sig=JSON.stringify([s.guests,s.stage]);if(sig===signature)return;signature=sig;
  const container=$('room-roster');container.replaceChildren();$('room-empty').hidden=!!(s.guests.length||s.stage.length);
  const people=[...s.guests,...s.stage.filter(p=>!s.guests.some(g=>g.id===p.id))];
  for(const p of people){
    const active=s.stage.find(g=>g.id===p.id),online=s.guests.some(g=>g.id===p.id),card=document.createElement('article');card.className='studio-person'+(active?' on-stage':'');
    const eyebrow=document.createElement('span');eyebrow.className='eyebrow';eyebrow.textContent=active?'NO ESTÚDIO':'NOS BASTIDORES';const name=document.createElement('strong');name.textContent=p.label;const status=document.createElement('small');status.textContent=online?(active?'Visível na cena Sala aberta':'Aprovado · pronto para entrar'):'Desconectado';
    const actions=document.createElement('div');actions.className='broadcast-actions';
    const button=(label,action,disabled=false)=>{const b=document.createElement('button');b.className=action==='add'?'primary':'beige-button';b.textContent=label;b.disabled=disabled;b.onclick=()=>run(action,p.id);actions.append(b);};
    button(active?'Retirar do estúdio':'Adicionar ao estúdio',active?'remove':'add',!active&&(!online||s.stage.length>=12));
    if(active){button(active.muted?'Ativar áudio no programa':'Silenciar no programa','mute',!online);button('Usar na entrevista','interview',!online);}
    card.append(eyebrow,name,status,actions);container.append(card);
  }
}
window.addEventListener('message',async event=>{
  if(!frame||event.source!==frame.contentWindow||event.origin!==origin||event.data?.cib!=='apce-roster'||!event.data.detailedState)return;
  // A lista visual do VDO.Ninja omite feeds recolhidos/ocultos. Consultar as
  // conexões mantém os participantes no painel mesmo sem miniatura na direção.
  lastMessage=Date.now();const details=Object.values(event.data.detailedState),claimed=details.some(p=>p?.localStream&&p.director===true);
  const guests=details.filter(p=>p&&!p.localStream&&!p.director&&typeof p.streamID==='string').map(p=>({id:p.streamID,label:p.label||''}));
  try{render(await post('/api/room/action',{action:'sync',guests,claimed}));if(!claimed)$('room-status').textContent='Aguardando a direção assumir esta sala…';}catch(e){message(e.message,true);}
});
$('room-open').onclick=openRoom;
$('room-invite').onclick=async()=>{try{await navigator.clipboard.writeText(state.links.invite);message('Convite copiado. Cole no chat do YouTube para chamar participantes.');}catch(e){message(e.message,true);}};
let hostFrame=null;
document.body.insertAdjacentHTML('beforeend','<dialog id="host-entry" class="host-entry"><div class="host-entry-tools"><div><span class="eyebrow">SUA ENTRADA NO ESTÚDIO</span><h2>Minha câmera e microfone</h2></div><button id="host-entry-close" class="beige-button" type="button">Voltar ao painel</button></div><p>Permita câmera e microfone, escolha seus dispositivos e entre com a câmera. Se aparecer um pedido de entrada, aprove-o na direção. Você continua conectado quando volta ao painel.</p><p id="host-entry-status" class="host-entry-status" role="status">Aguardando sua entrada na sala.</p><div id="host-entry-frame"></div><button id="host-entry-leave" class="text-button" type="button">Desligar minha câmera e sair da sala</button></dialog>');
$('host-entry-close').onclick=()=>$('host-entry').close();
const approval=document.createElement('button');approval.type='button';approval.className='text-button';approval.textContent='Conferir aprovação na direção';approval.onclick=()=>{$('host-entry').close();location.hash='#estudio';};$('host-entry-status').after(approval);
$('host-entry-leave').onclick=()=>{hostFrame?.contentWindow?.postMessage({hangup:true},origin);hostFrame?.remove();hostFrame=null;$('host-entry').close();};
function enterHost(){
  openRoom();if(!state)return;
  if(!hostFrame){
    hostFrame=document.createElement('iframe');hostFrame.title='Minha câmera e microfone na sala APCE';hostFrame.allow='camera; microphone; autoplay; fullscreen; display-capture';hostFrame.referrerPolicy='no-referrer';hostFrame.src=state.links.host;
    hostFrame.onload=()=>hostFrame.contentWindow.postMessage({pauseinvisible:false},origin);
    $('host-entry-frame').append(hostFrame);
  }
  $('host-entry').showModal();
}
window.apceEnterHost=enterHost;
window.addEventListener('apce:state',event=>{
  const connected=!!event.detail.hostConnected,text=connected?'Apresentador conectado ao programa. Confira sua imagem e o nível de voz.':'Câmera/microfone ainda não chegaram ao estúdio. Escolha os dispositivos, entre e confira a aprovação na direção.';
  $('host-entry-status').textContent=text;
  const shortcut=$('host-entry-shortcut');if(shortcut){shortcut.classList.toggle('connected',connected);shortcut.querySelector('span').textContent=connected?'Minha câmera · conectado':'Entrar com câmera e microfone';}
});
// O apresentador ouve as mídias diretamente pelo OBS. Mantém o vídeo do retorno
// sem reproduzir uma segunda cópia do mesmo áudio na sua entrada VDO.Ninja.
function syncHostReturnAudio(){if(hostFrame&&state){const id=new URL(state.links.host).searchParams.get('broadcast');if(id)hostFrame.contentWindow.postMessage({volume:0,target:id},origin);}}
setInterval(syncHostReturnAudio,2000);
$('room-host').onclick=enterHost;document.querySelector('[data-open="host"]').onclick=enterHost;
async function returnAction(action){const button=$('room-return-'+action);if(button)button.disabled=true;try{const s=await post('/api/room/return',{action});$('room-return-status').textContent=s.running?'Retorno privado ligado':'Retorno privado desligado';message(s.running?'Os convidados podem acompanhar o programa pelo retorno.':'Retorno desligado.');}catch(e){message(e.message,true);}finally{if(button)button.disabled=false;}}
$('room-return-start').onclick=()=>returnAction('start');$('room-return-stop').onclick=()=>returnAction('stop');
async function poll(){
  if(pending)return;pending=true;
  try{const res=await fetch('/api/room/state');if(res.ok)render(await res.json());if(frame)frame.contentWindow.postMessage({getDetailedState:true,cib:'apce-roster'},origin);if(frame&&Date.now()-lastMessage>15000)$('room-status').textContent='Conectando à direção do VDO.Ninja…';}catch{}finally{pending=false;}
}
await poll();syncPanelViews();setInterval(poll,3000);

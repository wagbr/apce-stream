let state, editing=false, timer;
const $ = id => document.getElementById(id);
const sceneLabels = {wait:'Preparação',intro:'Abertura',solo:'Solo',duo:'Entrevista',room:'Sala aberta',media:'Mídia',end:'Encerramento'};
function toast(message){$('toast').textContent=message;$('toast').style.display='block';clearTimeout(timer);timer=setTimeout(()=>$('toast').style.display='none',6000);}
async function action(data){const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw new Error(result.error);return result;}
async function run(fn){try{await fn();await refresh();}catch(e){toast(e.message);}}
function openLink(key){if(state?.links[key])window.open(state.links[key],'_blank','noopener,noreferrer');}
function help(html){$('help-content').innerHTML=html;$('help').showModal();}
async function refresh(){
  try{
    const r=await fetch('/api/state');state=await r.json();
    $('dot').classList.toggle('ready',state.connected);$('connection').textContent=state.connected?'OBS conectado':'OBS desconectado';
    $('live').textContent=state.streaming?'● TRANSMITINDO':'Fora do ar';$('live').classList.toggle('on',!!state.streaming);
    if(!$('scenes').children.length){Object.entries(state.scenes).forEach(([key,name],i)=>{const b=document.createElement('button');b.className='scene';b.dataset.scene=name;const n=document.createElement('span');n.className='num';n.textContent=String(i).padStart(2,'0');b.append(n,document.createTextNode(sceneLabels[key]));b.onclick=()=>run(()=>action({action:'scene',scene:name}));$('scenes').append(b);});}
    document.querySelectorAll('[data-scene]').forEach(b=>{b.classList.toggle('active',b.dataset.scene===state.currentScene);b.setAttribute('aria-pressed',String(b.dataset.scene===state.currentScene));});
    for(const p of ['host','guest']){$(p+'-mute').classList.toggle('muted',!!state[p+'Muted']);$(p+'-mute').textContent=state[p+'Muted']?'Mudo':'Mic';}
    if(!editing){for(const p of ['host','guest','topic'])$('labels').elements[p].value=state.labels[p];$('labels').elements.afterIntro.value=state.afterIntro;}
    $('record').textContent=state.recording?'■ Parar gravação':'● Gravar localmente';
    $('mediafile').textContent=state.mediaFile||state.imageFile||'Selecione um arquivo local ou compartilhe uma janela.';
    $('youtube-status').textContent=state.youtube.accountConnected?('Conta conectada: '+state.youtube.channelName+'. '+(state.youtube.configured?'Confira a live antes de transmitir.':'Selecione a live em Gerenciar transmissão no OBS.')):(state.youtube.configured?'YouTube: chave configurada no OBS. Confira o canal antes de transmitir.':'YouTube: conexão da conta pendente no OBS.');
    $('youtube').textContent=state.youtube.accountConnected?'YouTube conectado ↗':'Conectar YouTube ↗';
    if(!state.connected){$('preview').style.display='none';$('empty').style.display='flex';}
  }catch(e){$('connection').textContent='Painel sem conexão';}
}
async function preview(){try{if(!state?.connected)return;const r=await fetch('/api/preview');if(!r.ok)return;const p=await r.json();$('preview').src=p.image;$('preview').style.display='block';$('empty').style.display='none';}catch(e){}}
$('labels').oninput=()=>{editing=true;};$('labels').onsubmit=e=>{e.preventDefault();run(async()=>{const values=Object.fromEntries(new FormData(e.target));await action({action:'labels',...values});editing=false;toast('Identificação atualizada.');});};
document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>run(async()=>{await navigator.clipboard.writeText(state.links[b.dataset.copy]);toast('Link copiado. Compartilhe apenas com os participantes.');}));
document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openLink(b.dataset.open));
document.querySelectorAll('[data-mute]').forEach(b=>b.onclick=()=>run(()=>action({action:'mute',input:b.dataset.mute})));
document.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>run(async()=>{toast('Escolha o arquivo na janela do Windows.');await action({action:'pick-media',kind:b.dataset.pick});}));
document.querySelectorAll('[data-media]').forEach(b=>b.onclick=()=>run(()=>action({action:'media-type',kind:b.dataset.media})));
document.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>run(()=>action({action:'media-control',command:b.dataset.play})));
$('share').onclick=()=>openLink('share');$('record').onclick=()=>run(()=>action({action:'record'}));
$('setup').onclick=()=>run(async()=>{if(confirm('Criar ou reparar as cenas da coleção APCE? O programa voltará à preparação.')){await action({action:'setup'});toast('Cenas APCE configuradas.');}});
$('youtube').onclick=()=>help('<h2>Conectar o canal da APCE</h2><ol><li>No OBS APCE, abra <strong>Configurações → Transmissão</strong>.</li><li>Confirme <strong>YouTube – RTMPS</strong> e clique em <strong>Conectar conta</strong>.</li><li>Faça login e selecione o canal <strong>@apcedf</strong>, autorizando o OBS.</li><li>Volte ao OBS, aplique as configurações e use <strong>Gerenciar transmissão</strong> para escolher a live.</li></ol><p>A transmissão começa somente quando você aciona o controle do OBS. Confira o canal antes.</p><p><a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer">Abrir YouTube Studio ↗</a></p>');
$('return-help').onclick=()=>help('<h2>Retorno aos convidados</h2><p>No OBS, abra <strong>Ferramentas → VDO.Ninja Studio → Guest Return</strong>. A sala e o retorno foram preparados no perfil APCE.</p><ol><li>Confirme a <strong>trilha de áudio 2</strong> e o limite de convidados.</li><li>Clique em <strong>Start return</strong>. Esse botão ativa o retorno privado.</li><li>Entre pelo link do apresentador. Os convidados usam o convite da sala ou o link individual.</li></ol><p>Todos veem o programa e ouvem a abertura e as mídias. A conversa chega diretamente pela sala, sem devolver as vozes na trilha de retorno. Use fones de ouvido.</p><p>Os botões de microfone deste painel controlam as fontes do OBS. Na sala aberta, gerencie quem aparece e é ouvido pela página <strong>Direção</strong>.</p>');
$('close-help').onclick=()=>$('help').close();
await refresh();await preview();setInterval(refresh,2500);setInterval(preview,2000);

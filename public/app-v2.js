let state, editing=false, toastTimer, refreshPending=false, previewPending=false;
const $=id=>document.getElementById(id);
const icon=id=>`<svg class="icon" aria-hidden="true"><use href="/icons.svg#${id}"/></svg>`;
const sceneLabels={wait:'Preparação',intro:'Abertura',solo:'Solo',duo:'Entrevista',room:'Sala aberta',media:'Mídia',end:'Encerramento'};
const recordControl=$('record');recordControl.classList.remove('full');document.querySelector('.topbar-actions').insertBefore(recordControl,$('youtube'));document.querySelector('.output-heading .eyebrow').textContent='CANAL DA APCE';
const performanceStatus=document.createElement('p');performanceStatus.id='performance-status';performanceStatus.className='hint';performanceStatus.style.cssText='padding:0 16px 12px;margin:0;overflow-wrap:anywhere';document.querySelector('.program-card').append(performanceStatus);
function renderPerformance(p){
  const issues={network:'Há perda de quadros no envio. Confira a conexão de internet.',encoding:'A codificação está perdendo quadros.',rendering:'A composição da cena está perdendo quadros.',ok:p?.streaming?'Envio sem perda de quadros neste intervalo.':'Sem transmissão em andamento.',waiting:'Medindo o desempenho…'};
  performanceStatus.textContent=p?`OBS · ${p.fps} fps · CPU ${p.cpu}% · ${issues[p.issue]||issues.waiting}`:'Aguardando medição do OBS.';
  performanceStatus.title=p?`Últimos 5 s: composição ${p.renderLoss}% · codificação ${p.encodeLoss}% · rede ${p.networkLoss}%. A prévia acima é uma foto atualizada a cada 2 s; confira o movimento no OBS.`:'';
}

function toast(message,error=false){$('toast-message').textContent=message;$('toast').classList.toggle('error',error);$('toast').dataset.visible='true';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').dataset.visible='false',5500);}
async function action(data){const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw new Error(result.error||'Não foi possível concluir esta ação.');return result;}
async function run(fn,button){
  if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
  try{await fn();await refresh();}catch(e){toast(e.message,true);}
  finally{if(button){button.disabled=false;button.removeAttribute('aria-busy');}}
}
function openLink(key){if(state?.links[key])window.open(state.links[key],'_blank','noopener,noreferrer');else toast('Aguarde a conexão do painel.',true);}
function help(html){$('help-content').innerHTML=html;$('help').showModal();}
function buildScenes(){
  for(const [i,[key,name]] of Object.entries(state.scenes).entries()){
    const b=document.createElement('button');b.className='scene';b.dataset.scene=name;b.dataset.layout=key;b.setAttribute('aria-label',name.replace(' · ',' '));b.title=`${sceneLabels[key]} · atalho ${i+1}`;
    const thumb=document.createElement('div');thumb.className='scene-thumb';
    const img=document.createElement('img');img.src=`/assets/orbital-v2/scene-${key}-v2.webp`;img.alt='';img.loading='lazy';img.decoding='async';img.onerror=()=>{img.style.visibility='hidden';};
    const num=document.createElement('span');num.className='scene-index';num.textContent=name.slice(0,2);
    const shortcut=document.createElement('kbd');shortcut.className='scene-key';shortcut.textContent=i+1;shortcut.setAttribute('aria-hidden','true');
    thumb.append(img,num,shortcut);
    const meta=document.createElement('div');meta.className='scene-meta';const label=document.createElement('span');label.className='scene-label';label.textContent=sceneLabels[key];const lamp=document.createElement('i');lamp.className='scene-light';lamp.setAttribute('aria-hidden','true');meta.append(label,lamp);b.append(thumb,meta);
    b.onclick=()=>run(()=>action({action:'scene',scene:name}),b);$('scenes').append(b);
  }
}
async function refresh(){
  if(refreshPending)return;refreshPending=true;
  try{
    const r=await fetch('/api/state');if(!r.ok)throw Error('Sem conexão');state=await r.json();window.apceProductionState=state;
    $('dot').classList.toggle('ready',state.connected);$('connection').textContent=state.connected?'OBS conectado':'OBS desconectado';
    const onAir=window.apceBroadcast?.selected?.lifeCycleStatus==='live';$('live').textContent=onAir?'Ao vivo':state.streaming?'Enviando sinal':'Fora do ar';$('live').classList.toggle('on',onAir);
    $('program-name').textContent=state.currentScene?state.currentScene.split(' · ').slice(1).join(' · '):'Estúdio em espera';
    if(!$('scenes').children.length)buildScenes();
    for(const b of document.querySelectorAll('[data-scene]')){const selected=b.dataset.scene===state.currentScene;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));if(!b.hasAttribute('aria-busy'))b.disabled=!state.connected;}
    for(const p of ['host','guest']){
      const muted=!!state[p+'Muted'],button=$(p+'-mute');button.classList.toggle('muted',muted);button.setAttribute('aria-pressed',String(muted));button.setAttribute('aria-label',`${muted?'Ativar':'Silenciar'} ${p==='host'?'apresentador':'convidado'}`);button.title=button.getAttribute('aria-label');button.querySelector('use').setAttribute('href','/icons.svg#'+(muted?'mic-off':'mic'));if(!button.hasAttribute('aria-busy'))button.disabled=!state.connected;
      $(p+'-name').textContent=state.labels[p]||(p==='host'?'Apresentador':'Convidado');$(p+'-avatar').textContent=state.labels[p]?Array.from(state.labels[p].trim())[0]?.toLocaleUpperCase('pt-BR')||'':(p==='host'?'01':'02');
    }
    if(!editing){for(const p of ['host','guest','topic'])$('labels').elements[p].value=state.labels[p];$('labels').elements.afterIntro.value=state.afterIntro;}
    $('record-label').textContent=state.recording?'Parar gravação':'Gravar localmente';$('record').setAttribute('aria-label',$('record-label').textContent);$('record').title=$('record-label').textContent;$('record').classList.toggle('recording',!!state.recording);$('record').querySelector('use').setAttribute('href','/icons.svg#'+(state.recording?'stop':'record'));if(!$('record').hasAttribute('aria-busy'))$('record').disabled=!state.connected;
    const file=state.mediaFile||state.imageFile||'';$('mediafile').textContent=file?file.split(/[\\/]/).pop():'Selecione um arquivo ou compartilhe uma janela.';$('mediafile').title=file;
    const linked=!!state.youtube.schedulerConnected;
    $('youtube-status').textContent=linked?('Canal conectado: '+state.youtube.accountName+'. Selecione a live no controle de transmissão do painel.'):'Conecte o canal no Agendador para iniciar e encerrar pelo painel.';
    $('youtube-label').textContent=linked?'YouTube conectado':'Conectar canal';$('youtube').classList.toggle('connected',linked);$('youtube').setAttribute('aria-label',linked?'YouTube conectado ao painel':'Conectar YouTube');
    if(!state.connected){$('preview').style.display='none';$('empty').style.display='flex';}
    renderPerformance(state.performance);window.dispatchEvent(new CustomEvent('apce:state',{detail:state}));
  }catch(e){$('connection').textContent='Painel sem conexão';$('dot').classList.remove('ready');}
  finally{refreshPending=false;}
}
async function preview(){if(previewPending||!state?.connected||document.hidden||['#estudio','#agendador','#biblioteca'].includes(location.hash))return;previewPending=true;try{const r=await fetch('/api/preview');if(!r.ok)return;const p=await r.json();$('preview').src=p.image;$('preview').style.display='block';$('empty').style.display='none';}catch{}finally{previewPending=false;}}
$('labels').oninput=()=>{editing=true;};
$('labels').onsubmit=e=>{e.preventDefault();const button=e.target.querySelector('[type=submit]');run(async()=>{await action({action:'labels',...Object.fromEntries(new FormData(e.target))});editing=false;toast('Assinatura atualizada no programa.');},button);};
for(const b of document.querySelectorAll('[data-copy]'))b.onclick=()=>run(async()=>{if(!state?.links[b.dataset.copy])throw Error('Aguarde a conexão do painel.');await navigator.clipboard.writeText(state.links[b.dataset.copy]);toast('Link copiado. A próxima boa conversa está a um convite.');},b);
for(const b of document.querySelectorAll('[data-open]'))b.onclick=()=>openLink(b.dataset.open);
for(const b of document.querySelectorAll('[data-mute]'))b.onclick=()=>run(()=>action({action:'mute',input:b.dataset.mute}),b);
for(const b of document.querySelectorAll('[data-pick]'))b.onclick=()=>run(async()=>{toast('Escolha o arquivo na janela do Windows.');const result=await action({action:'pick-media',kind:b.dataset.pick});if(!result.cancelled)toast('Arquivo preparado. Selecione a cena Mídia para exibir.');},b);
for(const b of document.querySelectorAll('[data-media]'))b.onclick=()=>run(async()=>{await action({action:'media-type',kind:b.dataset.media});document.querySelectorAll('[data-media]').forEach(other=>{other.classList.toggle('selected',other===b);other.setAttribute('aria-pressed',String(other===b));});},b);
for(const b of document.querySelectorAll('[data-play]'))b.onclick=()=>run(()=>action({action:'media-control',command:b.dataset.play}),b);
$('share').onclick=()=>openLink('share');$('record').onclick=()=>run(()=>action({action:'record'}),$('record'));
$('setup').onclick=()=>run(async()=>{if(confirm('Reparar as cenas da coleção APCE? O programa voltará à preparação.')){await action({action:'setup'});toast('Cenas APCE preparadas. Vamos conversar.');}},$('setup'));
$('youtube').onclick=()=>{
  help('<h2>Seu canal no YouTube.</h2><p id="account-copy"></p><ol><li>No OBS APCE, abra <strong>Configurações → Transmissão</strong>.</li><li>Use <strong>YouTube – RTMPS → Conectar conta</strong> se precisar fazer login. Selecione o canal <strong>@apcedf</strong>.</li><li>Com a conta conectada, use <strong>Gerenciar transmissão</strong> no OBS para escolher a live.</li></ol><p>Inicie e encerre a transmissão pelo OBS, depois de conferir o canal e a live.</p><p><a href="https://studio.youtube.com" target="_blank" rel="noopener noreferrer">Abrir YouTube Studio ↗</a></p>');
  $('account-copy').textContent=state?.youtube.accountConnected?'Conta conectada: '+state.youtube.channelName+'.':'A conexão do canal é feita no OBS.';
};
$('return-help').onclick=()=>help('<h2>Todo mundo acompanha.</h2><p>No OBS, abra <strong>Ferramentas → VDO.Ninja Studio → Guest Return</strong>.</p><ol><li>Confirme a <strong>trilha de áudio 2</strong>. A sala e o retorno já estão configurados no perfil APCE.</li><li>Clique em <strong>Start return</strong> para ligar o retorno privado.</li><li>Entre pelo link do apresentador e envie o link individual ao convidado da entrevista. Para mais pessoas, use o convite da sala e a página <strong>Direção</strong>.</li></ol><p>Os convidados veem o programa e ouvem a abertura e as mídias. A conversa chega diretamente pela sala, sem devolver as próprias vozes com atraso. Use fones de ouvido.</p><p>Os botões de microfone controlam as fontes individuais no OBS. Na sala aberta, gerencie o áudio pela <strong>Direção</strong>.</p>');
$('studio-help').onclick=()=>help('<h2>O estúdio é seu.</h2><p>Escolha uma cena pelas miniaturas ou use as teclas <strong>1 a 7</strong>. Os atalhos ficam suspensos enquanto você escreve nos campos.</p><ol><li>Entre com câmera e microfone e convide seus interlocutores.</li><li>Preencha nomes e assunto em <strong>Sua assinatura</strong>.</li><li>Escolha o layout e prepare os arquivos em <strong>Na tela, por favor</strong>.</li><li>Ao selecionar <strong>Abertura</strong>, a vinheta toca e avança automaticamente para a cena escolhida.</li></ol><p>A transmissão pública começa pelo OBS. O painel permite produzir, trocar cenas e gravar localmente.</p>');
$('close-help').onclick=()=>$('help').close();
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||['#agendador','#biblioteca','#estudio'].includes(location.hash)||document.querySelector('dialog[open]')||e.target.closest('input,textarea,select,[contenteditable=true]'))return;if(/^[1-7]$/.test(e.key)&&state?.connected){const scene=Object.values(state.scenes)[Number(e.key)-1];if(scene){e.preventDefault();run(()=>action({action:'scene',scene}));}}});
for(const link of document.querySelectorAll('.rail-links>a'))link.onclick=()=>{document.querySelectorAll('.rail-links>a').forEach(l=>l.classList.toggle('active',l===link));};
await refresh();await preview();setInterval(refresh,2500);setInterval(preview,2000);

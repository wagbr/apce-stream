const $=id=>document.getElementById(id);
document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="/live-control.css">');
document.querySelector('.production').insertAdjacentHTML('afterbegin',`
<article class="card broadcast-card" aria-labelledby="broadcast-title"><div class="broadcast-heading"><div><span class="eyebrow">YOUTUBE · @apcedf</span><h2 id="broadcast-title">Sua conversa, ao vivo.</h2></div><span id="broadcast-badge" class="live-badge">Fora do ar</span></div>
<label for="broadcast-select">Transmissão agendada</label><div class="broadcast-select-row"><select id="broadcast-select"><option value="">Atualize e selecione uma live</option></select><button id="broadcast-refresh" class="beige-button" title="Atualizar lives">Atualizar</button></div>
<p id="broadcast-detail" class="hint">Agende uma live para definir título, horário e thumb.</p><div class="broadcast-actions"><button id="broadcast-start" class="primary" disabled>Iniciar transmissão</button><button id="broadcast-stop" class="beige-button" disabled>Encerrar transmissão</button><a href="#agendador" class="text-button">Agendar live</a></div><p id="broadcast-message" class="hint" role="status" aria-live="polite"></p></article>
<dialog id="broadcast-confirm" class="live-confirm"><button id="broadcast-close" class="icon-button close" aria-label="Fechar">×</button><span class="eyebrow">CANAL @apcedf</span><h2 id="broadcast-confirm-title"></h2><p id="broadcast-confirm-event"></p><p id="broadcast-confirm-copy"></p><div class="broadcast-actions"><button id="broadcast-confirm-go" class="primary"></button><button id="broadcast-cancel" class="beige-button">Voltar</button></div></dialog>`);
let state,working=false,confirmation;
$('youtube').onclick=()=>{location.hash='#agendador';};
$('return-help').onclick=()=>{location.hash='#estudio';};
$('studio-help').onclick=()=>{$('help-content').innerHTML='<h2>Do convite ao vivo.</h2><ol><li>Abra <strong>Sala e convidados</strong>, ligue a direção e o retorno, entre com sua câmera e copie o convite para o chat.</li><li>Aprove os pedidos na direção e adicione as pessoas ao estúdio. Há 12 lugares, incluindo apresentadores.</li><li>No Programa, selecione a live agendada e use <strong>Iniciar transmissão</strong>. Confira a cena antes de confirmar.</li><li>Troque cenas, exiba mídias e use <strong>Encerrar transmissão</strong> para finalizar no YouTube e parar o sinal do OBS.</li></ol><p>Os convidados veem o programa pelo retorno. A sala pode continuar aberta depois da live. Use fones e mantenha o painel aberto durante a produção.</p>';$('help').showModal();};
const privacy={public:'Pública',unlisted:'Não listada',private:'Privada'};
const phases={checking:'Conferindo o canal e a live…',preparing:'Preparando a entrada de vídeo…',sending:'Ligando o envio do OBS…',waiting:'Aguardando o YouTube receber o sinal…',starting:'Abrindo a live no YouTube…',live:'Transmissão ao vivo no YouTube.',stopping:'Encerrando a live no YouTube e o envio do OBS…',complete:'Transmissão encerrada no YouTube.',idle:''};
async function request(action,data={}){const res=await fetch('/api/broadcast/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...data})});const body=await res.json();if(!res.ok)throw Error(body.error);return body;}
function render(s){
  state=s;window.apceBroadcast=s;const select=$('broadcast-select'),focused=document.activeElement===select;
  const items=[...s.options];if(s.selected&&!items.some(e=>e.id===s.selected.id))items.unshift(s.selected);
  const signature=JSON.stringify(items.map(e=>[e.id,e.title,e.lifeCycleStatus]));
  if(!focused&&select.dataset.signature!==signature){select.replaceChildren(new Option('Selecione uma live agendada',''));for(const e of items)select.add(new Option(e.title,e.id));select.dataset.signature=signature;}
  if(!focused)select.value=s.selected?.id||'';
  const live=s.selected?.lifeCycleStatus==='live';$('broadcast-badge').textContent=live?'Ao vivo':s.ingestOwned?'Enviando sinal':'Fora do ar';$('broadcast-badge').classList.toggle('on',live);
  if(s.selected){const when=s.selected.scheduledStartTime?new Date(s.selected.scheduledStartTime).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'';$('broadcast-detail').textContent=`${privacy[s.selected.privacy]||''} · ${when} · @apcedf`;}
  const busy=working||s.busy;select.disabled=busy||s.ingestOwned;$('broadcast-refresh').disabled=busy;
  $('broadcast-start').disabled=busy||!s.obsConnected||!s.selected||live||s.selected.lifeCycleStatus==='complete';
  $('broadcast-stop').disabled=busy||!s.selected||(!s.ingestOwned&&!['live','liveStarting','testing'].includes(s.selected.lifeCycleStatus));
  $('broadcast-message').textContent=s.error||phases[s.phase]||'';$('broadcast-message').classList.toggle('live-error',!!s.error);
  const badge=$('live');if(badge){badge.textContent=live?'Ao vivo':s.ingestOwned?'Enviando sinal':'Fora do ar';badge.classList.toggle('on',live);}
  window.dispatchEvent(new CustomEvent('apce:broadcast',{detail:s}));
}
async function run(action,data={}){
  working=true;if(state)render(state);
  try{const result=await request(action,data);working=false;render(result);}
  catch(e){working=false;if(state)render(state);$('broadcast-message').textContent=e.message;$('broadcast-message').classList.add('live-error');}
}
$('broadcast-refresh').onclick=()=>run('refresh');
$('broadcast-select').onchange=e=>{if(e.target.value)run('select',{id:e.target.value});};
function confirm(action){
  if(!state?.selected)return;confirmation={action,id:state.selected.id};const start=action==='start';
  $('broadcast-confirm-title').textContent=start?'Vamos entrar no ar?':'Encerrar esta transmissão?';
  $('broadcast-confirm-event').textContent=state.selected.title+' · '+privacy[state.selected.privacy];
  $('broadcast-confirm-copy').textContent=start?'A cena atual do OBS será enviada ao canal @apcedf. Confira câmera, microfones e a cena antes de continuar.':'O YouTube encerrará esta live e o OBS parará de enviar o sinal. A sala e o retorno dos convidados continuam ligados.';
  if(start&&!window.apceProductionState?.hostConnected)$('broadcast-confirm-copy').textContent+=' A direção ainda não confirmou sua câmera e microfone no estúdio. Use Entrar com câmera e microfone e confira os dispositivos e a aprovação antes de uma conversa ao vivo. Você pode iniciar só com a abertura ou mídias, se desejar.';
  $('broadcast-confirm-go').textContent=start?'Entrar ao vivo agora':'Encerrar live agora';$('broadcast-confirm').showModal();
}
$('broadcast-start').onclick=()=>confirm('start');$('broadcast-stop').onclick=()=>confirm('stop');
$('broadcast-close').onclick=$('broadcast-cancel').onclick=()=>$('broadcast-confirm').close();
$('broadcast-confirm-go').onclick=()=>{$('broadcast-confirm').close();run(confirmation.action,{id:confirmation.id});};
async function poll(){try{const res=await fetch('/api/broadcast/state');if(res.ok)render(await res.json());}catch{}}
await poll();await run('refresh');setInterval(poll,2000);

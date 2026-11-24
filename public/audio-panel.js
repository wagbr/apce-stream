const $=id=>document.getElementById(id);
const icon=name=>`<svg class="icon" aria-hidden="true"><use href="/icons.svg#${name}"/></svg>`;
document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="/audio-panel.css">');
const opener=document.createElement('button');opener.id='audio-open';opener.type='button';opener.className='sand-tool';opener.innerHTML=icon('mic')+'<span>Áudio e volume</span>';
await new Promise(resolve=>{const ready=()=>document.querySelector('.sand-toolbelt');if(ready())return resolve();const observer=new MutationObserver(()=>{if(ready()){observer.disconnect();resolve();}});observer.observe(document.body,{childList:true,subtree:true});});
document.querySelector('.sand-toolbelt').append(opener);
document.body.insertAdjacentHTML('beforeend',`<dialog id="audio-panel" class="audio-panel"><button id="audio-close" class="icon-button close" aria-label="Fechar controles de áudio">${icon('close')}</button><span class="eyebrow">SOM DA TRANSMISSÃO</span><h2>Todo mundo se ouve.</h2><p>Abertura e mídias saem com áudio. Use os botões para silenciar quando desejar. A escuta no computador é independente do áudio enviado ao público.</p><div id="audio-channels"></div><p class="hint">As vozes dos convidados são ouvidas na sua entrada como apresentador. A escuta extra da conversa é opcional e pode repetir sua própria voz. Use fones.</p><p id="audio-message" role="status" aria-live="polite"></p></dialog>`);
let state,requesting=false;const rows=new Map();
const message=(value,error=false)=>{$('audio-message').textContent=value;$('audio-message').classList.toggle('live-error',error);};
async function change(data){try{const response=await fetch('/api/audio/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const body=await response.json();if(!response.ok)throw Error(body.error);render(body);message('Áudio atualizado.');}catch(error){message(error.message,true);}}
function render(value){
  state=value;
  for(const channel of value.channels){
    let row=rows.get(channel.id);
    if(!row){
      row=document.createElement('section');row.className='audio-channel';row.innerHTML=`<div class="audio-channel-heading"><strong></strong><button class="beige-button audio-mute" type="button"></button></div><div class="audio-meter" role="meter" aria-valuemin="-60" aria-valuemax="0"><span></span></div><div class="audio-channel-controls"><label>Volume<input class="audio-volume" type="range" min="0" max="100" step="1"></label><label class="audio-monitor"><input type="checkbox">Ouvir no computador</label></div><small class="hint audio-route"></small>`;
      row.dataset.channel=channel.id;row.querySelector('strong').textContent=channel.label;
      row.querySelector('.audio-mute').onclick=()=>{const current=state.channels.find(item=>item.id===channel.id);change({action:'mute',channel:channel.id,muted:!current.muted});};
      row.querySelector('.audio-volume').onchange=event=>change({action:'volume',channel:channel.id,volume:Number(event.target.value)/100});
      row.querySelector('.audio-monitor input').onchange=event=>change({action:'monitor',channel:channel.id,enabled:event.target.checked});
      $('audio-channels').append(row);rows.set(channel.id,row);
    }
    const mute=row.querySelector('.audio-mute');mute.textContent=channel.muted?'Ativar som':'Silenciar';mute.setAttribute('aria-pressed',String(!!channel.muted));mute.setAttribute('aria-label',(channel.muted?'Ativar som de ':'Silenciar ')+channel.label);mute.classList.toggle('muted',!!channel.muted);
    for(const control of row.querySelectorAll('button,input'))control.disabled=!channel.available;
    const volume=row.querySelector('.audio-volume');volume.setAttribute('aria-label','Volume de '+channel.label);if(document.activeElement!==volume)volume.value=Math.round((channel.volume??1)*100);
    row.querySelector('.audio-monitor input').checked=!!channel.monitor;
    const meter=row.querySelector('.audio-meter');meter.setAttribute('aria-label','Nível de '+channel.label);meter.setAttribute('aria-valuenow',String(Math.round(channel.db??-60)));meter.querySelector('span').style.width=(Math.max(0,Math.min(60,(channel.db??-60)+60))/60*100)+'%';
    row.querySelector('.audio-route').textContent=!channel.available?'Fonte indisponível: use Reparar cenas.':!channel.streamTrack?'Sem áudio na trilha da transmissão: confira a configuração.':channel.muted?'Silenciado no programa':channel.active?'Áudio habilitado no programa':'Áudio habilitado · aguardando esta cena';
  }
}
async function poll(){if(requesting||!$('audio-panel').open)return;requesting=true;try{const response=await fetch('/api/audio/state');if(response.ok)render(await response.json());}catch{message('Não foi possível consultar o áudio.',true);}finally{requesting=false;}}
opener.onclick=()=>{$('audio-panel').showModal();poll();};$('audio-close').onclick=()=>$('audio-panel').close();setInterval(poll,500);

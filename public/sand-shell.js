import {syncPanelViews} from './panel-views.js';
const $=id=>document.getElementById(id),icon=name=>`<svg class="icon" aria-hidden="true"><use href="/icons.svg#${name}"/></svg>`;
const sheet=$('sand-theme')||document.createElement('link');sheet.id='sand-theme';sheet.rel='stylesheet';sheet.href='/sand-theme.css';document.head.append(sheet);
const required=['broadcast-select','schedule-form','library-drop','room-return-start','comments-column'];
await new Promise(resolve=>{
  const ready=()=>required.every(id=>$(id));if(ready()){resolve();return;}
  const observer=new MutationObserver(()=>{if(ready()){observer.disconnect();resolve();}});observer.observe(document.body,{childList:true,subtree:true});
});
document.head.append(sheet);
// Mantém os campos e seus eventos: abrir e fechar um painel não recria formulários.
const production=document.querySelector('.production'),main=document.querySelector('main');
const nav=document.createElement('nav');nav.className='sand-nav';nav.setAttribute('aria-label','Áreas do painel');
nav.innerHTML=`<a href="#programa">${icon('studio')}<span>Programa</span></a><a href="#estudio">${icon('users')}<span>Convidados</span></a><a href="#biblioteca">${icon('library')}<span>Mídias</span></a><a href="#agendador">${icon('calendar')}<span>Agenda</span></a>`;
document.querySelector('.brand').after(nav);
document.querySelector('.brand .eyebrow').textContent='APCE · ATEU CAST';
const brandTitle=document.querySelector('.brand strong');brandTitle.textContent='Mesa de produção';
document.querySelector('.workspace-heading h1').textContent='O estúdio é seu.';
document.querySelector('.workspace-heading .eyebrow').textContent='CIÊNCIA, LAICIDADE E BOAS CONVERSAS';
document.querySelector('.workspace-heading p').textContent='Prepare. Convide. Converse.';
const topActions=document.querySelector('.topbar-actions');
const chatButton=document.createElement('button');chatButton.id='sand-chat';chatButton.className='icon-button';chatButton.setAttribute('aria-label','Mostrar ou recolher comentários');chatButton.setAttribute('aria-controls','comments-column');chatButton.title='Comentários';chatButton.innerHTML='<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-6 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M7 8h10M7 12h6"/></svg>';
const settingsButton=document.createElement('button');settingsButton.id='sand-settings';settingsButton.className='icon-button';settingsButton.setAttribute('aria-label','Abrir configurações do estúdio');settingsButton.title='Configurações';settingsButton.innerHTML=icon('sliders');topActions.append(chatButton,settingsButton);
const drawer=document.createElement('dialog');drawer.id='studio-panel';drawer.className='sand-panel';drawer.setAttribute('aria-labelledby','sand-panel-title');
drawer.innerHTML=`<header id="sand-panel-handle" class="sand-panel-header" tabindex="0" aria-label="Mover painel. Use as setas do teclado para reposicionar."><span class="sand-grip" aria-hidden="true">${icon('sliders')}</span><div><span class="eyebrow">MESA DE PRODUÇÃO</span><h2 id="sand-panel-title"></h2></div><button id="sand-panel-close" class="icon-button" aria-label="Fechar painel">${icon('close')}</button></header><div id="sand-panel-body" class="sand-panel-body"></div>`;document.body.append(drawer);
const panels=new Map(),panelBody=$('sand-panel-body');let opener=null,activePanel=null;
function section(key,title,nodes,wide=false){
  const s=document.createElement('section');s.className='sand-panel-section';s.dataset.panel=key;s.hidden=true;
  for(const node of nodes)if(node)s.append(node);
  panelBody.append(s);panels.set(key,{element:s,title,wide});return s;
}
function closePanel(){if(!drawer.open)return;drawer.close();opener?.setAttribute('aria-expanded','false');opener?.focus({preventScroll:true});activePanel=null;}
function openPanel(key,button){
  const panel=panels.get(key);if(!panel)return;
  if(drawer.open)drawer.close();opener?.setAttribute('aria-expanded','false');
  for(const p of panels.values())p.element.hidden=p!==panel;
  activePanel=key;opener=button||document.activeElement;opener?.setAttribute('aria-expanded','true');
  $('sand-panel-title').textContent=panel.title;drawer.classList.toggle('wide',panel.wide);drawer.dataset.panel=key;
  drawer.style.removeProperty('left');drawer.style.removeProperty('top');drawer.style.removeProperty('width');drawer.style.removeProperty('height');drawer.style.removeProperty('right');
  if(matchMedia('(max-width:760px)').matches)drawer.showModal();else drawer.show();
  panelBody.scrollTop=0;requestAnimationFrame(()=>{
    const field=panel.element.querySelector('input:not([type=file]):not([type=hidden]),select,button,textarea');(field||$('sand-panel-close')).focus({preventScroll:true});
  });
}
function button(label,key,glyph='sliders'){
  const b=document.createElement('button');b.type='button';b.className='sand-tool';b.dataset.panelOpen=key;b.setAttribute('aria-controls','studio-panel');b.setAttribute('aria-expanded','false');b.innerHTML=icon(glyph);const span=document.createElement('span');span.textContent=label;b.append(span);b.onclick=()=>openPanel(key,b);return b;
}
$('sand-panel-close').onclick=closePanel;
drawer.addEventListener('cancel',e=>{e.preventDefault();closePanel();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drawer.open&&!document.querySelector('dialog[open]:not(#studio-panel)')){e.preventDefault();closePanel();}});
drawer.addEventListener('close',()=>{if(!drawer.open)opener?.setAttribute('aria-expanded','false');});
// Painel flutuante no computador; folha modal em telas pequenas.
const handle=$('sand-panel-handle');let drag=null;
const position=(x,y)=>{const r=drawer.getBoundingClientRect();drawer.style.left=Math.max(8,Math.min(innerWidth-r.width-8,x))+'px';drawer.style.top=Math.max(8,Math.min(innerHeight-r.height-8,y))+'px';drawer.style.right='auto';};
handle.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button')||matchMedia('(max-width:760px)').matches)return;const r=drawer.getBoundingClientRect();drag={x:e.clientX-r.x,y:e.clientY-r.y};handle.setPointerCapture(e.pointerId);handle.classList.add('dragging');e.preventDefault();});
handle.addEventListener('pointermove',e=>{if(drag)position(e.clientX-drag.x,e.clientY-drag.y);});
handle.addEventListener('pointerup',()=>{drag=null;handle.classList.remove('dragging');});handle.addEventListener('pointercancel',()=>{drag=null;handle.classList.remove('dragging');});
handle.addEventListener('keydown',e=>{if(e.target!==handle||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();if(e.key==='Home'){drawer.style.removeProperty('left');drawer.style.removeProperty('right');drawer.style.removeProperty('top');return;}const r=drawer.getBoundingClientRect(),step=e.shiftKey?40:16;position(r.x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),r.y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));});

const session=document.createElement('div');session.className='sand-session';session.innerHTML=`<button id="sand-event" class="sand-event" aria-controls="studio-panel" aria-expanded="false"><span class="eyebrow">TRANSMISSÃO DO YOUTUBE</span><strong id="sand-event-title">Escolher uma transmissão</strong><span class="sand-event-edit">${icon('sliders')}</span></button><div class="sand-session-actions" id="sand-session-actions"></div>`;
production.prepend(session);
const actions=$('sand-session-actions');actions.append($('broadcast-badge'),$('broadcast-start'),$('broadcast-stop'));
const liveMessage=$('broadcast-message');liveMessage.classList.add('sand-live-message');session.after(liveMessage);
const broadcastCard=document.querySelector('.broadcast-card');section('transmissao','Escolher transmissão',[broadcastCard]);
$('sand-event').onclick=()=>openPanel('transmissao',$('sand-event'));
const tools=document.createElement('div');tools.className='sand-toolbelt';
const audio=document.createElement('div');audio.className='sand-audio';
for(const who of ['host','guest']){const group=document.createElement('div');group.className='sand-mic';const label=document.createElement('span');label.id='sand-'+who+'-name';label.textContent=who==='host'?'Apresentador':'Entrevista';group.append($(who+'-mute'),label);audio.append(group);}
tools.append(audio,button('Identificação','identificacao','sliders'),button('Exibição rápida','midia','media'));
const hostEntry=document.createElement('button');hostEntry.type='button';hostEntry.id='host-entry-shortcut';hostEntry.className='sand-tool host-entry-shortcut';hostEntry.innerHTML=icon('users')+'<span>Entrar com câmera e microfone</span>';hostEntry.onclick=()=>window.apceEnterHost?.();tools.prepend(hostEntry);
const guestShortcut=document.createElement('a');guestShortcut.className='sand-tool';guestShortcut.href='#estudio';guestShortcut.innerHTML=icon('users')+'<span>Convidados</span><span id="sand-room-count" class="sand-count">0 / 12</span>';tools.append(guestShortcut);
document.querySelector('.program-card').after(tools);
const stageControls=document.createElement('section');stageControls.className='sand-stage-controls';stageControls.setAttribute('aria-label','Controles de produção');
tools.before(stageControls);stageControls.append(tools,production.querySelector('.section-heading'),$('scenes'));
section('identificacao','Nomes e assunto',[document.querySelector('.labels-card')]);
section('participantes','Áudio e convites',[document.querySelector('.guests-card')]);
section('midia','Exibição rápida',[document.querySelector('.media-card')]);
const output=document.querySelector('.output-card');output.prepend($('youtube'));output.append($('studio-help'));$('studio-help').className='beige-button full';$('studio-help').innerHTML=icon('help')+'<span>Ajuda de operação</span>';
const config=section('configuracoes','Canal e configurações',[output]);config.prepend(button('Áudio e convites','participantes','users'));
settingsButton.onclick=()=>openPanel('configuracoes',settingsButton);

const schedulerGrid=document.querySelector('.scheduler-grid');section('agendamento','Agendar uma live',[schedulerGrid],true);
const newLive=button('Nova transmissão','agendamento','plus');newLive.id='sand-new-live';newLive.classList.add('primary');document.querySelector('.scheduler-heading').append(newLive);
const upload=section('upload','Adicionar mídias',[ $('library-drop'),$('library-files'),document.querySelector('.library-upload-button') ]);
const uploadButton=button('Adicionar arquivos','upload','upload');uploadButton.id='sand-upload';uploadButton.classList.add('primary');document.querySelector('.library-heading-actions').append(uploadButton);
const returnBox=document.createElement('div');returnBox.className='sand-return';returnBox.innerHTML='<p>Os convidados acompanham abertura, câmeras e mídias pelo retorno privado. Use fones de ouvido.</p>';
returnBox.append($('room-return-status'),$('room-return-start'),$('room-return-stop'));section('retorno','Retorno do estúdio',[returnBox]);
$('room-invite').after(button('Retorno do estúdio','retorno','screen'));
for(const hint of [document.querySelector('.studio-warning'),document.querySelector('.studio-director-header .hint')]){
  if(!hint)continue;const details=document.createElement('details');details.className='sand-instructions';const summary=document.createElement('summary');summary.textContent='Como operar esta etapa';hint.before(details);details.append(summary,hint);
}
function syncRoute(){
  syncPanelViews();const hash=location.hash||'#programa';
  for(const a of nav.querySelectorAll('a')){const current=a.hash===hash;a.classList.toggle('active',current);if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  if(drawer.open)closePanel();
}
nav.addEventListener('click',e=>{const a=e.target.closest('a');if(a){e.preventDefault();location.hash=a.hash;scrollTo({top:0,behavior:'instant'});}});
window.addEventListener('hashchange',syncRoute);
function updateBroadcast(s){$('sand-event-title').textContent=s?.selected?.title||'Escolher uma transmissão';$('sand-event').title=s?.selected?.title||'Escolher uma transmissão';}
window.addEventListener('apce:broadcast',e=>updateBroadcast(e.detail));updateBroadcast(window.apceBroadcast);
window.addEventListener('apce:state',e=>{for(const who of ['host','guest'])$('sand-'+who+'-name').textContent=e.detail.labels[who]||(who==='host'?'Apresentador':'Entrevista');});
const roomCount=$('room-count'),updateRoomCount=()=>{$('sand-room-count').textContent=roomCount.textContent.replace(' no estúdio','');};updateRoomCount();new MutationObserver(updateRoomCount).observe(roomCount,{childList:true,subtree:true,characterData:true});
function toggleComments(){if(matchMedia('(max-width:1100px)').matches)$('comments-toggle').click();else document.body.classList.toggle('comments-collapsed');syncChatButton();}
function syncChatButton(){const narrow=matchMedia('(max-width:1100px)').matches;chatButton.setAttribute('aria-expanded',String(narrow?document.body.classList.contains('comments-open'):!document.body.classList.contains('comments-collapsed')));}
chatButton.onclick=toggleComments;$('comments-close').addEventListener('click',()=>{if(!matchMedia('(max-width:1100px)').matches)document.body.classList.add('comments-collapsed');syncChatButton();});
new MutationObserver(syncChatButton).observe(document.body,{attributes:true,attributeFilter:['class']});window.addEventListener('resize',()=>{syncChatButton();if(drawer.open&&drawer.style.left){const r=drawer.getBoundingClientRect();position(r.x,r.y);}});
const diagrams={wait:'<circle cx="32" cy="18" r="12"/><path d="M32 10v8l6 4"/>',intro:'<rect x="7" y="3" width="50" height="30" rx="4"/><path d="m27 10 13 8-13 8Z"/>',solo:'<rect x="7" y="3" width="50" height="30" rx="4"/>',duo:'<rect x="3" y="6" width="27" height="24" rx="3"/><rect x="34" y="6" width="27" height="24" rx="3"/>',room:'<rect x="4" y="4" width="16" height="12" rx="2"/><rect x="24" y="4" width="16" height="12" rx="2"/><rect x="44" y="4" width="16" height="12" rx="2"/><rect x="4" y="20" width="16" height="12" rx="2"/><rect x="24" y="20" width="16" height="12" rx="2"/><rect x="44" y="20" width="16" height="12" rx="2"/>',media:'<rect x="3" y="3" width="43" height="30" rx="3"/><rect x="50" y="12" width="12" height="12" rx="2"/>',end:'<circle cx="32" cy="18" r="12"/><path d="m25 18 5 5 10-11"/>'};
function decorateScenes(){for(const b of document.querySelectorAll('.scene:not([data-sand-scene])')){b.dataset.sandScene='true';const span=document.createElement('span');span.className='sand-scene-diagram';span.innerHTML=`<svg viewBox="0 0 64 36" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">${diagrams[b.dataset.layout]||diagrams.solo}</svg>`;b.querySelector('.scene-thumb').append(span);}}
decorateScenes();new MutationObserver(decorateScenes).observe($('scenes'),{childList:true});
syncRoute();syncChatButton();document.body.dataset.sandReady='true';
// O hash de entrada não deve esconder a navegação atrás do cabeçalho fixo.
requestAnimationFrame(()=>scrollTo({top:0,behavior:'instant'}));

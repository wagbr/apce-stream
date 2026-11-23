document.head.insertAdjacentHTML('beforeend','<link rel="stylesheet" href="/comments.css">');
const column=document.createElement('aside');column.className='comments-column';column.setAttribute('aria-label','Comentários do YouTube');column.id='comments-column';
column.innerHTML=`<div class="comments-heading"><div><span class="eyebrow">A CONVERSA CONTINUA AQUI</span><h2>Comentários<span class="comments-youtube" aria-label="YouTube">▶</span></h2></div><button id="comments-close" class="icon-button" aria-label="Fechar comentários">×</button></div>
<p id="comments-event">Selecione uma live em Programa.</p><div class="comments-connection"><i id="comments-dot"></i><span id="comments-status" role="status">Aguardando uma live</span><button id="comments-retry" class="text-button">Reconectar</button></div>
<label class="comments-search">Buscar comentário<input id="comments-search" type="search" placeholder="Nome ou mensagem…" autocomplete="off"></label>
<div class="comments-list" id="comments-list" role="list" aria-label="Mensagens do chat"></div><div id="comments-empty"><span aria-hidden="true">“</span><strong>A voz de quem acompanha.</strong><p>Selecione uma live em Programa para acompanhar os comentários do YouTube.</p></div>
<div class="comments-bottom"><span id="comments-on-screen">Clique em uma mensagem para exibir.</span><button id="comments-hide" class="beige-button full" disabled>Retirar da tela<span aria-hidden="true">×</span></button><p id="comments-error" role="status"></p></div>`;
document.querySelector('.topbar').after(column);document.body.classList.add('with-comments');
const toggle=document.createElement('button');toggle.id='comments-toggle';toggle.className='comments-toggle beige-button';toggle.textContent='Comentários';toggle.setAttribute('aria-controls',column.id);toggle.setAttribute('aria-expanded','false');document.body.append(toggle);
const $=id=>document.getElementById(id);let state,signature='',busy=false,polling=false,serial=0;
const statuses={idle:'Aguardando uma live',waiting:'Aguardando o chat',connecting:'Conectando ao YouTube…',connected:'Conectado ao YouTube',paused:'Comentários pausados',ended:'Chat encerrado',error:'Conexão interrompida'};
function mobileOpen(value){document.body.classList.toggle('comments-open',value);toggle.setAttribute('aria-expanded',String(value));if(value)$('comments-search').focus();}
toggle.onclick=()=>mobileOpen(!document.body.classList.contains('comments-open'));$('comments-close').onclick=()=>mobileOpen(false);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('comments-open')){mobileOpen(false);toggle.focus();}});
function renderList(){
  if(!state)return;
  const search=$('comments-search').value.toLocaleLowerCase('pt-BR').trim();
  const items=state.messages.filter(m=>(m.author+' '+m.text).toLocaleLowerCase('pt-BR').includes(search));
  const next=JSON.stringify([items,state.selected?.id,state.status,state.broadcast?.id,search]);if(signature===next)return;signature=next;
  const list=$('comments-list'),atEnd=list.scrollHeight-list.scrollTop-list.clientHeight<80,scroll=list.scrollTop,focused=document.activeElement?.dataset.commentId;
  list.replaceChildren();
  for(const m of items){
    const row=document.createElement('div');row.setAttribute('role','listitem');
    const b=document.createElement('button');b.type='button';b.className='comment-message';b.dataset.commentId=m.id;b.setAttribute('aria-pressed',String(state.selected?.id===m.id));b.title='Exibir comentário de '+m.author+' na transmissão';
    const avatar=document.createElement('span');avatar.className='comment-avatar';avatar.textContent=[...m.author][0]||'?';
    if(m.avatar){const img=document.createElement('img');img.src=m.avatar;img.alt='';img.referrerPolicy='no-referrer';img.loading='lazy';img.onerror=()=>img.remove();avatar.append(img);}
    const content=document.createElement('span');content.className='comment-content';
    const name=document.createElement('strong');name.textContent=m.author;
    const tag=document.createElement('small');tag.textContent=state.selected?.id===m.id?'NA TELA':m.paid?'SUPER CHAT':m.owner?'CANAL':m.moderator?'MODERAÇÃO':m.member?'MEMBRO':'';
    const message=document.createElement('span');message.className='comment-text';message.textContent=m.text;
    const broadcastId=state.broadcast?.id;
    content.append(name,tag,message);b.append(avatar,content);b.onclick=()=>run(state.selected?.id===m.id?'hide':'show',{id:m.id,broadcastId});row.append(b);list.append(row);
  }
  if(focused){const prior=[...list.querySelectorAll('button')].find(b=>b.dataset.commentId===focused);prior?.focus({preventScroll:true});}
  list.scrollTop=atEnd?list.scrollHeight:scroll;
  $('comments-empty').hidden=items.length>0;
  const copy=$('comments-empty').querySelector('p');copy.textContent=search?'Nenhuma mensagem corresponde à sua busca.':!state.broadcast?'Selecione uma live em Programa para acompanhar os comentários do YouTube.':state.status==='ended'?'O chat desta transmissão já foi encerrado.':'As mensagens aparecerão aqui quando chegarem. Clique para colocar uma delas na transmissão.';
}
function render(s){
  state=s;
  $('comments-event').textContent=s.broadcast?.title|| (s.broadcast?'Live selecionada':'Selecione uma live em Programa.');
  $('comments-status').textContent=statuses[s.status]||'Aguardando comentários';$('comments-dot').classList.toggle('connected',s.status==='connected');
  $('comments-retry').disabled=busy||!s.broadcast||s.status==='connecting';$('comments-hide').disabled=busy||!s.selected;
  $('comments-on-screen').textContent=s.selected?'Na tela · '+s.selected.author:'Clique em uma mensagem para exibir.';$('comments-error').textContent=s.error||'';renderList();
}
async function run(action,extra={}){
  if(busy)return;busy=true;serial++;if(state)render(state);
  try{const response=await fetch('/api/chat/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...extra})});const value=await response.json();if(!response.ok)throw Error(value.error);render(value);}
  catch(e){$('comments-error').textContent=e.message;}
  finally{busy=false;if(state){$('comments-hide').disabled=!state.selected;$('comments-retry').disabled=!state.broadcast||state.status==='connecting';}}
}
$('comments-search').oninput=()=>{signature='';renderList();};$('comments-hide').onclick=()=>run('hide');$('comments-retry').onclick=()=>run('retry');
async function poll(){if(polling||busy)return;polling=true;const version=serial;try{const response=await fetch('/api/chat/state');if(response.ok){const value=await response.json();if(version===serial)render(value);}else $('comments-status').textContent='Não foi possível ler os comentários.';}catch{$('comments-status').textContent='Painel desconectado. Tentando novamente…';}finally{polling=false;}}
await poll();setInterval(poll,1200);

const card=document.getElementById('comment'),author=document.getElementById('author'),message=document.getElementById('message'),photo=document.getElementById('photo');
let signature='',pending=false,lastSuccess=Date.now();
photo.onerror=()=>photo.removeAttribute('src');
function render(value){
  const next=JSON.stringify(value);if(signature===next)return;signature=next;
  if(!value){card.hidden=true;return;}
  author.textContent=value.author;message.textContent=value.text;document.getElementById('initial').textContent=[...value.author][0]||'?';
  if(value.avatar)photo.src=value.avatar;else photo.removeAttribute('src');
  card.hidden=false;message.style.fontSize='38px';
  for(let size=38;size>24&&message.scrollHeight>245;size-=2)message.style.fontSize=(size-2)+'px';
  card.classList.remove('enter');void card.offsetWidth;card.classList.add('enter');
}
async function poll(){if(pending)return;pending=true;try{const r=await fetch('/api/chat/overlay',{signal:AbortSignal.timeout(3000)});if(r.ok){render((await r.json()).selected);lastSuccess=Date.now();}}catch{}finally{pending=false;if(Date.now()-lastSuccess>15000){card.hidden=true;signature='';}}}
await poll();setInterval(poll,300);

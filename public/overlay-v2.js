const params=new URLSearchParams(location.search),mode=params.get('mode')||'wait',front=params.get('layer')==='front',root=document.getElementById('root'),thumbnail=params.get('thumbnail')==='1';
const hero=mode==='wait'||mode==='end',nativeParticipants=params.get('native')==='1';
const titles={solo:'APRESENTADOR',duo:'CONVERSA EM DUAS VOZES',room:'SALA ABERTA',media:'EM EXIBIÇÃO'};
if(!front){
  root.innerHTML=`<div class="back${hero?' hero':''}"></div>`;
  if(hero){
    const block=document.createElement('div');block.className='hero';block.innerHTML=`<div class="hero-label"><i></i>${mode==='end'?'ATÉ A PRÓXIMA':'PREPARANDO O ESTÚDIO'}</div><img class="apce-corner" src="/assets/apce.png" alt="APCE"><div class="hero-content"><div class="hero-kicker">IDEIAS EM ÓRBITA</div><img class="hero-logo" src="/assets/ateucast.png" alt="Ateu Cast"><h1>${mode==='end'?'Até a próxima<br><span>boa conversa.</span>':'Uma boa conversa<br><span>começa aqui.</span>'}</h1><p>${mode==='end'?'Obrigado por fazer parte deste encontro.':'Ciência, laicidade e outros jeitos de olhar o mundo.'}</p></div>`;root.append(block);
  }else{
    const header=document.createElement('div');header.className='header';header.innerHTML=`<img class="program-logo" src="/assets/ateucast.png" alt="Ateu Cast"><div class="header-rule"></div><div class="header-copy"><strong>${titles[mode]||'ESTÚDIO APCE'}</strong><span>CIÊNCIA · LAICIDADE · SOCIEDADE</span></div><img class="apce" src="/assets/apce.png" alt="APCE">`;root.append(header);
    const frames={solo:['solo'],duo:['host','guest'],room:['room'],media:['media','pip']};
    for(const [i,key] of (frames[mode]||[]).entries()){
      if(nativeParticipants&&['solo','host','guest','pip'].includes(key))continue;
      const frame=document.createElement('div');frame.className='frame '+key;
      if(thumbnail){const label=document.createElement('span');label.className='thumbnail-label';label.textContent=mode==='media'&&i===0?'MÍDIA':String(i+1).padStart(2,'0');frame.append(label);}root.append(frame);
    }
    if(mode==='duo'){const d=document.createElement('div');d.innerHTML='<div class="duo-heading"><i></i><span>ESPAÇO PARA BOAS IDEIAS</span></div><div class="duo-under"><strong>Um assunto. Muitos olhares.</strong></div>';root.append(d);}
    if(mode==='media'){const d=document.createElement('div');d.innerHTML='<div class="media-side"><span>NA TELA</span><strong>Veja.<br>Escute.<br>Converse.</strong></div><div class="pip-bottom">Mais contexto para a nossa conversa.</div>';root.append(d);}
  }
  const footer=document.createElement('div');footer.className='footer';footer.innerHTML='<div class="topic" id="topic"></div><div class="channel">youtube.com/@apcedf</div>';root.append(footer);
}else{
  const fields=nativeParticipants?[]:mode==='solo'?[['host','solo-name']]:mode==='duo'?[['host','host-name'],['guest','guest-name']]:mode==='media'?[['host','pip-name']]:[];
  for(const [key,cls] of fields){const name=document.createElement('div');name.id=key;name.className='name '+cls;root.append(name);}
}
async function update(){try{const labels=await(await fetch('/api/labels')).json();for(const key of ['host','guest','topic']){const node=document.getElementById(key);if(node){node.textContent=labels[key]||'';if(key!=='topic')node.style.display=labels[key]?'block':'none';}}}catch{}}
update();setInterval(update,1500);

const params=new URLSearchParams(location.search),mode=params.get('mode')||'wait',front=params.get('layer')==='front',root=document.getElementById('root');
const hero=['wait','end','intro'].includes(mode),nativeParticipants=params.get('native')==='1';
if(!front){
  const background=document.createElement('div');background.className='back'+(hero?' hero':'');root.append(background);
  const frames={solo:['solo'],duo:['host','guest'],room:['room'],media:['media','pip']};
  for(const key of frames[mode]||[]){
    if(nativeParticipants&&['solo','host','guest','pip'].includes(key))continue;
    const frame=document.createElement('div');frame.className='frame '+key;root.append(frame);
  }
}else{
  const fields=nativeParticipants?[]:mode==='solo'?[['host','solo-name']]:mode==='duo'?[['host','host-name'],['guest','guest-name']]:mode==='media'?[['host','pip-name']]:[];
  for(const [key,cls] of fields){const name=document.createElement('div');name.id=key;name.className='name '+cls;name.hidden=true;root.append(name);}
  if(['solo','duo','room','media'].includes(mode)){const topic=document.createElement('div');topic.id='topic';topic.className='topic';topic.hidden=true;root.append(topic);}
}
async function update(){
  try{const labels=await(await fetch('/api/labels')).json();for(const key of ['host','guest','topic']){const node=document.getElementById(key);if(node){node.textContent=labels[key]||'';node.hidden=!labels[key];}}}catch{}
}
if(front&&root.children.length){await update();setInterval(update,1500);}

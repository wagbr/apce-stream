import fs from 'node:fs';
import path from 'node:path';
import {buildLinks} from './studio.mjs';

export function createRoomControl({base,cfg,api,names,saveConfig,now=()=>Date.now()}){
  const file=path.join(base,'private/stage.json');
  let stage=[];try{stage=JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  let guests=[],heartbeat=0;
  const valid=id=>typeof id==='string'&&/^[\w-]{3,100}$/.test(id)&&id!==cfg.return;
  stage=stage.filter(p=>valid(p.id)).slice(0,12);
  const save=()=>{fs.writeFileSync(file+'.tmp',JSON.stringify(stage),'utf8');fs.renameSync(file+'.tmp',file);};
  async function setMute(id,muted){
    const inputName=id===cfg.host?names.host:id===(cfg.interviewGuest||cfg.guest)?names.guest:null;
    if(inputName)await api('SetInputMute',{inputName,inputMuted:!!muted});
    const p=stage.find(p=>p.id===id);if(p){p.muted=!!muted;save();}
  }
  function state(){
    const online=heartbeat>0&&now()-heartbeat<90000;
    return {capacity:12,online,lastSeen:heartbeat,guests:online?guests:[],stage:stage.map(p=>({...p,connected:online&&guests.some(g=>g.id===p.id)})),links:buildLinks(cfg)};
  }
  function stageState(){
    let mixUrl='';
    if(stage.length){const u=new URL(buildLinks({...cfg,guest:stage.map(p=>p.id).join(',')}).guestView);u.searchParams.delete('solo');u.searchParams.set('showlabels','');mixUrl=u.toString();}
    return {participants:stage.map(p=>({...p,url:buildLinks({...cfg,guest:p.id}).guestView})),mixUrl,capacity:12};
  }
  async function action(data){
    if(data.action==='sync'){
      if(!Array.isArray(data.guests)||data.guests.length>80)throw Error('Lista de participantes inválida.');
      // Uma segunda aba pode estar apenas aguardando a posse da direção.
      // Seu roster vazio não substitui a lista da direção que está conectada.
      if(data.claimed===false)return state();
      const previous=guests,seen=new Set();guests=data.guests.filter(p=>valid(p.id)&&!seen.has(p.id)&&seen.add(p.id)).map(p=>({id:p.id,label:String(p.label||previous.find(g=>g.id===p.id)?.label||'Participante').slice(0,80)}));
      heartbeat=now();
      // O apresentador ocupa um dos mesmos doze lugares.
      for(const id of [cfg.host,cfg.guest]){
        const person=guests.find(g=>g.id===id);
        if(person&&!previous.some(p=>p.id===id)&&!stage.some(p=>p.id===id)&&stage.length<12){
          let muted=false;try{muted=(await api('GetInputMute',{inputName:id===cfg.host?names.host:names.guest}))?.inputMuted===true;}catch{}
          stage.push({...person,muted});save();
        }
      }
      for(const p of stage){const g=guests.find(g=>g.id===p.id);if(g)p.label=g.label;}
      return state();
    }
    if(data.action==='remove'){stage=stage.filter(p=>p.id!==data.id);save();return state();}
    const guest=guests.find(g=>g.id===data.id);
    if(!guest||now()-heartbeat>=90000)throw Error('Aguarde a direção conectar esta pessoa.');
    if(data.action==='add'){
      if(!stage.some(p=>p.id===guest.id)){
        if(stage.length>=12)throw Error('Os 12 lugares estão ocupados, incluindo os apresentadores. Retire alguém antes de adicionar outra pessoa.');
        stage.push({...guest,muted:false});save();
      }
    }else if(data.action==='mute'){
      const p=stage.find(p=>p.id===guest.id);if(!p)throw Error('Coloque esta pessoa no estúdio primeiro.');await setMute(p.id,!p.muted);
    }else if(data.action==='interview'){
      if(!stage.some(p=>p.id===guest.id))throw Error('Adicione esta pessoa ao estúdio primeiro.');
      const links=buildLinks({...cfg,guest:guest.id});
      await api('SetInputSettings',{inputName:names.guest,inputSettings:{url:links.guestView},overlay:true});
      cfg.interviewGuest=guest.id;cfg.labels.guest=guest.label;saveConfig();
      await api('SetInputMute',{inputName:names.guest,inputMuted:!!stage.find(p=>p.id===guest.id)?.muted});
    }else throw Error('Ação de participante inválida.');
    return state();
  }
  return {state,stageState,action,setMute};
}

const NONE='OBS_MONITORING_TYPE_NONE',BOTH='OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT';
const tracks=returned=>({'1':true,'2':returned,'3':false,'4':false,'5':false,'6':false});
export function createAudioControl({api,isConnected,cfg,names,scenes,saveConfig,clock=Date.now}){
  const channels=[{id:'intro',label:'Abertura',returned:true},{id:'video',label:'Vídeos e áudios',returned:true},{id:'room',label:'Conversa no programa',returned:false},{id:'share',label:'Tela compartilhada',returned:true}];
  const levels=new Map();let cached=null,cachedAt=0,pending=null;
  function receiveMeters({inputs=[]}){for(const input of inputs){const peak=Math.max(0,...(input.inputLevelsMul||[]).map(channel=>Number(channel[1])||0));levels.set(input.inputName,{peak,at:clock()});}}
  async function configure(){
    if(!isConnected())return;
    const present=new Set((await api('GetInputList')).inputs.map(input=>input.inputName));
    for(const channel of channels){
      if(!present.has(names[channel.id]))continue;
      const inputName=names[channel.id],saved=cfg.audioMix?.[channel.id];
      await api('SetInputAudioTracks',{inputName,inputAudioTracks:tracks(channel.returned)});
      await api('SetInputAudioMonitorType',{inputName,monitorType:(saved?.monitor??channel.returned)?BOTH:NONE});
      if(saved){await api('SetInputMute',{inputName,inputMuted:saved.muted===true});await api('SetInputVolume',{inputName,inputVolumeMul:saved.volume??1});}
    }
    // As câmeras são apenas imagem; uma única mixagem leva todas as vozes.
    for(const inputName of [names.host,names.guest])if(present.has(inputName))await api('SetInputAudioTracks',{inputName,inputAudioTracks:{'1':false,'2':false,'3':false,'4':false,'5':false,'6':false}});
    for(const sceneName of [scenes.solo,scenes.duo,scenes.media]){
      const items=await api('GetSceneItemList',{sceneName}).catch(()=>null);if(!items)continue;
      const existing=items.sceneItems.find(item=>item.sourceName===names.audioScene);
      if(existing){if(!existing.sceneItemEnabled)await api('SetSceneItemEnabled',{sceneName,sceneItemId:existing.sceneItemId,sceneItemEnabled:true});}
      else if((await api('GetSceneList')).scenes.some(scene=>scene.sceneName===names.audioScene))await api('CreateSceneItem',{sceneName,sourceName:names.audioScene,sceneItemEnabled:true});
    }
    cachedAt=0;
  }
  async function read(){
    if(!isConnected())return {connected:false,channels:[]};
    if(cached&&clock()-cachedAt<1000)return cached;
    if(pending)return pending;
    pending=(async()=>{
      const result=await Promise.all(channels.map(async channel=>{
        const inputName=names[channel.id];
        try{
          const [mute,volume,monitor,route,active]=await Promise.all([api('GetInputMute',{inputName}),api('GetInputVolume',{inputName}),api('GetInputAudioMonitorType',{inputName}),api('GetInputAudioTracks',{inputName}),api('GetSourceActive',{sourceName:inputName})]);
          return {...channel,available:true,muted:mute.inputMuted,volume:volume.inputVolumeMul,monitor:monitor.monitorType===BOTH,streamTrack:route.inputAudioTracks?.['1']===true,returnTrack:route.inputAudioTracks?.['2']===true,active:active.videoActive};
        }catch{return {...channel,available:false};}
      }));
      cached={connected:true,channels:result};cachedAt=clock();return cached;
    })();try{return await pending;}finally{pending=null;}
  }
  async function state(){
    const value=await read();return {...value,channels:value.channels.map(channel=>{
      const level=levels.get(names[channel.id]),peak=channel.muted||!level||clock()-level.at>2000?0:level.peak;
      return {...channel,peak,db:peak>0?Math.min(0,Math.max(-60,20*Math.log10(peak))):-60};
    })};
  }
  async function action(data){
    if(!isConnected())throw Error('Abra o OBS para controlar o áudio.');
    const channel=channels.find(item=>item.id===data.channel);if(!channel)throw Error('Fonte de áudio inválida.');
    const inputName=names[channel.id];
    if(data.action==='mute'){if(typeof data.muted!=='boolean')throw Error('Estado de mute inválido.');await api('SetInputMute',{inputName,inputMuted:data.muted});}
    else if(data.action==='volume'){if(!Number.isFinite(data.volume)||data.volume<0||data.volume>1)throw Error('Volume inválido.');await api('SetInputVolume',{inputName,inputVolumeMul:data.volume});}
    else if(data.action==='monitor'){if(typeof data.enabled!=='boolean')throw Error('Estado de escuta inválido.');await api('SetInputAudioMonitorType',{inputName,monitorType:data.enabled?BOTH:NONE});}
    else throw Error('Controle de áudio inválido.');
    if(pending)await pending;cachedAt=0;const current=(await read()).channels.find(item=>item.id===channel.id);
    if(current?.available){cfg.audioMix??={};cfg.audioMix[channel.id]={muted:current.muted,volume:current.volume,monitor:current.monitor};saveConfig();}
    return state();
  }
  return {configure,state,action,receiveMeters};
}

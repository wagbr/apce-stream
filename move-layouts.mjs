import fs from 'node:fs';
export const MOVE=JSON.parse(fs.readFileSync(new URL('./move-transition.json',import.meta.url),'utf8'));
export const participantLayers={hostFrame:'APCE · Moldura apresentador',guestFrame:'APCE · Moldura convidado',hostName:'APCE · Nome apresentador',guestName:'APCE · Nome convidado',mediaName:'APCE · Nome apresentador compacto'};

export async function configureMove(api,scenes,names,port){
  const transitions=await api('GetSceneTransitionList');
  const move=transitions.transitions.find(t=>t.transitionKind===MOVE.id&&t.transitionName===MOVE.name);
  if(!move)return false;
  const fade=transitions.transitions.find(t=>t.transitionKind==='fade_transition');
  await api('SetCurrentSceneTransition',{transitionName:MOVE.name});
  const settings={...MOVE.settings};if(fade){settings.transition_in=fade.transitionName;settings.transition_out=fade.transitionName;settings.transition_match=fade.transitionName;}
  await api('SetCurrentSceneTransitionSettings',{transitionSettings:settings,overlay:true});
  await api('SetCurrentSceneTransitionDuration',{transitionDuration:MOVE.duration});
  const base=`http://127.0.0.1:${port}`;
  async function input(scene,name,url,width,height){
    const {inputs}=await api('GetInputList');
    if(!inputs.some(i=>i.inputName===name))await api('CreateInput',{sceneName:scene,inputName:name,inputKind:'browser_source',inputSettings:{url,width,height,shutdown:false,restart_when_active:false,reroute_audio:true,fps:30,css:'body {background:rgba(0,0,0,0);margin:0;overflow:hidden;}'},sceneItemEnabled:true});
    else await api('SetInputSettings',{inputName:name,inputSettings:{url,width,height},overlay:true});
    await api('SetInputAudioTracks',{inputName:name,inputAudioTracks:{'1':false,'2':false,'3':false,'4':false,'5':false,'6':false}});
  }
  async function place(scene,source,geometry,behind){
    let items=(await api('GetSceneItemList',{sceneName:scene})).sceneItems;
    let item=items.find(i=>i.sourceName===source);
    if(!item){const created=await api('CreateSceneItem',{sceneName:scene,sourceName:source,sceneItemEnabled:true});item={sceneItemId:created.sceneItemId};}
    const data={sceneName:scene,sceneItemId:item.sceneItemId};const [x,y,w,h]=geometry;
    await api('SetSceneItemTransform',{...data,sceneItemTransform:{positionX:x,positionY:y,alignment:5,boundsType:'OBS_BOUNDS_STRETCH',boundsAlignment:0,boundsWidth:w,boundsHeight:h}});
    await api('SetSceneItemLocked',{...data,sceneItemLocked:true});await api('SetSceneItemEnabled',{...data,sceneItemEnabled:true});
    items=(await api('GetSceneItemList',{sceneName:scene})).sceneItems;
    const own=items.find(i=>i.sourceName===source);
    if(behind){const camera=items.find(i=>i.sourceName===behind);if(camera)await api('SetSceneItemIndex',{...data,sceneItemIndex:camera.sceneItemIndex-(own.sceneItemIndex<camera.sceneItemIndex?1:0)});}
    else await api('SetSceneItemIndex',{...data,sceneItemIndex:items.length-1});
  }
  async function override(source,settings){
    const filterName='APCE · Regras Move';const filters=(await api('GetSourceFilterList',{sourceName:source})).filters;
    if(filters.some(f=>f.filterName===filterName))await api('SetSourceFilterSettings',{sourceName:source,filterName,filterSettings:settings,overlay:true});
    else await api('CreateSourceFilter',{sourceName:source,filterName,filterKind:'move_transition_override_filter',filterSettings:settings});
  }
  const L=participantLayers;
  await input(scenes.solo,L.hostFrame,base+'/participant-layer.html?kind=frame',1600,900);
  await input(scenes.duo,L.guestFrame,base+'/participant-layer.html?kind=frame',1600,900);
  await input(scenes.solo,L.hostName,base+'/participant-layer.html?kind=name&person=host',840,90);
  await input(scenes.duo,L.guestName,base+'/participant-layer.html?kind=name&person=guest',840,90);
  await input(scenes.media,L.mediaName,base+'/participant-layer.html?kind=name&person=host&size=compact',336,86);
  for(const [scene,geometry] of [[scenes.solo,[236,140,1448,818]],[scenes.duo,[60,256,888,503]],[scenes.media,[1532,386,328,188]]])await place(scene,L.hostFrame,geometry,names.host);
  await place(scenes.duo,L.guestFrame,[972,256,888,503],names.guest);
  await place(scenes.solo,L.hostName,[264,872,840,90]);await place(scenes.duo,L.hostName,[88,680,840,90]);await place(scenes.duo,L.guestName,[1000,680,840,90]);await place(scenes.media,L.mediaName,[1536,590,336,86]);
  await override(L.mediaName,{match_source:L.hostName});
  const enterExit={position_in:10,position_out:10,zoom_in:100,zoom_out:100};
  for(const source of [names.guest,L.guestFrame,L.guestName])await override(source,enterExit);
  for(const mode of ['solo','duo','media'])for(const layer of ['Fundo','Legendas']){
    const inputName=`APCE · ${layer} ${mode}`,current=await api('GetInputSettings',{inputName});if(!current.inputSettings.url)continue;const url=new URL(current.inputSettings.url);url.searchParams.set('native','1');await api('SetInputSettings',{inputName,inputSettings:{url:url.toString()},overlay:true});
  }
  return true;
}

import fs from 'node:fs';
import path from 'node:path';

const files={wait:'fundo-espera.webp',solo:'fundo-estudio.webp',duo:'fundo-estudio.webp',room:'fundo-sala.webp',media:'fundo-midia.webp',end:'fundo-espera.webp'};
export async function configureSceneBackgrounds(api,{base,scenes}){
  const [stream,record]=await Promise.all([api('GetStreamStatus'),api('GetRecordStatus')]);
  if(stream.outputActive||record.outputActive)throw Error('Encerre a transmissão e a gravação antes de atualizar os fundos.');
  for(const filename of new Set(Object.values(files))){if(!fs.existsSync(path.join(base,'public/assets/areia-v3',filename)))throw Error('Fundo APCE ausente: '+filename);}
  const changed=[];
  for(const [mode,filename] of Object.entries(files)){
    const sceneName=scenes[mode],inputName=`APCE · Fundo ${mode}`,file=path.join(base,'public/assets/areia-v3',filename);
    const {inputs}=await api('GetInputList'),old=inputs.find(i=>i.inputName===inputName);
    let sceneItemId;
    if(old?.inputKind==='image_source'){
      await api('SetInputSettings',{inputName,inputSettings:{file,unload:false},overlay:true});
      const items=(await api('GetSceneItemList',{sceneName})).sceneItems;
      const item=items.find(i=>i.sourceName===inputName);
      sceneItemId=item?.sceneItemId??(await api('CreateSceneItem',{sceneName,sourceName:inputName,sceneItemEnabled:true})).sceneItemId;
    }else{
      // A imagem entra atrás da fonte antiga antes de esta ser removida.
      // Câmeras, mixer e a sessão privada de retorno não são recriados.
      const pending=inputs.find(i=>i.inputName===inputName+' · imagem areia');
      const temporary=pending?.inputName||(old?inputName+' · imagem areia':inputName);
      if(pending)sceneItemId=(await api('GetSceneItemList',{sceneName})).sceneItems.find(i=>i.sourceName===temporary).sceneItemId;
      else sceneItemId=(await api('CreateInput',{sceneName,inputName:temporary,inputKind:'image_source',inputSettings:{file,unload:false},sceneItemEnabled:true})).sceneItemId;
      await api('SetSceneItemIndex',{sceneName,sceneItemId,sceneItemIndex:0});
      if(old){
        const previous=inputName+' · anterior v2';
        await api('SetInputName',{inputName,newInputName:previous});
        await api('SetInputName',{inputName:temporary,newInputName:inputName});
        for(const item of (await api('GetSceneItemList',{sceneName})).sceneItems.filter(i=>i.sourceName===previous))await api('RemoveSceneItem',{sceneName,sceneItemId:item.sceneItemId});
        // Algumas versões do OBS já destroem a fonte ao retirar a última cena.
        await api('RemoveInput',{inputName:previous}).catch(error=>{if(error.code!==600)throw error;});
      }else if(pending)await api('SetInputName',{inputName:temporary,newInputName:inputName});
    }
    await api('SetSceneItemTransform',{sceneName,sceneItemId,sceneItemTransform:{positionX:0,positionY:0,alignment:5,boundsType:'OBS_BOUNDS_STRETCH',boundsAlignment:0,boundsWidth:1920,boundsHeight:1080}});
    await api('SetSceneItemIndex',{sceneName,sceneItemId,sceneItemIndex:0});
    await api('SetSceneItemLocked',{sceneName,sceneItemId,sceneItemLocked:true});
    changed.push(inputName);
  }
  return {backgrounds:changed.length,nativeImages:true};
}

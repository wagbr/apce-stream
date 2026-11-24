// As câmeras e o mosaico mantêm 30 fps. Texto e molduras não precisam
// redesenhar vinte páginas a 30 fps, mas ficam carregados para o Move.
export async function configureSourcePerformance(api){
  const {inputs}=await api('GetInputList');
  for(const input of inputs){
    if(input.inputKind==='ffmpeg_source'&&/^APCE · (Abertura leve|Vídeo de exibição)$/u.test(input.inputName)){
      const {inputSettings:s}=await api('GetInputSettings',{inputName:input.inputName});
      // Nesta APU, decodificar e codificar pela mesma GPU causou perdas
      // na abertura. A CPU decodifica a mídia; o AMD codifica a saída.
      if(s.hw_decode!==false)await api('SetInputSettings',{inputName:input.inputName,inputSettings:{hw_decode:false},overlay:true});
      continue;
    }
    if(input.inputKind!=='browser_source'||!/^APCE · (Fundo |Legendas |Moldura |Nome )/u.test(input.inputName))continue;
    const {inputSettings:s}=await api('GetInputSettings',{inputName:input.inputName});
    if(s.fps===10&&s.fps_custom===true)continue;
    await api('SetInputSettings',{inputName:input.inputName,inputSettings:{fps:10,fps_custom:true},overlay:true});
  }
}

const difference=(end,start,key)=>Math.max(0,(end[key]||0)-(start[key]||0));
const percent=(missed,total)=>total>0?Math.round(missed/total*10000)/100:0;
export function performanceSample(current,previous,stream,previousStream){
  const fresh=previous&&current.renderTotalFrames>=previous.renderTotalFrames;
  const rendered=fresh?difference(current,previous,'renderTotalFrames'):0;
  const encoded=fresh&&current.outputTotalFrames>=previous.outputTotalFrames?difference(current,previous,'outputTotalFrames'):0;
  const sent=stream.outputActive&&previousStream?.outputActive&&stream.outputTotalFrames>=previousStream.outputTotalFrames?difference(stream,previousStream,'outputTotalFrames'):0;
  const renderLoss=percent(difference(current,previous||current,'renderSkippedFrames'),rendered);
  const encodeLoss=percent(difference(current,previous||current,'outputSkippedFrames'),encoded);
  const networkLoss=percent(difference(stream,previousStream||stream,'outputSkippedFrames'),sent);
  const samples=rendered>0;
  const issue=!samples?'waiting':networkLoss>=1||stream.outputReconnecting?'network':encodeLoss>=1?'encoding':renderLoss>=1?'rendering':'ok';
  return {fps:Math.round(current.activeFps||0),cpu:Math.round(current.cpuUsage||0),renderLoss,encodeLoss,networkLoss,issue,streaming:!!stream.outputActive};
}

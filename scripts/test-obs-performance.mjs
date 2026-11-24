import test from 'node:test';
import assert from 'node:assert/strict';
import {performanceSample,configureSourcePerformance} from '../obs-performance.mjs';
import {buildLinks} from '../studio.mjs';
import {interactionHint} from '../public/youtube-interaction.js';
const sample={activeFps:30,cpuUsage:2,renderTotalFrames:1000,renderSkippedFrames:0,outputTotalFrames:1000,outputSkippedFrames:0};
test('separa perdas de composição, codificação e rede por intervalo',()=>{
  const end={...sample,renderTotalFrames:1150,outputTotalFrames:1150};
  assert.equal(performanceSample({...end,outputSkippedFrames:15},sample,{},{}).issue,'encoding');
  assert.equal(performanceSample({...end,renderSkippedFrames:3},sample,{},{}).issue,'rendering');
  const network=performanceSample(end,sample,{outputActive:true,outputTotalFrames:1150,outputSkippedFrames:6},{outputActive:true,outputTotalFrames:1000,outputSkippedFrames:0});
  assert.equal(network.issue,'network');assert.equal(network.networkLoss,4);
  assert.equal(performanceSample(end,sample,{},{}).issue,'ok');
});
test('reinícios e contadores de uma transmissão anterior não geram perdas falsas',()=>{
  const reset=performanceSample({...sample,renderTotalFrames:10,outputTotalFrames:0},sample,{outputActive:false,outputSkippedFrames:200},{});
  assert.equal(reset.issue,'waiting');assert.equal(reset.networkLoss,0);
  assert.equal(performanceSample(sample,null,{},null).issue,'waiting');
});
test('reduz somente camadas gráficas; preserva câmeras, áudio e conexões do Move',async()=>{
  const calls=[],inputs=['APCE · Fundo solo','APCE · Nome apresentador','APCE · Comentário em destaque','APCE · Apresentador','APCE · Sala VDO.Ninja'].map(inputName=>({inputName,inputKind:'browser_source'}));
  await configureSourcePerformance(async(request,data)=>{calls.push({request,data});return request==='GetInputList'?{inputs}:{inputSettings:{fps:30,shutdown:false}};});
  const writes=calls.filter(c=>c.request==='SetInputSettings');assert.equal(writes.length,2);
  assert(writes.every(c=>c.data.inputSettings.fps===10&&c.data.inputSettings.fps_custom===true));
  assert(writes.every(c=>!Object.hasOwn(c.data.inputSettings,'shutdown')));
});
test('mídias não disputam o decodificador da APU, preservando mute e roteamento',async()=>{
  const writes=[];await configureSourcePerformance(async(request,data)=>{
    if(request==='GetInputList')return {inputs:[{inputName:'APCE · Abertura leve',inputKind:'ffmpeg_source'}]};
    if(request==='GetInputSettings')return {inputSettings:{hw_decode:true}};
    writes.push(data);
  });assert.deepEqual(writes,[{inputName:'APCE · Abertura leve',inputSettings:{hw_decode:false},overlay:true}]);
});
test('convites limitam captura a 30 fps sem exigir uma câmera compatível com fps exato',()=>{
  const links=buildLinks({room:'test',return:'return',host:'host',guest:'guest',password:'fixture',labels:{}});
  for(const name of ['host','guest','invite']){const u=new URL(links[name]);assert.equal(u.searchParams.get('maxframerate'),'30');assert(!u.searchParams.has('fps'));}
});
test('participação distingue teste privado, audiência infantil e chat padrão',()=>{
  assert.match(interactionHint({privacy:'private'}),/Não listada/);
  assert.match(interactionHint({privacy:'public',madeForKids:true}),/desativa chat/);
  assert.match(interactionHint({privacy:'unlisted',madeForKids:false}),/ativado por padrão/);
});

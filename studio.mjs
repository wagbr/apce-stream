export const SCENES = Object.freeze({wait:'00 · Preparação',intro:'01 · Abertura',solo:'02 · Solo',duo:'03 · Entrevista',room:'04 · Sala aberta',media:'05 · Mídia',end:'06 · Encerramento'});
export const names = Object.freeze({host:'APCE · Apresentador',guest:'APCE · Convidado',room:'APCE · Sala VDO.Ninja',intro:'APCE · Abertura leve',video:'APCE · Vídeo de exibição',image:'APCE · Imagem de exibição',share:'APCE · Compartilhamento',audioScene:'APCE · Conversa'});
export function buildLinks(cfg) {
  const make = params => 'https://vdo.ninja/?' + new URLSearchParams({...params,password:cfg.password}).toString();
  const common = {room:cfg.room, broadcast:cfg.return, language:'pt'};
  const roomkey=cfg.roomSourceKey||cfg.roomApi||'';
  return {
    // A admissão inclui conexões técnicas. A grade do programa impõe 12 pessoas.
    director:make({director:cfg.room,language:'pt',requireapproval:'',roomcap:40,roomkey,api:cfg.roomApi||''}),
    host:make({...common,push:cfg.host,roomkey,label:cfg.labels.host || 'Apresentador'}),
    guest:make({...common,push:cfg.guest,label:cfg.labels.guest || 'Convidado'}),
    invite:make({...common,label:''}),
    monitor:make({view:cfg.return,scene:'',solo:'',room:cfg.room,roomkey}),
    hostView:make({view:cfg.host,scene:'',room:cfg.room,roomkey,solo:'',cleanoutput:'',transparent:'',obsoff:''}),
    guestView:make({view:cfg.guest,scene:'',room:cfg.room,roomkey,solo:'',cleanoutput:'',transparent:'',obsoff:''}),
    roomView:make({scene:'',room:cfg.room,exclude:cfg.return,cleanoutput:'',transparent:'',obsoff:''}),
    share:make({push:cfg.host+'slides',screenshare:'',label:'Apresentação'}),
    shareView:make({view:cfg.host+'slides',solo:'',cleanoutput:'',obsoff:''})
  };
}

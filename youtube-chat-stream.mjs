import grpc from '@grpc/grpc-js';
import loader from '@grpc/proto-loader';
import {fileURLToPath} from 'node:url';

export const chatDefinition=grpc.loadPackageDefinition(loader.loadSync(fileURLToPath(new URL('./protocols/youtube-chat.proto',import.meta.url)),{keepCase:false,defaults:false})).youtube.api.v3;
export function chatStreamError(error){
  const messages={
    3:'O YouTube recusou a retomada do chat. Use Reconectar para carregar as mensagens recentes.',
    5:'O chat desta transmissão não foi encontrado.',
    7:'O YouTube não permitiu ler este chat. Confira a conta conectada.',
    8:'O YouTube limitou o acesso ao chat. Aguarde antes de tentar novamente.',
    9:'O chat está desativado ou já foi encerrado no YouTube.',
    12:'O serviço de comentários não está disponível nesta conexão.',
    14:'A conexão com os comentários do YouTube caiu. Tentando reconectar…',
    16:'A autorização do YouTube precisa ser renovada.',
  };
  return Object.assign(new Error(messages[error.code]||'Não foi possível receber os comentários do YouTube. Tentando reconectar…'),{code:error.code===16?'AUTH_REQUIRED':'CHAT_STREAM',grpcCode:error.code,terminal:[3,5,7,9,12].includes(error.code)});
}
export function openYouTubeChat({access,chatId,pageToken,onData,onError,onReady,onEnd,address='youtube.googleapis.com:443',credentials=grpc.credentials.createSsl()}){
  const client=new chatDefinition.V3DataLiveChatMessageService(address,credentials,{'grpc.max_receive_message_length':4*1024*1024});
  const metadata=new grpc.Metadata();metadata.set('authorization','Bearer '+access);
  const call=client.streamList({liveChatId:chatId,hl:'pt',profileImageSize:88,part:['id','snippet','authorDetails'],...(pageToken?{pageToken}:{})},metadata,{deadline:Date.now()+55*60*1000});
  let closed=false,failed=false;
  const timer=setTimeout(()=>{if(!closed){failed=true;onError(chatStreamError({code:14}));}},30000);timer.unref();
  call.on('metadata',()=>{clearTimeout(timer);if(!closed)onReady?.();});
  call.on('data',data=>{clearTimeout(timer);if(!closed)onData(data);});
  call.on('error',e=>{clearTimeout(timer);if(!closed){failed=true;onError(chatStreamError(e));}});
  call.on('end',()=>{clearTimeout(timer);if(!closed&&!failed)onEnd?.();});
  return ()=>{if(closed)return;closed=true;clearTimeout(timer);call.cancel();client.close();};
}

export const APCE_AUTH_URL='https://api.apceapp.com.br/stream-auth';
const SCOPE='https://www.googleapis.com/auth/youtube.force-ssl';
const error=(message,code='AUTH_SERVICE',status=502)=>Object.assign(new Error(message),{code,status});
export function createOAuthBroker({url=APCE_AUTH_URL,fetchImpl=fetch,port=3210}={}){
  async function call(endpoint,data){
    let response,body;
    try{
      response=await fetchImpl(url+'/v1/'+endpoint,{...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(30000),redirect:'error'});
      body=await response.json();
    }catch{throw error('O serviço de conexão da APCE não respondeu. Confira a internet e tente novamente.');}
    if(!response.ok)throw error(body.error||'A conexão ao YouTube foi recusada.',body.code||'AUTH_SERVICE',response.status);
    return body;
  }
  return {
    async credentials(){
      const data=await call('config');
      if(data.version!==1||!/^\d+-[\w-]+\.apps\.googleusercontent\.com$/.test(data.client_id||'')||data.redirect_uri!==`http://127.0.0.1:${port}/api/youtube/callback`||data.scope!==SCOPE||data.channel!=='@apcedf')throw error('A configuração central da APCE é incompatível com esta instalação.');
      return {type:'broker',client_id:data.client_id};
    },
    exchange:({code,verifier,redirectUri})=>call('exchange',{code,code_verifier:verifier,redirect_uri:redirectUri}),
    refresh:tokens=>call('refresh',{refresh_token:tokens.refresh_token,broker_ticket:tokens.broker_ticket}),
  };
}

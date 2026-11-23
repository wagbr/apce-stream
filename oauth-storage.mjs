import path from 'node:path';

export function persistentOAuthFile(base,{platform=process.platform,env=process.env}={}){
  const root=env.APCE_STREAM_DATA_DIR||(platform==='win32'&&env.LOCALAPPDATA?path.join(env.LOCALAPPDATA,'APCE Stream'):null);
  return root?path.join(path.resolve(root),'youtube','connection.dpapi'):path.join(base,'private','youtube','connection.dpapi');
}

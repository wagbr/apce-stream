import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createYouTubeScheduler} from '../youtube-scheduler.mjs';
import {persistentOAuthFile} from '../oauth-storage.mjs';
import {createOAuthBroker} from '../oauth-broker.mjs';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scheduler=createYouTubeScheduler({base,port:3210,authFile:persistentOAuthFile(base),broker:createOAuthBroker()});
const state=await scheduler.status();
console.log(JSON.stringify({clientConfigured:state.clientConfigured,connected:state.connected,persistent:true}));

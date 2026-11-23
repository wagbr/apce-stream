import fs from 'node:fs';
import {chromium} from 'playwright';
if(!process.argv.includes('--autorizado'))throw Error('Autorização explícita para abrir o link privado do VDO.Ninja é necessária.');
const state=await(await fetch('http://127.0.0.1:3210/api/state')).json();
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
  const page=await browser.newPage();await page.goto(state.links.monitor,{waitUntil:'domcontentloaded',timeout:60000});
  let metrics;
  for(let i=0;i<30;i++){
    metrics=await page.evaluate(()=>({videos:[...document.querySelectorAll('video')].map(v=>({width:v.videoWidth,height:v.videoHeight,time:v.currentTime,playing:!v.paused})),sessionVisible:typeof session!=='undefined',sessionFields:typeof session==='undefined'?[]:Object.keys(session).filter(k=>/rpc|stream|video|peer/i.test(k))}));
    if(metrics.videos.some(v=>v.width>0&&v.time>1))break;
    await page.waitForTimeout(1000);
  }
  fs.writeFileSync('evidencias/retorno.json',JSON.stringify(metrics,null,2),'utf8');console.log(JSON.stringify(metrics));
}finally{await browser.close();}

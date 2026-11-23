import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
if (!process.argv.includes('--autorizado')) {
  throw new Error('Obtenha autorização explícita para abrir o link privado da sala no VDO.Ninja antes de executar com --autorizado.');
}
const state=await(await fetch('http://127.0.0.1:3210/api/state')).json();
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
try{
  const context=await browser.newContext({permissions:['camera','microphone'],viewport:{width:1280,height:800}});
  const page=await context.newPage();
  await page.goto(state.links.host,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(5000);
  await page.locator('#container-3').click();
  await page.waitForTimeout(4000);
  const buttons=await page.locator('button:visible').evaluateAll(nodes=>nodes.map(n=>({id:n.id,text:n.textContent.trim().replace(/\s+/g,' ').slice(0,100)})));
  const title=await page.title();
  const controls=await page.locator('input:visible,select:visible,[role=button]:visible').evaluateAll(nodes=>nodes.map(n=>({tag:n.tagName,id:n.id,role:n.getAttribute('role'),text:n.tagName==='INPUT'?'':n.textContent.trim().replace(/\s+/g,' ').slice(0,120)})));
  console.log(JSON.stringify({title,buttons,controls},null,2));
  fs.writeFileSync(path.join(base,'evidencias/vdo-pagina.json'),JSON.stringify({title,buttons,controls},null,2),'utf8');
}finally{await browser.close();}

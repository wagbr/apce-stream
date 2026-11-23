import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  for(const mode of ['wait','solo','duo','room','media','end']){
    await page.goto(`http://127.0.0.1:3210/overlay-v2.html?mode=${mode}&layer=back&thumbnail=1`);
    await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode().catch(()=>{}))));
    await page.waitForTimeout(1000);
    await page.screenshot({path:path.join(base,'public/assets/orbital-v2',`scene-${mode}-v2.png`)});
  }
  console.log('Seis miniaturas renderizadas a partir dos overlays reais.');
}finally{await browser.close();}

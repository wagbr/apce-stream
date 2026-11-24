import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {chromium} from 'playwright';import assert from 'node:assert/strict';
const base=path.dirname(path.dirname(fileURLToPath(import.meta.url))),assets=path.join(base,'public/assets/areia-v3'),output=path.join(base,'evidencias/areia-v3');fs.mkdirSync(output,{recursive:true});
const bundled=path.join(base,'runtime/ffmpeg/bin/ffmpeg.exe'),ffmpeg=fs.existsSync(bundled)?bundled:'ffmpeg';
function convert(input,filename,width=1920,height=1080){const r=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',input,'-vf',`scale=${width}:${height}`,'-c:v','libwebp','-quality','90','-frames:v','1',path.join(assets,filename)],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error(r.stderr||'Falha ao exportar '+filename);}
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--mute-audio']});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}});
 async function render(mode,native,name){
  await page.goto(`http://127.0.0.1:3210/overlay-v2.html?mode=${mode}&layer=back&native=${native?'1':'0'}`);
  await page.locator('.back').waitFor();await page.evaluate(async()=>{const src=getComputedStyle(document.querySelector('.back')).backgroundImage.match(/url\(["']?(.+?)["']?\)/)[1],img=new Image();img.src=src;await img.decode();});
  assert.equal((await page.locator('#root').textContent()).trim(),'','O fundo deve conter somente imagens.');
  const file=path.join(output,name);await page.screenshot({path:file});return file;
 }
 convert(await render('room',true,'fundo-sala.png'),'fundo-sala.webp');
 convert(await render('media',true,'fundo-midia.png'),'fundo-midia.webp');
 for(const mode of ['wait','intro','solo','duo','room','media','end'])convert(await render(mode,false,`scene-${mode}.png`),`scene-${mode}-v3.webp`,640,360);
 console.log('Fundos de sala e mídia em 1080p e sete miniaturas sem frases exportados.');
}finally{await browser.close();}

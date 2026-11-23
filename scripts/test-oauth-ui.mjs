import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';

// Somente rotas OAuth simuladas; este ensaio não abre o Google nem altera conexões.
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage();const errors=[];let connecting=false,connected=true,connects=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.oauthPopupClosed=0;window.open=()=>({location:'about:blank',close(){window.oauthPopupClosed++;}});});
  await page.route('**/api/youtube/**',async route=>{
    const endpoint=new URL(route.request().url()).pathname.split('/').at(-1);
    if(endpoint==='state')return route.fulfill({json:{clientConfigured:true,clientType:'broker',centralAuth:true,connected,connecting,busy:false,error:'',account:connected?{id:'UC_FIXTURE',title:'APCE',handle:'@apcedf'}:null,events:[],upcoming:[]}});
    if(endpoint==='refresh')return route.fulfill({json:{upcoming:[]}});
    if(endpoint==='connect'){connects++;connecting=true;return route.fulfill({json:{url:'https://accounts.google.com/fixture-only'}});}
    throw Error('Rota inesperada no teste: '+endpoint);
  });
  await page.goto('http://127.0.0.1:3210/#agendador');
  await page.locator('#scheduler-settings').click();
  await page.locator('#scheduler-persistent-note:visible').waitFor();
  assert.equal(await page.locator('#scheduler-oauth-file').isVisible(),false);
  assert.equal(await page.locator('#scheduler-advanced').isVisible(),false);
  await page.locator('#scheduler-login').click();
  await page.waitForTimeout(4600);
  assert.equal(connects,1);assert.equal(await page.evaluate(()=>window.oauthPopupClosed),0);
  connecting=false;await page.waitForTimeout(4400);
  assert.equal(await page.evaluate(()=>window.oauthPopupClosed),1);
  connected=false;await page.reload();
  await page.locator('#scheduler-connect:visible').waitFor();
  await page.locator('#scheduler-connect').click();
  await page.waitForTimeout(100);
  assert.equal(connects,2);assert.equal(await page.locator('#scheduler-oauth-file').isVisible(),false);
  assert.deepEqual(errors,[]);
  const evidence={passed:true,noJSONPrompt:true,directGoogleLogin:true,popupPreservedUntilAuthorization:true,oauthMocked:true,realAuthorizationChanged:false};
  fs.mkdirSync('evidencias',{recursive:true});fs.writeFileSync('evidencias/oauth-ui.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{await browser.close();}

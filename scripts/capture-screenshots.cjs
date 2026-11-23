const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const root = path.resolve(__dirname,'..');
const out = path.join(root,'docs','screenshots');
fs.mkdirSync(out,{recursive:true});
const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff'};
const server = http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),vendor=url.pathname.startsWith('/vendor/vditor/');
  const base=path.join(root,vendor?'node_modules/vditor':'public');
  const rel=vendor?url.pathname.slice('/vendor/vditor/'.length):url.pathname==='/'?'index.html':url.pathname.slice(1);
  const file=path.resolve(base,decodeURIComponent(rel));
  if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':contentTypes[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const profile=path.join(require('os').tmpdir(),'tolcy-screenshot-profile-'+Date.now());
  const browser=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let ws;
  try{
    const endpoint=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Browser startup timed out')),20000);browser.stderr.on('data',chunk=>{text+=chunk;const m=/DevTools listening on (ws:\/\/[^\s]+)/.exec(text);if(m){clearTimeout(timer);resolve(m[1]);}});browser.on('error',reject);});
    ws=new WebSocket(endpoint);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve);ws.addEventListener('error',reject);});
    let serial=0;const pending=new Map();
    ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);if(p){pending.delete(message.id);message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result);}}});
    const command=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}: {})}));});
    const {targetId}=await command('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
    const page=(method,params)=>command(method,params,sessionId);
    const evaluate=async(expression)=>{const r=await page('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
    await page('Page.enable');await page('Runtime.enable');
    await page('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
    await page('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.clear();localStorage.setItem('wengao-lang','zh');localStorage.setItem('wengao-theme','light');"});
    await page('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
    let ready=false;for(let i=0;i<100;i++){try{ready=await evaluate("typeof state !== 'undefined' && !!state.editor && !state.loading && !!state.editor.vditor.ir");}catch{}if(ready)break;await wait(100);}if(!ready)throw Error('Editor did not initialize');
    const startup=await evaluate("({text:state.editor.getValue(),tabs:state.tabs.length,dirty:state.dirty})");
    if(startup.text.trim()||startup.tabs!==0||startup.dirty)throw Error('Editor startup should be blank: '+JSON.stringify(startup));
    console.log('Blank startup verified');
    await capture('startup.png');
    const sampleZh='# 把想法，写成清晰的文字\n\n一份笔记、一篇文章，或者一个刚刚萌芽的计划。打开 Tolcy，让注意力回到内容。\n\n## 写作，从本地开始\n\n- **文件属于你**：直接打开 Markdown 文件夹\n- **格式自然呈现**：标题、列表、表格与代码\n- **随时分享**：导出 PDF、Word、EPUB 与 HTML\n\n> 不需要账户。文稿保存在自己的电脑上。\n\n## 今天的写作计划\n\n| 任务 | 状态 |\n| --- | --- |\n| 整理灵感与资料 | 已完成 |\n| 写下文章初稿 | 进行中 |\n| 导出并分享 | 待开始 |\n\n## 留下一点灵感\n\n从一个小想法开始，写出自己的节奏。\n';
    const sampleEn='# A little room for your ideas\n\nA note, a first draft, or the beginning of something new. Open Tolcy and focus on the words.\n\n## Your words. Your files.\n\n- **Local workspace** — keep Markdown files in your own folders\n- **Instant rendering** — headings, lists, tables, and code\n- **Share your work** — export PDF, Word, EPUB, and HTML\n\n> No account required. Documents stay on your computer.\n\n## A simple writing plan\n\n| Task | Status |\n| --- | --- |\n| Collect ideas | Done |\n| Write the first draft | In progress |\n| Export and share | Up next |\n\n## Make space to think\n\nStart with one idea. Find your own writing rhythm.\n';
    async function setup(language,theme,markdown){
      await evaluate(`lang=${JSON.stringify(language)};applyI18n();applyTheme(${JSON.stringify(theme)});state.tabs=[];state.activeKey='';state.saved='';state.dirty=false;state.name='';load('# Notes\\n\\nA place for ideas.','notes.md',null,'notes.md','C:/Tolcy-Demo/notes.md');load(${JSON.stringify(markdown)},${JSON.stringify(language==='zh'?'写作计划.md':'writing-plan.md')},null,'writing-plan.md','C:/Tolcy-Demo/writing-plan.md');state.folders=[{name:'Tolcy Demo',path:'C:/Tolcy-Demo',open:true,tree:[{name:${JSON.stringify(language==='zh'?'写作计划.md':'writing-plan.md')},kind:'file',path:'C:/Tolcy-Demo/writing-plan.md'},{name:'notes.md',kind:'file',path:'C:/Tolcy-Demo/notes.md'},{name:'ideas',kind:'dir',path:'C:/Tolcy-Demo/ideas',open:true,children:[{name:'reading-list.md',kind:'file',path:'C:/Tolcy-Demo/ideas/reading-list.md'}]}]}];setWorkspaceCollapsed(false);setOutlineCollapsed(false);renderTree();renderTabs();renderOutline();`);
      await evaluate('document.fonts.ready');await wait(700);
    }
    async function capture(name){const {data}=await page('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,name),Buffer.from(data,'base64'));console.log(`Captured ${name}`);}
    await setup('zh','light',sampleZh);await capture('editor-zh.png');
    await setup('en','dark',sampleEn);await capture('editor-en.png');
    await setup('zh','paper',sampleZh);await evaluate("showSettings();document.querySelectorAll('[data-settings-tab]').forEach(b=>b.classList.toggle('is-current',b.dataset.settingsTab==='export'));document.querySelectorAll('[data-settings-panel]').forEach(p=>p.hidden=p.dataset.settingsPanel!=='export');");await wait(200);await capture('export-zh.png');
    await setup('zh','light',sampleZh);
    await evaluate("isDesktop=()=>true;encryptionKeys=[{id:'a'.repeat(32),name:'个人笔记'},{id:'b'.repeat(32),name:'工作文稿'}];invoke=async()=>null;const demoTab=state.tabs.find(t=>t.key===state.activeKey);demoTab.encryptionKeyId=demoTab.savedEncryptionKeyId='a'.repeat(32);renderTabs();renderEncryptionSettings();showSettings();document.querySelectorAll('[data-settings-tab]').forEach(b=>b.classList.toggle('is-current',b.dataset.settingsTab==='encryption'));document.querySelectorAll('[data-settings-panel]').forEach(p=>p.hidden=p.dataset.settingsPanel!=='encryption');");
    const footerFits = await evaluate("(()=>{const sidebar=document.getElementById('sidebar');const fits=()=>{const toggle=document.getElementById('quick-encryption-toggle').getBoundingClientRect(),select=document.getElementById('quick-encryption-key').getBoundingClientRect(),settings=document.getElementById('open-settings').getBoundingClientRect();return toggle.right<=select.left&&select.right<=settings.left&&select.width>=16;};const results=[];for(const width of [248,160]){sidebar.style.width=width+'px';results.push({width,ok:fits()});}sidebar.style.width='248px';return results;})()");
    if(footerFits.some(result=>!result.ok))throw Error('Sidebar encryption controls overflow: '+JSON.stringify(footerFits));
    console.log('Sidebar layout verified: '+JSON.stringify(footerFits));
    await capture('encryption-zh.png');
    await evaluate("lang='en';encryptionKeys=[{id:'a'.repeat(32),name:'Personal notes'},{id:'b'.repeat(32),name:'Work documents'}];state.name='writing-plan.md';state.tabs.find(t=>t.key===state.activeKey).name=state.name;applyI18n();renderEncryptionSettings();");
    await capture('encryption-en.png');
    const errors=await evaluate("({title:document.title,language:lang,theme:themeName()})");console.log(JSON.stringify(errors));
    await command('Browser.close');
  }finally{if(ws)ws.close();browser.kill();server.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;server.close();});

/* Saved lessons must contain the current construction, even with slow snapshots. */
module.exports=async({page,assert,screenshot})=>{
  await page.addInitScript(()=>{
    const names=new Set();window.__capture={pending:[],hold:false,fail:false};
    const nativeSet=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){if(window.__capture.fail&&key==='dongjiexi:geogebra:v1:teaching')throw new DOMException('full','QuotaExceededError');return nativeSet.call(this,key,value);};
    window.GGBApplet=class{constructor(params){this.params=params;}inject(id){
      document.getElementById(id).textContent='题稿保存 API 测试替身';
      const api=new Proxy({exists:n=>names.has(n),isDefined:n=>names.has(n),getVisible:()=>true,getAllObjectNames:()=>[...names],
        evalCommand:command=>{names.add(command.split(/[=:]/)[0].trim());return true;},newConstruction:()=>names.clear(),
        getBase64:callback=>{const raw=btoa(JSON.stringify([...names]));if(window.__capture.hold)window.__capture.pending.push(()=>callback(raw));else setTimeout(()=>callback(raw),10);},
        setBase64:(raw,callback)=>{names.clear();JSON.parse(atob(raw)).forEach(n=>names.add(n));callback();},
        getViewProperties:()=>({width:800,height:600})
      },{get:(target,key)=>key in target?target[key]:()=>{}});
      setTimeout(()=>this.params.appletOnLoad(api),10);
    }};
  });
  await page.reload();
  const ready=async()=>{try{await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&window.DongUnifiedBoard.isSynchronized());}catch(error){error.message+=' '+JSON.stringify(await page.evaluate(()=>({skipped:window.DongGeoGebra.getReport().skipped,status:document.querySelector('#boardEngineStatus').textContent,title:document.querySelector('#boardEngineStatus').title})));throw error;}};
  await ready();
  async function select(id){await page.locator('#openQuestionBank').click();await page.locator(`[data-bank-id="${id}"]`).click();}
  async function open(id){await select(id);await page.locator('[data-bank-action="full"]').click();await page.waitForFunction(()=>!document.querySelector('#questionBankDialog').open);await ready();}
  const entries=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dongjiexi:notebook:v1')||'[]'));
  const add=name=>page.evaluate(n=>window.DongGeoGebra.getAPI().evalCommand(n+'=(7,8)'),name);
  const hold=()=>page.evaluate(()=>{window.__capture.hold=true;});
  const pending=()=>page.waitForFunction(()=>window.__capture.pending.length>0);
  const release=()=>page.evaluate(()=>{window.__capture.hold=false;window.__capture.pending.splice(0).forEach(run=>run());});
  await open('2024-ii-3');
  const original=await page.locator('#question').inputValue();
  await page.locator('[data-inspector-view="lesson"]').click();
  await add('LatestAuxiliary');await hold();
  await page.locator('[data-lesson-action="save"]').click();await pending();
  assert(!(await entries()).some(r=>r.question===original),'The save action waits for the actual board snapshot');
  await release();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('已存入'));
  let saved=(await entries()).find(r=>r.question===original);
  assert(JSON.parse(Buffer.from(saved.boardDraft.base64,'base64')).includes('LatestAuxiliary'),'The answer-panel save includes just-drawn objects');

  await add('BeforeSwitch');await select('2022-beijing-19-1');await hold();
  await page.locator('[data-bank-action="full"]').click();await pending();
  assert.equal(await page.locator('#question').inputValue(),original,'Switch waits until the old board is saved');
  assert(await page.locator('[data-bank-action="practice"]').isDisabled(),'Repeated navigation cannot race the first save');
  await release();await page.waitForFunction(()=>!document.querySelector('#questionBankDialog').open);
  await page.waitForFunction(()=>window.DongGeoGebra.getReport().signature.includes('2022-beijing-19-1'));
  saved=(await entries()).find(r=>r.question===original);
  assert(JSON.parse(Buffer.from(saved.boardDraft.base64,'base64')).includes('BeforeSwitch'));
  assert.equal(await page.evaluate(()=>window.DongGeoGebra.getAPI().exists('BeforeSwitch')),false,'Old auxiliary work must not leak into another question');
  await page.locator('#openNotebook').click();await page.locator(`[data-open-lesson="${saved.id}"]`).click();await ready();
  try{await page.waitForFunction(()=>window.DongGeoGebra.getAPI().exists('BeforeSwitch'));}catch(error){console.log(await page.evaluate(record=>({signatureMatches:record.boardDraft.sceneSignature===window.DongGeoGebra.getReport().signature,savedSignature:record.boardDraft.sceneSignature,report:window.DongGeoGebra.getReport(),savedOwned:record.boardDraft.owned,names:window.DongGeoGebra.getAPI().getAllObjectNames(),status:document.querySelector('#boardEngineStatus').textContent,title:document.querySelector('#boardEngineStatus').title}),saved));throw error;}

  // A cancelled save must not quietly export a different question.
  await page.locator('#openNotebook').click();await hold();
  let downloads=0;page.on('download',()=>downloads++);
  await page.locator('#exportLesson').click();await pending();
  await page.evaluate(()=>{document.querySelector('#question').value+='\n新题草稿';});
  await release();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('保存期间'));
  assert.equal(downloads,0,'Changed context cannot be downloaded under the prior save request');
  await page.evaluate(q=>{document.querySelector('#question').value=q;},original);
  await page.locator('#notebookDialog [data-close-dialog]').click();

  // Callback order can differ from snapshot request order.
  await hold();await add('OlderSnapshot');
  await page.evaluate(()=>{window.__firstSave=window.DongGeoGebra.save();});await pending();
  await add('NewerSnapshot');await page.evaluate(()=>{window.__secondSave=window.DongGeoGebra.save();});
  await page.waitForFunction(()=>window.__capture.pending.length===2);
  await page.evaluate(async()=>{window.__capture.pending.pop()();await window.__secondSave;window.__capture.pending.shift()();await window.__firstSave;window.__capture.hold=false;});
  assert(await page.evaluate(()=>JSON.parse(atob(window.DongUnifiedBoard.snapshot().base64)).includes('NewerSnapshot')),'A slow earlier save cannot overwrite the latest saved construction');

  // Storage failure keeps the current question and leaves an actionable error.
  await select('2022-beijing-19-1');await page.evaluate(()=>{window.__capture.fail=true;});
  await page.locator('[data-bank-action="full"]').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('存储空间不足'));
  assert.equal(await page.locator('#question').inputValue(),original);
  assert(await page.locator('#questionBankDialog').isVisible());
  assert.equal(await page.locator('[data-bank-action="full"]').isDisabled(),false,'Failure allows retry');
  await page.evaluate(()=>{window.__capture.fail=false;});
  await page.locator('#closeQuestionBank').click();

  // Closing the chooser while a save is pending cancels only the switch.
  await select('2022-beijing-19-1');await hold();await page.locator('[data-bank-action="full"]').click();await pending();
  await page.locator('#closeQuestionBank').click();await page.locator('#openQuestionBank').click();await release();
  await page.waitForFunction(()=>!document.querySelector('[data-bank-action="full"]').disabled);
  assert.equal(await page.locator('#question').inputValue(),original);
  await page.locator('#closeQuestionBank').click();
  const currentSaved=(await entries()).find(r=>r.question===original);
  await add('UnsavedScratch');
  await page.locator('#openNotebook').click();await page.locator(`[data-open-lesson="${currentSaved.id}"]`).click();
  await page.waitForFunction(()=>!window.DongGeoGebra.getAPI().exists('UnsavedScratch'));
  assert(await page.evaluate(()=>window.DongGeoGebra.getAPI().exists('BeforeSwitch')),'Reopening the same scene restores its saved auxiliary work');
  assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('dongjiexi:lesson-backups:v1')).some(r=>r.switchBackup&&r.boardDraft&&JSON.parse(atob(r.boardDraft.base64)).includes('UnsavedScratch'))),'Reopening an earlier copy preserves outgoing unsaved construction in a separate backup');
  assert.deepEqual(await page.evaluate(()=>{const match=window.DongGeoGebra.matchesScene;return[match('{"points":{"A":[1,2]},"type":"circle"}','{"type":"circle","points":{"A":[1,2]}}'),match('{"points":{"A":[1,2]}}','{"points":{"A":[2,1]}}'),match('{"r":1}','{"r":2}'),match('invalid','{}')];}),[true,false,false,false],'Object-key order may vary; coordinates, values and validity must still match');
  await screenshot('lesson-capture-preserved.png',null);
};

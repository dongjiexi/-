/* Release lifecycle checks use an existing sourced question, not a solver benchmark. */
module.exports=async({page,assert})=>{
  await page.locator('#openQuestionBank').click();
  await page.locator('[data-bank-id="2024-ii-3"]').click();
  await page.locator('[data-bank-action="full"]').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('zhigeometry:last')||'null')?.solution);
  const baseline=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')));
  const record={format:'dongjiexi-lesson',version:1,id:'release-private-record',title:'已保存真题',savedAt:new Date().toISOString(),question:baseline.question,scene:baseline.scene,original:baseline.original,solution:{...baseline.solution,study:{notes:'PRIVATE_NOTES'},conversation:[{role:'user',content:'PRIVATE_CHAT'}],rawReply:'PRIVATE_REPLY'},activePart:baseline.activePart,exploring:baseline.exploring};
  const corrupt=JSON.stringify([record,null,42,{title:1}]);
  await page.evaluate(raw=>{localStorage.setItem('dongjiexi:notebook:v1',raw);localStorage.setItem('dongjiexi:lesson-backups:v1','{broken-backups');},corrupt);
  await page.locator('#openNotebook').click();
  assert.match(await page.locator('#notebookList').textContent(),/原数据已保留/);
  assert.equal(await page.locator('[data-open-lesson="release-private-record"]').count(),1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('dongjiexi:notebook:v1')),corrupt,'Reading a damaged index does not erase it');
  await page.locator('[data-open-lesson="release-private-record"]').click();
  await page.locator('#saveLesson').click();
  assert(await page.evaluate(raw=>Object.keys(localStorage).some(k=>k.startsWith('dongjiexi:notebook:v1:recovery:')&&localStorage.getItem(k)===raw),corrupt),'Saving first preserves the complete unreadable original');
  assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('dongjiexi:notebook:v1')).every(v=>v&&typeof v.question==='string')));
  await page.locator('#openNotebook').click();await page.locator('#exportSharedLesson').click();
  let shared=JSON.parse(await page.locator('[data-share-preview]').textContent());
  assert.equal(shared.format,'dongjiexi-lesson');assert.equal(shared.question,record.question);assert.deepEqual(shared.scene,record.scene);
  for(const key of ['study','conversation','rawReply'])assert.equal(shared.solution[key],undefined);
  assert.equal(shared.boardDraft,undefined);assert.equal(shared.activePart,record.activePart);
  const download=page.waitForEvent('download');await page.locator('[data-share-download]').click();assert.equal((await download).suggestedFilename(),'董解析-分享题稿.json');
  await page.locator('[data-share-close]').click();await page.locator('#openNotebook').click();
  const before=await page.evaluate(()=>localStorage.getItem('zhigeometry:last'));
  for(const bad of [null,{...record,solution:{...record.solution,verification:{checks:{bad:true}}}},{...record,solution:{...record.solution,sceneAudit:{answerConflicts:[null]}}}]){
    await page.locator('#importLesson').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
    assert.equal(await page.evaluate(()=>localStorage.getItem('zhigeometry:last')),before,'Invalid import must preserve the previous complete saved draft');
  }
  // A valid share file remains compatible with the existing importer.
  await page.locator('#importLesson').setInputFiles({name:'shared.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(shared))});
  await page.waitForFunction(()=>!document.querySelector('#notebookDialog').open);
  assert.equal(await page.locator('#question').inputValue(),record.question);
  assert.equal(JSON.parse(await page.locator('#sceneJson').inputValue()).type,record.scene.type);
  // If the recovery copy cannot be written, neither index nor current draft is removed.
  await page.evaluate(()=>{localStorage.setItem('dongjiexi:notebook:v1','[null]');window.__notebookSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('dongjiexi:notebook:v1:recovery:'))throw new DOMException('quota','QuotaExceededError');return window.__notebookSet.call(this,k,v);};});
  await page.locator('#saveLesson').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('dongjiexi:notebook:v1')),'[null]');
  assert.match(await page.locator('#status').textContent(),/异常记录未能备份/);
  await page.evaluate(()=>Storage.prototype.setItem=window.__notebookSet);
};

/* A sourced question drives context/lifecycle checks; no model call is needed. */
module.exports=async({page,assert,screenshot})=>{
  await page.locator('#openQuestionBank').click();await page.locator('[data-bank-id="2024-ii-3"]').click();await page.locator('[data-bank-action="full"]').click();
  const original=await page.locator('#question').inputValue(),edited=original+'\n（未完成的新题草稿）';
  const notebook=await page.evaluate(()=>localStorage.getItem('dongjiexi:notebook:v1'));
  await page.evaluate(()=>{window.__prints=0;window.print=()=>window.__prints++;});
  await page.locator('#question').fill(edited);await page.locator('#saveLesson').click();
  assert.match(await page.locator('#status').textContent(),/题目已修改/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('dongjiexi:notebook:v1')),notebook);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dongjiexi:draft:v1')).question),edited);
  await page.locator('[data-inspector-view="lesson"]').click();await page.locator('[data-lesson-action="print"]').click();assert.equal(await page.evaluate(()=>window.__prints),0);
  // A queued handler must also reject a stale context, even when the reference
  // lesson normally hides the AI-chat controls.
  await page.evaluate(()=>{document.querySelector('#followupInput').value='请解释这一步';document.querySelector('#sendFollowup').click();});assert.match(await page.locator('#status').textContent(),/题目已修改/);
  await page.locator('#openNotebook').click();await page.locator('#exportSharedLesson').click();assert.equal(await page.locator('#shareLessonDialog').isVisible(),false);
  await page.locator('#notebookDialog [data-close-dialog]').click();
  await page.locator('[data-restore-answer-question]').click();assert.equal(await page.locator('#question').inputValue(),original);
  await page.locator('#saveLesson').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dongjiexi:draft:v1')).question),edited,'Saving restored old lesson retains the separate new-question draft');
  await page.locator('[data-restore-pending-question]').click();assert.equal(await page.locator('#question').inputValue(),edited);
  await page.locator('[data-restore-answer-question]').click();
  await page.locator('#sceneJson').evaluate(el=>{el.value=JSON.stringify({type:'circle',r:99,showDynamic:false});document.querySelector('#applyJson').click();});
  await page.locator('[data-inspector-view="lesson"]').click();assert.match(await page.locator('.solve-review').textContent(),/手工图稿.*未确认/);
  await page.locator('[data-lesson-action="print"]').click();assert.equal(await page.evaluate(()=>window.__prints),1);assert.equal(await page.locator('#printLesson img').count(),0,'An unrelated replacement graph is not attached to old-answer printing');
  assert.match(await page.locator('#printLesson').textContent(),/未附图/);
  await page.locator('[data-inspector-view="geometry"]').click();
  const previous=await page.evaluate(()=>localStorage.getItem('zhigeometry:last'));
  await page.evaluate(()=>{window.__savedSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='zhigeometry:last')throw new DOMException('full','QuotaExceededError');return window.__savedSet.call(this,k,v);};});
  await page.locator('#saveLocal').click();assert.match(await page.locator('#status').textContent(),/本机保存失败/);assert.equal(await page.evaluate(()=>localStorage.getItem('zhigeometry:last')),previous);
  await page.evaluate(()=>Storage.prototype.setItem=window.__savedSet);
  await page.locator('#question').fill(edited);
  await page.locator('#openQuestionBank').click();await page.locator('[data-bank-id="2023-i-6"]').click();await page.locator('[data-bank-action="full"]').click();
  await page.waitForFunction(()=>!document.querySelector('#questionBankDialog').open);
  assert.notEqual(await page.locator('#question').inputValue(),edited,'A preserved draft must not prevent selecting the next bank question');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dongjiexi:draft:v1')).question),edited);
  assert(await page.evaluate(q=>JSON.parse(localStorage.getItem('dongjiexi:lesson-backups:v1')).some(r=>r.switchBackup&&r.question===q&&r.solution.restatement===q),original),'The prior answer is backed up under its own original question');
  await screenshot('answer-context-desktop.png',null);
};

/* Notebook navigation uses sourced Beijing 2022 Q19 and national II 2024 Q3. */
module.exports=async({page,assert,screenshot})=>{
  const fs=require('node:fs/promises');
  const last=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')));
  async function bank(id){await page.locator('#openQuestionBank').click();await page.locator(`[data-bank-id="${id}"]`).click();await page.locator('[data-bank-action="full"]').click();await page.waitForFunction(()=>!document.querySelector('#questionBankDialog').open);return last();}
  const first=await bank('2022-beijing-19-1'),second=await bank('2024-ii-3');
  function record(state,title,date,review){return {...state,format:'dongjiexi-lesson',version:1,id:'shared-old-id',title,savedAt:date,solution:{...state.solution,study:{review,notes:review==='review'?'端点需要检查':'',mode:'full'}}};}
  const a=record(first,'北京椭圆题','2025-01-01T00:00:00Z','review'),b=record(second,'全国向量题','2026-01-01T00:00:00Z','mastered');
  a.question=a.question.replace('x²/a²+y²/b²=1','\\(\\dfrac{x^2}{a^2}+\\dfrac{y^2}{b^2}=1\\)');a.solution.restatement=a.question;
  await page.evaluate(records=>{localStorage.setItem('dongjiexi:notebook:v1',JSON.stringify(records));localStorage.removeItem('dongjiexi:lesson-backups:v1');},[a,b]);
  await page.locator('#openNotebook').click();
  const cards=page.locator('#notebookList .notebook-entry');
  assert.match(await page.locator('#notebookSummary').textContent(),/2 \/ 2/);
  assert.equal(await cards.first().locator('strong').textContent(),b.title);
  await page.locator('#notebookSort').selectOption('oldest');assert.equal(await cards.first().locator('strong').textContent(),a.title);
  assert(await cards.first().locator('.katex').count()>0,'Notebook formulas render without truncating TeX');
  assert.equal(await cards.first().locator('.katex-error').count(),0);
  const preview=cards.first().locator('[data-notebook-preview]');await preview.click();assert.equal(await preview.getAttribute('aria-expanded'),'true');await preview.click();
  await page.locator('#notebookSearch').fill('  端点需要检查  ');assert.equal(await cards.count(),1,'Trimmed search includes saved notes');
  await page.locator('#notebookSearch').fill('');await page.locator('#reviewFilter').selectOption('mastered');assert.equal(await cards.count(),1);assert.match(await cards.textContent(),/已掌握/);
  await page.locator('#reviewFilter').selectOption('new');assert.equal(await cards.count(),0);
  await page.locator('#reviewFilter').selectOption('review');
  const download=page.waitForEvent('download');await cards.first().locator('[data-export-saved]').click();
  const saved=JSON.parse(await fs.readFile(await (await download).path(),'utf8'));
  assert.equal(saved.question,a.question,'Export this question exports the selected record, not the current board');
  assert.equal(saved.solution.study.notes,'端点需要检查');assert.equal((await last()).question,b.question,'Export does not replace the active lesson');

  // A quota failure must be visible inside the modal and must not switch.
  await page.evaluate(()=>{window.__originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='dongjiexi:notebook:v1')throw new DOMException('full','QuotaExceededError');return window.__originalSet.call(this,k,v);};});
  await cards.first().locator('[data-open-lesson]').click();
  await page.waitForFunction(()=>document.querySelector('#notebookNotice').textContent.includes('空间不足'));
  assert.equal((await last()).question,b.question);assert.equal(await cards.first().locator('[data-open-lesson]').isDisabled(),false);
  await page.evaluate(()=>Storage.prototype.setItem=window.__originalSet);

  // Closing and reopening while a capture is pending cancels the old switch.
  await page.evaluate(()=>{const board=window.DongUnifiedBoard;window.__boardOriginal=board;window.DongUnifiedBoard={...board,capture:async()=>{const result=await board.capture();return new Promise(resolve=>window.__releaseNotebook=()=>resolve(result));}};});
  await cards.first().locator('[data-open-lesson]').click();await page.waitForFunction(()=>!!window.__releaseNotebook);
  assert(await page.locator('#notebookSearch').isDisabled());
  await page.locator('#notebookDialog [data-close-dialog]').click();await page.locator('#openNotebook').click();
  await page.evaluate(()=>{window.DongUnifiedBoard=window.__boardOriginal;window.__releaseNotebook();});
  await page.waitForFunction(()=>!document.querySelector('#notebookSearch').disabled);
  assert.equal((await last()).question,b.question,'A cancelled request cannot change the lesson after reopening');
  await cards.first().locator('[data-open-lesson]').click();await page.waitForFunction(()=>!document.querySelector('#notebookDialog').open);
  assert.equal((await last()).question,a.question,'Duplicate imported record IDs do not open the wrong entry');

  // A new draft must stay separate from the old solution on navigation.
  await page.locator('#question').fill(b.question);await page.locator('#openNotebook').click();await page.locator('#reviewFilter').selectOption('all');
  const savedB=await page.evaluate(question=>JSON.parse(localStorage.getItem('dongjiexi:notebook:v1')).find(r=>r.question===question),b.question);
  await page.locator(`[data-open-lesson="${savedB.id}"]`).click();
  await page.waitForFunction(()=>!document.querySelector('#notebookDialog').open);
  assert(await page.evaluate(question=>JSON.parse(localStorage.getItem('dongjiexi:lesson-backups:v1')).some(r=>r.switchBackup&&r.question===question&&r.solution.restatement===question),a.question),'The outgoing answer retains its own source question');
  const draftKeys=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('draft')));assert(draftKeys.length>0);
  await page.setViewportSize({width:390,height:844});await page.locator('#openNotebook').click();await page.locator('#reviewFilter').selectOption('backup');
  assert(await cards.count()>0);assert.match(await cards.first().textContent(),/备份/);
  assert(await page.locator('#notebookDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Mobile notebook has no sideways overflow');
  await screenshot('notebook-mobile.png',null);
};

module.exports=async({page,assert})=>{
  await page.locator('#openQuestionBank').click();await page.locator('[data-bank-id="2024-ii-3"]').click();await page.locator('[data-bank-action="full"]').click();
  const record=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('zhigeometry:last'));return {format:'dongjiexi-lesson',version:1,id:'external-fixture',question:s.question,scene:s.scene,original:s.original,activePart:s.activePart,solution:{...s.solution,verification:{status:'fully-verified',checks:[],counts:{verified:99}},parts:s.solution.parts.map(p=>({...p,verification:{status:'fully-verified'}})),sceneAudit:{checks:[{label:'file-assertion',passed:true}]}}};});
  const importFile=async data=>{await page.locator('#openNotebook').click();await page.locator('#importLesson').setInputFiles({name:'import.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});};
  await importFile(record);await page.waitForFunction(()=>!document.querySelector('#notebookDialog').open);
  assert.match(await page.locator('.trust-summary strong').textContent(),/待核验/);assert.equal(await page.locator('.verification-status.fully-verified').count(),0);
  assert((await page.locator('[data-imported-verification]').textContent()).includes('fully-verified'),'Original file claims remain reviewable as history');
  assert.match(await page.locator('.solve-review').textContent(),/尚未核对/);
  await page.reload();await page.locator('[data-inspector-view="lesson"]').click();assert.match(await page.locator('.trust-summary strong').textContent(),/待核验/);
  const before=await page.evaluate(()=>localStorage.getItem('zhigeometry:last'));
  await importFile({...record,question:record.question+'（不同题目）'});assert.equal(await page.evaluate(()=>localStorage.getItem('zhigeometry:last')),before,'A mismatched import is rejected before clearing the current lesson');
  await page.locator('#notebookDialog [data-close-dialog]').click();
  await page.locator('#openQuestionBank').click();await page.locator('[data-bank-id="2024-ii-3"]').click();await page.locator('[data-bank-action="full"]').click();
  assert.match(await page.locator('.trust-summary strong').textContent(),/题库参考讲解/,'The bundled bank route is distinct from an external file claim');
};

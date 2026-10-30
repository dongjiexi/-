/* Delayed HTTP fixture tests context isolation; the problem is a bank reference. */
module.exports=async({page,context,assert})=>{
  await context.route('**/runtime-config.js*',r=>r.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:true,requiresAuth:false};'}));
  await context.route('**/api/health',r=>r.fulfill({json:{app:'董解析',default_model:'context-fixture',engine:{available:true,installed:true,remote:true,models:['context-fixture']}}}));
  await page.evaluate(()=>localStorage.setItem('dongjiexi:solve-mode:v1','cloud'));await page.reload();
  await page.waitForFunction(()=>document.querySelector('#engineStatus').classList.contains('ready'));
  await page.locator('#openQuestionBank').click();await page.locator('[data-bank-id="2024-ii-3"]').click();await page.locator('[data-bank-action="full"]').click();
  const record=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('zhigeometry:last'));return {format:'dongjiexi-lesson',version:1,question:s.question,scene:s.scene,solution:{...s.solution,mode:'cloud-ai'}};});
  await page.locator('#openNotebook').click();await page.locator('#importLesson').setInputFiles({name:'cloud-record.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(record))});
  await page.locator('[data-inspector-view="lesson"]').click();
  let finish,start;const started=new Promise(resolve=>start=resolve);
  await context.route('**/api/jobs',async r=>{await new Promise(resolve=>{finish=resolve;start();});await r.fulfill({json:{id:'late-chat',status:'completed',result:{text:'LATE_REPLY_SHOULD_NOT_APPEAR'}}});});
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')).solution.conversation||[]);
  await page.locator('#followupInput').fill('请解释关键步骤');await page.locator('#sendFollowup').click();await started;
  await page.locator('#question').fill(record.question+'\n（改题后的草稿）');finish();
  await page.waitForFunction(()=>!document.querySelector('#solveButton').disabled);
  assert.equal(await page.locator('#followupInput').inputValue(),'请解释关键步骤');assert(!(await page.locator('#chatMessages').textContent()).includes('LATE_REPLY'));
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')).solution.conversation||[]),before);
  assert.match(await page.locator('#status').textContent(),/追问未写入新题/);
};

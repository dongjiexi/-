/* Sourced exam teaching flow; the AI-review callback is a billing-free fixture. */
module.exports=async({page,context,assert,screenshot})=>{
  await context.addInitScript(()=>{
    let classroom;
    Object.defineProperty(window,'DongClassroom',{configurable:true,get:()=>classroom,set(value){
      classroom=value;const attach=value.attach;
      value.attach=api=>{window.__classroomContext={api,sends:0};api.sendFeedback=()=>{window.__classroomContext.sends++;};return attach(api);};
    }});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#openQuestionBank').click();await page.locator('[data-bank-id="2023-i-6"]').click();await page.locator('[data-bank-action="practice"]').click();
  await page.locator('[data-inspector-view="lesson"]').click();
  const original=await page.locator('#question').inputValue();
  await page.locator('.step-navigation button').first().click();
  await page.locator('#studyNotes > summary').click();
  const notes='我在列式时需要重新核对切线与半径的垂直关系。';
  await page.locator('#studentAttempt').fill(notes);await page.locator('#reviewState').selectOption('review');
  const before=await page.evaluate(()=>JSON.stringify(window.__classroomContext.api.state.solution.study));
  await page.evaluate(()=>{window.__worksheetPrinted=0;window.print=()=>window.__worksheetPrinted++;});

  await page.locator('#question').fill(original+'\n新增条件待核对');
  await page.locator('#studyQuestionContext').waitFor({state:'visible'});
  assert.match(await page.locator('#studyQuestionContext').textContent(),/对应保存的原题/);
  for(const id of ['studentAttempt','reviewState','reviewAttempt','learningStyle','startClassroom','printWorksheet'])assert(await page.locator('#'+id).isDisabled(),id+' is disabled for a changed question');
  assert(await page.locator('.step-navigation button').first().isDisabled());
  // A stale event already queued before controls were disabled must be guarded too.
  await page.locator('#reviewAttempt').dispatchEvent('click');await page.locator('#printWorksheet').dispatchEvent('click');
  await page.locator('#studentAttempt').evaluate(el=>{el.value='不可写入旧题的笔记';el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.evaluate(()=>window.__classroomContext.sends),0);
  assert.equal(await page.evaluate(()=>window.__worksheetPrinted),0);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__classroomContext.api.state.solution.study)),before,'Editing another question must preserve the old study notes and revealed steps');
  await screenshot('classroom-stale-question.png',null);

  await page.locator('#question').fill(original);
  assert(await page.locator('#studyQuestionContext').isHidden());assert(await page.locator('#reviewAttempt').isEnabled());
  assert.equal(await page.locator('#studentAttempt').inputValue(),notes);
  assert.equal(await page.locator('#reviewState').inputValue(),'review');
  await page.locator('.step-navigation button').first().click();
  assert.equal(await page.locator('#solution .part-body ol>li:visible').count(),2,'Restoring the original question resumes the saved step sequence');
  await page.locator('#reviewAttempt').click();assert.equal(await page.evaluate(()=>window.__classroomContext.sends),1);
  assert((await page.locator('#followupInput').inputValue()).includes(notes));
  await page.locator('#printWorksheet').click();assert.equal(await page.evaluate(()=>window.__worksheetPrinted),1);

  await page.locator('#startClassroom').click();assert(await page.locator('body').evaluate(el=>el.classList.contains('classroom-mode')));
  // Input can also be changed by an import/recognition integration while lecture
  // layout hides the editor; exercise the actual input event, not a private API.
  await page.locator('#question').evaluate(el=>{el.value+='\n待重新解答';el.dispatchEvent(new Event('input',{bubbles:true}));});
  assert(!await page.locator('body').evaluate(el=>el.classList.contains('classroom-mode')));
  assert(await page.locator('#classroomBar').isHidden());assert(await page.locator('#classroomInk').isHidden());
  assert.equal(await page.evaluate(()=>window.__classroomContext.api.state.solution.study.notes),notes);
  await page.locator('#question').fill(original);assert(await page.locator('#startClassroom').isEnabled());
  await page.locator('#startClassroom').click();await page.locator('#exitClassroom').click();
};

/* Real Beijing 2022 Q19, with typography/archive-only import variants. No inference. */
module.exports=async({page,assert,screenshot})=>{
  const last=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')));
  const part=()=>page.locator('#solution .part-body');
  const shown=()=>part().locator(':scope > ol > li:visible').count();
  const clickHint=()=>part().locator('.step-navigation [data-classroom-step="next"]').click();
  const original=page.locator('#solution [data-lesson-detail="problem"]');
  await page.locator('#openQuestionBank').click();
  await page.locator('[data-bank-id="2022-beijing-19-1"]').click();
  await page.locator('[data-bank-action="practice"]').click();
  await page.locator('[data-inspector-view="lesson"]').click();
  const reference=await last(),first=reference.solution.parts[0],second=reference.solution.parts[1];
  assert.equal(reference.solution.parts.length,2);
  assert.equal(await shown(),0);
  assert(await part().locator('[data-classroom-step="previous"]').isDisabled());
  await original.locator('summary').click();
  await part().locator('[data-classroom-step="next"]').focus();await page.keyboard.press('Enter');
  assert(await part().locator('[data-classroom-step="next"]').evaluate(el=>document.activeElement===el),'Keyboard focus follows the recreated hint button');
  assert(await original.evaluate(el=>el.open),'The question stays open while revealing a hint');
  await part().locator('[data-classroom-step="previous"]').click();
  assert.equal(await shown(),0,'A single accidental reveal can be undone without resetting the whole lesson');
  assert(await part().locator('.step-navigation span').evaluate(el=>document.activeElement===el),'At the boundary focus moves to progress rather than the answer');
  await clickHint();
  await part().locator('[data-classroom-step="answer"]').click();
  assert.equal(await shown(),1);assert(await part().locator('.answer-summary').isVisible());
  await page.locator(`[data-study-part="${second.index}"]`).click();
  assert(await page.locator(`[data-study-part="${second.index}"]`).evaluate(el=>document.activeElement===el&&el.getAttribute('aria-pressed')==='true'));
  assert(await original.evaluate(el=>el.open),'Switching parts keeps the same question open');
  await clickHint();await clickHint();
  assert.equal(await shown(),2);assert(await part().locator('.answer-summary').isHidden());
  const priorStudy=(await last()).solution.study;

  await page.locator('#startClassroom').click();
  assert(await page.locator('body').evaluate(el=>el.classList.contains('classroom-mode')));
  assert.equal(await shown(),2,'Entering lecture must resume the active part, not erase hints');
  assert.equal((await page.locator('#classroomProgress').textContent()).replace(/\s/g,''),`2/${second.steps.length}步`);
  assert(await page.locator('#classroomNextPart').isDisabled());
  assert.equal(await page.locator('#classroomAnswer').getAttribute('aria-pressed'),'false');
  await page.locator('#classroomPreviousPart').click();
  assert(await page.locator('#classroomPreviousPart').isDisabled());
  assert.equal(await shown(),1,'Each part resumes its own saved step count');
  assert(await part().locator('.answer-summary').isVisible(),'A previously revealed conclusion remains revealed');
  assert.equal(await page.locator('#classroomAnswer').textContent(),'隐藏结论');
  assert.equal(await page.locator('#classroomAnswer').getAttribute('aria-pressed'),'true');
  await page.locator('#classroomNextPart').click();
  await page.locator('#nextStep').click();assert.equal(await shown(),Math.min(3,second.steps.length));
  await page.locator('#previousStep').click();assert.equal(await shown(),2);
  await screenshot('teaching-resumed-desktop.png',null);
  await page.locator('#exitClassroom').click();
  assert.deepEqual((await last()).solution.study.counts,priorStudy.counts);
  assert.deepEqual((await last()).solution.study.answers,priorStudy.answers);
  await page.locator('#learningStyle').selectOption('full');
  assert.equal(await shown(),second.steps.length);
  await page.locator('#startClassroom').click();
  assert.equal(await shown(),2);
  assert.equal((await last()).solution.study.mode,'full','Lecture does not overwrite the saved reading mode');
  await page.locator('#classroomLocateStep').click();
  assert.equal(await page.evaluate(()=>window.DongBoardStep.snapshot()?.index),1,'The teacher toolbar highlights the last revealed step');
  assert.match(await page.locator('#classroomFeedback').textContent(),/已高亮/);
  await page.locator('#previousStep').click();
  assert.equal(await page.evaluate(()=>window.DongBoardStep.snapshot()),null,'Collapsing the highlighted step removes the board emphasis');
  await page.locator('#nextStep').click();
  await page.locator('#exitClassroom').click();
  assert.equal(await page.locator('#learningStyle').inputValue(),'full');
  assert.equal(await shown(),second.steps.length);
  assert(await page.locator('#startClassroom').evaluate(el=>document.activeElement===el),'Leaving lecture returns keyboard focus');
  await page.locator('#learningStyle').selectOption('step');assert.equal(await shown(),2);
  await page.locator('#startClassroom').click();assert.equal(await shown(),2);
  await page.locator('#exitClassroom').click();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-inspector-view="lesson"]').click();
  assert.equal(await shown(),2,'Saved teaching progress survives a refresh');

  // Printing complete answers uses the active part's scene, so name that scope.
  await page.locator('#learningStyle').selectOption('full');
  await page.evaluate(()=>{window.__printed=[];window.print=()=>{const target=document.querySelector('#printLesson');window.__printed.push({html:target.innerHTML,text:target.textContent,parts:target.querySelectorAll('.part-body').length,scope:target.querySelector('[data-print-graph-scope]')?.textContent,katex:target.querySelectorAll('.katex').length,errors:target.querySelectorAll('.katex-error').length});};});
  await page.locator('[data-lesson-action="print"]').click();
  let print=await page.evaluate(()=>window.__printed.at(-1));
  assert.equal(print.parts,2,'The complete printout keeps both answers');
  assert(print.scope?.includes(second.label),'The current graph is labelled as the second part, not all answers');
  assert.equal(print.errors,0);

  // Keep the real source and proof, changing only mathematical delimiters.
  const imported=JSON.parse(JSON.stringify(reference));
  imported.format='dongjiexi-lesson';imported.version=1;
  imported.question=reference.question
    .replace('x²/a²+y²/b²=1','\\(\\dfrac{x^2}{a^2}+\\dfrac{y^2}{b^2}=1\\)')
    .replace('A(0,1)','\\[A(0,1)\\]')
    .replace('2√3','2\\sqrt{3}');
  imported.solution.restatement=imported.question;
  imported.solution.study={mode:'step',counts:{},answers:{},notes:'',review:'new'};
  imported.activePart=first.index;
  // Old AI steps are retained for review, never promoted to additional hints.
  for(const item of imported.solution.parts)item.model_steps=[...item.steps];
  await page.locator('#openNotebook').click();
  await page.locator('#importLesson').setInputFiles({name:'beijing-2022-q19-typography.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
  await page.locator('[data-inspector-view="lesson"]').click();
  assert.equal(await shown(),0);
  assert.match(await part().locator('.step-navigation span').textContent(),new RegExp(`0 / ${first.steps.length}`),'Untrusted archival steps are excluded from pedagogical progress');
  assert(await part().locator('.model-original').isHidden(),'Step learning does not expose the archival answer outside its hint sequence');
  await clickHint();assert.equal(await shown(),1);
  assert.match(await part().locator('.step-navigation span').textContent(),new RegExp(`1 / ${first.steps.length}`));
  await page.locator('#printWorksheet').click();
  print=await page.evaluate(()=>window.__printed.at(-1));
  assert.equal(print.parts,0,'An independent worksheet never includes solution sections');
  assert.equal(print.errors,0);assert(print.katex>=3,'Inline, display and raw supported TeX are rendered before print() is called');
  assert(!print.html.includes('answer-summary'));assert(!print.text.includes('k=-4'),'The worksheet does not reveal the second-part answer');
  assert(print.text.includes('作答区'));assert(print.text.includes('北京卷'));
  assert.equal(await page.locator('#printLesson img, #printLesson script, #printLesson iframe').count(),0);
  await page.locator('#learningStyle').selectOption('full');
  assert(await part().locator('.model-original').isVisible(),'The archival derivation remains accessible in complete reading mode');
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-mobile-panel="lesson"]').click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await screenshot('teaching-workflow-mobile.png',null);
  // Corrupted/legacy learning metadata cannot reveal all hints or answers.
  await page.evaluate(()=>{const key='zhigeometry:last',r=JSON.parse(localStorage.getItem(key)),parts=r.solution.parts;r.activePart=parts[0].index;r.solution.study={mode:'step',counts:{[parts[0].index]:1.8,[parts[1].index]:'Infinity'},answers:{[parts[0].index]:'false'}};localStorage.setItem(key,JSON.stringify(r));});
  await page.reload();await page.locator('[data-mobile-panel="lesson"]').click();await page.locator('[data-inspector-view="lesson"]').click();
  assert.equal(await shown(),1);assert(await part().locator('.answer-summary').isHidden());
  await page.locator(`[data-study-part="${second.index}"]`).click();assert.equal(await shown(),0);
  await page.locator(`[data-study-part="${first.index}"]`).click();await part().locator('[data-classroom-step="previous"]').click();assert.equal(await shown(),0);
};

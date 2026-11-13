/* A complete teaching round trip for 2025 National I Q18. */
module.exports=async({page,assert,screenshot})=>{
  const snapshot=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')));
  const record=question=>page.evaluate(question=>JSON.parse(localStorage.getItem('dongjiexi:notebook:v1')||'[]').find(item=>item.question===question),question);
  await page.locator('#openQuestionBank').click();
  await page.locator('[data-bank-id="2025-i-18"]').click();
  await page.locator('[data-bank-action="practice"]').click();
  await page.locator('[data-inspector-view="lesson"]').click();
  const original=await snapshot(),question=original.question;
  const part=page.locator('#solution .part-body');
  await page.locator('[data-study-part="202"]').click();
  await part.locator('[data-classroom-step="next"]').click();
  await page.locator('#startClassroom').click();
  assert.equal(await page.locator('#classroomPart').inputValue(),'202');
  await page.locator('#classroomLocateStep').click();
  assert((await page.evaluate(()=>window.DongBoardStep.snapshot()?.ids)).some(id=>/locus.*circle/.test(id)));
  await page.locator('#exitClassroom').click();

  // Hide an auxiliary line and drag P on its punctured circle.
  await page.locator('[data-inspector-view="geometry"]').click();
  const scene=()=>page.evaluate(()=>JSON.parse(document.querySelector('#sceneJson').value));
  const initial=await scene();
  const ray=initial.objects.find(item=>item.op==='ray'&&item.part!==201);
  assert(ray);
  const layer=page.locator('#layers label').filter({hasText:ray.label}).locator('input');
  await layer.uncheck();
  await page.locator('#homeButton').click();
  const locate=await page.evaluate(()=>{
    const box=document.querySelector('#canvas').getBoundingClientRect(),s=JSON.parse(document.querySelector('#sceneJson').value);
    const circle=s.objects.find(item=>item.kind==='circle'&&item.role==='derived_locus');
    const driver=s.objects.find(item=>item.op==='point_on'&&item.label==='P');
    const scale=Math.max(10.5/box.width,(2*(Math.abs(circle.k)+1.3*circle.r))/box.height);
    const screen=(x,y)=>({x:box.left+box.width/2+x/scale,y:box.top+box.height/2-y/scale});
    return {from:screen(circle.h+circle.r*Math.cos(driver.t),circle.k+circle.r*Math.sin(driver.t)),
      to:screen(circle.h+circle.r,circle.k),t:driver.t};
  });
  await page.mouse.move(locate.from.x,locate.from.y);
  await page.mouse.down();
  await page.mouse.move(locate.to.x,locate.to.y,{steps:12});
  await page.mouse.up();
  const moved=await scene(),driver=moved.objects.find(item=>item.op==='point_on'&&item.label==='P');
  assert(Math.abs(driver.t-locate.t)>.1,'Constrained point moved on the real board');
  const geometry=await page.evaluate(s=>{
    const engine=window.DongSceneAudit.frame(s,window.DongConstruct).engine;
    const P=engine.resolveNamedPoint('P'),R=engine.resolveNamedPoint('R'),A=engine.resolveNamedPoint('A');
    return {circle:P.x**2+(P.y+4)**2,product:Math.hypot(P.x-A.x,P.y-A.y)*Math.hypot(R.x-A.x,R.y-A.y)};
  },moved);
  assert(Math.abs(geometry.circle-18)<1e-7&&Math.abs(geometry.product-3)<1e-7);

  await page.locator('[data-inspector-view="lesson"]').click();
  await page.locator('#startClassroom').click();
  await page.locator('#classroomSave').click();
  await page.waitForFunction(()=>document.querySelector('#classroomFeedback').textContent.includes('已保存'));
  const saved=await record(question);
  assert.equal(saved.activePart,202);
  assert.equal(saved.scene.objects.find(item=>item.id===driver.id).t,driver.t);
  assert.equal(saved.scene.objects.find(item=>item.id===ray.id).visible,false);
  assert.equal(saved.solution.study.counts[202],1);
  await page.locator('#exitClassroom').click();

  await page.locator('#openQuestionBank').click();
  await page.locator('[data-bank-id="2022-beijing-10"]').click();
  await page.locator('[data-bank-action="full"]').click();
  assert.notEqual(await page.locator('#question').inputValue(),question);
  const savedId=(await record(question)).id;
  await page.locator('#openNotebook').click();
  const savedRow=page.locator('.notebook-entry').filter({has:page.locator(`[data-open-lesson="${savedId}"]`)});
  await savedRow.locator('[data-resume-lecture]').click();
  await page.locator('#notebookDialog').waitFor({state:'hidden'});
  assert(await page.locator('#classroomBar').isVisible(),'The notebook resumes lecture mode directly');
  const restored=await snapshot();
  assert.equal(restored.question,question);
  assert.equal(restored.activePart,202);
  assert.equal(restored.scene.objects.find(item=>item.id===driver.id).t,driver.t);
  assert.equal(restored.scene.objects.find(item=>item.id===ray.id).visible,false);
  assert.equal(restored.solution.study.counts[202],1);

  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-mobile-panel="lesson"]').click();
  await page.locator('#classroomLocateStep').click();
  assert.equal(await page.locator('.workspace').getAttribute('data-mobile-view'),'board');
  assert.equal(await page.locator('#classroomPart').inputValue(),'202');
  assert.match(await page.locator('#classroomProgress').textContent(),/^1 \/ /);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await screenshot('lecture-resume-mobile.png',null);
};

module.exports=async({page,assert,screenshot})=>{
  await page.locator('#openQuestionBank').click();await page.locator('#bankList button').first().waitFor();
  for(const id of ['2022-beijing-12','2023-ii-5','2023-ii-10','2024-ii-3']){
    await page.locator(`[data-bank-id="${id}"]`).click();
    assert.equal(await page.locator('#bankDetail .katex-error').count(),0);
    await page.locator('[data-bank-action="full"]').click();
    assert.match(await page.locator('#solution').innerText(),/题库参考讲解/);
    assert.doesNotMatch(await page.locator('#solution .solve-review').innerText(),/尚未生成/);
    assert.equal(await page.locator('#solution .katex-error').count(),0);
    assert(JSON.parse(await page.locator('#sceneJson').inputValue()).referenceScene);
    await page.locator('#openQuestionBank').click();
  }
  await page.locator('[data-bank-id="2022-beijing-19-1"]').click();
  assert.match(await page.locator('#bankDetail').innerText(),/完整题目/);
  await page.locator('[data-bank-action="full"]').click();
  assert.match(await page.locator('#solution .solve-review').innerText(),/2\/2/);
  await page.locator('[data-study-part="2"]').click();
  assert.match((await page.locator('#solution').innerText()).replace(/\s/g,''),/k=-4|k=−4/);
  const completeScene=JSON.parse(await page.locator('#sceneJson').inputValue());
  for(const label of ['M','N'])assert(completeScene.objects.some(o=>o.label===label&&o.op==='intersection'));
  assert.equal(await page.locator('#solution .katex-error').count(),0);
  await page.locator('#openQuestionBank').click();
  await page.locator('[data-bank-id="2023-ii-5"]').click();await page.locator('[data-bank-action="full"]').click();
  const original=await page.locator('#sceneJson').inputValue();
  const normal=(await page.locator('.inspect').boundingBox()).width;
  await page.locator('#readingLayoutToggle').click();
  assert.equal(await page.locator('#readingLayoutToggle').getAttribute('aria-pressed'),'true');
  assert((await page.locator('.inspect').boundingBox()).width>normal+150);
  assert(await page.locator('.controls').isHidden());assert(await page.locator('.board-shell').isVisible());
  for(const width of [1366,1024,800]){await page.setViewportSize({width,height:768});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));}
  await screenshot('reading-priority.png',null);
  await page.locator('#readingLayoutToggle').click();assert(await page.locator('.controls').isVisible());assert.equal(await page.locator('#sceneJson').inputValue(),original);
  await page.setViewportSize({width:390,height:844});await page.locator('[data-mobile-panel="lesson"]').click();assert(await page.locator('#readingLayoutToggle').isHidden());assert(await page.locator('#solution').isVisible());
};

module.exports=async({page,assert,screenshot})=>{
  const response=await page.request.get(new URL('autumn-study.webp',page.url()).href);assert.equal(response.status(),200);assert((await response.body()).length<300000,'Painting is compressed for mobile loading');
  const style=await page.evaluate(()=>({art:getComputedStyle(document.body,'::before').backgroundImage,pointer:getComputedStyle(document.body,'::before').pointerEvents,accent:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()}));
  assert.match(style.art,/autumn-study.webp/);assert.equal(style.pointer,'none');assert.equal(style.accent,'#a34239');
  assert.equal(await page.locator('#openGeoGebraInline').isVisible(),false,'No second drawing destination');
  await page.locator('#sceneJson').evaluate(el=>{el.value=JSON.stringify({type:'ellipse',a:3,b:2,showDynamic:true,lineThrough:'center',theta:35});document.querySelector('#applyJson').click();});
  await screenshot('autumn-desktop.png',null);
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});await page.locator('[data-mobile-panel="input"]').click();
    assert(await page.evaluate(()=>{const b=document.querySelector('#solveButton'),range=document.createRange();range.selectNodeContents(b);const text=range.getBoundingClientRect(),box=b.getBoundingClientRect();return text.left>=box.left&&text.right<=box.right;}),'Solve label stays legible');
    await screenshot('autumn-input-'+width+'.png',null);
    await page.locator('[data-mobile-panel="board"]').click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await page.locator('#canvas').isVisible());
    assert(!await page.locator('.board-shell').evaluate(el=>getComputedStyle(el).backgroundImage.includes('autumn-study')),'No painting inside mathematical canvas');
    await screenshot('autumn-mobile-'+width+'.png',null);
  }
  await page.emulateMedia({media:'print'});assert.equal(await page.evaluate(()=>getComputedStyle(document.body,'::before').display),'none');await page.emulateMedia({media:'screen'});
};

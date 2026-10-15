module.exports=async({page,assert,screenshot})=>{
  const response=await page.request.get(new URL('autumn-background.svg',page.url()).href);
  assert.equal(response.status(),200);assert.match(await response.text(),/Original decorative artwork/);
  const style=await page.evaluate(()=>({bg:getComputedStyle(document.body).backgroundImage,art:getComputedStyle(document.body,'::before').backgroundImage,pointer:getComputedStyle(document.body,'::before').pointerEvents,accent:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()}));
  assert.match(style.bg,/gradient/);assert.match(style.art,/autumn-background/);assert.equal(style.pointer,'none');assert.equal(style.accent,'#a34239');
  await page.locator('#sceneJson').evaluate(el=>{el.value=JSON.stringify({type:'ellipse',a:3,b:2,showDynamic:true,lineThrough:'center',theta:35});document.querySelector('#applyJson').click();});
  await screenshot('autumn-desktop.png',null);
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});await page.locator('[data-mobile-panel="board"]').click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert(await page.locator('#canvas').isVisible());
    await screenshot('autumn-mobile-'+width+'.png',null);
  }
  await page.emulateMedia({media:'print'});assert.equal(await page.evaluate(()=>getComputedStyle(document.body,'::before').display),'none');
  await page.emulateMedia({media:'screen'});
};

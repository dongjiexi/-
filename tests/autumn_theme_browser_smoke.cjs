module.exports=async({page,assert,screenshot})=>{
  const response=await page.request.get(new URL('autumn-study.webp',page.url()).href);assert.equal(response.status(),200);assert((await response.body()).length<300000,'Painting is compressed for mobile loading');
  const style=await page.evaluate(()=>({art:getComputedStyle(document.body,'::before').backgroundImage,pointer:getComputedStyle(document.body,'::before').pointerEvents,accent:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()}));
  assert(!style.art.includes('autumn-study.webp'),'No painting hidden beneath opaque panels');assert.equal(style.pointer,'none');assert.equal(style.accent,'#a34239');
  assert.match(await page.locator('.topbar').evaluate(el=>getComputedStyle(el).backgroundImage),/autumn-study.webp/);
  assert.match(await page.locator('.controls>.panel-heading').evaluate(el=>getComputedStyle(el,'::after').backgroundImage),/autumn-study.webp/);
  assert.equal(await page.locator('#openGeoGebraInline').isVisible(),false,'No second drawing destination');
  await page.locator('#sceneJson').evaluate(el=>{el.value=JSON.stringify({type:'ellipse',a:3,b:2,showDynamic:true,lineThrough:'center',theta:35});document.querySelector('#applyJson').click();});
  await screenshot('autumn-desktop.png',null);
  for(const [width,height]of [[1920,1080],[1366,768],[1280,720],[1024,768]]){
    await page.setViewportSize({width,height});
    assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1&&document.documentElement.scrollWidth<=innerWidth+1),'Desktop page fits viewport');
    const board=await page.locator('.board-shell').boundingBox();assert(board.y+board.height<=height,'Entire board stays in viewport');
    await page.locator('.controls').evaluate(el=>{el.scrollTop=el.scrollHeight});assert(await page.locator('.controls').evaluate(el=>el.scrollTop>0),'Long input column remains independently scrollable');
    await page.mouse.wheel(0,700);assert.equal(await page.evaluate(()=>scrollY),0);
  }
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

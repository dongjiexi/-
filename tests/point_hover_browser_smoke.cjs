module.exports=async({page,assert,screenshot})=>{
  const scene={type:'circle',r:4,h:0,k:0,points:{},showConic:false,showFeatures:false,showDynamic:false,dynamicLine:false,isFreeBoard:true,lines:[],objects:[
    {id:'origin',kind:'point',label:'P',x:0,y:0,visible:true},
    {id:'remote',kind:'point',label:'N₁′',x:8,y:3,visible:true},
    {id:'mid',kind:'construction',op:'midpoint',label:'M',refs:['origin','remote'],visible:true},
    {id:'hidden',kind:'point',label:'H',x:0,y:3,visible:false},
    {id:'invalid',kind:'construction',op:'intersection',label:'U',refs:['parallel-a','parallel-b'],visible:true},
    {id:'parallel-a',kind:'line',m:0,b:1,visible:false},
    {id:'parallel-b',kind:'line',m:0,b:2,visible:false}
  ]};
  await page.locator('#sceneJson').evaluate((element,value)=>{element.value=value;document.querySelector('#applyJson').click();},JSON.stringify(scene));
  const canvas=page.locator('#canvas');
  await page.locator('#homeButton').click();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const box=await canvas.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.locator('#pointHoverCard').waitFor({state:'visible'});
  assert.match(await page.locator('#pointHoverCard').getAttribute('aria-label'),/P\(0, 0\)/,'Hover card must expose point name and coordinates');
  assert.equal(await page.locator('#pointHoverCard .katex').count()>0,true,'Point coordinates must be rendered with KaTeX');
  await page.mouse.move(box.x+5,box.y+5);
  assert.equal(await page.locator('#pointHoverCard').isHidden(),true);

  await page.setViewportSize({width:320,height:720});
  await page.locator('[data-mobile-panel="board"]').click();
  for(let i=0;i<5;i++)await page.locator('#zoomIn').click();
  const original=await page.locator('#sceneJson').inputValue();
  const manager=page.locator('#objectManagerDialog'),search=page.locator('#boardObjectSearch');
  await page.locator('#openObjectManager').click();
  assert(await manager.getByRole('button',{name:'定位 H',exact:true}).isDisabled(),'Hidden point stays hidden');
  assert(await manager.getByRole('button',{name:'定位 U',exact:true}).isDisabled(),'Undefined point cannot be located');
  await search.fill("n_1'");
  assert(await manager.getByRole('button',{name:'定位 N₁′',exact:true}).isVisible(),'Search normalizes subscripts and primes');
  await manager.locator('[data-object-id="mid"][data-object-action="select"]').click();
  assert.match(await manager.locator('#nativeInspector').innerText(),/依赖：P、N₁′/);
  await manager.getByRole('button',{name:'定位 N₁′',exact:true}).click();
  const marker=page.locator('#nativePointLocator'),value=page.locator('#locatedPointValue');
  await marker.waitFor();
  assert(await manager.isHidden());
  assert.equal(await value.getAttribute('aria-label'),'N₁′(8, 3)');
  assert.equal(await value.locator('.katex').count(),1);
  const centered=await marker.evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top),w:el.parentElement.clientWidth,h:el.parentElement.clientHeight}));
  assert(Math.abs(centered.x-centered.w/2)<2&&Math.abs(centered.y-centered.h/2)<2,'Offscreen point is centered without moving the geometry');
  assert.equal(await page.locator('#sceneJson').inputValue(),original);
  assert(await page.locator('#undoDrag').isDisabled());
  await screenshot('located-point-mobile.png',null);
  const dragFrom=await marker.boundingBox();
  const dx=dragFrom.x+dragFrom.width/2,dy=dragFrom.y+dragFrom.height/2;
  await page.mouse.move(dx,dy);await page.mouse.down();await page.mouse.move(dx-20,dy+15,{steps:4});await page.mouse.up();
  assert.notEqual(await value.getAttribute('aria-label'),'N₁′(8, 3)','Located coordinates update as the point moves');
  await page.locator('#clearLocatedPoint').click();
  assert(await marker.isHidden());
  assert(await page.locator('#locatedPoint').isHidden());
  console.log('PASS hover and mobile point locator, exact coordinates, name/dependency search, hidden and undefined points, and live movement.');
};

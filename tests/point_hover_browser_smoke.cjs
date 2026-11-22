module.exports=async({page,context,assert,screenshot})=>{
  await context.addInitScript(()=>{
    let learning;
    Object.defineProperty(window,'DongLearning',{
      get:()=>learning,
      set(value){
        learning=value;
        const attach=value.attach;
        value.attach=api=>{window.__pointHoverTest=api;return attach(api);};
      }
    });
  });
  await page.reload({waitUntil:'domcontentloaded'});
  const viewport=()=>page.evaluate(()=>({...window.__pointHoverTest.state.view}));
  const near=(actual,expected,message)=>assert(Math.abs(actual-expected)<1e-7*(1+Math.abs(expected)),message);
  const sameZoom=(actual,expected)=>{
    near(actual.xmax-actual.xmin,expected.xmax-expected.xmin,'Locating and recentering preserve the horizontal zoom');
    near(actual.ymax-actual.ymin,expected.ymax-expected.ymin,'Locating and recentering preserve the vertical zoom');
  };
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
  const zoomed=await viewport();
  const manager=page.locator('#objectManagerDialog'),search=page.locator('#boardObjectSearch');
  const inspector=manager.locator('#nativeInspector'),heading=inspector.locator('[data-object-heading]');
  await page.locator('#openObjectManager').click();
  assert(await manager.getByRole('button',{name:'定位 H',exact:true}).isDisabled(),'Hidden point stays hidden');
  assert(await manager.getByRole('button',{name:'定位 U',exact:true}).isDisabled(),'Undefined point cannot be located');
  await search.fill("n_1'");
  assert(await manager.getByRole('button',{name:'定位 N₁′',exact:true}).isVisible(),'Search normalizes subscripts and primes');
  await manager.locator('[data-object-id="mid"][data-object-action="select"]').click();
  assert.equal(await heading.textContent(),'M');
  assert.deepEqual(await inspector.getByRole('group',{name:'查看依赖',exact:true}).locator('[data-related-object]').evaluateAll(buttons=>buttons.map(button=>button.dataset.relatedObject)),['origin','remote']);
  await inspector.locator('[data-related-object="origin"]').click();
  assert.equal(await heading.textContent(),'P','A dependency link selects its source point');
  assert.match(await inspector.locator('[data-live-equation]').textContent(),/\(0, 0\)/);
  assert.equal(await search.inputValue(),"n_1'",'Navigating dependencies preserves the search');
  assert.equal(await manager.locator('[data-object-id="origin"][data-object-action="select"]').count(),0,'The inspector can select a source excluded by the list filter');
  await inspector.getByRole('group',{name:'依赖此对象的构造',exact:true}).locator('[data-related-object="mid"]').click();
  assert.equal(await heading.textContent(),'M','The source links back to the construction that uses it');
  await inspector.locator('[data-related-object="remote"]').click();
  assert.equal(await heading.textContent(),'N₁′');
  await inspector.getByRole('group',{name:'依赖此对象的构造',exact:true}).locator('[data-related-object="mid"]').click();
  assert.equal(await heading.textContent(),'M');
  await search.fill('no-matching-object');
  assert.equal(await manager.locator('#boardObjects [data-object-action="select"]').count(),0);
  await inspector.locator('[data-related-object="remote"]').click();
  assert.equal(await heading.textContent(),'N₁′','Dependency navigation works even when the object list has no matches');
  assert.equal(await search.inputValue(),'no-matching-object');
  await inspector.getByRole('button',{name:'在画板上定位',exact:true}).click();
  const marker=page.locator('#nativePointLocator'),value=page.locator('#locatedPointValue');
  const recenter=page.locator('#recenterLocatedPoint');
  await marker.waitFor();
  assert(await manager.isHidden());
  assert.equal(await value.getAttribute('aria-label'),'N₁′(8, 3)');
  assert.equal(await value.locator('.katex').count(),1);
  const centered=await marker.evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top),w:el.parentElement.clientWidth,h:el.parentElement.clientHeight}));
  assert(Math.abs(centered.x-centered.w/2)<2&&Math.abs(centered.y-centered.h/2)<2,'Offscreen point is centered without moving the geometry');
  sameZoom(await viewport(),zoomed);
  assert(await recenter.isHidden(),'A centered point does not need a recenter action');
  assert.equal(await page.locator('#sceneJson').inputValue(),original);
  assert(await page.locator('#undoDrag').isDisabled());

  await page.locator('#panMode').click();
  await canvas.scrollIntoViewIfNeeded();
  const panBox=await canvas.boundingBox();
  const pan=async distance=>{
    const x=panBox.x+panBox.width*.12,y=panBox.y+panBox.height*.35;
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(x+panBox.width*distance,y,{steps:6});await page.mouse.up();
  };
  await pan(.44);
  assert(await marker.isVisible(),'A point near the viewport edge still has its locator');
  assert(await recenter.isVisible(),'A point near the viewport edge offers recentering');
  await pan(.3);
  assert(await marker.isHidden(),'Panning away hides the offscreen marker');
  assert(await page.locator('#locatedPoint').isVisible(),'Offscreen points retain their coordinate card');
  assert(await page.locator('#locatedPoint').evaluate(element=>element.hasAttribute('data-outside-view')));
  assert(await recenter.isVisible(),'The offscreen point can be centered again');
  assert.equal(await value.getAttribute('aria-label'),'N₁′(8, 3)','Panning leaves the located point coordinates unchanged');
  sameZoom(await viewport(),zoomed);
  assert.equal(await page.locator('#sceneJson').inputValue(),original,'Panning changes only the viewport');
  await recenter.click();
  await marker.waitFor({state:'visible'});
  const recentered=await marker.evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top),w:el.parentElement.clientWidth,h:el.parentElement.clientHeight}));
  assert(Math.abs(recentered.x-recentered.w/2)<2&&Math.abs(recentered.y-recentered.h/2)<2,'Recenter restores the same point to the middle of the board');
  sameZoom(await viewport(),zoomed);
  assert(await recenter.isHidden());
  assert.equal(await page.locator('#sceneJson').inputValue(),original,'Recenter preserves every scene object and construction dependency');
  assert(await page.locator('#undoDrag').isDisabled(),'Viewport navigation does not add geometry undo entries');
  await screenshot('located-point-mobile.png',null);
  await page.locator('#moveMode').click();
  const dragFrom=await marker.boundingBox();
  const dx=dragFrom.x+dragFrom.width/2,dy=dragFrom.y+dragFrom.height/2;
  await page.mouse.move(dx,dy);await page.mouse.down();await page.mouse.move(dx-20,dy+15,{steps:4});await page.mouse.up();
  assert.notEqual(await value.getAttribute('aria-label'),'N₁′(8, 3)','Located coordinates update as the point moves');
  await page.locator('#clearLocatedPoint').click();
  assert(await marker.isHidden());
  assert(await page.locator('#locatedPoint').isHidden());
  console.log('PASS hover and mobile point locator, bidirectional inspector navigation under search, offscreen recentering with unchanged zoom/scene, hidden and undefined points, and live movement.');
};

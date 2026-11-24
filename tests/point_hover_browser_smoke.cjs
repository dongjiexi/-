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
  const scene={type:'circle',r:4,h:0,k:0,points:{S:[1,-3],'R₂':[-3,-3]},pointParts:{S:[1,2],'R₂':[2]},showConic:false,showFeatures:false,showDynamic:false,dynamicLine:false,isFreeBoard:true,lines:[],objects:[
    {id:'origin',kind:'point',label:'P',x:0,y:0,visible:true},
    {id:'remote',kind:'point',label:'N₁′',x:8,y:3,visible:true},
    {id:'mid',kind:'construction',op:'midpoint',label:'M',refs:['origin','remote'],visible:true},
    {id:'hidden',kind:'point',label:'H',x:0,y:3,visible:false},
    {id:'invalid',kind:'construction',op:'intersection',label:'U',refs:['parallel-a','parallel-b'],visible:true},
    {id:'hidden-invalid',kind:'construction',op:'intersection',label:'V',refs:['parallel-a','parallel-b'],visible:false},
    {id:'parallel-a',kind:'line',m:0,b:1,visible:false},
    {id:'parallel-b',kind:'line',m:0,b:2,visible:false},
    {id:'other-point',kind:'point',label:'W₂',x:-2,y:-2,part:2,visible:true},
    {id:'other-hidden',kind:'point',label:'H₂',x:-2,y:2,part:2,visible:false},
    {id:'other-invalid',kind:'construction',op:'intersection',label:'U₂',refs:['parallel-a','parallel-b'],part:2,visible:true}
  ]};
  await page.locator('#sceneJson').evaluate((element,value)=>{element.value=value;document.querySelector('#applyJson').click();},JSON.stringify(scene));
  const setPart=index=>page.evaluate(part=>{const api=window.__pointHoverTest;api.state.activePart=part;api.partChanged();api.render();},index);
  await setPart(1);
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
  const filter=page.locator('#boardObjectFilter'),resetFilters=page.locator('#resetBoardObjectFilters');
  const nativeRows=()=>manager.locator('#boardObjects [data-object-action="select"]').evaluateAll(buttons=>buttons.map(button=>button.dataset.objectId).filter(id=>!id.startsWith('feature:')&&id!=='$conic').sort());
  const expectRows=async(ids,message)=>assert.deepEqual(await nativeRows(),ids.slice().sort(),message);
  const expectFeatures=async(ids,message)=>assert.deepEqual(await manager.locator('#boardObjects [data-object-action="select"]').evaluateAll(buttons=>buttons.map(button=>button.dataset.objectId).filter(id=>id.startsWith('feature:')).sort()),ids.map(name=>'feature:'+name).sort(),message);
  const inspector=manager.locator('#nativeInspector'),heading=inspector.locator('[data-object-heading]');
  await page.locator('#openObjectManager').click();
  assert.equal(await manager.locator('[data-object-id="$dynamic"],[data-object-id="$dynamic2"]').count(),0,'A free board does not acquire built-in dynamic-line rows');
  assert(await manager.getByRole('button',{name:'定位 H',exact:true}).isDisabled(),'Hidden point stays hidden');
  assert(await manager.getByRole('button',{name:'定位 U',exact:true}).isDisabled(),'Undefined point cannot be located');
  const sceneBeforeFilters=await page.evaluate(()=>JSON.stringify(window.__pointHoverTest.sceneData()));
  const currentIds=['origin','remote','mid','hidden','invalid','hidden-invalid','parallel-a','parallel-b'];
  const allIds=scene.objects.map(object=>object.id);
  assert.equal(await filter.inputValue(),'all');
  await expectRows(allIds,'All objects includes hidden, undefined, and other-part objects');
  await expectFeatures(['O','S','R₂'],'All objects includes shared, other-part, and layer-hidden named features');
  assert(await manager.getByRole('button',{name:'定位 O',exact:true}).isDisabled(),'A hidden built-in center cannot be located');
  assert(await manager.getByRole('button',{name:'定位 R₂',exact:true}).isDisabled(),'A named point belonging to another part cannot be located');
  assert(await manager.getByRole('button',{name:'定位 S',exact:true}).isEnabled(),'A shared named point stays available when the built-in feature layer is hidden');
  assert(await manager.locator('[data-object-id="feature:R₂"][data-object-action="visibility"]').isChecked(),'An inactive part does not change a named point’s visibility checkbox');
  assert.equal(await manager.locator('[data-object-id="feature:O"][data-object-action="visibility"]').isChecked(),false,'The explicitly hidden center has an unchecked visibility checkbox');
  await manager.locator('[data-object-id="feature:O"][data-object-action="select"]').click();
  assert.equal(await heading.textContent(),'O');
  assert.equal(await inspector.getByRole('button',{name:'在画板上定位',exact:true}).count(),0,'Inspecting a hidden center does not offer a point-locate action');
  assert(await page.locator('#nativePointLocator').isHidden());
  assert.deepEqual(await viewport(),zoomed,'Inspecting a hidden point does not recenter the board');
  assert(await resetFilters.isHidden());
  await manager.locator('[data-object-id="feature:R₂"][data-object-action="select"]').focus();
  await filter.selectOption('current');
  await expectRows(currentIds,'Current-part objects includes hidden and undefined objects but excludes other parts');
  await expectFeatures(['O','S'],'Current-part features includes a layer-hidden center but excludes an unrelated named point');
  assert(await filter.evaluate(element=>document.activeElement===element),'Filtering a focused other-part row moves focus to the filter control');
  await manager.locator('[data-object-id="feature:O"][data-object-action="select"]').focus();
  await filter.selectOption('visible');
  await expectRows(['origin','remote','mid'],'Visible objects must be current, shown, and defined');
  await expectFeatures(['S'],'Visible features excludes both a hidden layer and an inactive part');
  assert(await filter.evaluate(element=>document.activeElement===element),'Filtering a focused hidden-layer row does not retain focus on an excluded row');
  await filter.selectOption('hidden');
  await expectRows(['hidden','hidden-invalid','parallel-a','parallel-b'],'Hidden objects includes only current objects explicitly hidden');
  await expectFeatures(['O'],'An out-of-part named point is not mistaken for a layer-hidden feature');
  await search.fill('h');
  await expectRows(['hidden'],'Search combines with the hidden filter and excludes a matching name from another part');
  await search.fill('');
  await filter.selectOption('undefined');
  await expectRows(['invalid','hidden-invalid'],'Undefined objects includes current hidden invalid objects');
  await expectFeatures([],'Defined built-in and named points do not appear as undefined');
  await search.fill('u');
  await expectRows(['invalid'],'Undefined and name filters combine without including undefined objects from another part');
  await search.fill("n_1'");
  await filter.selectOption('hidden');
  await expectRows([],'A name matching visible objects does not bypass the hidden filter');
  assert(await resetFilters.isVisible(),'No matching objects offers a filter reset');
  await resetFilters.click();
  assert.equal(await filter.inputValue(),'all','Reset clears the object-state filter');
  assert.equal(await search.inputValue(),'','Reset clears the text search');
  await expectRows(allIds,'Reset restores the complete object list');
  await expectFeatures(['O','S','R₂'],'Reset also restores every feature row');
  assert(await resetFilters.isHidden());
  await filter.selectOption('current');
  await setPart(2);
  await expectRows(allIds,'The second part includes its own native objects and shared objects');
  await expectFeatures(['O','S','R₂'],'The shared named point belongs to both parts');
  await filter.selectOption('visible');
  await expectRows(['origin','remote','mid','other-point'],'Switching parts updates native visible rows');
  await expectFeatures(['S','R₂'],'The second part makes its named point visible without exposing the hidden center');
  assert(await manager.getByRole('button',{name:'定位 R₂',exact:true}).isEnabled(),'A named point becomes locatable only in a part that contains it');
  await filter.selectOption('hidden');
  await expectFeatures(['O'],'Part switching preserves the explicit hidden feature layer');
  await setPart(1);
  await filter.selectOption('all');
  await expectFeatures(['O','S','R₂']);
  assert.equal(await page.locator('#sceneJson').inputValue(),original,'Filtering does not change the serialized scene');
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__pointHoverTest.sceneData())),sceneBeforeFilters,'Filtering never changes object visibility, geometry, part scopes, or dependencies');
  assert(await page.locator('#undoDrag').isDisabled(),'Filtering does not create a geometry undo entry');
  sameZoom(await viewport(),zoomed);
  await filter.selectOption('visible');
  await search.fill("n_1'");
  await expectRows(['remote','mid'],'Visible objects can be searched by normalized names and dependency names');
  assert(await manager.getByRole('button',{name:'定位 N₁′',exact:true}).isVisible(),'Search normalizes subscripts and primes');
  await manager.locator('[data-object-id="mid"][data-object-action="select"]').click();
  assert.equal(await heading.textContent(),'M');
  assert.deepEqual(await inspector.getByRole('group',{name:'查看依赖',exact:true}).locator('[data-related-object]').evaluateAll(buttons=>buttons.map(button=>button.dataset.relatedObject)),['origin','remote']);
  await inspector.locator('[data-related-object="origin"]').click();
  assert.equal(await heading.textContent(),'P','A dependency link selects its source point');
  assert.match(await inspector.locator('[data-live-equation]').textContent(),/\(0, 0\)/);
  await inspector.getByRole('button',{name:'返回 M',exact:true}).click();
  assert.equal(await heading.textContent(),'M');
  assert.equal(await inspector.getByRole('button',{name:/^返回 /}).count(),0);
  await inspector.locator('[data-related-object="origin"]').click();
  assert.equal(await search.inputValue(),"n_1'",'Navigating dependencies preserves the search');
  assert.equal(await filter.inputValue(),'visible','Navigating dependencies preserves the object-state filter');
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

  const pairedScene={type:'circle',r:4,h:0,k:0,theta:35,theta2:120,lineThrough:'center',showConic:true,showFeatures:false,showDynamic:true,dynamicLine:true,dynamicLineLabel:'l₁',dynamicLinePart:1,dynamicIntersectionLabels:['A','B'],pairedChord:{labels:['C','D'],lineLabel:'l₂',part:2,visible:true},points:{},lines:[],objects:[]};
  const pickObject=id=>manager.locator(`[data-object-id="${id}"][data-object-action="select"]`);
  const visibility=id=>manager.locator(`[data-object-id="${id}"][data-object-action="visibility"]`);
  const expectDynamicRows=async(ids,message)=>assert.deepEqual(await manager.locator('#boardObjects [data-object-action="select"]').evaluateAll(buttons=>buttons.map(button=>button.dataset.objectId).filter(id=>id==='$dynamic'||id==='$dynamic2').sort()),ids.slice().sort(),message);
  const loadPaired=async(model,part)=>{
    if(await manager.isVisible())await page.locator('#closeObjectManager').click();
    await page.locator('[data-mobile-panel="board"]').click();
    await page.locator('#sceneJson').evaluate((element,value)=>{element.value=value;document.querySelector('#applyJson').click();},JSON.stringify(model));
    await setPart(part);
    await page.locator('#openObjectManager').click();
    await search.fill('');await filter.selectOption('all');
  };
  const sceneSnapshot=()=>page.evaluate(()=>JSON.stringify(window.__pointHoverTest.sceneData()));
  await loadPaired(pairedScene,1);
  const pairedOriginal=await page.locator('#sceneJson').inputValue(),pairedSnapshot=await sceneSnapshot();
  await expectDynamicRows(['$dynamic','$dynamic2'],'All objects exposes both named built-in lines regardless of part');
  assert.equal(await pickObject('$dynamic').textContent(),'l₁');
  assert.equal(await pickObject('$dynamic2').textContent(),'l₂');
  for(const id of ['$dynamic','$dynamic2']){
    assert(await visibility(id).isDisabled(),'Built-in line visibility is read-only in the object list');
    assert(await visibility(id).isChecked(),'Part membership does not change the line layer checkbox');
  }
  await filter.selectOption('current');
  await expectDynamicRows(['$dynamic'],'The primary line belongs to part 1; the secondary also needs its own part scope');
  await expectFeatures(['O','A','B']);
  await filter.selectOption('visible');
  await expectDynamicRows(['$dynamic']);
  await expectFeatures(['A','B'],'Only intersections of the visible primary line are locatable in part 1');
  await filter.selectOption('hidden');
  await expectDynamicRows([],'An out-of-part secondary line is not reported as hidden');
  await setPart(2);
  await filter.selectOption('current');
  await expectDynamicRows([],'The secondary line still requires the primary line to belong to the current part');
  await expectFeatures(['O'],'Secondary intersections inherit both parent and secondary part scopes');
  await filter.selectOption('visible');
  await expectDynamicRows([]);
  await expectFeatures([]);
  await filter.selectOption('all');
  assert(await manager.getByRole('button',{name:'定位 C',exact:true}).isDisabled(),'Matching only the secondary scope cannot locate its intersection');
  assert(await manager.getByRole('button',{name:'定位 D',exact:true}).isDisabled());
  await setPart(null);
  await filter.selectOption('visible');
  await expectDynamicRows(['$dynamic','$dynamic2'],'Combined view displays both scoped lines');
  await expectFeatures(['A','B','C','D']);
  await filter.selectOption('all');
  const relations=label=>inspector.getByRole('group',{name:label,exact:true});
  for(const [lineId,lineLabel,names] of [['$dynamic','l₁',['A','B']],['$dynamic2','l₂',['C','D']]]){
    for(const name of names){
      await pickObject('feature:'+name).click();
      assert.equal(await heading.textContent(),name);
      assert.deepEqual(await relations('查看依赖').locator('[data-related-object]').evaluateAll(buttons=>buttons.map(button=>button.dataset.relatedObject).sort()),[lineId,'$conic'].sort(),'Each built-in intersection identifies its own line and the primary conic');
      await relations('查看依赖').locator(`[data-related-object="${lineId}"]`).click();
      assert.equal(await heading.textContent(),lineLabel);
      assert.deepEqual(await relations('依赖此对象的构造').locator('[data-related-object^="feature:"]').evaluateAll(buttons=>buttons.map(button=>button.dataset.relatedObject).sort()),names.map(value=>'feature:'+value).sort(),'Each built-in line links back to its own defined intersection points');
      await relations('依赖此对象的构造').locator(`[data-related-object="feature:${name}"]`).click();
      assert.equal(await heading.textContent(),name,'The source line navigates back to the selected intersection');
      await relations('查看依赖').locator('[data-related-object="$conic"]').click();
      assert.equal(await heading.textContent(),'主圆锥曲线');
    }
  }
  await pickObject('$dynamic2').click();
  assert.equal(await inspector.getByRole('textbox',{name:'对象名称',exact:true}).count(),0,'Built-in lines do not expose native-object renaming');
  await inspector.getByRole('button',{name:'调节动直线角度',exact:true}).click();
  assert(await manager.isHidden());
  assert.equal(await page.locator('#parameterTarget').inputValue(),'$dynamic','The secondary line uses the existing moving-line parameter target');
  await page.waitForFunction(()=>document.activeElement?.matches('#params input[data-key="theta2"][data-param-expression]'),null,{timeout:5000});
  assert.equal(await page.locator('#params input[data-key="theta2"][data-param-expression]').inputValue(),'120','The secondary-line shortcut focuses its own angle without changing it');
  await setPart(1);
  assert.equal(await page.locator('#sceneJson').inputValue(),pairedOriginal,'Part browsing and source navigation leave the paired-chord scene unchanged');
  assert.equal(await sceneSnapshot(),pairedSnapshot);
  assert(await page.locator('#undoDrag').isDisabled(),'Built-in relationship navigation adds no geometry undo entries');

  const globalPaired={...pairedScene,dynamicLinePart:null,pairedChord:{...pairedScene.pairedChord,part:null}};
  for(const [model,visibleLines,hiddenLines,visiblePoints,hiddenPoints] of [
    [{...globalPaired,pairedChord:{...globalPaired.pairedChord,visible:false}},['$dynamic'],['$dynamic2'],['A','B'],['O','C','D']],
    [{...globalPaired,showConic:false},['$dynamic','$dynamic2'],[],[],['O','A','B','C','D']],
    [{...globalPaired,showDynamic:false,dynamicLine:false},[],['$dynamic','$dynamic2'],[],['O','A','B','C','D']]
  ]){
    await loadPaired(model,null);
    const originalVariant=await page.locator('#sceneJson').inputValue(),variantSnapshot=await sceneSnapshot();
    await filter.selectOption('visible');
    await expectDynamicRows(visibleLines,'Built-in line visibility follows the primary and secondary line layers');
    await expectFeatures(visiblePoints,'Intersection-point visibility also requires the primary conic layer');
    await filter.selectOption('hidden');
    await expectDynamicRows(hiddenLines);
    await expectFeatures(hiddenPoints);
    for(const name of hiddenPoints)assert(await manager.getByRole('button',{name:'定位 '+name,exact:true}).isDisabled(),'A hidden feature cannot be located through the object manager');
    assert.equal(await page.locator('#sceneJson').inputValue(),originalVariant);
    assert.equal(await sceneSnapshot(),variantSnapshot,'Filtering built-in lines never rewrites visibility, angles, scopes, or dependencies');
    assert(await page.locator('#undoDrag').isDisabled());
  }
  await screenshot('built-in-line-relations-mobile.png',null);
  console.log('PASS hover and mobile point locator, native/feature/built-in line scope and visibility filters, bidirectional intersection/source navigation and angle shortcut, scene nonmutation, safe focus, offscreen recentering, hidden and undefined points, and live movement.');
};

module.exports=async({page,context,assert,screenshot})=>{
  await page.evaluate(async()=>{for(const sw of await navigator.serviceWorker.getRegistrations())await sw.unregister();for(const key of await caches.keys())await caches.delete(key);});
  await context.route('**/runtime-config.js',route=>route.fulfill({contentType:'application/javascript',body:`window.DONGJIEXI_CONFIG=Object.freeze({version:'0.23.1',deployment:'web',apiBase:'',apiEnabled:false,requiresAuth:false});`}));
  await context.addInitScript(()=>{
    let construct;
    Object.defineProperty(window,'DongConstruct',{configurable:true,get:()=>construct,set:value=>{
      construct=value;const attach=value.attach;
      value.attach=api=>{const controller=attach(api);window.__curvePointTest={api,controller};return controller;};
    }});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#toolboxToggle').click();
  const scene=async()=>JSON.parse(await page.locator('#sceneJson').inputValue());
  await page.locator('#question').fill('已知椭圆x²/9+y²/4=1，求焦点坐标和离心率。');
  await page.locator('#solveButton').click();
  await page.waitForFunction(()=>document.querySelector('#solution').textContent.includes('离心率')&&JSON.parse(document.querySelector('#sceneJson').value).type==='ellipse');
  const originalQuestion=await page.locator('#question').inputValue(),originalSolution=await page.locator('#solution .part-body').allTextContents();
  await page.locator('[data-inspector-view="geometry"]').click();
  const model={type:'ellipse',a:3,b:2,h:0,k:0,orientation:'horizontal',showConic:true,showFeatures:true,showDynamic:false,points:{},lines:[],objects:[]};
  async function install(data){await page.locator('#sceneJson').evaluate((el,value)=>{el.value=value;document.querySelector('#applyJson').click();},JSON.stringify(data));await page.locator('#homeButton').click();}
  await install(model);
  let box=await page.locator('#canvas').boundingBox(),scale=Math.max(10.5/box.width,7.6/box.height);
  const xy=(x,y)=>({x:box.x+box.width/2+x/scale,y:box.y+box.height/2-y/scale});
  const click=async(x,y)=>{const p=xy(x,y);await page.mouse.click(p.x,p.y);};
  const move=async(x,y)=>{const p=xy(x,y);await page.mouse.move(p.x,p.y);};
  const constructed=async op=>(await scene()).objects.filter(o=>o.op===op);
  // Geometry-only protocol fixture; no fabricated exam or AI accuracy claim.
  await install({...model,showConic:false,showFeatures:false,objects:[{id:'ga',kind:'point',label:'U',x:-2,y:0},{id:'gb',kind:'point',label:'V',x:2,y:0},{id:'gc',kind:'point',label:'W',x:0,y:2}]});
  await page.locator('[data-construct="perp_bisector"]').click();await click(-2,0);await click(2,0);
  assert.deepEqual((await constructed('perp_bisector'))[0].refs,['ga','gb']);
  await page.locator('[data-construct="circumcircle"]').click();await click(-2,0);await click(2,0);await click(0,0);
  assert.equal((await constructed('circumcircle')).length,0);assert.match(await page.locator('#dragHint').innerText(),/共线/);
  await click(0,2);assert.deepEqual((await constructed('circumcircle'))[0].refs,['ga','gb','gc']);
  assert.equal((await scene()).objects.length,5,'Rejected third point does not leave an orphan');
  await page.locator('#moveMode').click();await page.locator('#undoDrag').click();assert.equal((await constructed('circumcircle')).length,0);
  await page.locator('#redoDrag').click();assert.equal((await constructed('circumcircle')).length,1);
  await page.reload();await page.waitForFunction(()=>JSON.parse(document.querySelector('#sceneJson').value).objects?.some(o=>o.op==='circumcircle'));
  if(!await page.locator('[data-construct="tangent"]').isVisible())await page.locator('#toolboxToggle').click();
  await install(model);box=await page.locator('#canvas').boundingBox();scale=Math.max(10.5/box.width,7.6/box.height);
  await page.locator('[data-construct="tangent"]').click();await click(-3,0);
  await move(3/Math.sqrt(2),Math.sqrt(2));assert.match(await page.locator('#snapStatus').innerText(),/切线预览/);
  await click(3/Math.sqrt(2),Math.sqrt(2));
  let tangents=await constructed('tangent');assert.equal(tangents.length,1);
  const bound=(await constructed('point_on'))[0];assert.deepEqual(tangents[0].refs,[bound.id,'$conic']);
  await page.locator('[data-construct="normal"]').click();await click(-3,0);await click(3/Math.sqrt(2),Math.sqrt(2));
  assert.deepEqual((await constructed('normal'))[0].refs,[bound.id,'$conic']);
  await page.locator('#moveMode').click();await move(3/Math.sqrt(2),Math.sqrt(2));await page.mouse.down();await move(-3/Math.sqrt(2),Math.sqrt(2));await page.mouse.up();
  const evaluate=async()=>page.evaluate(data=>{
    const curve=window.DongConstruct.conicShape({...data,conicType:data.type});
    const engine=window.DongConstruct.createEngine({model:()=>data,features:()=>Object.entries(data.points||{}).map(([name,[x,y]])=>({name,x,y})),coeffs:()=>curve.q,conicPoint:curve.pointAt,conicProject:curve.project});
    return data.objects.filter(o=>['tangent','normal'].includes(o.op)).map(o=>({id:o.id,...engine.resolve(o.id)}));
  },await scene());
  let [t,n]=await evaluate();assert(t.o.x<0);assert(Math.abs(t.d.x*n.d.x+t.d.y*n.d.y)<1e-9);
  await page.locator('#undoDrag').click();assert((await evaluate())[0].o.x>0);await page.locator('#redoDrag').click();

  // Native circle tangent/normal construction also participates in in-place editing.
  await install({...model,objects:[{id:'c',kind:'circle',h:0,k:0,r:1,label:'C1',source:'user',visible:true}]});
  await page.locator('[data-construct="tangent"]').click();await click(-1,0);await click(Math.SQRT1_2,Math.SQRT1_2);
  const circlePoint=(await constructed('point_on'))[0],circleTangent=(await constructed('tangent'))[0];
  assert.deepEqual(circleTangent.refs,[circlePoint.id,'c']);
  await page.locator('[data-construct="normal"]').click();await click(-1,0);await click(Math.SQRT1_2,Math.SQRT1_2);
  await page.locator('#moveMode').click();
  await page.locator('#openObjectManager').click();
  await page.locator('#boardObjects [data-object-id="c"][data-object-action="select"]').click();
  await page.locator('#objectInspectorSlot #nativeInspector').getByRole('button',{name:'编辑曲线参数',exact:true}).click();
  assert.equal(await page.locator('#addConicType').isDisabled(),true);
  assert.equal(await page.locator('#addConicFields [data-equation-param="r"]').inputValue(),'1');
  await page.locator('#addConicFields [data-equation-param="r"]').fill('2');
  await page.locator('#addConicFields [data-equation-param="h"]').fill('1/2');
  await page.locator('#addConicName').fill('辅助圆');
  const objectCount=(await scene()).objects.length;
  await page.locator('#confirmAddConic').click();await page.locator('#addConicDialog').waitFor({state:'hidden'});
  assert.equal(await page.locator('#objectManagerDialog').evaluate(el=>el.open),true,'Nested curve editor returns to object manager');
  await page.locator('#closeObjectManager').click();
  // Native dialog close events are queued; wait for restoration, not a frame race.
  await page.locator('#nativeInspectorHome #nativeInspector').waitFor({state:'attached'});
  assert.equal(await page.locator('#nativeInspectorHome #nativeInspector').count(),1);
  let edited=await scene();assert.equal(edited.objects.length,objectCount);
  const circle=edited.objects.find(o=>o.id==='c');assert.equal(circle.r,2);assert.equal(circle.h,.5);assert.equal(circle.label,'辅助圆');
  assert.equal(circle.equation,'(x−(1/2))²+y²=4');
  assert.deepEqual(edited.objects.find(o=>o.id===circleTangent.id).refs,[circlePoint.id,'c']);
  [t,n]=await evaluate();assert(Math.abs(Math.hypot(t.o.x-.5,t.o.y)-2)<1e-8);assert(Math.abs(t.d.x*n.d.x+t.d.y*n.d.y)<1e-8);
  await page.locator('#nativeInspector [data-live-equation] .katex').waitFor();
  assert.match(await page.locator('#nativeInspector [data-live-equation]').getAttribute('data-math-source'),/1\/2.*=4/);
  assert.equal(await page.locator('#question').inputValue(),originalQuestion);
  assert.deepEqual(await page.locator('#solution .part-body').allTextContents(),originalSolution,'Manual replacement keeps the original textual answer and steps');
  assert.match(await page.locator('.solve-review').textContent(),/手工图稿.*未确认/,'A manually replaced graph no longer inherits the old diagram checks');
  await page.locator('#undoDrag').click();assert.equal((await scene()).objects.find(o=>o.id==='c').r,1);await page.locator('#redoDrag').click();
  await page.locator('#layers .layer-row').filter({hasText:'辅助圆'}).getByRole('button',{name:'编辑',exact:true}).click();
  await page.locator('#addConicFields [data-equation-param="r"]').fill('0');await page.locator('#confirmAddConic').click();
  assert.match(await page.locator('#addConicError').innerText(),/大于 0/);await page.locator('#cancelAddConic').click();assert.equal((await scene()).objects.find(o=>o.id==='c').r,2);
  const circleEdge=xy(-1.5,0);await page.mouse.dblclick(circleEdge.x,circleEdge.y);
  await page.locator('#addConicDialog').waitFor({state:'visible'});assert.equal(await page.locator('#addConicFields [data-equation-param="r"]').inputValue(),'2');await page.locator('#cancelAddConic').click();
  await screenshot('curve-edit-and-tangent.png',null);

  for(const conicType of ['ellipse','hyperbola','parabola']){
    const curve={id:'edit-case',kind:'conic',conicType,h:0,k:0,a:3,b:2,p:1,direction:-1,orientation:'horizontal',source:'user',label:'编辑样本'};
    const follower={id:'follower',kind:'construction',op:'point_on',refs:['edit-case'],t:.6,source:'user',label:'T'};
    await install({...model,objects:[curve,follower]});
    await page.locator('#layers .layer-row').filter({hasText:'编辑样本'}).getByRole('button',{name:'编辑',exact:true}).click();
    const field=key=>page.locator(`#addConicFields [data-equation-param="${key}"]`);
    await field('h').fill('1/3');await field('k').fill('-2/3');
    if(conicType==='parabola'){assert.equal(await field('direction').inputValue(),'left');await field('direction').selectOption('down');await field('p').fill('1/2');}
    else{await field('orientation').selectOption('vertical');await field('a').fill('√16');await field('b').fill('√4');}
    await page.locator('#confirmAddConic').click();
    const data=await scene(),updated=data.objects.find(o=>o.id==='edit-case');
    assert.equal(updated.orientation,'vertical');assert.equal(updated.h,1/3);assert.equal(updated.k,-2/3);assert.equal(data.objects.length,2);
    const point=await page.evaluate(data=>window.DongConstruct.createEngine({model:()=>data}).resolve('follower'),data);
    assert(point&&Number.isFinite(point.x)&&Number.isFinite(point.y),'编辑方向后依赖点仍可重算');
    if(conicType==='parabola')assert(Math.abs((point.x-updated.h)**2+2*(point.y-updated.k))<1e-8);
    else assert(Math.abs((point.y-updated.k)**2/16+(conicType==='ellipse'?1:-1)*(point.x-updated.h)**2/4-1)<1e-8);
  }

  // Invalid tangent in the answer's lines collection must not disappear silently.
  const derived={...model,points:{P:[0,0]},lines:[{id:'answer',kind:'slope',m:0,b:2,role:'tangent',source:'derived',label:'P 点切线',refs:['feature:P','$conic']}],objects:[]};
  await install(derived);assert.match(await page.locator('#undefinedObjects').innerText(),/P 点切线.*不在曲线上/);
  await install({...derived,points:{P:[0,2]}});assert.equal(await page.locator('#undefinedObjects').innerText(),'','源点恢复到曲线后警告应消失');
  const bad={...model,points:{P:[0,0]}};await install(bad);
  // Dialogs and full-page screenshots can scroll the page; refresh viewport coordinates.
  await page.locator('#canvas').scrollIntoViewIfNeeded();box=await page.locator('#canvas').boundingBox();scale=Math.max(10.5/box.width,7.6/box.height);
  await page.locator('[data-construct="tangent"]').click();box=await page.locator('#canvas').boundingBox();await click(-3,0);await click(0,0);
  assert.equal((await constructed('tangent')).length,0);assert.match(await page.locator('#dragHint').innerText(),/不在所选曲线上/);
  await install(edited);await page.reload();await page.waitForFunction(()=>JSON.parse(document.querySelector('#sceneJson').value).objects?.some(o=>o.id==='c'));
  assert.equal((await scene()).objects.find(o=>o.id==='c').equation,'(x−(1/2))²+y²=4');
  assert.equal((await constructed('normal')).length,1);

  // Keep declared intersection identities when a moving line becomes tangent
  // or disjoint; a missing branch must never receive fabricated coordinates.
  await install({type:'circle',r:1,h:0,k:0,theta:0,lineThrough:'point:P',points:{P:[2,1]},
    showConic:true,showDynamic:true,showFeatures:true,dynamicIntersectionLabels:['A','B'],lines:[],objects:[]});
  await page.locator('[data-inspector-view="geometry"]').click();
  await page.locator('#parameterTarget').selectOption('$dynamic');
  const manager=page.locator('#objectManagerDialog'),filter=page.locator('#boardObjectFilter');
  const selectPoint=name=>manager.locator(`[data-object-id="feature:${name}"][data-object-action="select"]`);
  const locatePoint=name=>manager.locator(`[data-object-id="feature:${name}"][data-object-action="locate"]`);
  const featureRows=()=>manager.locator('[data-object-action="select"][data-object-id^="feature:"]').evaluateAll(buttons=>buttons.map(button=>button.dataset.objectId).sort());
  const actualPoints=()=>page.evaluate(()=>{
    const {api,controller}=window.__curvePointTest;
    return ['A','B'].map(name=>{const point=api.features().find(item=>item.name===name);return{name,finite:!!point&&Number.isFinite(point.x)&&Number.isFinite(point.y),shape:controller.engine.resolve('feature:'+name)};});
  });
  for(const stage of [{angle:0,missing:['B']},{angle:90,missing:['A','B']},{angle:45,missing:[]}]){
    await page.locator('#params input[data-key="theta"][data-param-expression]').fill(String(stage.angle));
    await page.locator('#openObjectManager').click();
    await filter.selectOption('all');
    for(const name of ['A','B']){
      assert.equal(await selectPoint(name).count(),1,'Declared moving points keep their stable object-manager IDs');
      assert.equal(await locatePoint(name).isDisabled(),stage.missing.includes(name),'Only a finite visible intersection can be located');
    }
    await filter.selectOption('undefined');
    assert.deepEqual(await featureRows(),stage.missing.map(name=>'feature:'+name).sort(),'Undefined filter reflects actual tangent/disjoint/secant geometry');
    for(const name of stage.missing){
      await selectPoint(name).click();
      assert.match(await manager.locator('#nativeInspector').innerText(),/没有有限实交点/);
      for(const source of ['$dynamic','$conic']){
        const link=manager.locator(`#nativeInspector [data-related-object="${source}"]`);
        assert.equal(await link.count(),1);assert(await link.isEnabled(),'Missing intersections still expose their defining line and curve');
        await link.click();
        const returnToPoint=manager.locator(`#nativeInspector [data-related-object="feature:${name}"]`);
        assert(await returnToPoint.isEnabled(),'A source links back to its declared but undefined intersection');
        await returnToPoint.click();
        assert.equal(await manager.locator('#nativeInspector [data-object-heading]').textContent(),name);
      }
    }
    for(const point of await actualPoints()){
      assert.equal(point.finite,!stage.missing.includes(point.name));
      if(stage.missing.includes(point.name))assert.equal(point.shape,null,'Absent intersections must not resolve to placeholder coordinates');
    }
    const current=await scene();
    assert.equal(current.points.A,undefined);assert.equal(current.points.B,undefined);
    assert.equal(current.objects.length,0,'Object listing does not write fabricated intersection points into the scene');
    await page.locator('#closeObjectManager').click();
  }
  const recovered=await actualPoints();
  for(const point of recovered){assert(Math.abs(point.shape.x**2+point.shape.y**2-1)<1e-8);assert(Math.abs(point.shape.y-point.shape.x+1)<1e-8);}
  console.log('PASS: tangent/normal motion, in-place curve edits, live equations, undo, persistence and declared moving intersections across tangent/disjoint/secant states without fabricated coordinates.');
};

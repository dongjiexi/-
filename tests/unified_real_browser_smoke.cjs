// Opt-in integration: the actual official GeoGebra app.
module.exports=async({page,assert,screenshot})=>{
  const scene={type:'ellipse',a:3,b:2,showDynamic:false,objects:[{id:'u',kind:'construction',op:'point_on',refs:['$conic'],label:'U',t:.5},{id:'t',kind:'construction',op:'tangent',refs:['u','$conic'],label:'t'}]};
  await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},scene);
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&window.DongGeoGebra.getAPI()?.exists('t'),null,{timeout:100000});
  assert.equal(await page.locator('#openGeoGebraInline').isVisible(),false);
  assert.equal(await page.locator('.dong-ggb-close').isVisible(),false);
  for(const selector of ['.unified-tools','.dong-ggb-tools']){
    await page.locator(selector+' > summary').click();
    const button=page.locator(selector+' > div button:visible').first();
    await button.scrollIntoViewIfNeeded();
    assert(await button.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Open menu must be above the real GeoGebra canvas: '+selector);
    await page.locator(selector+' > summary').click();
  }
  await page.evaluate(()=>{const api=window.DongGeoGebra.getAPI();api.evalCommand('Manual=(7,8)');api.evalCommand('ManualLine=Line(U,Manual)');});
  await page.getByRole('button',{name:'画板设置',exact:true}).click();
  const settings=page.locator('#boardSettings');assert(await settings.isVisible());
  const rect=await settings.boundingBox();assert(rect.width>rect.height,'Desktop settings should be a wide dialog, not a narrow side strip');
  await settings.locator('[data-setting="grid"]').uncheck();assert.equal(await page.evaluate(()=>window.DongGeoGebra.getAPI().getGridVisible(1)),false);
  await settings.locator('[data-setting="x"]').uncheck();
  await settings.locator('[data-setting="object"]').selectOption('ManualLine');await settings.locator('[data-setting="color"]').fill('#a34239');await settings.locator('[data-setting="color"]').dispatchEvent('change');
  assert.equal((await page.evaluate(()=>window.DongGeoGebra.getAPI().getColor('ManualLine'))).toLowerCase(),'#a34239');
  await screenshot('settings-desktop.png',null);await settings.getByRole('button',{name:'完成',exact:true}).click();
  await page.getByRole('button',{name:'画板设置',exact:true}).click();assert.equal(await settings.locator('[data-setting="x"]').isChecked(),false,'Axis state is read from the current applet');
  await settings.locator('[data-setting="x"]').check();await settings.locator('[data-setting="grid"]').check();await settings.getByRole('button',{name:'完成',exact:true}).click();
  await page.locator('#sceneJson').evaluate(el=>{const s=JSON.parse(el.value);s.a=4;el.value=JSON.stringify(s);document.querySelector('#applyJson').click();});
  await page.waitForFunction(()=>window.DongGeoGebra.getAPI().getValue('a')===4);
  assert(await page.evaluate(()=>window.DongGeoGebra.getAPI().isDefined('ManualLine')));
  await page.locator('#sceneJson').evaluate(el=>{const s=JSON.parse(el.value);s.objects.push({id:'extra',kind:'conic',conicType:'ellipse',label:'E2',h:1,k:-2,a:4,b:2,orientation:'vertical'});el.value=JSON.stringify(s);document.querySelector('#applyJson').click();});
  await page.waitForFunction(()=>window.DongGeoGebra.getAPI().exists('E2'));
  assert(await page.evaluate(()=>window.DongGeoGebra.getAPI().isDefined('ManualLine')),'Adding a curve preserves auxiliary dependency commands');
  const residual=await page.evaluate(()=>{const api=window.DongGeoGebra.getAPI();api.evalCommand('CheckDistance=Distance(U,t)');return api.getValue('CheckDistance');});
  assert(Math.abs(residual)<1e-7,'Tangent remains incident on source point');
  await page.evaluate(()=>window.DongGeoGebra.save());
  await page.reload();await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&window.DongGeoGebra.getAPI()?.isDefined('ManualLine'),null,{timeout:100000});
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'保存完整图稿',exact:true}).click();
  const downloaded=await downloadPromise,file=await downloaded.path();
  const saved=JSON.parse(require('node:fs').readFileSync(file,'utf8'));assert.equal(saved.format,'dongjiexi-board');assert(saved.boardDraft.base64);
  await page.locator('#sceneJson').evaluate(el=>{el.value=JSON.stringify({type:'circle',r:2,showDynamic:false,objects:[]});document.querySelector('#applyJson').click();});
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&!window.DongGeoGebra.getAPI().exists('Manual'));
  await page.locator('.dong-ggb-head input[type="file"]').last().setInputFiles(file);
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&window.DongGeoGebra.getAPI().isDefined('ManualLine'),null,{timeout:15000});
  assert.equal(JSON.parse(await page.locator('#sceneJson').inputValue()).type,'ellipse');
  await screenshot('unified-real-desktop.png',null);
  await page.setViewportSize({width:390,height:844});await page.locator('[data-mobile-panel="board"]').click();
  await page.waitForFunction(()=>{const host=document.querySelector('.dong-ggb-host'),frame=host?.querySelector('.GeoGebraFrame');return frame&&frame.getBoundingClientRect().width>=host.clientWidth*.95;});
  await page.getByRole('button',{name:'画板设置',exact:true}).click();assert((await settings.boundingBox()).width<=390);await settings.getByRole('button',{name:'完成',exact:true}).click();
  await page.locator('.unified-tools summary').click();assert(await page.locator('.unified-tool-content').getByRole('button',{name:'收起工具',exact:true}).isVisible());
  await page.locator('.unified-tool-content').getByRole('button',{name:'收起工具',exact:true}).click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await screenshot('unified-real-mobile.png',null);
  await page.locator('#sceneJson').evaluate(el=>{el.value=JSON.stringify({type:'parabola',h:2,k:1,p:1,showDynamic:false,showFeatures:false,points:{N:[4,3]},objects:[]});document.querySelector('#applyJson').click();});
  await page.waitForFunction(()=>window.DongGeoGebra.getAPI().exists('N'));
  assert(await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI();return a.getVisible('N')&&a.getXcoord('O')===0&&a.getYcoord('O')===0&&a.getXcoord('V')===2;}),'Named problem points and translated parabola origin retain their meaning');
  await page.locator('#sceneJson').evaluate(el=>{el.value=JSON.stringify({type:'ellipse',a:3,b:2,showDynamic:false,showFeatures:false,points:{F:[Math.sqrt(5),0]},pointBindings:{F:'focus2'},objects:[]});document.querySelector('#applyJson').click();});
  await page.waitForFunction(()=>window.DongGeoGebra.getAPI()?.exists('F')&&window.DongGeoGebra.getAPI().getVisible('F'));
  assert(await page.evaluate(()=>Math.abs(window.DongGeoGebra.getAPI().getXcoord('F')-Math.sqrt(5))<1e-8),'Named focus is visible even when generic features are hidden');
  await page.evaluate(()=>window.DongGeoGebra.getAPI().setValue('a',4));
  assert(await page.evaluate(()=>Math.abs(window.DongGeoGebra.getAPI().getXcoord('F')-Math.sqrt(12))<1e-8),'Named focus follows the actual conic rather than a frozen coordinate');
  const focalQuestion=require('../dist/question-bank.json').items.find(q=>q.id==='2023-ii-10').question;
  await page.locator('#sceneJson').evaluate((el,q)=>{el.value=JSON.stringify(window.DongParabolaFocalChoice.solve(q).scene);document.querySelector('#applyJson').click();},focalQuestion);
  try{await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&window.DongGeoGebra.getAPI()?.isDefined('M')&&window.DongGeoGebra.getAPI()?.isDefined('N'));}catch(error){console.log('Focal bridge diagnostic',await page.evaluate(()=>({report:window.DongGeoGebra.getReport(),objects:window.DongGeoGebra.getAPI().getAllObjectNames().map(n=>[n,window.DongGeoGebra.getAPI().getDefinitionString(n)])})));throw error;}
  const circle=await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI();return a.getAllObjectNames().find(n=>a.getCaption(n)==='直径圆'&&a.isDefined(n))||null;});
  assert(circle,'Actual GeoGebra must contain the dependent diameter circle');
  assert(await page.evaluate(n=>{const a=window.DongGeoGebra.getAPI();a.evalCommand('RadiusCheck=Radius('+n+')');return Math.abs(a.getValue('RadiusCheck')-8/3)<1e-7;},circle));
  await page.evaluate(()=>window.DongGeoGebra.getAPI().setValue('p',2));
  assert(await page.evaluate(n=>{const a=window.DongGeoGebra.getAPI();a.evalCommand('RadiusCheck=Radius('+n+')');return Math.abs(a.getValue('RadiusCheck')-16/3)<1e-7;},circle),'Circle must follow source conic rather than frozen coordinates');
  for(const id of ['2023-ii-5','2024-ii-3']){
    const q=require('../dist/question-bank.json').items.find(q=>q.id===id).question;
    await page.locator('#sceneJson').evaluate((el,q)=>{el.value=JSON.stringify(window.DongAlgebraGeometry.solve(q).scene);document.querySelector('#applyJson').click();},q);
    await page.waitForFunction(id=>window.DongGeoGebra.getReport()?.signature?.includes(id==='2024-ii-3'?'vector-norm':'ellipse-area-ratio'),id);
    try{await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&window.DongGeoGebra.getAPI()?.isDefined('B'));}catch(error){console.log(id,await page.evaluate(()=>({report:window.DongGeoGebra.getReport(),objects:window.DongGeoGebra.getAPI()?.getAllObjectNames().map(n=>[n,window.DongGeoGebra.getAPI().getDefinitionString(n)])})));throw error;}
    if(id==='2024-ii-3')assert.equal(await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI();return a.getAllObjectNames().filter(n=>a.getObjectType(n)==='vector'&&a.isDefined(n)&&a.getVisible(n)).length;}),4);
    else assert(await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI();return Math.abs(a.getXcoord('B')**2/3+a.getYcoord('B')**2-1)<1e-7;}));
    await screenshot(id+'-unified.png',null);
  }
};

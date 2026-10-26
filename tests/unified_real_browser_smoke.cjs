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
  const polygonScene={type:'circle',r:2,showConic:false,showDynamic:false,showFeatures:false,points:{U:[0,0],V:[2,0],W:[0,2]},objects:[{id:'separate-edge',kind:'construction',op:'segment',refs:['feature:U','feature:V'],label:'separate',part:2}],polygons:[{labels:['U','V','W'],label:'TeachingTriangle',part:1}]};
  await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},polygonScene);
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&window.DongGeoGebra.getAPI()?.exists('TeachingTriangle'));
  const generatedEdges=await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI();return a.getAllObjectNames().filter(n=>a.getObjectType(n)==='segment'&&n!=='separate');});
  assert.equal(generatedEdges.length,3,'Actual polygon creates three additional boundary objects');
  const partScene=JSON.parse(await page.locator('#sceneJson').inputValue());
  for(const part of [2,1,2]){
    await page.evaluate(({s,part})=>window.DongGeoGebra.syncTeaching({...s,activePart:part}),{s:partScene,part});
    await page.waitForFunction(part=>JSON.parse(window.DongGeoGebra.getReport().signature).activePart===part,part);
    const visible=await page.evaluate(edges=>{const a=window.DongGeoGebra.getAPI();return {polygon:a.getVisible('TeachingTriangle'),edges:edges.map(n=>a.getVisible(n)),separate:a.getVisible('separate')};},generatedEdges);
    assert.equal(visible.polygon,part===1);assert(visible.edges.every(v=>v===(part===1)),'Polygon boundary must follow its own part, without affecting an independently constructed edge');assert.equal(visible.separate,part===2);
  }
  const distantScene={type:'circle',r:1,showDynamic:false,points:{Far:[20,14]},objects:[{id:'hidden-far',kind:'point',label:'HiddenFar',x:1000,y:1000,visible:false}]};
  await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},distantScene);
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&window.DongGeoGebra.getAPI()?.exists('Far'));
  const farView=await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI(),raw=a.getViewProperties(1);return typeof raw==='string'?JSON.parse(raw):raw;});
  assert(20>farView.xMin&&20<farView.xMin+farView.width*farView.invXscale&&14>farView.yMin&&14<farView.yMin+farView.height*farView.invYscale,'A named point far from the main curve must be inside the initial viewport');
  assert(farView.xMin+farView.width*farView.invXscale<100,'Hidden points must not expand the viewport');
  assert((farView.xMin+farView.width*farView.invXscale-20)/farView.invXscale>=16,'Leave screen-space margin around a distant point, not just one visible pixel');
  await screenshot('distant-given-point.png',null);
  const currentScene=JSON.parse(await page.locator('#sceneJson').inputValue());
  await page.evaluate(s=>{window.DongGeoGebra.getAPI().setCoordSystem(-2,2,-2,2);window.DongGeoGebra.syncTeaching({...s,r:2});},currentScene);
  await page.waitForFunction(()=>JSON.parse(window.DongGeoGebra.getReport().signature).r===2);
  assert(await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI(),raw=a.getViewProperties(1),v=typeof raw==='string'?JSON.parse(raw):raw;return Math.abs(v.xMin+2)<1e-7&&Math.abs(v.width*v.invXscale-4)<1e-7;}),'Parameter edits preserve a user-selected zoom instead of repeatedly refitting');
  const degenerate={type:'circle',r:1,showDynamic:false,objects:[{id:'secant',kind:'slope',m:0,b:2,label:'secant'},{id:'i1',kind:'construction',op:'intersection',refs:['secant','$conic'],branch:0,label:'P'},{id:'i2',kind:'construction',op:'intersection',refs:['secant','$conic'],branch:1,label:'Q'},{id:'mid',kind:'construction',op:'midpoint',refs:['i1','i2'],label:'M'}]};
  await page.locator('#question').evaluate(el=>{el.value='之前的题目仍留在输入栏，不应改变手工图稿的约束属性。';});
  await page.evaluate(()=>localStorage.setItem('dongjiexi:geogebra:v1:teaching:archive','[null]'));
  await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},degenerate);
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&window.DongGeoGebra.getAPI()?.exists('M'));
  assert(await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI();return !a.isDefined('P')&&!a.isDefined('Q')&&!a.isDefined('M');}),'Nonintersecting objects stay as undefined dependencies, not fabricated points');
  assert(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('dongjiexi:geogebra:v1:teaching:archive:recovery:')&&localStorage.getItem(k)==='[null]')));
  await page.evaluate(()=>window.DongGeoGebra.save());await page.reload();await page.locator('[data-mobile-panel="board"]').click();
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&window.DongGeoGebra.getAPI()?.exists('M'),null,{timeout:100000});
  assert.equal(JSON.parse(await page.locator('#sceneJson').inputValue()).problemMotion,false,'Reload preserves manual scene provenance despite retained question text');
  assert(await page.evaluate(()=>!window.DongGeoGebra.getAPI().isDefined('M')),'Undefined construction survives save and reload');
  const recovered=JSON.parse(await page.locator('#sceneJson').inputValue());
  await page.locator('#importLesson').setInputFiles({name:'manual-lesson.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'dongjiexi-lesson',version:1,question:'保留题目文字的手工图稿',scene:recovered,solution:null}))});
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&window.DongGeoGebra.getAPI()?.exists('M'),null,{timeout:100000});
  assert.equal(JSON.parse(await page.locator('#sceneJson').inputValue()).problemMotion,false,'Lesson import preserves explicitly manual scenes');
  for(const radius of [3,1,3]){
    await page.evaluate(({s,r})=>window.DongGeoGebra.syncTeaching({...s,r}),{s:recovered,r:radius});
    await page.waitForFunction(r=>JSON.parse(window.DongGeoGebra.getReport().signature).r===r,radius);
    const defined=await page.evaluate(()=>window.DongGeoGebra.getAPI().isDefined('M'));
    if(defined!==(radius===3))console.log('Degenerate restoration',radius,await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI();return a.getAllObjectNames().map(n=>[n,a.getObjectType(n),a.getDefinitionString(n),a.isDefined(n),a.getObjectType(n)==='point'&&a.isDefined(n)?[a.getXcoord(n),a.getYcoord(n)]:null]);}));
    assert.equal(defined,radius===3);
    assert(await page.evaluate(()=>new DOMParser().parseFromString(window.DongGeoGebra.getAPI().getXML(),'application/xml').querySelector('element[label="R"] fixed')?.getAttribute('val')==='true'),'Parameter updates restore the source-point lock');
    if(radius===3)assert(await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI();return Math.abs(a.getXcoord('M'))<1e-7&&Math.abs(a.getYcoord('M')-2)<1e-7&&Math.abs(a.getXcoord('P')**2+a.getYcoord('P')**2-9)<1e-7;}));
  }
  for(const type of ['circle','ellipse','hyperbola']){
    await page.locator('#sceneJson').evaluate((el,type)=>{el.value=JSON.stringify({type,r:2,a:3,b:2,h:2,k:-1,showDynamic:false});document.querySelector('#applyJson').click();},type);
    await page.waitForFunction(type=>{const s=JSON.parse(window.DongGeoGebra.getReport().signature);return window.DongUnifiedBoard.isActive()&&s.type===type&&s.h===2&&s.k===-1;},type);
    assert.equal(await page.evaluate(()=>window.DongGeoGebra.getAPI().getCaption('O')),'中心','Translated default center must not be displayed as the origin');
    await page.evaluate(()=>window.DongGeoGebra.getAPI().evalCommand('KeptSegment=Segment(O,(5,4))'));
    await page.locator('#parameterTarget').evaluate(el=>{el.value='$conic';el.dispatchEvent(new Event('change',{bubbles:true}));});
    for(const [h,k,caption]of [[0,0,'O'],[-3,2,'中心']]){
      for(const [key,value]of [['h',h],['k',k]])await page.locator('#r-'+key).evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
      await page.waitForFunction(({h,k})=>{const s=JSON.parse(window.DongGeoGebra.getReport().signature);return window.DongUnifiedBoard.isActive()&&s.h===h&&s.k===k;},{h,k});
      assert.equal(await page.evaluate(()=>window.DongGeoGebra.getAPI().getCaption('O')||'O'),caption);
      assert(await page.evaluate(()=>window.DongGeoGebra.getAPI().isDefined('KeptSegment')),'Existing center-dependent auxiliaries survive translation');
    }
    await page.evaluate(()=>window.DongGeoGebra.save());await page.reload();await page.locator('[data-mobile-panel="board"]').click();
    await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&window.DongGeoGebra.getAPI()?.exists('KeptSegment'),null,{timeout:100000});
    assert.equal(await page.evaluate(()=>window.DongGeoGebra.getAPI().getCaption('O')),'中心');
  }
  for(const type of ['circle','ellipse','hyperbola','parabola']){
    const s={type,a:3,b:2,r:3,p:1,h:2,k:1,points:{Z:[4,3]},showDynamic:true,lineThrough:'point:O',dynamicLineLabel:'OriginLine',objects:[{id:'origin-mid',kind:'construction',op:'midpoint',refs:['feature:O','feature:Z'],label:'OriginMid'}]};
    await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},s);
    await page.waitForFunction(type=>{const r=window.DongGeoGebra.getReport();return window.DongUnifiedBoard.isActive()&&JSON.parse(r.signature).type===type&&window.DongGeoGebra.getAPI()?.exists('OriginMid');},type);
    const check=()=>page.evaluate(()=>{const a=window.DongGeoGebra.getAPI();a.evalCommand('OriginResidual=Distance((0,0),OriginLine)');return [a.getXcoord('OriginMid'),a.getYcoord('OriginMid'),a.getValue('OriginResidual')];});
    let values=await check();assert(Math.abs(values[0]-2)<1e-8&&Math.abs(values[1]-1.5)<1e-8&&Math.abs(values[2])<1e-8,'Implicit O is the origin, not the translated center or vertex');
    if(type==='circle'){
      const legacy=await page.evaluate(async()=>{const a=window.DongGeoGebra.getAPI(),report=window.DongGeoGebra.getReport();document.getElementById('dong-geogebra-dialog').removeAttribute('open');a.evalCommand('OriginMid=Midpoint(O,Z)');a.evalCommand('OriginLine=Line(O,(4,5))');a.evalCommand('LegacyManual=Segment(O,Z)');const base64=await new Promise(resolve=>a.getBase64(resolve));return {base64,owned:report.owned,sceneSignature:report.signature,title:'Legacy origin fixture'};});
      await page.addInitScript(record=>{if(!sessionStorage.getItem('origin-legacy-injected')){localStorage.setItem('dongjiexi:geogebra:v1:teaching',JSON.stringify(record));sessionStorage.setItem('origin-legacy-injected','1');}},legacy);
      await page.reload();await page.locator('[data-mobile-panel="board"]').click();
      try{await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&window.DongGeoGebra.getAPI()?.exists('LegacyManual'),null,{timeout:100000});}catch(error){console.log('Origin migration diagnostic',await page.evaluate(()=>({status:document.querySelector('#boardEngineStatus')?.outerHTML,report:window.DongGeoGebra.getReport(),names:window.DongGeoGebra.getAPI()?.getAllObjectNames(),saved:JSON.parse(localStorage.getItem('dongjiexi:geogebra:v1:teaching'))?.owned})));throw error;}
      values=await check();assert(Math.abs(values[0]-2)<1e-8&&Math.abs(values[1]-1.5)<1e-8&&Math.abs(values[2])<1e-8,'Legacy automatic origin references migrate');
      assert(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('dongjiexi:geogebra:v1:teaching:origin-migration:'))),'Original legacy draft is backed up');
      assert(await page.evaluate(()=>Math.abs(window.DongGeoGebra.getAPI().getValue('LegacyManual')-Math.sqrt(8))<1e-8),'Manual center-based auxiliary is not rewritten');
    }
    await page.locator('#parameterTarget').evaluate(el=>{el.value='$conic';el.dispatchEvent(new Event('change',{bubbles:true}));});
    await page.locator('#r-h').evaluate(el=>{el.value='-2';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&JSON.parse(window.DongGeoGebra.getReport().signature).h===-2);
    values=await check();assert(Math.abs(values[0]-2)<1e-8&&Math.abs(values[1]-1.5)<1e-8&&Math.abs(values[2])<1e-8,'Origin dependencies remain fixed as the curve moves');
  }
  const crowded={type:'circle',r:3,showDynamic:false,points:{N:[1,1],Np:[1.03,1.02],F1:[1.05,1.04]},objects:[{id:'mid-label-test',kind:'construction',op:'midpoint',refs:['feature:N','feature:F1'],label:'LabelMid'}]};
  await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},crowded);
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&window.DongGeoGebra.getAPI()?.exists('LabelMid'));
  const before=await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI();return ['N','Np','F1','LabelMid'].map(n=>[n,a.getXcoord(n),a.getYcoord(n),a.getCommandString(n,false)]);});
  await page.locator('.dong-ggb-tools > summary').click();await page.getByRole('button',{name:'整理点名',exact:true}).click();
  const after=await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI();return ['N','Np','F1','LabelMid'].map(n=>[n,a.getXcoord(n),a.getYcoord(n),a.getCommandString(n,false)]);});
  assert.deepEqual(after,before,'Arranging labels changes neither coordinates nor construction commands');
  const offsets=await page.evaluate(()=>{const doc=new DOMParser().parseFromString(window.DongGeoGebra.getAPI().getXML(),'application/xml');return ['N','Np','F1','LabelMid'].map(n=>doc.querySelector('element[label="'+n+'"] labelOffset')?.outerHTML);});
  assert(offsets.every(Boolean)&&new Set(offsets).size>1,'Nearby point labels receive distinct screen offsets');
  await page.evaluate(()=>window.DongGeoGebra.arrangeLabels());
  const repeatedOffsets=await page.evaluate(()=>{const doc=new DOMParser().parseFromString(window.DongGeoGebra.getAPI().getXML(),'application/xml');return ['N','Np','F1','LabelMid'].map(n=>doc.querySelector('element[label="'+n+'"] labelOffset')?.outerHTML);});
  assert.deepEqual(repeatedOffsets,offsets,'Repeated arrangement is stable in the real GGB renderer');
  await screenshot('arranged-point-labels-mobile.png',null);
  await page.evaluate(()=>window.DongGeoGebra.save());await page.reload();await page.locator('[data-mobile-panel="board"]').click();
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&window.DongGeoGebra.getAPI()?.exists('LabelMid'),null,{timeout:100000});
  const restoredOffsets=await page.evaluate(()=>{const doc=new DOMParser().parseFromString(window.DongGeoGebra.getAPI().getXML(),'application/xml');return ['N','Np','F1','LabelMid'].map(n=>doc.querySelector('element[label="'+n+'"] labelOffset')?.outerHTML);});
  assert.deepEqual(restoredOffsets,offsets,'Label offsets survive saving and reopening');
  const originalXML=await page.evaluate(()=>new DOMParser().parseFromString(window.DongGeoGebra.getAPI().getXML(),'application/xml').querySelector('construction').outerHTML);
  await page.locator('.dong-ggb-tools > summary').click();await page.getByRole('button',{name:'查找点',exact:true}).click();
  await page.getByLabel('选择要定位的点').selectOption('N');
  await page.locator('#boardPointLocator').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#boardPointInfo').textContent.includes('坐标读数（近似）'));
  await page.getByLabel('选择要定位的点').selectOption('LabelMid');
  await page.waitForFunction(()=>document.querySelector('#boardPointInfo').textContent.includes('Midpoint'));
  await page.getByLabel('选择要定位的点').selectOption('N');
  assert.equal(await page.evaluate(()=>new DOMParser().parseFromString(window.DongGeoGebra.getAPI().getXML(),'application/xml').querySelector('construction').outerHTML),originalXML,'Locating a point does not change the GGB construction or style');
  await screenshot('point-finder-mobile.png',null);
  await page.evaluate(()=>window.DongGeoGebra.getAPI().evalCommand('LocatorFree=(2,1)'));
  await page.getByRole('button',{name:'刷新点名',exact:true}).click();
  await page.getByLabel('选择要定位的点').selectOption('LocatorFree');
  await page.waitForFunction(()=>document.querySelector('#boardPointFinder').textContent.includes('正在定位 LocatorFree'));
  const markerX=await page.locator('#boardPointLocator').evaluate(el=>el.style.left);
  await page.evaluate(()=>window.DongGeoGebra.getAPI().setCoords('LocatorFree',-1,2));
  await page.waitForFunction(old=>document.querySelector('#boardPointLocator').style.left!==old,markerX);
  await page.evaluate(()=>window.DongGeoGebra.getAPI().setVisible('LocatorFree',false));
  await page.waitForFunction(()=>document.querySelector('#boardPointLocator').hidden&&document.querySelector('#boardPointFinder').textContent.includes('这个点已隐藏'));
  await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI();a.setVisible('LocatorFree',true);a.setCoords('LocatorFree',1000,1000);});
  await page.waitForFunction(()=>document.querySelector('#boardPointLocator').hidden&&document.querySelector('#boardPointFinder').textContent.includes('当前视野外'));
  await page.evaluate(()=>window.DongGeoGebra.getAPI().deleteObject('LocatorFree'));
  await page.waitForFunction(()=>document.querySelector('#boardPointFinder').textContent.includes('已删除或改名'));
  await page.getByLabel('选择要定位的点').selectOption('N');await page.locator('#boardPointLocator').waitFor({state:'visible'});
  await page.getByRole('button',{name:'结束定位',exact:true}).click();
  assert(await page.locator('#boardPointLocator').isHidden());assert(await page.locator('#boardPointFinder').isHidden());
  await page.locator('.dong-ggb-tools > summary').click();await page.getByRole('button',{name:'查找点',exact:true}).click();
  await page.getByLabel('选择要定位的点').selectOption('N');await page.locator('#boardPointLocator').waitFor({state:'visible'});
  assert.equal(await page.locator('#boardPointLocator').evaluate(el=>getComputedStyle(el).pointerEvents),'none','Locator must never intercept drawing or dragging');
  const beforeZoom=await page.locator('#boardPointLocator').evaluate(el=>el.style.left);
  await page.evaluate(()=>window.DongGeoGebra.getAPI().setCoordSystem(-3,3,-3,3));
  await page.waitForFunction(old=>document.querySelector('#boardPointLocator').style.left!==old,beforeZoom);
  await page.keyboard.press('Escape');assert(await page.locator('#boardPointFinder').isHidden());assert(await page.locator('#boardPointLocator').isHidden());
  await page.locator('.dong-ggb-tools > summary').click();await page.getByRole('button',{name:'查找点',exact:true}).click();
  await page.getByLabel('选择要定位的点').selectOption('N');
  await page.locator('#sceneJson').evaluate(el=>{el.value=JSON.stringify({type:'ellipse',a:3,b:2,showDynamic:false,points:{N:[-1,1]}});document.querySelector('#applyJson').click();});
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&JSON.parse(window.DongGeoGebra.getReport().signature).type==='ellipse');
  assert(await page.locator('#boardPointFinder').isHidden());assert(await page.locator('#boardPointLocator').isHidden(),'New problem clears the old selection even if it reuses the name N');
};

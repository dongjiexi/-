module.exports=async({page,assert,screenshot})=>{
  await page.addInitScript(()=>{
    const names=new Set(),values={},coords={},shown={};window.__unified={names,values,coords,commands:[]};
    window.GGBApplet=class{constructor(params){this.params=params;window.__unified.params=params;}inject(id){
      document.getElementById(id).textContent='统一画板 API 测试替身';
      const api=new Proxy({exists:n=>names.has(n),isDefined:()=>true,getVisible:n=>shown[n]!==false,setVisible:(n,value)=>shown[n]=value,evalCommand:s=>{names.add(s.split(/[=:]/)[0]);window.__unified.commands.push(s);return true;},setValue:(n,v)=>values[n]=v,setCoords:(n,x,y)=>coords[n]=[x,y],getXcoord:n=>coords[n]?.[0]||0,getYcoord:n=>coords[n]?.[1]||0,getViewProperties:()=>({width:800,height:600}),getBase64:cb=>cb(btoa(JSON.stringify([...names]))),setBase64:(raw,cb)=>{names.clear();JSON.parse(atob(raw)).forEach(n=>names.add(n));cb();},newConstruction:()=>names.clear(),setMode:n=>window.__unified.mode=n},{get:(o,k)=>k in o?o[k]:()=>{}});setTimeout(()=>this.params.appletOnLoad(api),10);
    }};
  });await page.reload();
  const scene={type:'ellipse',a:3,b:2,showDynamic:false,objects:[{id:'u',kind:'point',source:'user',label:'U',x:1,y:2}]};
  await page.locator('#sceneJson').evaluate((el,value)=>{el.value=JSON.stringify(value);document.querySelector('#applyJson').click();},scene);
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive());
  assert.equal(await page.locator('#openGeoGebraInline').isVisible(),false);
  assert.equal(await page.locator('.dong-ggb-close').isVisible(),false);
  assert.equal(await page.locator('#canvas').isVisible(),false);
  assert(await page.locator('.board-toolbar').isVisible());
  assert.equal(await page.evaluate(()=>window.__unified.params.showToolBar),false,'No second GeoGebra toolbar');
  assert.equal(await page.evaluate(()=>window.__unified.params.showAlgebraInput),false,'One parameter interface');
  assert.equal(await page.evaluate(()=>window.__unified.params.allowStyleBar),false,'Common settings use the wide integrated dialog');
  await page.getByRole('button',{name:'画板设置',exact:true}).click();assert(await page.locator('#boardSettings').isVisible());await page.locator('#boardSettings [data-close]').click();
  await page.locator('.unified-tools summary').click();
  assert.equal(await page.locator('.unified-tools').evaluate(el=>getComputedStyle(el).overflow),'visible','Shared details styling must not clip this menu');
  await page.locator('.unified-tool-content').getByRole('button',{name:'切线',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__unified.mode),13);
  await page.locator('.unified-tool-content').getByRole('button',{name:'收起工具',exact:true}).click();
  assert.equal(await page.locator('.unified-tools').getAttribute('open'),null);
  await page.evaluate(()=>{window.DongGeoGebra.getAPI().evalCommand('Manual=(7,8)');return window.DongGeoGebra.save();});
  await page.reload();await page.waitForFunction(()=>window.DongUnifiedBoard.isActive());
  assert(await page.evaluate(()=>window.DongGeoGebra.getAPI().exists('Manual')),'Same question reload preserves manual auxiliary work');
  const other={type:'circle',r:5,showDynamic:false,points:{W:[2,1]}};
  await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},other);
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&JSON.parse(window.DongGeoGebra.getReport().signature).type==='circle');
  await page.evaluate(()=>{const r=window.DongGeoGebra.getReport();window.DongUnifiedBoard.stageDraft({base64:btoa(JSON.stringify([...window.__unified.names,'OldPendingMarker'])),sceneSignature:r.signature,owned:r.owned,coordinateFrameVersion:1});});
  await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},scene);
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&JSON.parse(window.DongGeoGebra.getReport().signature).type==='ellipse');
  assert.match(await page.locator('#boardEngineStatus').textContent(),/附加图稿.*不匹配/);
  await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},other);
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive()&&JSON.parse(window.DongGeoGebra.getReport().signature).type==='circle');
  assert.equal(await page.evaluate(()=>window.DongGeoGebra.getAPI().exists('OldPendingMarker')),false,'A rejected draft cannot apply later when another scene happens to match');
  const exports=await page.evaluate(async()=>{const original=window.DongGeoGebra;window.DongGeoGebra={...original,getReport:()=>({...original.getReport(),signature:'sync-in-progress'})};try{let image='',file='';try{window.DongUnifiedBoard.image();}catch(e){image=e.message;}try{await window.DongUnifiedBoard.exportBoard();}catch(e){file=e.message;}return {image,file};}finally{window.DongGeoGebra=original;}});
  assert.match(exports.image,/正在同步/);assert.match(exports.file,/正在同步/);
  const functionScene={...scene,objects:[...scene.objects,{id:'f',kind:'function',family:'sine',label:'f',params:{A:2,w:3,phi:0,d:1}}]};
  await page.locator('#sceneJson').evaluate((el,value)=>{el.value=JSON.stringify(value);document.querySelector('#applyJson').click();},functionScene);
  await page.waitForFunction(()=>window.__unified.commands.some(s=>s.includes('sin(')));
  const unsupported={...scene,objects:[{id:'bad',kind:'construction',op:'point_on',refs:['$conic'],label:'T',t:.5,motionDomain:{parameter:{min:0,max:1,minClosed:false}}}]};
  await page.locator('#sceneJson').evaluate((el,value)=>{el.value=JSON.stringify(value);document.querySelector('#applyJson').click();},unsupported);
  await page.waitForFunction(()=>document.querySelector('.board-shell').dataset.renderer==='native');
  assert(await page.locator('#canvas').isVisible(),'Unsupported restrictions retain complete native construction');
  assert.match(await page.locator('#boardEngineStatus').innerText(),/完整教学构造/);
  await page.locator('#sceneJson').evaluate((el,value)=>{el.value=JSON.stringify(value);document.querySelector('#applyJson').click();},scene);
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive());
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});await page.locator('[data-mobile-panel="board"]').click();
    await page.locator('.unified-tools summary').click();assert(await page.locator('.unified-tool-content').getByRole('button',{name:'收起工具',exact:true}).isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('.unified-tool-content').getByRole('button',{name:'收起工具',exact:true}).click();
  }
  await screenshot('unified-mobile.png',null);
  // Legacy scopes can use numeric strings, empty arrays or the combined view 0.
  const scoped={...scene,points:{N:[0,1]},pointParts:{N:['2']},objects:[
    {...scene.objects[0],parts:[]},
    {id:'scoped-mid',kind:'construction',op:'midpoint',refs:['feature:N','u'],label:'M',part:2},
    {id:'scoped-circle',kind:'circle',h:2,k:1,r:1,label:'ScopeCircle',parts:['2']},
    {id:'hidden-point',kind:'point',label:'H',x:1,y:0,visible:false}
  ]};
  await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},scoped);
  await page.waitForFunction(()=>window.DongGeoGebra.getAPI().exists('ScopeCircle'));
  const current=JSON.parse(await page.locator('#sceneJson').inputValue());
  for(const part of [1,2,0,1]){
    await page.evaluate(({scene,part})=>window.DongGeoGebra.syncTeaching({...scene,activePart:part}),{scene:current,part});
    await page.waitForFunction(part=>JSON.parse(window.DongGeoGebra.getReport().signature).activePart===part,part);
    const flags=await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI();return ['U','N','M','ScopeCircle','H'].map(n=>a.getVisible(n));});
    assert.deepEqual(flags,[true,part!==1,part!==1,part!==1,false]);
  }
  const locus={...scene,objects:[
    {id:'locus',kind:'circle',label:'P 的轨迹',role:'derived_locus',h:0,k:0,r:2},
    {id:'driver',kind:'construction',op:'point_on',label:'P',refs:['locus'],t:.5,motionDomain:{parameter:{min:0,max:1}}}
  ]};
  await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},locus);
  await page.waitForFunction(()=>window.DongGeoGebra.getReport().skipped.includes('受限轨迹：P 的轨迹')&&!window.DongUnifiedBoard.isActive());
  assert.match(await page.locator('#locusRangeSummary').textContent(),/已按绑定范围显示/);
  const duplicate={...scene,objects:[
    {id:'p1',kind:'point',label:'P',x:1,y:1,part:1},
    {id:'p2',kind:'point',label:'P',x:1,y:2,part:2}
  ],points:{A:[0,0]},lines:[{id:'ap',kind:'through_points',a:'A',b:'P',label:'AP',infinite:true}]};
  await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},duplicate);
  await page.waitForFunction(()=>window.DongGeoGebra.getReport().skipped.includes('分问同名点：P')&&!window.DongUnifiedBoard.isActive());
  assert(await page.locator('#canvas').isVisible());
  const single={...duplicate,objects:[duplicate.objects[1]]};
  await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},single);
  await page.waitForFunction(()=>window.DongGeoGebra.getReport().skipped.includes('分问端点：P')&&!window.DongUnifiedBoard.isActive());
};

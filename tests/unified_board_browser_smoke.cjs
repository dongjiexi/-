module.exports=async({page,assert,screenshot})=>{
  await page.addInitScript(()=>{
    const names=new Set(),values={},coords={};window.__unified={names,values,coords,commands:[]};
    window.GGBApplet=class{constructor(params){this.params=params;window.__unified.params=params;}inject(id){
      document.getElementById(id).textContent='统一画板 API 测试替身';
      const api=new Proxy({exists:n=>names.has(n),isDefined:()=>true,getVisible:()=>true,evalCommand:s=>{names.add(s.split(/[=:]/)[0]);window.__unified.commands.push(s);return true;},setValue:(n,v)=>values[n]=v,setCoords:(n,x,y)=>coords[n]=[x,y],getXcoord:n=>coords[n]?.[0]||0,getYcoord:n=>coords[n]?.[1]||0,getViewProperties:()=>({width:800,height:600}),getBase64:cb=>cb(btoa(JSON.stringify([...names]))),setBase64:(raw,cb)=>{names.clear();JSON.parse(atob(raw)).forEach(n=>names.add(n));cb();},newConstruction:()=>names.clear(),setMode:n=>window.__unified.mode=n},{get:(o,k)=>k in o?o[k]:()=>{}});setTimeout(()=>this.params.appletOnLoad(api),10);
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
  await page.locator('.unified-tools summary').click();
  await page.locator('.unified-tool-content').getByRole('button',{name:'切线',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.__unified.mode),13);
  await page.locator('.unified-tool-content').getByRole('button',{name:'收起工具',exact:true}).click();
  assert.equal(await page.locator('.unified-tools').getAttribute('open'),null);
  await page.evaluate(()=>{window.DongGeoGebra.getAPI().evalCommand('Manual=(7,8)');return window.DongGeoGebra.save();});
  await page.reload();await page.waitForFunction(()=>window.DongUnifiedBoard.isActive());
  assert(await page.evaluate(()=>window.DongGeoGebra.getAPI().exists('Manual')),'Same question reload preserves manual auxiliary work');
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
};

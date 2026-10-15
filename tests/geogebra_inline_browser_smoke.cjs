// Adapter/lifecycle checks with an explicit API fixture, not GeoGebra algebra validation.
module.exports=async({page,context,baseURL,assert,screenshot})=>{
  await page.addInitScript(()=>{
    window.__ggbCalls=[];const names=new Set();
    window.GGBApplet=class {constructor(params){this.params=params;}inject(target){
      document.getElementById(target).textContent='GeoGebra API 测试替身';
      const api=new Proxy({exists:n=>names.has(n),evalCommand:cmd=>{window.__ggbCalls.push(cmd);names.add(cmd.split(/[=:]/)[0]);return true;},getBase64:cb=>cb(btoa('fixture')),setBase64:(s,cb)=>cb(),getViewProperties:()=>({width:800,height:600}),getXcoord:()=>0,getYcoord:()=>0,newConstruction:()=>{names.clear();window.__ggbCalls=[];}},{get:(o,k)=>k in o?o[k]:()=>{}});
      setTimeout(()=>this.params.appletOnLoad(api),0);
    }};
  });
  await page.reload();
  const fixture={type:'circle',r:3,isFreeBoard:true,showDynamic:false,showFeatures:false,points:{},lines:[],objects:[
    {id:'mid',kind:'construction',op:'midpoint',refs:['u','v'],label:'M'},
    {id:'u',kind:'point',label:'U',x:-2,y:0},{id:'v',kind:'point',label:'V',x:2,y:0},{id:'w',kind:'point',label:'W',x:0,y:2},
    {id:'circle',kind:'construction',op:'circumcircle',refs:['u','v','w'],label:'c'},
    {id:'bis',kind:'construction',op:'perp_bisector',refs:['u','v'],label:'b'},
    {id:'moving',kind:'construction',op:'point_on',refs:['circle'],t:.5,label:'T'},
    {id:'bounded',kind:'construction',op:'point_on',refs:['circle'],t:.5,label:'S',motionDomain:{parameter:{min:0,max:1}}},
    {id:'limited',kind:'construction',op:'point_on',refs:['circle'],t:.5,label:'受限点',motionDomain:{parameter:{min:0,max:1,minClosed:false}}},
    {id:'missing',kind:'construction',op:'midpoint',refs:['limited','u'],label:'依赖受限点'}
  ],polygons:[{label:'△UVW',labels:['U','V','W']}]};
  await page.locator('#sceneJson').evaluate((el,value)=>{el.value=value;document.querySelector('#applyJson').click();},JSON.stringify(fixture));
  const original=await page.locator('#sceneJson').inputValue();
  await page.locator('#openGeoGebraInline').click();
  await page.waitForFunction(()=>document.querySelector('.dong-ggb-status')?.textContent.includes('部分导入'));
  assert.equal(await page.locator('#geoGebraInlineSlot #dong-geogebra-dialog[open]').count(),1);
  assert.equal(await page.locator('#canvas').isVisible(),false);
  const calls=await page.evaluate(()=>window.__ggbCalls.join('\n'));
  for(const name of ['Midpoint(U,V)','Circle(U,V,W)','PerpendicularBisector(U,V)','Polygon(U,V,W)'])assert(calls.includes(name),name);
  assert(!calls.includes('调半径'),'Free board must not synthesize a primary curve');
  assert(calls.includes('T=Point(c)'),'Unrestricted path point remains attached');
  assert(calls.includes('Curve(x(Center(c))+Radius(c)*cos(tt),y(Center(c))+Radius(c)*sin(tt),tt,0,1)'),'Closed range becomes a bounded path');
  assert.match(await page.locator('.dong-ggb-status').innerText(),/受限点.*依赖受限点/);
  assert.equal(await page.locator('#sceneJson').inputValue(),original,'Import does not rewrite native graph');
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.locator('[data-mobile-panel="board"]').click();assert(await page.locator('.dong-ggb-close').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await screenshot('geogebra-inline-320-fixture.png',null);
  await page.locator('.dong-ggb-close').click();assert(await page.locator('#canvas').isVisible());assert.equal(await page.locator('#sceneJson').inputValue(),original);
  await page.locator('#openGeoGebraInline').click();assert.equal(await page.locator('#dong-geogebra-dialog').count(),1);
  await page.locator('.dong-ggb-close').click();
  const offline=await context.newPage();
  try{
    await offline.route('**/runtime-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:false};'}));
    await offline.route('https://www.geogebra.org/**',r=>r.abort('failed'));
    await offline.goto(baseURL,{waitUntil:'domcontentloaded'});
    await offline.locator('#openGeoGebraInline').click();await offline.waitForFunction(()=>document.querySelector('.dong-ggb-status')?.textContent.includes('无法连接'));
    await offline.locator('.dong-ggb-close').click();assert(await offline.locator('#canvas').isVisible(),'Failed external engine must not trap the user');
  }finally{await offline.close();}
};

// Opt-in network integration: actual official app, never a simulated algebra API.
module.exports=async({page,assert,screenshot})=>{
  const scene={type:'ellipse',a:3,b:2,h:0,k:0,showDynamic:false,objects:[
    {id:'moving',kind:'construction',op:'point_on',refs:['$conic'],t:.5,label:'U'},
    {id:'bounded',kind:'construction',op:'point_on',refs:['$conic'],t:.5,label:'S',motionDomain:{parameter:{min:0,max:1}}},
    {id:'mid',kind:'construction',op:'midpoint',refs:['moving','bounded'],label:'M'}
  ]};
  await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},scene);
  await page.locator('#unrestrictedMove').click();
  await page.locator('#parameterTarget').selectOption('$conic');
  await page.locator('#openGeoGebraInline').click();
  await page.waitForFunction(()=>window.DongGeoGebra.getAPI()?.exists('M'),null,{timeout:100000});
  const result=await page.evaluate(()=>{
    const api=window.DongGeoGebra.getAPI(),p=n=>[api.getXcoord(n),api.getYcoord(n)];
    const start=p('S');api.setCoords('U',-10,8);api.setCoords('S',-10,-8);
    const u=p('U'),s=p('S'),m=p('M');
    api.setValue('a',4);const resized=p('S');
    return {start,u,s,m,resized,command:api.getCommandString('S',false)};
  });
  console.log('REAL PATH',JSON.stringify(result));
  // GeoGebra projects setCoords numerically onto parametric curves (about 2e-6 here).
  assert(Math.abs(result.start[0]-3*Math.cos(.5))<1e-5);
  assert(Math.abs(result.start[1]-2*Math.sin(.5))<1e-5);
  for(const p of [result.u,result.s])assert(Math.abs(p[0]**2/9+p[1]**2/4-1)<1e-6);
  assert(result.s[0]>=3*Math.cos(1)-1e-6&&result.s[1]>=-1e-6,'Bounded point cannot leave its arc');
  assert(Math.abs(result.m[0]-(result.u[0]+result.s[0])/2)<1e-7);
  assert(Math.abs(result.resized[0]**2/16+result.resized[1]**2/4-1)<1e-6,'Bounded path follows changed ellipse parameters');
  await page.evaluate(()=>window.DongGeoGebra.getAPI().evalCommand('Manual=(7,8)'));
  await page.locator('#params input[data-key="a"][data-param-expression]').fill('5');
  await page.waitForFunction(()=>window.DongGeoGebra.getAPI().getValue('a')===5);
  assert(await page.evaluate(()=>window.DongGeoGebra.getAPI().exists('Manual')),'Native parameter UI must preserve advanced additions');
  await page.setViewportSize({width:390,height:844});await page.locator('[data-mobile-panel="board"]').click();
  assert(await page.locator('.dong-ggb-close').isVisible());
  assert.equal(await page.locator('.dong-ggb-tools').getAttribute('open'),null);
  await page.locator('.dong-ggb-tools summary').click();assert(await page.getByRole('button',{name:'保存 .ggb',exact:true}).isVisible());
  await page.locator('.dong-ggb-tools summary').click();assert(await page.locator('.dong-ggb-close').isVisible());
  await screenshot('geogebra-real-bounded-point-mobile.png',null);
  await page.locator('.dong-ggb-close').click();assert(await page.locator('#canvas').isVisible());
};

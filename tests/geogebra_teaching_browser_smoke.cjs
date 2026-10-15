// Explicit API fixture: lifecycle and source-of-truth contracts, not algebra proof.
module.exports=async({page,assert,screenshot})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('dongjiexi:geogebra:v1',JSON.stringify({base64:btoa('wrong-question')}));
    const names=new Set(),values={},coords={},visible={};
    window.__teaching={values,coords,visible,resets:0};
    window.GGBApplet=class{constructor(p){this.p=p;window.__teaching.initial=p.ggbBase64;}inject(id){
      document.getElementById(id).textContent='教学联动 API 测试替身';
      const api=new Proxy({exists:n=>names.has(n),isDefined:()=>true,getVisible:n=>visible[n]!==false,
        evalCommand:s=>{names.add(s.split(/[=:]/)[0]);return true;},setValue:(n,v)=>values[n]=v,
        setCoords:(n,x,y)=>coords[n]=[x,y],getXcoord:n=>coords[n]?.[0]||0,getYcoord:n=>coords[n]?.[1]||0,
        setVisible:(n,v)=>visible[n]=v,getBase64:f=>f(btoa('current-teaching')),getViewProperties:()=>({width:800,height:600}),
        newConstruction:()=>{window.__teaching.resets++;names.clear();},registerClientListener:f=>window.__teaching.client=f
      },{get:(o,k)=>k in o?o[k]:()=>{}});setTimeout(()=>this.p.appletOnLoad(api),0);
    }};
  });await page.reload();
  const scene={type:'ellipse',a:3,b:2,h:0,k:0,showDynamic:false,objects:[{id:'u',kind:'point',label:'U',x:1,y:2,source:'user'},{id:'v',kind:'point',label:'V',x:2,y:3,source:'user'},{id:'edge',kind:'construction',op:'segment',refs:['u','v'],label:'s',part:2}]};
  await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},scene);
  await page.locator('#openGeoGebraInline').click();await page.waitForFunction(()=>window.DongGeoGebra.getAPI()?.exists('s'));
  assert.equal(await page.evaluate(()=>window.__teaching.initial),undefined,'Never load another question draft');
  assert.equal(await page.getByRole('button',{name:'图形 / 代数',exact:true}).isVisible(),false,'One parameter interface');
  const current=await page.locator('#sceneJson').inputValue();
  await page.evaluate(raw=>{const scene=JSON.parse(raw);window.DongGeoGebra.getAPI().evalCommand('Manual=(7,8)');window.DongGeoGebra.syncTeaching({...scene,a:4,activePart:1});},current);
  await page.waitForFunction(()=>window.__teaching.values.a===4);
  assert(await page.evaluate(()=>window.DongGeoGebra.getAPI().exists('Manual')),'Parameter change preserves manual constructions');
  assert.equal(await page.evaluate(()=>window.__teaching.visible.s),false);
  await page.evaluate(raw=>window.DongGeoGebra.syncTeaching({...JSON.parse(raw),a:4,activePart:2}),current);
  await page.waitForFunction(()=>window.__teaching.visible.s===true);
  // Driver event returns coordinates to the native model rather than creating a detached copy.
  await page.evaluate(()=>{const api=window.DongGeoGebra.getAPI();api.setCoords('U',3,4);window.__teaching.client({type:'dragEnd'});});
  const updated=JSON.parse(await page.locator('#sceneJson').inputValue());assert.equal(updated.objects.find(o=>o.id==='u').x,3);
  assert.equal(updated.objects.find(o=>o.id==='u').y,4);
  const next={type:'circle',r:5,showDynamic:false,points:{Z:[0,2]},objects:[]};
  await page.locator('#sceneJson').evaluate((el,s)=>{el.value=JSON.stringify(s);document.querySelector('#applyJson').click();},next);
  await page.waitForFunction(()=>window.DongGeoGebra.getAPI().exists('Z')&&!window.DongGeoGebra.getAPI().exists('U'));
  assert(await page.evaluate(()=>!!localStorage.getItem('dongjiexi:geogebra:v1:teaching:previous')),'Graph replacement keeps a backup');
  assert(await page.locator('.dong-ggb-close').isVisible());await screenshot('teaching-linked-desktop.png',null);
  await page.locator('.dong-ggb-close').click();assert(await page.locator('#canvas').isVisible());
};

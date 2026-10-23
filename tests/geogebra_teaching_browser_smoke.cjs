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
  const backupSignature=await page.evaluate(()=>JSON.parse(localStorage.getItem('dongjiexi:geogebra:v1:teaching:previous')).sceneSignature);
  assert.equal(JSON.parse(backupSignature).type,'ellipse','Old board backup must not be associated with the new circle question');
  for(const [index,raw]of ['{"unexpected":true}','[null,42]','{not-json'].entries()){
    await page.evaluate(raw=>localStorage.setItem('dongjiexi:geogebra:v1:teaching:archive',raw),raw);
    await page.locator('#sceneJson').evaluate((el,index)=>{el.value=JSON.stringify({type:'circle',r:3+index,showDynamic:false,points:{['Recovery'+index]:[1,2]},objects:[]});document.querySelector('#applyJson').click();},index);
    await page.waitForFunction(index=>window.DongGeoGebra.getAPI().exists('Recovery'+index),index,{timeout:6000});
    assert(await page.evaluate(raw=>Object.keys(localStorage).filter(k=>k.startsWith('dongjiexi:geogebra:v1:teaching:archive:recovery:')).some(k=>localStorage.getItem(k)===raw),raw),'Preserve unreadable archive data instead of deleting it');
  }
  const retained=await page.evaluate(()=>{const key='dongjiexi:geogebra:v1:teaching:archive',record=JSON.parse(localStorage.getItem(key))[0];localStorage.setItem(key,JSON.stringify([record,null]));return record;});
  await page.locator('#sceneJson').evaluate(el=>{el.value=JSON.stringify({type:'circle',r:10,showDynamic:false,points:{Recovered:[1,2]},objects:[]});document.querySelector('#applyJson').click();});
  await page.waitForFunction(()=>window.DongGeoGebra.getAPI().exists('Recovered'));
  assert(await page.evaluate(record=>JSON.parse(localStorage.getItem('dongjiexi:geogebra:v1:teaching:archive')).some(item=>JSON.stringify(item)===JSON.stringify(record)),retained),'Valid history remains available even when another record is corrupt');
  assert(await page.locator('.dong-ggb-close').isVisible());await screenshot('teaching-linked-desktop.png',null);
  // Screen-layout fixture: real browser XML/canvas, deliberately not a GGB
  // rendering assertion. Dense, boundary and hidden-axis behavior is deterministic.
  const layout=await page.evaluate(()=>{
    const api=window.DongGeoGebra.getAPI();
    let width=320,height=240,showAxes=false,patches=0;
    const points=Array.from({length:24},(_,i)=>({name:'Near'+i,x:160+i*.12,y:120+i*.1}));
    points.push({name:'Edge',x:319,y:1});
    let doc;
    const reset=()=>{doc=new DOMParser().parseFromString('<geogebra><euclidianView><axis id="0" show="'+showAxes+'"/><axis id="1" show="'+showAxes+'"/></euclidianView><construction>'+points.map(p=>'<element type="point" label="'+p.name+'"><labelOffset x="150" y="150"/></element>').join('')+'</construction></geogebra>','application/xml');};
    reset();
    api.getXML=()=>new XMLSerializer().serializeToString(doc);
    api.getViewProperties=()=>({width,height,xMin:-160,yMin:-120,invXscale:1,invYscale:1});
    api.getXcoord=n=>points.find(p=>p.name===n).x-160;
    api.getYcoord=n=>120-points.find(p=>p.name===n).y;
    api.getVisible=()=>true;api.isDefined=()=>true;api.getLabelVisible=()=>true;
    api.getLabelStyle=()=>0;api.getPointSize=()=>5;
    api.evalXML=xml=>{patches++;const parsed=new DOMParser().parseFromString('<root>'+xml+'</root>','application/xml');for(const el of parsed.querySelectorAll('element'))doc.querySelector('element[label="'+el.getAttribute('label')+'"]').replaceWith(doc.importNode(el,true));};
    const result=window.DongGeoGebra.arrangeLabels();
    const ctx=document.createElement('canvas').getContext('2d');ctx.font='18px sans-serif';
    const boxes=points.map(p=>{const offset=doc.querySelector('element[label="'+p.name+'"] labelOffset');return {x:p.x+4+Number(offset.getAttribute('x')),y:p.y-30+Number(offset.getAttribute('y')),width:Math.max(20,ctx.measureText(p.name).width+10),height:26,px:p.x,py:p.y};});
    const first=api.getXML();window.DongGeoGebra.arrangeLabels();const second=api.getXML();
    // Single point beside the origin: hidden axes must not consume room.
    points.splice(1);points[0]={name:'Near0',x:160,y:120};showAxes=false;reset();window.DongGeoGebra.arrangeLabels();const hidden=api.getXML();
    showAxes=true;reset();window.DongGeoGebra.arrangeLabels();const shown=api.getXML();
    const offsetOf=xml=>new DOMParser().parseFromString(xml,'application/xml').querySelector('labelOffset').outerHTML;
    width=20;let smallError='';const count=patches;try{window.DongGeoGebra.arrangeLabels();}catch(e){smallError=e.message;}
    return {result,boxes,stable:first===second,hidden:offsetOf(hidden),shown:offsetOf(shown),smallError,smallWrites:patches-count};
  });
  assert(layout.result.unresolved>0,'An overcrowded cluster is reported rather than silently declared readable');
  for(const r of layout.boxes){assert(r.x>=5&&r.y>=5&&r.x+r.width<=315&&r.y+r.height<=235,'Labels remain in the viewport');assert(Math.hypot(Math.max(r.x-r.px,0,r.px-r.x-r.width),Math.max(r.y-r.py,0,r.py-r.y-r.height))<=49,'Labels stay close to their own point');}
  assert(layout.stable,'Repeated arrangement must not make labels wander');
  assert.notEqual(layout.hidden,layout.shown,'Only visible axes reserve label space');
  assert(layout.smallError.includes('展开画板')&&layout.smallWrites===0,'Collapsed viewport is rejected without changing labels');
  await page.locator('.dong-ggb-close').click();assert(await page.locator('#canvas').isVisible());
};

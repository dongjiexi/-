/* Teaching interaction contract with a deterministic GGB API seam, no inference. */
module.exports=async({page,assert,screenshot})=>{
  await page.addInitScript(()=>{
    let classroom;
    Object.defineProperty(window,'DongClassroom',{configurable:true,get:()=>classroom,set(value){classroom=value;const attach=value.attach;value.attach=api=>{window.__teachingApi=api;return attach(api);};}});
    window.GGBApplet=class{constructor(params){this.params=params;}inject(id){
      const names=new Set(),styles={},coords={},visibility={};let clientListener;
      const container=document.getElementById(id);container.replaceChildren();
      const graphics=document.createElement('canvas');graphics.style.cssText='width:100%;height:100%;display:block';container.append(graphics);
      const api=new Proxy({
        exists:n=>names.has(n),isDefined:n=>names.has(n),getAllObjectNames:()=>[...names],getObjectType:()=> 'point',
        evalCommand:command=>{const n=command.split(/[=:]/)[0].trim();names.add(n);return true;},newConstruction:()=>{names.clear();for(const n of Object.keys(styles))delete styles[n];},
        setCoords:(n,x,y)=>coords[n]=[x,y],getXcoord:n=>coords[n]?.[0]||0,getYcoord:n=>coords[n]?.[1]||0,
        getVisible:n=>visibility[n]!==false,setVisible:(n,v)=>visibility[n]=v,
        getLineThickness:n=>styles[n]?.line??3,setLineThickness:(n,v)=>{(styles[n]||=( {})).line=v;},
        getPointSize:n=>styles[n]?.point??5,setPointSize:(n,v)=>{(styles[n]||=( {})).point=v;},
        getBase64:cb=>{const data=btoa(JSON.stringify({names:[...names],styles,coords,visibility}));setTimeout(()=>cb(data),30);},
        setBase64:(raw,cb)=>{const data=JSON.parse(atob(raw));names.clear();data.names.forEach(n=>names.add(n));for(const n of Object.keys(styles))delete styles[n];Object.assign(styles,data.styles);Object.assign(coords,data.coords);Object.assign(visibility,data.visibility);cb();},
        getViewProperties:()=>({width:800,height:600,xMin:-4,yMin:-3,invXscale:.01,invYscale:.01}),
        registerClientListener:fn=>clientListener=fn
      },{get:(target,key)=>key in target?target[key]:()=>{}});
      window.__teachingGgb={api,styles,fire:event=>clientListener?.(event)};
      setTimeout(()=>this.params.appletOnLoad(api),10);
    }};
  });
  await page.reload();
  await page.locator('#openQuestionBank').click();await page.locator('[data-bank-id="2024-ii-3"]').click();await page.locator('[data-bank-action="full"]').click();
  await page.waitForFunction(()=>window.DongUnifiedBoard.isActive());
  await page.locator('#learningStyle').selectOption('step');await page.locator('.step-navigation button').first().click();
  const prior=await page.locator('.step-navigation span').first().textContent();
  await page.locator('#startClassroom').click();
  assert.equal(await page.locator('.step-navigation span').first().textContent(),prior,'Entering lecture preserves the saved reveal sequence');
  assert.match(await page.locator('#classroomProgress').textContent(),/^1 \/ /);
  await page.keyboard.press('PageDown');assert.match(await page.locator('#classroomProgress').textContent(),/^2 \/ /,'Inline GGB must not swallow lecture navigation');
  await page.keyboard.press('PageUp');assert.match(await page.locator('#classroomProgress').textContent(),/^1 \/ /);
  await page.locator('#zoomIn').focus();
  await page.keyboard.press('PageDown');
  assert.match(await page.locator('#classroomProgress').textContent(),/^1 \/ /,'Board-focused keys do not change the explanation');
  await page.locator('#nextStep').focus();
  for(const key of ['Control+ArrowRight','Alt+ArrowRight','Shift+ArrowRight']){
    await page.keyboard.press(key);assert.match(await page.locator('#classroomProgress').textContent(),/^1 \/ /,'Modified shortcuts must not reveal another step');
  }
  await page.locator('.unified-tools > summary').click();await page.keyboard.press('Escape');
  assert(await page.locator('#classroomBar').isVisible(),'Escape closes the tool menu before leaving the lecture');
  assert.equal(await page.locator('.unified-tools').evaluate(el=>el.open),false);
  await page.evaluate(()=>{const field=document.createElement('math-field');field.id='lecture-input-fixture';document.body.append(field);field.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,composed:true}));field.remove();});
  assert.match(await page.locator('#classroomProgress').textContent(),/^1 \/ /,'Formula editing must not reveal another step');
  const ink=page.locator('#classroomInk');assert(await ink.isVisible());assert.equal(await ink.evaluate(el=>el.parentElement.className),'dong-ggb-host');
  const rect=await ink.boundingBox(),host=await page.locator('.dong-ggb-host').boundingBox();assert(Math.abs(rect.width-host.width)<2&&Math.abs(rect.height-host.height)<2);
  await page.locator('#inkToggle').click();
  const originalScene=await page.locator('#sceneJson').inputValue();
  await page.mouse.move(rect.x+40,rect.y+50);await page.mouse.down();await page.mouse.move(rect.x+140,rect.y+100,{steps:6});await page.mouse.up();
  const hasInk=()=>ink.evaluate(el=>el.getContext('2d').getImageData(0,0,el.width,el.height).data.some((v,i)=>i%4===3&&v>0));
  assert(await hasInk(),'Red pen is visible over the primary GGB graphics');
  assert.equal(await page.locator('#sceneJson').inputValue(),originalScene,'Screen ink never creates geometry');
  assert(await page.locator('.board-toolbar').evaluate(el=>{const r=el.getBoundingClientRect();return !document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#classroomInk');}),'Ink does not cover the toolbar');
  await screenshot('teaching-primary-ink.png',null);
  await page.evaluate(()=>window.__teachingGgb.fire({type:'viewChanged2D'}));assert.equal(await hasInk(),false,'A changed graphics view clears obsolete screen marks');
  await page.keyboard.press('Escape');assert(await page.locator('#classroomBar').isHidden(),'Escape exits lecture even while the inline board dialog is open');

  const point='A',style=await page.evaluate(n=>{const a=window.DongGeoGebra.getAPI();return [a.getLineThickness(n),a.getPointSize(n)];},point);
  assert(await page.evaluate(n=>window.DongGeoGebra.getAPI().exists(n),point));
  await page.evaluate(n=>window.DongGeoGebra.highlight(['feature:'+n]),point);
  assert.deepEqual(await page.evaluate(n=>{const a=window.DongGeoGebra.getAPI();return [a.getLineThickness(n),a.getPointSize(n)];},point),[9,8]);
  const snapshot=await page.evaluate(async()=>{const record=await window.DongGeoGebra.save();return JSON.parse(atob(record.base64));});
  assert.deepEqual([snapshot.styles[point].line,snapshot.styles[point].point],style,'Saved styles do not contain transient answer-step emphasis');
  assert.deepEqual(await page.evaluate(n=>{const a=window.DongGeoGebra.getAPI();return [a.getLineThickness(n),a.getPointSize(n)];},point),[9,8],'Saving preserves the current UI emphasis');
  await page.evaluate(async()=>{const first=window.DongGeoGebra.save();window.DongGeoGebra.highlight(['feature:B']);await Promise.all([first,window.DongGeoGebra.save()]);});
  assert.deepEqual(await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI();return [a.getLineThickness('A'),a.getPointSize('A'),a.getLineThickness('B'),a.getPointSize('B')];}),[...style,9,8],'Overlapping saves preserve the latest selected highlight');
  await page.reload();await page.waitForFunction(()=>window.DongUnifiedBoard.isActive());
  assert.deepEqual(await page.evaluate(()=>{const a=window.DongGeoGebra.getAPI();return [a.getLineThickness('A'),a.getPointSize('A'),a.getLineThickness('B'),a.getPointSize('B')];}),[...style,...style],'Reload restores original styles with no stale highlight');

  await page.evaluate(()=>window.DongGeoGebra.highlight(['feature:A']));
  await page.getByRole('button',{name:'画板设置',exact:true}).click();
  await page.locator('#boardSettings [data-setting="object"]').selectOption('A');
  assert.equal(Number(await page.locator('#boardSettings [data-setting="thickness"]').inputValue()),style[0],'Settings reads the original style, not temporary step emphasis');
  await page.locator('#boardSettings [data-setting="thickness"]').fill('2');await page.locator('#boardSettings [data-setting="thickness"]').dispatchEvent('change');
  await page.locator('#boardSettings [data-close]').click();
  const edited=await page.evaluate(async()=>{window.DongGeoGebra.highlight(['feature:A']);const record=await window.DongGeoGebra.save();window.DongGeoGebra.highlight([]);return {saved:JSON.parse(atob(record.base64)).styles.A.line,live:window.DongGeoGebra.getAPI().getLineThickness('A')};});
  assert.deepEqual(edited,{saved:2,live:2},'A style edit survives later highlighting and saving');

  // A bounded native-only dependency tests renderer changes without dropping ink.
  await page.locator('#sceneJson').evaluate(el=>{el.value=JSON.stringify({type:'ellipse',a:3,b:2,showDynamic:false,objects:[{id:'restricted',kind:'construction',op:'point_on',refs:['$conic'],label:'T',t:.5,motionDomain:{parameter:{min:0,max:1,minClosed:false}}}]});document.querySelector('#applyJson').click();});
  await page.waitForFunction(()=>!window.DongUnifiedBoard.isActive());
  await page.locator('[data-inspector-view="lesson"]').click();
  await page.locator('#startClassroom').click();assert.equal(await ink.evaluate(el=>el.parentElement.className),'canvas-wrap');assert(await ink.isVisible(),'Native fallback uses the same screen-ink control');
  await page.keyboard.press('Escape');
};

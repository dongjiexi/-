/* Sourced lesson, deterministic fullscreen timing and multi-pointer input. */
module.exports=async({page,assert,screenshot})=>{
  await page.addInitScript(()=>{
    const state=window.__fullscreen={element:null,exits:0,pending:null,reject:false};
    Object.defineProperty(document,'fullscreenElement',{get:()=>state.element});
    Element.prototype.requestFullscreen=()=>new Promise((resolve,reject)=>{state.pending=()=>{state.pending=null;if(state.reject){reject(new Error('denied'));return;}state.element=document.documentElement;document.dispatchEvent(new Event('fullscreenchange'));resolve();};});
    document.exitFullscreen=async()=>{state.exits++;state.element=null;document.dispatchEvent(new Event('fullscreenchange'));};
  });
  await page.reload();
  await page.locator('#openQuestionBank').click();await page.locator('[data-bank-id="2024-ii-3"]').click();await page.locator('[data-bank-action="full"]').click();
  await page.locator('[data-inspector-view="lesson"]').click();await page.locator('#startClassroom').click();
  await page.locator('#classroomFullscreen').click();assert(await page.locator('#classroomFullscreen').isDisabled());
  await page.locator('#exitClassroom').click();await page.evaluate(()=>window.__fullscreen.pending());
  await page.waitForFunction(()=>!document.querySelector('#classroomFullscreen').disabled);
  assert.equal(await page.evaluate(()=>document.fullscreenElement),null,'A late fullscreen grant cannot reopen a closed lecture');
  await page.locator('#startClassroom').click();
  await page.evaluate(()=>{window.__fullscreen.element=document.documentElement;document.dispatchEvent(new Event('fullscreenchange'));});
  assert.equal(await page.locator('#classroomFullscreen').textContent(),'退出全屏');
  const exits=await page.evaluate(()=>window.__fullscreen.exits);
  await page.locator('#exitClassroom').click();assert.equal(await page.evaluate(()=>window.__fullscreen.exits),exits,'Leaving lecture preserves fullscreen established elsewhere');
  await page.evaluate(()=>document.exitFullscreen());await page.locator('#startClassroom').click();
  await page.locator('#classroomFullscreen').click();await page.evaluate(()=>window.__fullscreen.pending());
  await page.waitForFunction(()=>document.querySelector('#classroomFullscreen').getAttribute('aria-pressed')==='true');
  await page.locator('#exitClassroom').click();assert.equal(await page.evaluate(()=>document.fullscreenElement),null,'Lecture-owned fullscreen closes with the lecture');
  await page.locator('#startClassroom').click();await page.evaluate(()=>{window.__fullscreen.reject=true;});
  await page.locator('#classroomFullscreen').click();await page.evaluate(()=>window.__fullscreen.pending());
  await page.waitForFunction(()=>!document.querySelector('#classroomFullscreen').disabled);
  assert.match(await page.locator('#status').textContent(),/未允许切换全屏/);assert(await page.locator('#classroomBar').isVisible());

  await page.setViewportSize({width:390,height:844});await page.locator('[data-mobile-panel="board"]').click();
  await page.locator('#inkToggle').click();
  const original=await page.locator('#sceneJson').inputValue();
  const result=await page.locator('#classroomInk').evaluate(ink=>{
    // Synthetic pointers have no browser pointer capture; emulate that API only.
    const held=new Set();ink.setPointerCapture=id=>held.add(id);ink.hasPointerCapture=id=>held.has(id);ink.releasePointerCapture=id=>held.delete(id);
    const r=ink.getBoundingClientRect(),emit=(type,id,x,y,button=0)=>ink.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:r.left+x,clientY:r.top+y,button,bubbles:true}));
    emit('pointerdown',1,30,30);emit('pointermove',1,80,80);const first=ink.toDataURL();
    emit('pointerdown',2,150,150);emit('pointermove',2,180,180);emit('pointercancel',2,180,180);
    const ignored=ink.toDataURL()===first;emit('pointermove',1,100,100);const continued=ink.toDataURL()!==first;
    const beforeLost=ink.toDataURL();emit('lostpointercapture',1,100,100);emit('pointermove',1,120,120);const stopped=ink.toDataURL()===beforeLost;
    emit('pointerdown',3,140,30);emit('pointermove',3,160,60);document.querySelector('#inkToggle').click();const closed=ink.toDataURL();emit('pointermove',3,180,90);
    return {ignored,continued,stopped,toggleStops:ink.toDataURL()===closed,captured:held.size};
  });
  assert.deepEqual(result,{ignored:true,continued:true,stopped:true,toggleStops:true,captured:0});
  assert.equal(await page.locator('#sceneJson').inputValue(),original,'Touch ink never changes the question geometry');
  await page.locator('#undoInk').click();await page.locator('#clearInk').click();
  assert.equal(await page.locator('#classroomInk').evaluate(el=>el.getContext('2d').getImageData(0,0,el.width,el.height).data.some((v,i)=>i%4===3&&v)),false);
  await screenshot('classroom-controls-mobile.png',null);
};

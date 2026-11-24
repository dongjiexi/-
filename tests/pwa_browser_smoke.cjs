module.exports = async ({page, context, assert, baseURL}) => {
  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
  assert.equal(manifest, 'manifest.webmanifest');
  const response = await page.request.get(new URL('manifest.webmanifest', page.url()).href);
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => navigator.serviceWorker?.controller, null, {timeout: 15000});
  const registration = await page.evaluate(async () => {
    const item = await navigator.serviceWorker.ready;
    return {scope: item.scope, controlled: !!navigator.serviceWorker.controller};
  });
  assert.equal(registration.controlled, true);

  await context.setOffline(true);
  await page.reload({waitUntil: 'domcontentloaded'});
  assert.match(await page.title(), /董解析/);
  await page.locator('#question').fill('椭圆 C：x²/4+y²=1。');
  await page.locator('#parseButton').click();
  await page.locator('#scenePreviewDialog').waitFor({state: 'visible'});
  await page.locator('#confirmScenePreview').click();
  await page.waitForFunction(() => /确认并绘图/.test(document.querySelector('#status')?.textContent || ''));
  assert.match(await page.locator('#status').textContent(), /确认并绘图/);
  assert.equal(JSON.parse(await page.locator('#sceneJson').inputValue()).type, 'ellipse');
  await context.setOffline(false);

  // Real file import and object-manager controls, with the installed worker:
  // persistence must also work when the next page load has no network at all.
  const paired={schemaVersion:2,type:'circle',r:4,h:0,k:0,theta:35,theta2:120,lineThrough:'center',
    showConic:true,showFeatures:false,showDynamic:true,dynamicLine:true,dynamicLineLabel:'l₁',
    dynamicLineParts:[1,2],dynamicIntersectionLabels:['A','B'],activePart:2,
    pairedChord:{labels:['C','D'],lineLabel:'l₂',part:2,visible:true},points:{},lines:[],
    objects:[{id:'first-part-only',kind:'point',label:'Q',x:6,y:3,part:1,visible:true}]};
  await page.locator('#openNativeFile').setInputFiles({name:'paired-visibility.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(paired))});
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#sceneJson').value).pairedChord?.lineLabel==='l₂');
  const readScene=()=>page.locator('#sceneJson').inputValue().then(JSON.parse);
  const manager=page.locator('#objectManagerDialog'),filter=page.locator('#boardObjectFilter');
  const visibility=id=>manager.locator(`[data-object-id="${id}"][data-object-action="visibility"]`);
  const dynamicRows=()=>manager.locator('#boardObjects [data-object-action="select"]').evaluateAll(buttons=>buttons.map(button=>button.dataset.objectId).filter(id=>id==='$dynamic'||id==='$dynamic2').sort());
  const featureRows=()=>manager.locator('#boardObjects [data-object-action="select"]').evaluateAll(buttons=>buttons.map(button=>button.dataset.objectId).filter(id=>/^feature:[ABCD]$/.test(id)).sort());
  await page.locator('#openObjectManager').click();
  await filter.selectOption('all');
  await visibility('$dynamic').uncheck();
  await visibility('$dynamic2').uncheck();
  const hiddenPair=await readScene();
  assert.equal(hiddenPair.primaryDynamicVisible,false);
  assert.equal(hiddenPair.pairedChord.visible,false);
  assert.equal(hiddenPair.showDynamic,true,'Independent hiding does not disable the whole chord model');
  const persisted=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')).scene);
  assert.equal(persisted.primaryDynamicVisible,false);
  assert.equal(persisted.pairedChord.visible,false);
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#sceneJson').value).pairedChord?.lineLabel==='l₂');
  assert(await page.evaluate(()=>!!navigator.serviceWorker.controller),'Offline reload remains controlled by the installed worker');
  assert.deepEqual(await readScene(),hiddenPair,'Offline restoration preserves visibility, part scopes, angles, and object references');
  await page.locator('#openObjectManager').click();
  await filter.selectOption('current');
  assert.deepEqual(await dynamicRows(),['$dynamic','$dynamic2'],'Both chord rows belong to restored part 2 even when hidden');
  assert.equal(await manager.locator('[data-object-id="first-part-only"][data-object-action="select"]').count(),0,'Other-part objects do not enter the restored current-part view');
  assert.equal(await visibility('$dynamic').isChecked(),false);
  assert.equal(await visibility('$dynamic2').isChecked(),false);
  await filter.selectOption('visible');
  assert.deepEqual(await dynamicRows(),[]);
  assert.deepEqual(await featureRows(),[],'Hidden chords do not expose their intersection points after offline reload');
  await filter.selectOption('hidden');
  assert.deepEqual(await dynamicRows(),['$dynamic','$dynamic2']);
  // The row leaves the hidden filter immediately; check() would wait for the
  // removed checkbox again. Verify the new state through the visible list.
  await visibility('$dynamic').click();
  await filter.selectOption('visible');
  assert.deepEqual(await dynamicRows(),['$dynamic'],'The first line can be shown again entirely offline');
  assert.deepEqual(await featureRows(),['feature:A','feature:B']);
  assert.equal((await readScene()).pairedChord.visible,false,'Showing the primary line does not reveal the secondary line');
  await filter.selectOption('hidden');
  await visibility('$dynamic2').click();
  await filter.selectOption('visible');
  assert.deepEqual(await dynamicRows(),['$dynamic','$dynamic2']);
  assert.deepEqual(await featureRows(),['feature:A','feature:B','feature:C','feature:D'],'Both intersection pairs return with their own line');
  const visiblePair=await readScene();
  assert.deepEqual({...visiblePair,primaryDynamicVisible:false,pairedChord:{...visiblePair.pairedChord,visible:false}},hiddenPair,'Showing lines changes only their visibility flags');
  await context.setOffline(false);

  await page.evaluate(async () => {
    for (const item of await navigator.serviceWorker.getRegistrations()) await item.unregister();
    for (const key of await caches.keys()) await caches.delete(key);
  });
  await context.route('**/runtime-config.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.DONGJIEXI_CONFIG=Object.freeze({version:'0.12.0',deployment:'web',apiBase:'',apiEnabled:false,requiresAuth:false,updateChannel:'stable'});`
  }));
  await page.reload({waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => navigator.serviceWorker?.controller, null, {timeout: 15000});
  await context.setOffline(true);
  await page.reload({waitUntil: 'domcontentloaded'});
  const offlineWeb = await page.evaluate(() => window.DongRuntime?.config);
  assert.equal(offlineWeb.deployment, 'web');
  assert.equal(offlineWeb.apiEnabled, false);
  assert.match(await page.locator('#engineStatus').textContent(), /云端服务尚未配置.*画板和草稿/);
  const help=await context.newPage();
  await help.goto(new URL('about.html',baseURL).href,{waitUntil:'domcontentloaded'});
  assert.match(await help.locator('h1').textContent(),/使用、隐私与来源/,'Offline help navigation uses its own cached document');
  await help.close();
  await context.setOffline(false);

  await context.unroute('**/runtime-config.js');
  await context.route('**/runtime-config.js', route => route.fulfill({
    status: 503,
    contentType: 'text/plain',
    body: 'temporary deployment configuration outage'
  }));
  await page.reload({waitUntil: 'domcontentloaded'});
  const degradedWeb = await page.evaluate(() => window.DongRuntime?.config);
  assert.equal(degradedWeb.deployment, 'web');
  assert.equal(degradedWeb.apiEnabled, false);
  assert.match(await page.locator('#engineStatus').textContent(), /云端服务尚未配置.*画板和草稿/);
  console.log('PASS: installable PWA, controlled service worker, offline standard-equation board, independent paired visibility and scoped object-manager recovery after offline reload.');
};

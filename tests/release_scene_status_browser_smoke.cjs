/* Explicit renderer failure fixture: verifies UI honesty, not model accuracy. */
module.exports=async({page,context,assert})=>{
  const fs=require('node:fs'),path=require('node:path');
  await context.route('**/learning-ui.js*',route=>{
    const source=fs.readFileSync(path.join(process.env.DONG_TEST_SOURCE_ROOT||path.resolve(__dirname,'..'),'dist/learning-ui.js'),'utf8');
    return route.fulfill({contentType:'application/javascript',body:source.replace('window.DongLearning={attach,questionRepairSuggestion};','window.DongLearning={attach(api){const install=api.installScene;api.installScene=(...args)=>{if(window.__failGraphInstall)throw new Error("测试注入：绘图载入失败");return install(...args);};return attach(api);},questionRepairSuggestion};')});
  });
  await context.route('**/runtime-config.js*',route=>route.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:true,requiresAuth:false};'}));
  await context.route('**/api/health',route=>route.fulfill({json:{app:'董解析',capabilities:{transport:'sse'},engine:{available:true,installed:true,remote:true,models:['test-cloud']},default_model:'test-cloud'}}));
  await context.route('**/api/stream',route=>route.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:JSON.stringify({title:'绘图失败独立状态',parts:[{index:0,status:'answered',answer:'协议占位结论',steps:['协议占位推导']}],scene:{type:'circle',r:2,dynamicLine:false}})}}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'}));
  await page.evaluate(()=>localStorage.setItem('dongjiexi:solve-mode:v1','cloud'));await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#engineStatus').classList.contains('ready'));
  const bank=await page.evaluate(async()=>await(await fetch('question-bank.json')).json());
  await page.locator('#sceneJson').evaluate(el=>{el.value=JSON.stringify({type:'circle',r:7,showDynamic:false});document.querySelector('#applyJson').click();});
  const previous=JSON.parse(await page.locator('#sceneJson').inputValue());
  await page.evaluate(()=>window.__failGraphInstall=true);
  await page.locator('#question').fill(bank.items.find(q=>q.id==='2024-ii-3').question);await page.locator('#solveButton').click();
  await page.waitForFunction(()=>!document.querySelector('#solveButton').disabled&&document.querySelector('#solution').textContent.includes('绘图失败独立状态'));
  assert.match(await page.locator('.solve-review').textContent(),/图形：载入失败/);
  assert.match(await page.locator('#exploreNotice').textContent(),/当前画板不作为本题答案/);
  assert.deepEqual(JSON.parse(await page.locator('#sceneJson').inputValue()),previous,'Previous drawing survives an installation failure');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')));
  assert(saved.solution.scene_load_error);assert.equal(saved.solution.title,'绘图失败独立状态');
  await page.evaluate(()=>{window.__printCalls=0;window.print=()=>window.__printCalls++;});
  await page.locator('[data-lesson-action="print"]').click();
  assert.equal(await page.evaluate(()=>window.__printCalls),1);assert.equal(await page.locator('#printLesson img').count(),0,'Failed current graph must not print the previous question drawing');
};

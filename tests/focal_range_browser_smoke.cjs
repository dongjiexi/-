module.exports=async({page,context,assert})=>{
  let answer='$|AB|\\in(2,5)$';
  await context.route('**/runtime-config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:true,requiresAuth:false};'}));
  await context.route('**/api/health',route=>route.fulfill({json:{app:'董解析',engine:{available:true,installed:true,remote:true,models:['deepseek-flash']},default_model:'deepseek-flash'}}));
  await context.route('**/api/jobs',route=>route.fulfill({json:{id:'focal-range',status:'completed',result:{mode:'cloud-ai',title:'云端范围测试',restatement:question,parts:[{index:0,label:'完整题目',status:'answered',answer,steps:['测试夹具中的错误结论。']}],completion:{answered:1,total:1},scene:{type:'ellipse',a:2,b:Math.sqrt(3),objects:[{id:'wrong',kind:'point',label:'F',x:0,y:0}]}}}}));
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#modelName').value==='deepseek-flash');
  const question='椭圆 C: x²/4+y²/3=1，过右焦点 F 的直线 l 与 C 交于 A、B 两点，求弦长 |AB| 的取值范围。';
  for(const wrong of ['$|AB|\\in(2,5)$','$|AB|\\in(3,4)$']){
    answer=wrong;await page.locator('#question').fill(question);await page.locator('#solveButton').click();
    await page.waitForFunction(()=>document.querySelector('#solveProgress').dataset.state==='complete');
    const text=await page.locator('#solution').textContent();assert.match(text,/通过 [1-9]/);assert.match(text,/范围与端点可达性/);assert.doesNotMatch(text,/图形尚未完整呈现：F/);
    const tex=await page.locator('.answer-summary annotation').allTextContents();assert(tex.some(t=>t.includes('[3,4]')),'Wrong values and open endpoints must both be corrected');
    const scene=JSON.parse(await page.locator('#sceneJson').inputValue());assert.equal(scene.lineThrough,'focus2');assert.deepEqual(scene.dynamicIntersectionLabels,['A','B']);assert.deepEqual(scene.points.F,[1,0]);
  }
};

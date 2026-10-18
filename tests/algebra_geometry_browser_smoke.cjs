const bank=require('../dist/question-bank.json');
module.exports=async({page,context,assert,screenshot})=>{
 const q=bank.items.find(x=>x.id==='2023-ii-5').question.replace('的左右焦点记为','的左、右焦点分别为').replace('截椭圆于','与椭圆C相交于').replace('$A,B$；','$A,B$两点，');
 const vector='已知'+bank.items.find(x=>x.id==='2024-ii-3').question.replace('向量','平面向量');
 for(const raw of [q,vector]){
  await page.locator('#question').fill(raw);await page.locator('#solveButton').click();
  await page.waitForFunction(()=>document.querySelector('#solveProgress').dataset.state==='complete');
  const r=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')).solution);
  assert.equal(r.restatement,raw);assert.equal(r.completion.answered,1);assert(r.scene.boundedAlgebra);assert.equal(await page.locator('#solution .katex-error').count(),0);
 }
 await screenshot('algebra-equivalent-wording.png',null);
 await context.route('**/runtime-config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:true,requiresAuth:false};'}));
 await context.route('**/api/health',route=>route.fulfill({json:{app:'董解析',engine:{available:true,installed:true,remote:true,models:['deepseek-flash']},default_model:'deepseek-flash'}}));
 let calls=0;
 await context.route('**/api/jobs',route=>{calls++;return route.fulfill({json:{id:'algebra-cloud',status:'completed',result:{mode:'cloud-ai',title:'云端面积比校验',restatement:q,answer:'错误候选',parts:[{index:0,label:'面积比',status:'answered',answer:'错误候选',steps:['错误候选']}],completion:{answered:1,total:1},scene:{type:'ellipse',a:9,b:2,showDynamic:false,points:{},lines:[],objects:[]}}}});});
 await page.evaluate(()=>localStorage.setItem('dongjiexi:solve-mode:v1','cloud'));
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('#modelName').value==='deepseek-flash');
 await page.locator('#question').fill(q);await page.locator('#solveButton').click();
 await page.waitForFunction(()=>document.querySelector('#solution').textContent.includes('云端面积比校验'));
 const r=await page.evaluate(()=>JSON.parse(localStorage.getItem('zhigeometry:last')).solution);
 assert(calls>0);assert(r.scene.boundedAlgebra);assert.equal(r.model_scene.a,9);assert(Math.abs(r.scene.a-Math.sqrt(3))<1e-8);assert.notEqual(r.answer,'错误候选');assert(r.parts[0].steps.some(s=>s.includes('排除')));
 assert.equal(await page.locator('#solution .katex-error').count(),0);
};

const fs=require('node:fs'),path=require('node:path');

module.exports=async({page,context,assert,screenshot})=>{
  const question=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/question-bank.json'),'utf8')).items.find(q=>q.id==='2022-ii-21-1').question;
  const first=question.indexOf('\n（1）'),second=question.indexOf('\n（2）');
  const page1=question.slice(0,second),page2='数学试题 第 2 页（共 2 页）\n'+question.slice(0,first)+question.slice(second);
  await context.route('**/runtime-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:true,requiresAuth:false};'}));
  await context.route('**/api/health',r=>r.fulfill({json:{app:'董解析',capabilities:{transport:'sse'},engine:{available:true,remote:true,vision:true,vision_model:'deepseek-flash',models:['deepseek-flash']}}}));
  const uploaded=[];
  let failSecond=true;
  await context.route('**/api/recognize',r=>{
    const body=r.request().postDataJSON();
    const bytes=Buffer.from(body.image.split(',')[1],'base64'),width=bytes.readUInt32BE(16);
    uploaded.push(width);
    if(width===460&&failSecond){failSecond=false;return r.fulfill({status:503,json:{error:'第 2 页网络中断'}});}
    const reply=width===440?{text:page1,uncertainties:[]}:{text:page2,uncertainties:['请核对斜率中的根号']};
    return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:JSON.stringify(reply)}}]})+
      '\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#cloudVisionChoice').waitFor({state:'visible'});
  const make=async(width,name)=>({name,mimeType:'image/png',buffer:Buffer.from(await page.evaluate(width=>{
    const c=document.createElement('canvas');c.width=width;c.height=210;const ctx=c.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#27211b';ctx.font='30px sans-serif';ctx.fillText('Math page '+width,20,80);
    return c.toDataURL('image/png').split(',')[1];
  },width),'base64')});
  const a=await make(440,'01.png'),b=await make(460,'02.png'),c=await make(480,'03.png');
  await page.locator('#question').fill('当前题稿保持原样');
  await page.locator('#imageFile').setInputFiles([b,a]);
  assert.deepEqual(uploaded,[],'Choosing files does not upload');
  await page.getByRole('button',{name:'上移第 2 页'}).click();
  assert.match(await page.locator('#imagePageList li').first().textContent(),/01\.png/);
  await page.locator('#recognizeButton').click();
  await page.waitForFunction(()=>document.querySelector('#recognizeButton').textContent==='继续识别'&&!document.querySelector('#recognizeButton').disabled);
  assert.deepEqual(uploaded,[440,460]);
  assert.match(await page.locator('#imagePageList li').first().textContent(),/已识别/);
  assert.match(await page.locator('#imagePageList li').last().textContent(),/识别失败/);
  assert.equal(await page.locator('#question').inputValue(),'当前题稿保持原样');
  assert(!await page.locator('#recognitionDialog').evaluate(d=>d.open));
  await page.locator('#recognizeButton').click();
  await page.locator('#recognitionDialog[open]').waitFor();
  assert.deepEqual(uploaded,[440,460,460],'Retry reuses the successful first page');
  assert.equal(await page.locator('#recognizedText').inputValue(),question);
  assert.match(await page.locator('#recognitionJoinNotice').textContent(),/已合并 1 处/);
  await page.setViewportSize({width:390,height:844});
  await page.locator('#recognitionPageSelect').selectOption('1');
  await page.waitForFunction(()=>document.querySelector('#recognitionOriginal')?.naturalWidth===460);
  await page.locator('#recognitionPageSource summary').click();
  assert.equal(await page.locator('#recognitionPageText').textContent(),page2);
  assert.match(await page.locator('#recognitionWarnings').textContent(),/第 2 页/);
  assert(await page.locator('#recognitionDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1));
  await screenshot('recognition-pages-mobile.png','#recognitionDialog');
  await page.locator('#recognizedText').fill(question.replace('（2）','（3）'));
  assert.match(await page.locator('#recognitionDuplicateNotice').textContent(),/跳号/);
  const duplicate=question+'\n（2）另求一条直线。';
  await page.locator('#recognizedText').fill(duplicate);
  await page.locator('#recognitionReviewed').check();
  await page.locator('#confirmRecognition').click();
  assert(await page.locator('#recognitionDuplicateNotice').isVisible());
  assert(await page.locator('#recognitionDialog').evaluate(d=>d.open));
  assert.equal(await page.locator('#question').inputValue(),'当前题稿保持原样');
  await page.locator('#recognitionDialog [data-close-dialog]').click();
  await page.locator('#recognizeButton').click();
  await page.locator('#recognitionDialog[open]').waitFor();
  assert.equal(await page.locator('#recognizedText').inputValue(),duplicate,'Reopening a completed batch retains the edited draft');
  assert.deepEqual(uploaded,[440,460,460],'Reviewing again performs no upload');
  await page.locator('#recognizedText').fill(question);
  await page.locator('#recognitionReviewed').check();
  await page.locator('#confirmRecognition').click();
  assert.equal(await page.locator('#question').inputValue(),question);
  await page.locator('[data-mobile-panel="input"]').click();
  await page.locator('#parseButton').click();
  await page.locator('#scenePreviewDialog[open]').waitFor();
  const preview=JSON.parse(await page.locator('#scenePreviewJson').inputValue());
  assert.equal(preview.asymptoteMidpoint.part,2);
  assert(preview.objects.some(node=>node.id==='asymptote-midpoint-middle'&&node.op==='midpoint'));
  await page.locator('#cancelScenePreview').click();

  await page.locator('#removeImage').click();
  await page.locator('#preferCloudVision').uncheck();
  await page.evaluate(({page1,page2})=>{
    window.__ocrPages={created:0,ended:0,files:[]};
    window.Tesseract={createWorker:async()=>{
      window.__ocrPages.created++;
      return{
        recognize:async file=>{
          window.__ocrPages.files.push(file.name);
          if(file.name==='02.png'&&!window.__ocrPages.released)await new Promise(resolve=>{window.__ocrPages.release=()=>{window.__ocrPages.released=true;resolve();};});
          const text=file.name==='01.png'?page1:file.name==='02.png'?page2:'注：核对题面中的正负号与小问编号，注意保留题中的渐近线、焦点及动点条件，并检查是否还包含下一页的小问。';
          return{data:{text,confidence:99}};
        },
        terminate:async()=>{window.__ocrPages.ended++;}
      };
    }};
  },{page1,page2});
  await page.locator('#imageFile').setInputFiles([a,b]);
  await page.locator('#cameraFile').setInputFiles(c);
  assert.equal(await page.locator('#imagePageList li').count(),3,'Camera appends to existing pages');
  await page.locator('#recognizeButton').click();
  await page.waitForFunction(()=>typeof window.__ocrPages.release==='function');
  await page.locator('#cancelJob').click();
  await page.evaluate(()=>window.__ocrPages.release());
  await page.waitForFunction(()=>document.querySelector('#recognizeButton').textContent==='继续识别'&&!document.querySelector('#recognizeButton').disabled);
  const local=()=>page.evaluate(()=>({created:window.__ocrPages.created,ended:window.__ocrPages.ended,files:window.__ocrPages.files}));
  assert.deepEqual(await local(),{created:1,ended:1,files:['01.png','02.png']});
  await page.locator('#recognizeButton').click();
  await page.locator('#recognitionDialog[open]').waitFor();
  await page.waitForFunction(()=>window.__ocrPages.ended===2);
  assert.deepEqual(await local(),{created:2,ended:2,files:['01.png','02.png','03.png']});
  assert.match(await page.locator('#recognizedText').inputValue(),/注意保留题中的渐近线/);
  assert.deepEqual(uploaded,[440,460,460],'Browser OCR submits no cloud images');
};

const fs=require('node:fs'),path=require('node:path');

module.exports=async({page,context,assert,screenshot})=>{
  const question=JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/question-bank.json'),'utf8')).items.find(q=>q.id==='2022-ii-21-1').question;
  const second=question.indexOf('\n（2）');
  const uploads=[];
  let failAdjusted=true;
  await context.route('**/runtime-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:true,requiresAuth:false};'}));
  await context.route('**/api/health',r=>r.fulfill({json:{app:'董解析',capabilities:{transport:'sse'},engine:{available:true,remote:true,vision:true,vision_model:'deepseek-flash',models:['deepseek-flash']}}}));
  await context.route('**/api/recognize',r=>{
    const {image}=r.request().postDataJSON(),bytes=Buffer.from(image.split(',')[1],'base64');
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
    uploads.push({image,width,height});
    if(width===480&&failAdjusted){failAdjusted=false;return r.fulfill({status:503,json:{error:'网络中断'}});}
    const text=width===410?question.slice(second):question.slice(0,second);
    return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({choices:[{delta:{content:JSON.stringify({text,uncertainties:[]})}}]})+
      '\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  const make=async(sideways,name)=>({name,mimeType:'image/png',buffer:Buffer.from(await page.evaluate(sideways=>{
    const c=document.createElement('canvas');c.width=sideways?400:410;c.height=sideways?600:240;
    const ctx=c.getContext('2d');
    if(sideways){ctx.translate(0,600);ctx.rotate(-Math.PI/2);}
    ctx.fillStyle='#a02020';ctx.fillRect(0,0,sideways?600:410,400);
    ctx.fillStyle='white';ctx.fillRect(60,80,480,240);
    ctx.fillStyle='#126635';ctx.fillRect(60,80,22,22);
    ctx.fillStyle='#2140a0';ctx.fillRect(518,298,22,22);
    ctx.fillStyle='black';ctx.font='34px sans-serif';ctx.fillText('F(2,0)    y = ±√3x',95,155);
    return c.toDataURL().split(',')[1];
  },sideways),'base64')});
  const a=await make(true,'page-1.png'),b=await make(false,'page-2.png');
  await page.locator('#imageFile').setInputFiles([a,b]);
  await page.locator('#cloudVisionChoice').waitFor({state:'visible'});
  const dialog=page.locator('#imageAdjustDialog'),stage=page.locator('#imageAdjustStage');
  const adjust=async()=>{
    await page.locator('#openImageAdjust').click();
    await stage.waitFor({state:'visible'});
  };
  const apply=async()=>{
    await page.locator('#applyImageAdjust').click();
    await dialog.waitFor({state:'hidden'});
  };
  const dimensions=()=>uploads.map(({width,height})=>[width,height]);
  const review=page.locator('#recognitionDialog');
  const checkPreview=async(selector,width,height)=>page.waitForFunction(({selector,width,height})=>{
    const image=document.querySelector(selector);
    return image.naturalWidth===width&&image.naturalHeight===height;
  },{selector,width,height});

  await adjust();
  assert(await page.locator('#applyImageAdjust').isDisabled());
  await page.getByRole('button',{name:'右转 90°',exact:false}).click();
  assert.match(await page.locator('#imageAdjustSize').textContent(),/600 × 400/);
  const box=await stage.boundingBox();
  await page.mouse.move(box.x+box.width*.1,box.y+box.height*.2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.9,box.y+box.height*.8,{steps:8});
  await page.mouse.up();
  // Set precise crop edges with keyboard after exercising pointer selection.
  const crop=async(left,top,right,bottom)=>page.locator('[data-crop-edge]').evaluateAll((edges,values)=>{
    for(const edge of edges){edge.value=values[edge.dataset.cropEdge];edge.dispatchEvent(new Event('input',{bubbles:true}));}
  },{left,top,right,bottom});
  assert(await page.locator('[data-crop-edge="left"]').evaluate(el=>Number(el.value)>80));
  await crop(100,200,900,800);
  assert.match(await page.locator('#imageAdjustSize').textContent(),/480 × 240/);
  await page.getByRole('button',{name:'左转 90°',exact:false}).click();
  assert.match(await page.locator('#imageAdjustSize').textContent(),/240 × 480/);
  await page.getByRole('button',{name:'右转 90°',exact:false}).click();
  await apply();
  await checkPreview('#questionImage',480,240);
  assert.deepEqual(uploads,[]);

  await page.locator('#recognizeButton').click();
  await page.waitForFunction(()=>document.querySelector('#recognizeButton').textContent==='继续识别'&&!document.querySelector('#recognizeButton').disabled);
  assert.deepEqual(dimensions(),[[480,240]]);
  await page.locator('#recognizeButton').click();
  await review.waitFor({state:'visible'});
  assert.deepEqual(dimensions(),[[480,240],[480,240],[410,240]]);
  assert.equal(uploads[1].image,uploads[0].image,'Retry sends the same adjusted pixels');
  const colors=await page.evaluate(async image=>{
    const bitmap=await createImageBitmap(await (await fetch(image)).blob());
    const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();
    return [[5,5],[475,235]].map(([x,y])=>[...ctx.getImageData(x,y,1,1).data]);
  },uploads[0].image);
  assert.deepEqual(colors,[[18,102,53,255],[33,64,160,255]],'Crop uses the exact oriented selection');
  await checkPreview('#recognitionOriginal',480,240);
  await page.locator('[data-review-view="actual"]').click();
  assert.equal(await page.locator('#recognitionImageScale').textContent(),'100%');
  await page.locator('#toggleRecognitionOriginal').click();
  await checkPreview('#recognitionOriginal',400,600);
  assert.equal(await page.locator('[data-review-view="fit"]').getAttribute('aria-pressed'),'true');
  await page.locator('#toggleRecognitionOriginal').click();
  await checkPreview('#recognitionOriginal',480,240);
  assert.equal(await page.locator('#recognitionImageScale').textContent(),'100%');
  await page.locator('#recognitionPageSelect').selectOption('1');
  assert(!await page.locator('#toggleRecognitionOriginal').isVisible());
  assert.equal(await page.locator('#recognizedText').inputValue(),question);
  await review.locator('[data-close-dialog]').click();

  await page.setViewportSize({width:320,height:760});
  await adjust();
  assert(await page.locator('#applyImageAdjust').isDisabled(),'Opening the editor does not change the page');
  const touch=await context.newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  await stage.scrollIntoViewIfNeeded();
  const rect=await stage.boundingBox();
  const points=(x,y)=>[{x:rect.x+rect.width*x,y:rect.y+rect.height*y}];
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(.15,.25)});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(.85,.75)});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert(!await page.locator('#applyImageAdjust').isDisabled());
  assert(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth+1));
  await screenshot('image-adjust-mobile.png','#imageAdjustDialog');
  await dialog.locator('[data-close-dialog]').click();
  await checkPreview('#questionImage',480,240);
  assert.equal(await page.locator('#recognizeButton').textContent(),'核对合并题面');

  await adjust();
  await page.locator('#imageAdjustTilt').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#imageAdjustAngle').textContent(),'1°');
  await apply();
  assert.match(await page.locator('#imagePageList li').first().textContent(),/待识别/);
  assert.match(await page.locator('#imagePageList li').last().textContent(),/已识别/);
  await page.locator('#recognizeButton').click();
  await review.waitFor({state:'visible'});
  assert.equal(uploads.length,4,'Applying a new angle invalidates only the edited page');
  assert.notEqual(uploads[3].image,uploads[1].image);
  await review.locator('[data-close-dialog]').click();

  await adjust();
  await page.locator('#resetImageAdjust').click();
  await apply();
  await checkPreview('#questionImage',400,600);
  await page.locator('#recognizeButton').click();
  await review.waitFor({state:'visible'});
  assert.deepEqual(dimensions().slice(-1),[[400,600]]);
  assert(!await page.locator('#toggleRecognitionOriginal').isVisible());
  await review.locator('[data-close-dialog]').click();

  await page.locator('#removeImage').click();
  await page.evaluate(text=>{
    window.Tesseract={createWorker:async()=>({
      recognize:async file=>{
        const bitmap=await createImageBitmap(file);
        window.__ocrSize=[bitmap.width,bitmap.height];bitmap.close();
        return {data:{text,confidence:99}};
      },terminate:async()=>{}
    })};
  },question);
  await page.locator('#imageFile').setInputFiles(a);
  await page.locator('#preferCloudVision').uncheck();
  await adjust();
  await page.getByRole('button',{name:'右转 90°',exact:false}).click();
  await crop(100,200,900,800);
  await apply();
  await page.locator('#recognizeButton').click();
  await review.waitFor({state:'visible'});
  assert.deepEqual(await page.evaluate(()=>window.__ocrSize),[480,240]);
  assert.equal(uploads.length,5,'Browser OCR submits no cloud images');
};

module.exports=async({page,context,assert,screenshot})=>{
  await context.route('**/runtime-config.js',r=>r.fulfill({contentType:'application/javascript',
    body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:false};'}));
  await page.reload({waitUntil:'domcontentloaded'});
  const files=await page.evaluate(()=>[[1000,2200],[1600,500]].map(([width,height])=>{
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fffefa';ctx.fillRect(0,0,width,height);
    ctx.fillStyle='#332319';ctx.font='54px serif';
    ctx.fillText('x²/4 + y² = 1',60,100);
    ctx.fillText('P(1,0)',70,height-100);
    return canvas.toDataURL('image/png').split(',')[1];
  }));
  await page.evaluate(()=>{
    window.__pageReads=[];
    window.Tesseract={createWorker:async()=>({
      recognize:async file=>{
        window.__pageReads.push(file.name);
        const text=file.name==='tall.png'?'已知平面直角坐标系中的椭圆 C 满足 x²/4+y²=1，且长轴位于 x 轴上。\n（1）求椭圆的两个焦点。':'（2）已知 P(1,0)，过 P 作一条动直线交椭圆于 A、B 两点，求弦 AB 长度的取值范围。';
        return{data:{confidence:99,text}};
      },terminate:async()=>{}
    })};
  });
  await page.locator('#imageFile').setInputFiles(files.map((data,index)=>({
    name:index?'wide.png':'tall.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')
  })));
  await page.locator('#recognizeButton').click();
  const dialog=page.locator('#recognitionDialog'),image=page.locator('#recognitionOriginal');
  const viewport=page.locator('#recognitionImageViewport'),input=page.locator('#recognizedText');
  const scale=page.locator('#recognitionImageScale'),fit=page.locator('[data-review-view="fit"]');
  const geometry=()=>viewport.evaluate(frame=>({
    width:frame.clientWidth,height:frame.clientHeight,scrollWidth:frame.scrollWidth,scrollHeight:frame.scrollHeight,
    left:frame.scrollLeft,top:frame.scrollTop
  }));
  await dialog.waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#recognitionImageScale').value!=='—');
  let view=await geometry();
  assert(view.scrollHeight<=view.height+1,'Initial view fits the whole long page');
  assert(await page.locator('#previousRecognitionPage').isDisabled());
  await page.locator('[data-review-view="width"]').click();
  view=await geometry();
  assert(view.scrollHeight>view.height*2&&view.top===0,'Fit width opens the top of a long readable page');
  await page.locator('[data-review-view="actual"]').click();
  assert.equal(await scale.textContent(),'100%');
  const frame=await viewport.boundingBox(),center={x:frame.x+frame.width/2,y:frame.y+frame.height/2};
  const before=await geometry();
  await page.mouse.move(center.x,center.y);
  await page.mouse.down();
  await page.mouse.move(center.x-50,center.y-90,{steps:6});
  await page.mouse.up();
  const panned=await geometry();
  assert(panned.top>before.top&&panned.left>before.left,'Desktop drag pans both axes');
  await viewport.press('+');
  assert.equal(await scale.textContent(),'140%');

  const draft=(await input.inputValue())+'\n用户已核对分数。';
  await input.fill(draft);
  const savedView=await geometry();
  await page.locator('#nextRecognitionPage').click();
  await page.waitForFunction(()=>document.querySelector('#recognitionOriginal').naturalWidth===1600);
  assert(await page.locator('#nextRecognitionPage').isDisabled());
  assert.equal(await fit.getAttribute('aria-pressed'),'true');
  await page.locator('#previousRecognitionPage').click();
  await page.waitForFunction(()=>document.querySelector('#recognitionImageScale').value==='140%');
  assert(Math.abs((await geometry()).top-savedView.top)<3,'Each page retains its reading position');
  assert.equal(await input.inputValue(),draft);

  await page.setViewportSize({width:320,height:780});
  await viewport.press('0');
  await page.locator('#expandRecognitionImage').click();
  assert.equal(await page.locator('#expandRecognitionImage').getAttribute('aria-expanded'),'true');
  await page.locator('[data-review-view="width"]').click();
  const phoneView=await geometry();
  assert(phoneView.scrollHeight>phoneView.height);
  await screenshot('image-review-viewer-mobile.png','#recognitionDialog');
  await viewport.scrollIntoViewIfNeeded();
  const touch=await context.newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  const area=await viewport.boundingBox(),x=area.x+area.width/2,y=area.y+area.height*.6;
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let step=1;step<=5;step++){
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-18*step}]});
    await page.waitForTimeout(30);
  }
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>document.querySelector('#recognitionImageViewport').scrollTop>20);
  await page.locator('#jumpRecognitionText').click();
  assert(await input.evaluate(el=>el===document.activeElement));
  await page.locator('#jumpRecognitionImage').click();
  assert(await viewport.evaluate(el=>el===document.activeElement));
  assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.equal(await input.inputValue(),draft);
  assert.deepEqual(await page.evaluate(()=>window.__pageReads),['tall.png','wide.png'],'Viewing images does not rerun OCR');
  assert.equal(await image.getAttribute('alt'),'第 1 页原图');
  await page.locator('#confirmRecognition').click();
  assert.equal(await page.locator('#question').inputValue(),draft);
};

const {raw,checked}=require('./fixtures/ocr-math-review.json');

module.exports=async({page,context,assert,screenshot})=>{
  await context.route('**/runtime-config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.DONGJIEXI_CONFIG={deployment:"web",apiEnabled:false};'}));
  await page.reload({waitUntil:'domcontentloaded'});
  const input=page.locator('#recognizedText'),dialog=page.locator('#recognitionDialog');
  const picture=Buffer.from(await page.evaluate(()=>{
    const c=document.createElement('canvas');c.width=500;c.height=210;return c.toDataURL().split(',')[1];
  }),'base64');
  await page.evaluate(text=>{
    const cut=text.lastIndexOf('\n');
    window.Tesseract={createWorker:async()=>({
      recognize:async file=>({data:{confidence:97,text:file.name==='stem.png'?text.slice(0,cut):text.slice(cut+1)}}),
      terminate:async()=>{}
    })};
  },raw);
  await page.locator('#question').fill('当前题稿');
  await page.locator('#imageFile').setInputFiles(['stem.png','choices.png'].map(name=>({name,mimeType:'image/png',buffer:picture})));
  await page.locator('#recognizeButton').click();
  await dialog.waitFor({state:'visible'});
  const merged=await input.inputValue();
  const kinds=await dialog.locator('[data-review-kind]').evaluateAll(buttons=>buttons.map(b=>b.dataset.reviewKind));
  assert.deepEqual(kinds,['polygon','segment','angle','vector','choices']);
  assert.equal(await page.locator('#question').inputValue(),'当前题稿');
  assert(!await page.locator('#recognitionReview').isVisible(),'Text heuristics are advisory');
  const selected=()=>input.evaluate(el=>el.value.slice(el.selectionStart,el.selectionEnd));
  await dialog.locator('[data-review-kind="choices"]').click();
  assert.equal(await selected(),'SC 44 D. [4,6]');
  assert.equal(await page.locator('#recognitionPageSelect').inputValue(),'1','A unique selection opens its source page');
  await page.locator('#recognitionPageSource summary').click();
  assert.equal(await page.locator('#recognitionPageText').textContent(),'SC 44 D. [4,6]');
  await dialog.locator('[data-review-kind="segment"]').click();
  assert.equal(await selected(),'4C');
  assert.equal(await page.locator('#recognitionPageSelect').inputValue(),'0');
  assert.equal(await input.inputValue(),merged,'Highlighting preserves the transcription');
  await page.setViewportSize({width:320,height:780});
  assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await screenshot('recognition-review-mobile.png','#recognitionFindings');

  await dialog.locator('[data-open-math-keyboard]').click();
  const keyboard=dialog.locator('#mathKeyboard');
  await keyboard.waitFor({state:'visible'});
  await keyboard.getByRole('button',{name:'π',exact:true}).click();
  assert.match(await input.inputValue(),/π=3/);
  assert.equal(await page.locator('#question').inputValue(),'当前题稿','Keyboard edits only the review copy');
  await keyboard.locator('[data-key-command="close"]').click();
  await input.fill(checked);
  assert(!await page.locator('#recognitionFindings').isVisible());
  await page.locator('#confirmRecognition').click();
  assert.equal(await page.locator('#question').inputValue(),checked);

  await page.locator('#removeImage').click();
  await page.locator('#imageFile').setInputFiles({name:'stem.png',mimeType:'image/png',buffer:picture});
  await page.locator('#recognizeButton').click();
  await dialog.waitFor({state:'visible'});
  await page.locator('#recognitionPageSource summary').click();
  assert.match(await page.locator('#recognitionPageText').textContent(),/4C=3/);
  assert(!await page.locator('#recognitionPageControl').isVisible());
  const single=await input.inputValue();
  await page.locator('#confirmRecognition').click();
  assert.equal(await page.locator('#question').inputValue(),single,'Confirmed advisory hints do not block submission');
};

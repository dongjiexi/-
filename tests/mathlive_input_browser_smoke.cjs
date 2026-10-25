module.exports=async({page,assert,screenshot})=>{
  await page.locator('[data-mobile-panel="board"]').click({force:true}).catch(()=>{});
  if(await page.locator('.board-shell').isHidden())await page.locator('[data-mobile-panel="board"]').click();
  if(await page.locator('.board-shell').evaluate(element=>element.classList.contains('toolbox-collapsed')))await page.locator('#toolboxToggle').click();
  await page.locator('[data-add-conic="circle"]').click();
  const radius=page.locator('#addConicFields [data-equation-param="r"]');
  await radius.focus();
  await page.locator('#addConicDialog [data-open-math-keyboard]').click();
  await page.locator('#mathLiveField').waitFor({state:'visible'});
  const numeric=page.locator('#mathKeyboardKeys');
  assert.equal(await numeric.getAttribute('data-layout'),'common');
  assert.equal(await numeric.locator('button').count(),24,'Numeric keypad has four six-key rows');
  await radius.fill('');await radius.focus();
  await numeric.getByRole('button',{name:'a/b',exact:true}).click();
  await numeric.getByRole('button',{name:'1',exact:true}).click();
  assert.equal(await radius.inputValue(),'(1)/()','Fraction template places the cursor in the numerator');
  const firstTab=page.locator('#math-tab-common');await firstTab.focus();await page.keyboard.press('ArrowRight');
  assert.equal(await numeric.getAttribute('data-layout'),'letters');
  await numeric.getByRole('button',{name:'A',exact:true}).click();
  assert((await radius.inputValue()).includes('A'),'Letter keyboard writes to the selected parameter');
  await page.locator('#math-tab-common').click();
  await page.setViewportSize({width:390,height:844});
  assert(await numeric.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Numeric keys fit a phone without horizontal scrolling');
  await screenshot('numeric-keyboard-mobile.png',null);
  await page.locator('#mathLiveField').evaluate(field=>{
    // Reconnect and type in the same task, before requestAnimationFrame can run.
    window.DongMathLive.connect(document.querySelector('#mathKeyboard'),document.querySelector('#addConicFields [data-equation-param="r"]'));
    field.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,inputType:'insertText',data:'5/2'}));
    field.value='\\frac{5}{2}';field.dispatchEvent(new Event('input',{bubbles:true}));
  });
  assert.equal(await radius.inputValue(),'\\frac{5}{2}','MathLive content must write back to the active parameter field');
  assert.match(await page.locator('#mathKeyboard').innerText(),/微积分与矩阵/,'Fallback keyboard must include the advanced symbol group');
  await page.locator('#mathKeyboard [data-key-command="close"]').click();
  await page.locator('#confirmAddConic').click();
  const scene=JSON.parse(await page.locator('#sceneJson').inputValue());
  assert.equal(scene.objects.at(-1).r,2.5);
  console.log('PASS: self-hosted MathLive edits structured parameters and the expanded keyboard remains available.');
};

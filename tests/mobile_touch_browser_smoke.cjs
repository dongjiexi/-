module.exports=async({page,baseURL,assert,errors})=>{
  const context=await page.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const phone=await context.newPage();phone.on('pageerror',error=>errors.push(error.message));
  try{
    await phone.goto(baseURL,{waitUntil:'domcontentloaded'});
    await phone.locator('#question').fill('椭圆x²/9+y²/4=1。');
    await phone.locator('#parseButton').tap();await phone.locator('#scenePreviewDialog').waitFor({state:'visible'});await phone.locator('#confirmScenePreview').tap();
    assert.equal(await phone.locator('#inputPanelToggle').isVisible(),false,'手机端不应显示无效的隐藏题目按钮');
    assert(await phone.locator('#canvas').isVisible(),'确认绘图后直接看到画板');
    assert(await phone.locator('#question').isHidden(),'确认绘图后不会停留在输入栏');
    await phone.locator('#toolboxToggle').tap();
    assert.equal(await phone.locator('#toolboxMobileCollapse').isVisible(),true,'展开作图工具后必须显示手机端收起按钮');
    await phone.locator('[data-add-conic="circle"]').tap();
    const dialog=await phone.locator('#addConicDialog').boundingBox();assert(dialog.x>=0&&dialog.x+dialog.width<=391,'手机模板弹窗不能超出屏幕');
    await phone.locator('#addConicFields [data-equation-param="r"]').fill('');
    await phone.locator('#addConicDialog [data-open-math-keyboard]').tap();
    for(const value of ['3','÷','2'])await phone.locator('#mathKeyboard').getByRole('button',{name:value,exact:true}).tap();
    await phone.locator('#mathKeyboard [data-key-command="close"]').tap();
    await phone.locator('#confirmAddConic').tap();
    const scene=JSON.parse(await phone.locator('#sceneJson').inputValue());assert.equal(scene.type,'ellipse');assert.equal(scene.objects.at(-1).r,1.5);
    await phone.locator('#toolboxMobileCollapse').tap();
    assert.equal(await phone.locator('#nativeToolbar').isVisible(),false,'手机端收起按钮应关闭整组作图工具');
    assert.equal(await phone.locator('#toolboxToggle').textContent(),'展开作图工具','顶部按钮文字必须同步复位');
    await phone.locator('#canvas').scrollIntoViewIfNeeded();
    assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'手机页面不得横向溢出');
    await phone.setViewportSize({width:844,height:390});
    assert.equal(await phone.locator('.mobile-panel-nav').isVisible(),true,'手机横屏仍使用栏目切换');
    assert.equal(await phone.locator('.inspect').isVisible(),false,'横屏也不能同时叠放解析');
    assert(await phone.locator('#inputPanelToggle').isHidden(),'横屏不显示仅用于桌面的布局按钮');
    await phone.locator('#toolboxToggle').tap();
    await phone.locator('#toolboxMobileCollapse').tap();
    assert(await phone.locator('#nativeToolbar').isHidden(),'横屏可以触摸收起作图工具');
    await phone.evaluate(()=>window.scrollTo(0,document.scrollingElement.scrollHeight));
    const landscape=await phone.evaluate(()=>({
      scroll:scrollY,navTop:document.querySelector('.mobile-panel-nav').getBoundingClientRect().top,
      canvasBottom:document.querySelector('#canvas').getBoundingClientRect().bottom
    }));
    assert(landscape.scroll>100&&Math.abs(landscape.navTop)<2,'手机横屏实际滚动且栏目导航常驻');
    assert(landscape.canvasBottom<=390,'手机横屏可以滚到完整画板底部');
    await phone.locator('#canvas').scrollIntoViewIfNeeded();
    assert.equal(await phone.locator('[data-add-conic="ellipse"]').count(),1);
    console.log('PASS: mobile touch input, recognition confirmation, additive curve dialog, no horizontal overflow and orientation change.');
  }finally{await context.close();}
};

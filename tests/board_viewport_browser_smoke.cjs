module.exports = async ({ page, context, assert, screenshot }) => {
  await context.addInitScript(() => {
    let learning;
    Object.defineProperty(window, 'DongLearning', {
      get: () => learning,
      set(value) {
        learning = value;
        const attach = value.attach;
        value.attach = api => {
          window.__boardTest = api;
          return attach(api);
        };
      }
    });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 3 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-mobile-panel="board"]').click();
  await page.locator('#sceneJson').evaluate(el => {
    el.value = JSON.stringify({
      type: 'circle', r: 3, showDynamic: false, showFeatures: false,
      objects: [{ id: 'point-p', kind: 'point', label: 'P', x: 0, y: 0 }]
    });
    document.querySelector('#applyJson').click();
  });
  const canvas = page.locator('#canvas');
  const get = () => page.evaluate(() => {
    const { state, sceneData } = window.__boardTest;
    return { view: state.view, width: state.cssW, height: state.cssH, scene: sceneData() };
  });
  const shortSide = ({ view }) => Math.min(view.xmax - view.xmin, view.ymax - view.ymin);
  const world = ({ view, width, height }, x, y) => [
    view.xmin + (view.xmax - view.xmin) * x / width,
    view.ymax - (view.ymax - view.ymin) * y / height
  ];
  const near = (a, b) => assert(Math.abs(a - b) < 1e-5, `${a} ≈ ${b}`);
  const worldAt = async (x, y) => {
    const box = await canvas.boundingBox();
    return world(await get(), x - box.x, y - box.y);
  };
  const contact = (type, points = []) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const undo = page.locator('#undoDrag');
  try {
    const home = page.getByRole('button', { name: '适应图形', exact: true });
    assert((await home.boundingBox()).height >= 44);
    await home.click();
    await canvas.scrollIntoViewIfNeeded();
    const baseline = await get();
    const box = await canvas.boundingBox();
    const midX = box.width / 2, midY = box.height / 2;
    const touch = (id, x, y) => ({ id, x: box.x + x, y: box.y + y });

    // Grab near a point, move it, then place the second finger.
    await contact('touchStart', [touch(1, midX + 8, midY)]);
    await contact('touchMove', [touch(1, midX + 28, midY)]);
    await page.waitForFunction(() => window.__boardTest.state.model.objects[0].x > 0);
    const preview = await page.evaluate(() => window.__boardTest.state.model.objects[0].x);
    near(preview, 20 * (baseline.view.xmax - baseline.view.xmin) / baseline.width);
    await contact('touchStart', [touch(1, midX + 28, midY), touch(2, midX - 32, midY)]);
    const startAnchor = await worldAt(box.x + midX - 2, box.y + midY);
    await contact('touchMove', [touch(1, midX + 78, midY + 16), touch(2, midX - 42, midY + 16)]);
    await page.waitForFunction(expected => {
      const { view } = window.__boardTest.state;
      return Math.abs((view.xmax - view.xmin) - expected) < 1e-5;
    }, (baseline.view.xmax - baseline.view.xmin) / 2);
    const zoomed = await get();
    near(shortSide(zoomed), shortSide(baseline) / 2);
    const endAnchor = await worldAt(box.x + midX + 18, box.y + midY + 16);
    near(startAnchor[0], endAnchor[0]);near(startAnchor[1], endAnchor[1]);
    await contact('touchEnd');
    assert.deepEqual((await get()).scene, baseline.scene, 'Pinching rolls back the tentative point drag');
    assert(await undo.isDisabled(), 'Viewport gestures leave drawing undo empty');

    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => window.__boardTest.state.cssW > 700);
    near(shortSide(await get()), shortSide(zoomed));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => window.__boardTest.state.cssW < 400);
    near(shortSide(await get()), shortSide(zoomed));
    await home.click();
    near(shortSide(await get()), shortSide(baseline));

    await page.locator('#toolboxToggle').click();
    await page.locator('[data-construct="point"]').click();
    await canvas.scrollIntoViewIfNeeded();
    const toolsBox = await canvas.boundingBox();
    const point = (id, x, y) => ({ id, x: toolsBox.x + x, y: toolsBox.y + y });
    await contact('touchStart', [point(1, 90, 130)]);
    await contact('touchStart', [point(1, 90, 130), point(2, 150, 130)]);
    await contact('touchMove', [point(1, 70, 140), point(2, 190, 140)]);
    await contact('touchEnd');
    assert.deepEqual((await get()).scene, baseline.scene, 'Pinching cannot place a point even in construction mode');
    assert.equal(await page.locator('[data-construct="point"]').getAttribute('aria-pressed'), 'true');
    await contact('touchStart', [point(1, 90, 130)]);
    await contact('touchEnd');
    assert.equal((await get()).scene.objects.length, baseline.scene.objects.length + 1, 'Next single tap constructs normally');

    await page.locator('#toolboxMobileCollapse').click();
    await home.click();
    const beforeKeyboard = await get();
    await canvas.press('+');
    near(shortSide(await get()), .8 * shortSide(beforeKeyboard));
    await canvas.press('Home');
    near(shortSide(await get()), shortSide(beforeKeyboard));
    await screenshot('board-touch-viewport.png', '.board-shell');
  } finally {
    await cdp.detach();
  }
};

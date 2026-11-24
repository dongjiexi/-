module.exports = async ({page, assert}) => {
  const scene = async () => JSON.parse(await page.locator('#sceneJson').inputValue());
  const fixture = {
    type: 'ellipse', a: 3, b: 2, h: 0, k: 0, orientation: 'horizontal',
    isFreeBoard: true, showConic: false, showDynamic: false, showFeatures: false,
    points: {}, lines: [], objects: [
      {id: 'a', kind: 'point', label: 'A', x: 2, y: 0},
      {id: 'b', kind: 'point', label: 'B', x: -1, y: 0},
      {id: 'c', kind: 'point', label: 'C', x: -1, y: 2},
      {id: 'h', kind: 'line', label: 'h', m: 0, b: 1}
    ]
  };
  await page.locator('#sceneJson').evaluate((el, data) => {
    el.value = JSON.stringify(data);
    document.querySelector('#applyJson').click();
  }, fixture);
  await page.locator('#homeButton').click();
  if (await page.locator('#toolboxToggle').getAttribute('aria-expanded') === 'false') {
    await page.locator('#toolboxToggle').click();
  }
  async function canvasCoordinates() {
    const canvas = page.locator('#canvas');
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    const unitsPerPixel = Math.max(10.5 / box.width, 7.6 / box.height);
    return (x, y) => [box.x + box.width / 2 + x / unitsPerPixel, box.y + box.height / 2 - y / unitsPerPixel];
  }
  await page.locator('[data-construct="angle_bisector"]').click();
  let xy = await canvasCoordinates();
  await page.mouse.click(...xy(2, 0));
  await page.mouse.click(...xy(-1, 0));
  await page.mouse.click(...xy(-1, 2));
  const bisector = (await scene()).objects.at(-1);
  assert.equal(bisector.op, 'angle_bisector');
  assert.deepEqual(bisector.refs, ['a', 'b', 'c']);

  await page.locator('[data-construct="intersection"]').click();
  xy = await canvasCoordinates();
  await page.mouse.click(...xy(-2, -1)); // Pick the extension on the other side of B.
  await page.mouse.click(...xy(-3, 1));
  const intersection = (await scene()).objects.at(-1);
  assert.equal(intersection.op, 'intersection');
  assert.deepEqual(intersection.refs, [bisector.id, 'h']);
  async function resolved() {
    return page.evaluate(({data, lineId, pointId}) => {
      const engine = window.DongConstruct.createEngine({model: () => data});
      return {line: engine.resolve(lineId), point: engine.resolve(pointId), reason: engine.invalidReason(lineId)};
    }, {data: await scene(), lineId: bisector.id, pointId: intersection.id});
  }
  async function assertCrossing(expectedX) {
    const {line, point} = await resolved();
    assert.equal(line?.type, 'line');
    assert.equal(point?.type, 'point');
    assert(Math.abs(point.x - expectedX) < 1e-7 && Math.abs(point.y - 1) < 1e-7,
      'Intersection with y = 1 should have x = ' + expectedX + ', got ' + JSON.stringify(point));
  }
  await assertCrossing(0);
  await page.locator('#moveMode').click();
  await page.locator('#snapDrag').check();
  async function drag(from, to) {
    const point = await canvasCoordinates();
    await page.mouse.move(...point(...from));
    await page.mouse.down();
    await page.mouse.move(...point(...to), {steps: 5});
    await page.mouse.up();
  }
  await drag([-1, 2], [1, 2]);
  await assertCrossing(Math.SQRT2);
  await drag([1, 2], [-1, 0]);
  const collapsed = await resolved();
  assert.equal(collapsed.line, null);
  assert.equal(collapsed.point, null);
  assert.match(collapsed.reason, /顶点.*(?:重合|分开)/);
  await page.locator('#undoDrag').click();
  await assertCrossing(Math.SQRT2);

  await page.reload({waitUntil: 'domcontentloaded'});
  await page.waitForFunction(id => JSON.parse(document.querySelector('#sceneJson').value).objects?.some(o => o.id === id), intersection.id);
  await assertCrossing(Math.SQRT2);
  if (await page.locator('#toolboxToggle').getAttribute('aria-expanded') === 'false') {
    await page.locator('#toolboxToggle').click();
  }
  await page.locator('#moveMode').click();
  await page.locator('#snapDrag').check();
  await drag([1, 2], [-2, 0]); // Straight angle: supporting bisector is vertical.
  await assertCrossing(-1);
  await drag([-2, 0], [1, 0]); // Zero angle: supporting bisector is parallel to y = 1.
  const zero = await resolved();
  assert.equal(zero.line?.type, 'line');
  assert(Math.abs(zero.line.d.y) < 1e-7, JSON.stringify(zero));
  assert.equal(zero.point, null);
};

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const sandbox = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/construction-board.js'), 'utf8'), sandbox);
const {createEngine, conicShape} = sandbox.window.DongConstruct;
test('renaming points preserves named lines, polygon vertices and ID dependencies atomically',()=>{
  const {model,engine}=fixture([{id:'p',kind:'point',label:'P',x:1,y:2},{id:'q',kind:'point',label:'Q',x:3,y:4},{id:'mid',kind:'construction',op:'midpoint',refs:['p','q'],label:'M'}],{O:[0,0]});
  model.lines=[{id:'pq',kind:'through_points',a:'P',b:'Q',infinite:true}];
  model.polygons=[{labels:['O','P','Q'],label:'△OPQ'},{labels:['O','P','Q'],label:'自定义区域'}];
  const before=JSON.stringify(model);assert.throws(()=>engine.renameObject('p','O'),/已被使用/);assert.equal(JSON.stringify(model),before);
  assert.throws(()=>engine.renameObject('p','  '),/不能为空/);assert.equal(JSON.stringify(model),before);
  assert.equal(engine.renameObject('p','P'),false);
  assert.equal(engine.renameObject('p','T'),true);assert.equal(model.lines[0].a,'T');assert.equal(model.polygons[0].labels.join(','),'O,T,Q');assert.equal(model.polygons[0].label,'△OTQ');assert.equal(model.polygons[1].label,'自定义区域');
  pointNear(engine.resolve('mid'),{x:2,y:3});pointNear(engine.resolve('pq').o,{x:1,y:2});assert.equal(model.objects[2].refs[0],'p');
  engine.renameObject('p','P');assert.equal(JSON.stringify(model),before);
});
test('curve rename cannot rewrite point references and ambiguous point names are rejected',()=>{
  const {model,engine}=fixture([{id:'c',kind:'circle',label:'C',h:0,k:0,r:2},{id:'p',kind:'point',label:'P',x:1,y:2},{id:'p2',kind:'point',label:'P',x:3,y:4}]);
  model.lines=[{id:'line',kind:'through_points',a:'C',b:'P'}];engine.renameObject('c','圆');assert.equal(model.lines[0].a,'C');
  const before=JSON.stringify(model);assert.throws(()=>engine.renameObject('p','T'),/重复/);assert.equal(JSON.stringify(model),before);
});
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/equation-builder.js'), 'utf8'), sandbox);

function near(actual, expected, label = 'number') {
  assert(Number.isFinite(actual), `${label} must be finite`);
  assert(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`);
}

function pointNear(actual, expected, label = 'point') {
  assert(actual, `${label} must be defined`);
  near(actual.x, expected.x, `${label}.x`);
  near(actual.y, expected.y, `${label}.y`);
}

function onConic(point, curve) {
  assert(point, 'curve-bound point must exist');
  const dx = point.x - curve.h, dy = point.y - curve.k;
  const major = curve.orientation === 'vertical' ? dy : dx;
  const minor = curve.orientation === 'vertical' ? dx : dy;
  if (curve.conicType === 'ellipse') near(major ** 2 / curve.a ** 2 + minor ** 2 / curve.b ** 2, 1, 'ellipse equation');
  else if (curve.conicType === 'hyperbola') near(major ** 2 / curve.a ** 2 - minor ** 2 / curve.b ** 2, 1, 'hyperbola equation');
  else near(minor ** 2, 4 * curve.p * curve.direction * major, 'parabola equation');
}

function fixture(objects, points = {}) {
  const model = {objects, lines: [], points};
  const engine = createEngine({
    model: () => model,
    features: () => Object.entries(model.points).map(([name, p]) => ({name, x: p[0], y: p[1]})),
    coeffs: () => ({A: 1, B: 0, C: 1, D: 100, E: -140, F: -2600}),
    origin: () => ({x: -50, y: 70}),
    angle: () => 17,
    // An added curve must never use the unrelated primary curve's parameterization.
    conicPoint: () => { throw new Error('used primary curve for an added curve'); },
    conicProject: () => { throw new Error('projected an added curve onto the primary curve'); }
  });
  return {model, engine};
}

test('added conics satisfy their own equation across orientations, openings and branches', () => {
  for (const conicType of ['ellipse', 'hyperbola', 'parabola']) {
    for (const orientation of ['horizontal', 'vertical']) {
      for (const direction of [-1, 1]) {
        const curve = {conicType, orientation, direction, h: 2.3, k: -4.1, a: 4.2, b: 1.7, p: 2.6};
        const shape = conicShape(curve);
        assert.equal(shape.type, 'conic');
        for (const branch of [-1, 1]) for (const t of [-2, -0.3, 0, 0.7, 2]) {
          const point = shape.pointAt(t, branch);
          onConic(point, curve);
          const parameter = shape.project(point);
          pointNear(shape.pointAt(parameter.t, parameter.branch || 1), point, 'projection round trip');
        }
      }
    }
  }
});

for (const conicType of ['ellipse', 'hyperbola', 'parabola']) {
  test(`${conicType}: bound points follow center, dimensions and orientation changes`, () => {
    const curve = {id: 'curve', kind: 'conic', conicType, orientation: 'horizontal', direction: 1, h: 2, k: -3, a: 4, b: 2, p: 2};
    const bound = {id: 'bound', kind: 'construction', op: 'point_on', refs: ['curve'], t: 0.7, branch: -1};
    const {engine} = fixture([curve, bound]);
    const before = engine.resolve('bound');
    onConic(before, curve);
    Object.assign(curve, {h: -4, k: 5, a: 3, b: 1.5, p: 0.75, orientation: 'vertical', direction: -1});
    const after = engine.resolve('bound');
    onConic(after, curve);
    assert(Math.hypot(after.x - before.x, after.y - before.y) > 1, 'transformation must move the bound point');
    pointNear(engine.pointOn('curve', bound), after, 'pointOn and dependency resolution');
    pointNear(engine.pointOn('curve', engine.project('curve', after)), after, 'engine projection');
    assert.equal(bound.refs[0], 'curve', 'the source curve reference remains stable');
  });
}

const intersectionCases = [
  {
    name: 'ellipse',
    curve: {conicType: 'ellipse', h: 3, k: -2, a: 4, b: 2, orientation: 'horizontal'},
    line: {m: 0, b: -2}, expected: [{x: -1, y: -2}, {x: 7, y: -2}],
    transform: {h: 6, k: 1, a: 2, b: 1}, nextLine: {m: 0, b: 1}, nextExpected: [{x: 4, y: 1}, {x: 8, y: 1}]
  },
  {
    name: 'hyperbola',
    curve: {conicType: 'hyperbola', h: 2, k: 3, a: 3, b: 2, orientation: 'horizontal'},
    line: {m: 0, b: 3}, expected: [{x: -1, y: 3}, {x: 5, y: 3}],
    transform: {h: -1, k: 2, a: 4, b: 1, orientation: 'vertical'}, nextLine: {x: -1}, nextExpected: [{x: -1, y: -2}, {x: -1, y: 6}]
  },
  {
    name: 'parabola',
    curve: {conicType: 'parabola', h: 1, k: -2, p: 2, direction: 1, orientation: 'horizontal'},
    line: {x: 3}, expected: [{x: 3, y: -6}, {x: 3, y: 2}],
    transform: {h: -2, k: 4, p: 0.5, direction: -1, orientation: 'vertical'}, nextLine: {m: 0, b: 2}, nextExpected: [{x: -4, y: 2}, {x: 0, y: 2}]
  }
];

for (const sample of intersectionCases) {
  test(`${sample.name}: line intersections recompute from the added curve after transformation`, () => {
    const curve = {id: 'curve', kind: 'conic', ...sample.curve};
    const line = {id: 'line', kind: 'line', ...sample.line};
    const points = [0, 1].map(branch => ({id: `I${branch}`, kind: 'construction', op: 'intersection', refs: ['line', 'curve'], branch}));
    const {engine} = fixture([curve, line, ...points]);
    sample.expected.forEach((expected, index) => pointNear(engine.resolve(`I${index}`), expected));
    Object.assign(curve, sample.transform);
    delete line.m; delete line.b; delete line.x;
    Object.assign(line, sample.nextLine);
    sample.nextExpected.forEach((expected, index) => {
      const result = engine.resolve(`I${index}`);
      pointNear(result, expected);
      onConic(result, curve);
    });
  });
}

test('over-point line rotation preserves a fixed pivot including a vertical direction', () => {
  const line = {id: 'line', kind: 'construction', op: 'line_angle', refs: ['feature:P'], angle: 20};
  const {engine, model} = fixture([line], {P: [1.25, -2.5]});
  const original = [...model.points.P];
  for (const angle of [0, 33, 90, 179, -45, 270]) {
    line.angle = angle;
    const shape = engine.resolve('line');
    pointNear(shape.o, {x: original[0], y: original[1]}, 'fixed pivot');
    assert.deepEqual(model.points.P, original, 'changing angle must not move the pivot');
    near(Math.hypot(shape.d.x, shape.d.y), 1, 'unit direction');
    if (angle === 90 || angle === 270) near(shape.d.x, 0, 'vertical direction');
  }
});

test('over-point line follows a derived midpoint pivot and recomputes dependent intersections', () => {
  const a = {id: 'A', kind: 'point', x: 0, y: 2};
  const b = {id: 'B', kind: 'point', x: 4, y: 6};
  const mid = {id: 'M', kind: 'construction', op: 'midpoint', refs: ['A', 'B']};
  const line = {id: 'line', kind: 'construction', op: 'line_angle', refs: ['M'], angle: 90};
  const axis = {id: 'axis', kind: 'line', m: 0, b: 0};
  const crossing = {id: 'I', kind: 'construction', op: 'intersection', refs: ['line', 'axis']};
  const {engine} = fixture([a, b, mid, line, axis, crossing]);
  pointNear(engine.resolve('line').o, {x: 2, y: 4});
  pointNear(engine.resolve('I'), {x: 2, y: 0});
  Object.assign(a, {x: -2, y: 0});
  Object.assign(b, {x: 8, y: 4});
  pointNear(engine.resolve('line').o, {x: 3, y: 2});
  pointNear(engine.resolve('I'), {x: 3, y: 0});
  line.angle = 45;
  pointNear(engine.resolve('line').o, {x: 3, y: 2});
  pointNear(engine.resolve('I'), {x: 1, y: 0});
  pointNear(engine.resolve('A'), {x: -2, y: 0});
  pointNear(engine.resolve('B'), {x: 8, y: 4});
});

test('tangents reject off-curve points and recover when the point is valid again', () => {
  const curve = {id: 'curve', kind: 'conic', conicType: 'ellipse', h: 0, k: 0, a: 3, b: 2, orientation: 'horizontal'};
  const point = {id: 'point', kind: 'point', x: 3, y: 0};
  const tangent = {id: 'tangent', kind: 'construction', op: 'tangent', refs: ['point', 'curve']};
  const {engine} = fixture([curve, point, tangent]);
  const valid = engine.resolve('tangent');
  pointNear(valid.o, point);
  near(valid.d.x, 0, 'tangent at right vertex is vertical');
  point.x = 3.1;
  assert.equal(engine.resolve('tangent'), null, 'off-curve point must not generate an apparent tangent');
  point.x = 0;
  assert.equal(engine.resolve('tangent'), null, 'center has zero gradient and is not a tangent point');
  point.y = 2;
  const recovered = engine.resolve('tangent');
  pointNear(recovered.o, point);
  near(recovered.d.y, 0, 'tangent at top vertex is horizontal');
});

test('translating a conic does not loosen the tangent point membership check', () => {
  const curve = {id: 'curve', kind: 'conic', conicType: 'ellipse', h: 1000, k: 1000, a: 3, b: 2, orientation: 'horizontal'};
  const point = {id: 'point', kind: 'point', x: 1003, y: 1000};
  const tangent = {id: 'tangent', kind: 'construction', op: 'tangent', refs: ['point', 'curve']};
  const {engine} = fixture([curve, point, tangent]);
  assert(engine.resolve('tangent'), 'the translated exact vertex has a tangent');
  point.x += 0.01;
  assert.equal(engine.resolve('tangent'), null, 'an off-curve point must remain invalid after translation');
});

test('circle tangent and normal use the same curve-bound point and stay perpendicular', () => {
  const circle={id:'c',kind:'circle',h:2,k:-3,r:4};
  const point={id:'T',kind:'construction',op:'point_on',refs:['c'],t:.7};
  const tangent={id:'t',kind:'construction',op:'tangent',refs:['T','c']};
  const normal={id:'n',kind:'construction',op:'normal',refs:['T','c']};
  const {engine}=fixture([circle,point,tangent,normal]);
  for(const t of [0,.7,Math.PI/2,Math.PI]){
    point.t=t;const a=engine.resolve('t'),b=engine.resolve('n');
    pointNear(a.o,b.o);near(a.d.x*b.d.x+a.d.y*b.d.y,0,'orthogonal tangent/normal');
    near((circle.h-b.o.x)*b.d.y-(circle.k-b.o.y)*b.d.x,0,'normal through circle center');
  }
  circle.h=-4;circle.r=2;point.t=.3;
  const a=engine.resolve('t');near(Math.hypot(a.o.x-circle.h,a.o.y-circle.k),2);
});

test('answer-derived tangent and normal re-evaluate instead of retaining stale coefficients', () => {
  const circle={id:'c',kind:'circle',h:0,k:0,r:5};
  const tangent={id:'t',kind:'slope',role:'tangent',source:'derived',m:-.75,b:6.25,refs:['feature:P','c']};
  const normal={id:'n',kind:'slope',role:'normal',source:'derived',m:4/3,b:0,refs:['feature:P','c']};
  const {engine,model}=fixture([circle,tangent,normal],{P:[3,4]});
  for(const point of [[3,4],[-4,3],[5,0]]){
    model.points.P=point;const a=engine.resolve('t'),b=engine.resolve('n');
    pointNear(a.o,{x:point[0],y:point[1]});near(a.d.x*b.d.x+a.d.y*b.d.y,0);
  }
  model.points.P=[6,0];
  assert.equal(engine.resolve('t'),null);assert.equal(engine.resolve('n'),null);
  assert.match(engine.invalidReason('t'),/不在曲线上/);
  assert.equal(tangent.m,-.75,'original answer coefficients remain available for the original proof');
});

test('curve equations are reconstructed from edited dimensions, orientation and translation', () => {
  const {curveEquation,curveSpec}=sandbox.window.DongEquationBuilder;
  const ellipse={kind:'conic',conicType:'ellipse',h:1,k:-2,a:4,b:2,orientation:'horizontal',equation:'obsolete'};
  assert.equal(curveEquation(ellipse),'(x−1)²/16+(y+2)²/4=1');
  Object.assign(ellipse,{orientation:'vertical',h:0,a:3});
  assert.equal(curveEquation(ellipse),'x²/4+(y+2)²/9=1');
  const parabola={kind:'conic',conicType:'parabola',h:2,k:3,p:.5,orientation:'vertical',direction:-1};
  assert.equal(curveSpec(parabola).values.direction,'down');
  assert.equal(curveEquation(parabola),'(x−2)²=−2(y−3)');
  assert.equal(curveEquation({kind:'circle',h:0,k:0,r:2}),'x²+y²=4');
});

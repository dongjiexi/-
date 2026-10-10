const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const domain=require('../dist/motion-domain.js'),motion=require('../dist/motion-protection.js'),bank=require('../dist/question-bank.js');
const box={window:{DongMotion:motion,DongMotionDomain:domain}};
vm.runInNewContext(fs.readFileSync(require.resolve('../dist/construction-board.js'),'utf8'),box);
const data=JSON.parse(fs.readFileSync(require.resolve('../dist/question-bank.json'),'utf8'));
const fixture=()=>bank.sceneFor(data.items.find(o=>o.id==='2025-i-18'));
function engine(m){const c=box.window.DongConstruct.conicShape({...m,conicType:m.type});return box.window.DongConstruct.createEngine({model:()=>m,features:()=>Object.entries(m.points||{}).map(([name,[x,y]])=>({name,x,y})),coeffs:()=>c.q,conicPoint:c.pointAt,conicProject:c.project});}
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('nonperiodic loci separate mathematical endpoints from viewport clipping',()=>{
  const view={xmin:-10,xmax:10,ymin:-8,ymax:8},shape={kind:'conic',conicType:'parabola',p:1};
  const render=d=>domain.nonPeriodicGeometry(shape,{motionDomain:d},view);
  const full=render({});assert.equal(full.markers.length,0);assert.equal(full.paths.length,1);
  const narrow=domain.nonPeriodicGeometry({...shape,p:1e-8},{motionDomain:{y:{min:0}}},view);assert(narrow.paths.length>0);assert(narrow.paths.flat().some(q=>q.x>5));assert.equal(narrow.markers.length,1);assert(narrow.markers[0].closed);
  const cut=render({x:{min:1,max:4,maxClosed:false}});assert.equal(cut.paths.length,2);assert.equal(cut.markers.length,4);
  assert.equal(cut.markers.filter(p=>p.closed&&p.x===1).length,2);assert.equal(cut.markers.filter(p=>!p.closed&&p.x===4).length,2);
  for(const path of cut.paths)for(const p of path)near(p.y*p.y,4*p.x);
  const singleton=render({x:{max:0}});assert.equal(singleton.paths.length,0);assert.deepEqual(singleton.markers,[{x:0,y:0,closed:true}]);
  const empty=render({x:{max:0,maxClosed:false}});assert.equal(empty.paths.length,0);assert.equal(empty.markers.length,0);
  const hole=render({excludePoints:[[1,2]]});assert.equal(hole.markers.length,1);assert.deepEqual(hole.markers[0],{x:1,y:2,closed:false});
  assert.equal(render({parameter:{min:-100,max:100}}).markers.length,0,'Offscreen domain endpoints are not clamped onto viewport');
  const edge=domain.nonPeriodicGeometry(shape,{motionDomain:{parameter:{min:2}}},{xmin:0,xmax:10,ymin:2,ymax:6});assert.deepEqual(edge.markers,[{x:1,y:2,closed:true}]);
  const shifted={...shape,orientation:'vertical',direction:-1,h:2,k:3,p:2};
  const down=domain.nonPeriodicGeometry(shifted,{motionDomain:{parameter:{min:-2,max:3,minClosed:false}}},view);
  assert.equal(down.markers.length,2);for(const path of down.paths)for(const q of path)near((q.x-2)**2,-8*(q.y-3));
});
test('hyperbolic loci keep branch, open boundaries and finite display samples',()=>{
  const view={xmin:-10,xmax:10,ymin:-8,ymax:8},shape={kind:'conic',conicType:'hyperbola',a:2,b:1};
  const render=(d,branch)=>domain.nonPeriodicGeometry(shape,{motionDomain:d,branch},view);
  const left=render({x:{min:-5,max:-3,minClosed:false}},-1);assert.equal(left.paths.length,2);assert.equal(left.markers.length,4);
  assert(left.markers.filter(p=>!p.closed).every(p=>p.x===-5));assert(left.markers.filter(p=>p.closed).every(p=>p.x===-3));
  for(const path of left.paths)for(const q of path){near(q.x*q.x/4-q.y*q.y,1);assert(q.x<0);}
  const right=render({branch:1,excludeAxes:['x']},-1);assert.equal(right.markers.length,1);assert.deepEqual(right.markers[0],{x:2,y:0,closed:false});assert(right.paths.flat().every(q=>q.x>=2));
  const vertical=domain.nonPeriodicGeometry({...shape,orientation:'vertical',h:1,k:2},{motionDomain:{branch:-1,parameter:{min:-1,max:1}}},view);
  for(const path of vertical.paths)for(const q of path){near((q.y-2)**2/4-(q.x-1)**2,1);assert(q.y<=0);}
  const extreme=render({parameter:{min:-100000,max:100000},x:{min:2}});assert.equal(extreme.markers.length,0);assert(extreme.paths.flat().every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)));
  assert.equal(render({arc:{min:0,max:1}}),null);assert.equal(domain.nonPeriodicGeometry(shape,{motionDomain:{}},{...view,xmax:Infinity}),null);
});
test('literal domains reject executable, unknown, nonfinite, empty and malformed data',()=>{
  for(const raw of [[],{quadrant:0},{branch:0},{x:{min:2,max:1}},{parameter:{min:0,max:0,minClosed:false}},{arc:{min:0,max:0}},{arc:{min:0,max:7}},{x:{min:Infinity}},{y:{min:0,minClosed:'true'}},{excludeAxes:['z']},{eval:'alert(1)'},JSON.parse('{"__proto__":{}}')])assert.throws(()=>domain.validate(raw));
  assert.deepEqual(domain.validate({quadrant:2,excludeAxes:['y','y']}),{quadrant:2,excludeAxes:['y']});
  assert.throws(()=>domain.validateProfiles({'201':{mode:'plane',x:1,y:2,motionDomain:{arc:{min:0,max:1}}}}));
  assert.throws(()=>domain.validateProfiles({'2':{mode:'curve',t:0}},new Set([1])));
  assert.throws(()=>domain.validateProfiles({'01':{mode:'curve',t:0}}));
});
test('open/closed intervals and wrap-around arcs preserve excluded endpoints',()=>{
  const spec={motionDomain:{arc:{min:5*Math.PI/3,max:Math.PI/3,minClosed:false,maxClosed:false}}};
  assert(domain.accepts(spec,{x:1,y:0},{t:0}));
  assert(!domain.accepts(spec,{x:.5,y:Math.sqrt(3)/2},{t:Math.PI/3}));
  assert(!domain.accepts(spec,{x:-1,y:0},{t:Math.PI}));
  const fit=domain.fit(spec,{t:Math.PI},{periodic:true});assert(fit.t>5*Math.PI/3&&fit.t<7*Math.PI/3);
  const full={motionDomain:{arc:{min:0,max:2*Math.PI,minClosed:false,maxClosed:true}}};assert(domain.accepts(full,{x:1,y:0},{t:0}),'one closed alias on a full circle is legal');
  const tiny={motionDomain:{parameter:{min:1,max:1+1e-10,minClosed:false,maxClosed:false}}};const t=domain.fit(tiny,{t:4}).t;assert(t>1&&t<1+1e-10);
  const one={motionDomain:{parameter:{min:1,minClosed:false}}};assert(domain.fit(one,{t:-10}).t>1);
  assert.throws(()=>domain.fit(spec,{t:0},{periodic:false}));
});
test('coordinate limits, quadrants and exclusions reject illegal points without inventing positions',()=>{
  const spec={motionDomain:{quadrant:1,x:{min:1,max:2,maxClosed:false},excludeAxes:['x']}};
  assert(domain.accepts(spec,{x:1.5,y:2}));for(const p of [{x:2,y:1},{x:1.5,y:0},{x:-1,y:2},{x:1,y:NaN}])assert(!domain.accepts(spec,p));
});

test('restricted circle and ellipse display cuts arcs and marks exact boundary inclusion',()=>{
  const circle={kind:'circle',h:0,k:0,r:2},render=d=>domain.periodicGeometry(circle,{motionDomain:d});
  const full=render({});assert.equal(full.markers.length,0);
  assert.equal(render({parameter:{min:0,max:2*Math.PI,minClosed:false,maxClosed:true}}).markers.length,0,'A closed equivalent parameter includes the seam point');
  const seam=render({parameter:{min:0,max:2*Math.PI,minClosed:false,maxClosed:false}});assert.equal(seam.markers.length,1);assert(!seam.markers[0].closed);
  const half=render({x:{min:0,minClosed:false}});assert.equal(half.markers.length,2);assert(half.markers.every(p=>p.x===0&&!p.closed));for(const path of half.paths)assert(path.slice(1,-1).every(p=>p.x>0));
  const arc=render({arc:{min:0,max:Math.PI/2,minClosed:false,maxClosed:true}});assert.equal(arc.paths.length,1);assert.deepEqual(arc.markers.map(p=>p.closed),[false,true]);
  const holes=render({excludeAxes:['y']});assert.equal(holes.markers.length,2);assert(holes.markers.every(p=>!p.closed));
  const missing=render({x:{min:3}});assert.equal(missing.paths.length,0);assert.equal(missing.markers.length,0);
  const singleton=render({x:{min:2}});assert.equal(singleton.paths.length,0);assert.equal(singleton.markers.length,1);assert(singleton.markers[0].closed);
  const wrapped=render({arc:{min:5*Math.PI/3,max:Math.PI/3,minClosed:false,maxClosed:false}});assert.equal(wrapped.markers.length,2);assert(wrapped.markers.every(p=>!p.closed));assert(wrapped.paths.flat().every(p=>p.x>.99));
  const ellipse=domain.periodicGeometry({kind:'conic',conicType:'ellipse',orientation:'vertical',h:2,k:3,a:4,b:2},{motionDomain:{y:{max:3,maxClosed:false}}});assert.equal(ellipse.markers.length,2);assert(ellipse.markers.every(p=>p.y===3&&!p.closed));
  for(const path of ellipse.paths)for(const p of path)near((p.x-2)**2/4+(p.y-3)**2/16,1);
  assert.equal(domain.periodicGeometry({kind:'conic',conicType:'hyperbola',a:2,b:1},{motionDomain:{}}),null);
});

test('fitting never converts invalid inputs into lawful boundary positions',()=>{
  const spec={motionDomain:{parameter:{min:-1,max:1}}};
  for(const parameter of [null,undefined,{},[],{t:Infinity},{t:-Infinity},{t:NaN},{t:null},{t:'2'},{t:100001}])assert.throws(()=>domain.fit(spec,parameter));
  assert.equal(domain.fit(spec,{t:2}).t,1,'Finite out-of-range dragging still clamps normally');
  const m=fixture(),e=engine(m);m.activePart=202;const o=m.objects.find(p=>p.label==='M');o.motionDomain={parameter:{min:0,max:Math.PI/2}};
  const before=JSON.stringify(o);
  for(const t of [Infinity,-Infinity,NaN,null,'1'])assert.equal(e.moveDriver(o.id,{t}),false);
  assert.equal(JSON.stringify(o),before,'Rejected movement does not alter saved position or constraints');
});

test('one-sided parameter domains reject nonfinite, missing and coerced parameters',()=>{
  for(const bounds of [{min:0},{max:0},{min:-1,max:1}]){
    const spec={motionDomain:{parameter:bounds}};
    for(const t of [Infinity,-Infinity,NaN,undefined,null,'0',100001,-100001])assert.equal(domain.accepts(spec,{x:1,y:1},{t}),false,String(t));
    assert.equal(domain.accepts(spec,{x:1,y:1},{t:0}),true);
  }
  assert(!domain.accepts({motionDomain:{parameter:{min:0,minClosed:false}}},{x:1,y:1},{t:0}));
  assert(domain.accepts({motionDomain:{parameter:{min:0,minClosed:false}}},{x:1,y:1},{t:1e-10}));
});
test('closed coordinate endpoints tolerate only roundoff; open endpoints stay excluded',()=>{
  assert(domain.accepts({motionDomain:{y:{min:.5}}},{x:Math.sqrt(3),y:Math.sin(Math.asin(.5))}));
  assert(!domain.accepts({motionDomain:{y:{min:.5,minClosed:false}}},{x:Math.sqrt(3),y:.5}));
  assert(!domain.accepts({motionDomain:{y:{min:.5}}},{x:1,y:.5-1e-8}));
});
test('real 2025 I question has independent plane and circle drivers per subquestion',()=>{
  const m=fixture(),e=engine(m),o=m.objects.find(p=>p.label==='P');m.activePart=201;
  const base=o.t;assert(e.dragDriver(o.id,{x:3,y:2}));const P=e.resolve(o.id),R=e.resolve('inverse-derived-R');near(P.x,3);near(P.y,2);near(R.x,.5);near(R.y,-.5);near(Math.hypot(R.x,R.y+1)*Math.hypot(P.x,P.y+1),3);
  assert(!e.dragDriver(o.id,{x:0,y:2}));assert.equal(o.t,base);near(e.resolve(o.id).x,3);
  m.activePart=202;const start=e.resolve(o.id);assert(e.dragDriver(o.id,{x:6,y:-3}));const legal=e.resolve(o.id);near(legal.x**2+(legal.y+4)**2,18);const rr=e.resolve('inverse-derived-R');near(rr.y/rr.x,3*legal.y/legal.x);assert(Math.hypot(start.x-legal.x,start.y-legal.y)>1);
  m.activePart=201;near(e.resolve(o.id).x,3);near(e.resolve(o.id).y,2);m.activePart=202;near(e.resolve(o.id).x,legal.x);
});
test('ellipse arc drag, moving descendants and inverse undo source remain consistent',()=>{
  const m=fixture(),e=engine(m);m.activePart=202;const o=m.objects.find(p=>p.label==='M');o.motionDomain={arc:{min:0,max:Math.PI/2,minClosed:false,maxClosed:false}};
  for(const p of [{x:-5,y:2},{x:3,y:0},{x:0,y:1},{x:-3,y:-1}]){e.dragDriver(o.id,p);const M=e.resolve(o.id);assert(M&&M.x>0&&M.y>0);near(M.x**2/9+M.y**2,1);assert(e.resolve('pm'));}
  o.motionDomain={x:{min:20}};assert.equal(e.resolve(o.id),null);assert.match(e.invalidReason(o.id),/范围/);
});
test('hyperbola drivers stay on the original branch unless explicitly reconfigured',()=>{
  const m=bank.sceneFor(data.items.find(p=>p.id==='2024-i-12')),e=engine(m);m.objects.push({id:'branch-driver',kind:'construction',op:'point_on',refs:['$conic'],branch:-1,t:.5,source:'user'});
  assert(e.dragDriver('branch-driver',{x:30,y:5}));assert(e.resolve('branch-driver').x<0);
  const o=m.objects.at(-1);o.motionDomain={branch:1,parameter:{min:-1,max:1}};assert(e.moveDriver(o.id,{t:10,branch:-1}));assert(e.resolve(o.id).x>0);near(o.t,1);
});
test('cloud/external scene schema validates only data constraints and valid part scopes',async()=>{
  const {safeConstructionScene}=await import('../dist/scene-contract.mjs');
  const raw={type:'ellipse',a:3,b:1,curvePoints:[{name:'P',t:1,motionDomain:{quadrant:1},motionByPart:{'201':{mode:'plane',x:3,y:2,motionDomain:{excludeAxes:['y']}}}}]};
  const good=safeConstructionScene(raw,{partIndexes:new Set([201,202])});assert(good.scene);const p=good.scene.objects.find(o=>o.label==='P');assert.equal(p.motionDomain.quadrant,1);assert.equal(p.motionByPart['201'].mode,'plane');
  const bad=safeConstructionScene(raw,{partIndexes:new Set([1])});assert(bad.warnings.length);assert(!bad.scene.objects.some(o=>o.label==='P'));
  raw.curvePoints[0].motionDomain={eval:'danger'};assert(safeConstructionScene(raw).warnings.length);
  raw.curvePoints[0].motionDomain={excludePoints:[[3,0]]};const excluded=safeConstructionScene(raw,{partIndexes:new Set([201,202])});assert(excluded.scene);assert.deepEqual(excluded.scene.objects.find(o=>o.label==='P').motionDomain.excludePoints,[[3,0]]);
  raw.curvePoints[0].motionDomain={excludePoints:[[3,'function()']]};const invalid=safeConstructionScene(raw);assert(invalid.warnings.length);assert(!invalid.scene.objects.some(o=>o.label==='P'));
});

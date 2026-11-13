const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={window:{}};
for(const file of ['scene-audit.js','step-highlight.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist',file),'utf8'),sandbox);
const link=sandbox.window.DongStepHighlight;
const entries=['A','B','A′','F₂','l','C','N'].map(label=>({id:'id:'+label,label}));
const check=(text,expected,missing=[])=>{const result=link.select(text,entries);assert.deepEqual(Array.from(result.matched),expected);assert.deepEqual(Array.from(result.missing),missing);};
check('将直线 $l$ 与椭圆 $C$ 联立，交于 A、B。',['A','B','l','C']);
check('连接 A′B，点 F_2 的坐标为 (2,0)。',['B','A′','F₂']);
check('由 $|AB|$ 及 $\\triangle OAB$ 的面积求值。',['A','B'],['O']);
check('点 M 是线段 AN 的中点。',['A','N'],['M']);
check('ellipse, LaTeX, application and link are English words.',[]);
check('A 与 A′ 是不同名称。',['A','A′']);
check('连接 $A^{\\prime}B$ 与点 $F_{2}$。',['B','A′','F₂']);
check('连接 $A^\\prime B$。',['B','A′']);
check('连接 $A^{\'}B$。',['B','A′']);
assert.equal(link.mentioned('A^2','A′'),false,'Ordinary powers are not point primes');
check('\\sqrt{2} 和 \\frac{1}{2} 是标量。',[]);
check('点 Z 是未构建点，<img src=x onerror=alert(1)>。',[],['Z']);
let model={},part=1,rendered=0;
const highlighter=link.attach({entries:()=>entries,model:()=>model,part:()=>part,render:()=>rendered++,ctx:{save(){},restore(){}},xy:(x,y)=>({x,y})});
assert.deepEqual(Array.from(highlighter.highlight({text:'点 N',part:1,index:0}).matched),['N']);
assert.equal(rendered,1);assert.deepEqual(Array.from(highlighter.snapshot().ids),['id:N']);
part=2;highlighter.draw();assert.equal(highlighter.snapshot(),null,'Part switch removes stale highlight');
highlighter.highlight({text:'点 A',part:2,index:1});model={};highlighter.draw();assert.equal(highlighter.snapshot(),null,'Graph replacement removes stale highlight');
highlighter.clear();highlighter.clear();assert.equal(highlighter.snapshot(),null);
const named=[{id:'tp',label:'P 点切线',aliases:['tP','l₁']},{id:'tr',label:'R 点切线',aliases:['tR','l₂']},{id:'T',label:'T'}];
assert.deepEqual(Array.from(link.select('切线tP与tR交于点T。',named).ids),['tp','tr','T']);
assert.deepEqual(Array.from(link.select('直线 $l_{1}$ 与 $l_2$。',named).ids),['tp','tr']);
assert.deepEqual(Array.from(link.select('直线tP',named.slice(1)).ids),[],'Hidden or other-part aliases never select absent entries');
const conflict=link.select('直线tP',[...named,{id:'other',label:'tP'}]);
assert.deepEqual(Array.from(conflict.ids),[],'Alias collision must not select unrelated lines');
assert.deepEqual(Array.from(conflict.missing),['tP（名称不唯一）']);
const duplicate=link.select('点 P 与点 Q。',[{id:'p1',label:'P'},{id:'p2',label:'P'},{id:'q',label:'Q'}]);
assert.deepEqual(Array.from(duplicate.ids),['q']);
assert.deepEqual(Array.from(duplicate.missing),['P（名称不唯一）']);
assert.deepEqual(Array.from(link.select('直线tP',[named[0],{...named[0]}]).ids),['tp'],'Repeated entry for the same object is not a collision');
assert.deepEqual(Array.from(link.select('ellipse and application',[{id:'bad',label:'辅助线',aliases:['ellipse','application','<img src=x>']}]).ids),[]);
const relations=[
  {id:'t1',label:'A 点切线',relation:'tangent',contact:'A'},
  {id:'t2',label:'B′ 点切线',relation:'tangent',contact:'B′'},
  {id:'t3',label:'A₁ 点切线',relation:'tangent',contact:'A₁'},
  {id:'T',label:'T',relation:'fixed-point'},
  {id:'fixed-line',label:'P 的定直线',relation:'fixed-line'}
];
const ids=(text,items=relations)=>Array.from(link.select(text,items).ids);
assert.deepEqual(ids('在 $A$、$B^{\\prime}$ 两点处分别作切线。'),['t1','t2']);
assert.deepEqual(ids('两条参数切线交于 Q。',relations.slice(0,2)),['t1','t2']);
assert.deepEqual(ids('两条切线互相垂直。'),[],'Three tangents must not be guessed as a pair');
assert.deepEqual(ids('A_1 点处的切线。'),['t3']);
assert.deepEqual(ids('直线 m 恒过定点。'),['T']);
assert.deepEqual(ids('动点 P 恒在定直线 x=-1 上。'),['fixed-line']);
assert.deepEqual(ids('过定点 P 作动直线。'),[],'A given fixed point does not identify the derived invariant');
assert.deepEqual(Array.from(link.select('A、B′ 两点处的切线。',relations.slice(0,1)).missing),['B′ 点切线']);
console.log('PASS: step links use existing object names, preserve primes/subscripts, report missing names, ignore English words and clear stale scenes.');

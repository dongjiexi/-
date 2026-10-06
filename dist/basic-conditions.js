/* Bounded equation/parameter models. Read premises, not bank IDs or answers. */
(function(root){
 'use strict';
 const plain=s=>root.DongMathInput.toPlain(String(s)).replace(/[$\s_{}]/g,'').replace(/[（），：；]/g,c=>({'（':'(', '）':')','，':',','：':':','；':';'}[c]));
 const scalar=s=>{try{const n=root.DongEquationBuilder.scalar(s);return Number.isFinite(n)&&Math.abs(n)<=10000?n:null;}catch{return null;}};
 const tex=n=>root.DongNumber.tex(n);
 function ellipse(raw){
  const s=plain(raw),m=/^(?:已知|设)?椭圆([A-Z]):([xy])\^2\/a\^2\+([xy])\^2\/b\^2=1\(a>b>0\)的?(.*?)[。;]?$/.exec(s);
  if(!m||m[2]===m[3])return null;
  const facts=m[4].split(','),eMatch=facts.map(f=>/^(?:的)?离心率(?:为|是|=)(.+)$/.exec(f)).filter(Boolean),lengthMatch=facts.map(f=>/^(?:长轴长|椭圆上(?:的点|任意一点)到两焦点的距离之和)(?:为|是|=)(.+)$/.exec(f)).filter(Boolean);
  if(facts.length!==2||eMatch.length!==1||lengthMatch.length!==1)return null;
  const e=scalar(eMatch[0][1]),L=scalar(lengthMatch[0][1]);if(!(e>0&&e<1&&L>0))return null;
  const major2=L*L/4,minor2=major2*(1-e*e);if(!(minor2>0))return null;
  const vertical=m[2]==='y',a=Math.sqrt(major2),b=Math.sqrt(minor2);
  return{type:'ellipse',a,b,h:0,k:0,orientation:vertical?'vertical':'horizontal',curve:m[1],e,L,major2,minor2,inferred_from_conditions:true,exact:{a2:tex(a*a),b2:tex(b*b)},derivation:[
   `由${lengthMatch[0][0].startsWith('长轴长')?'长轴长':'椭圆定义的两焦点距离之和'} $2a=${tex(L)}$，得长半轴 $a=${tex(L/2)}$。`,
   `离心率 $e=c/a=${tex(e)}$，所以 $c^2=a^2e^2=${tex(major2*e*e)}$，$b^2=a^2(1-e^2)=${tex(minor2)}$。`,
   `检查 $a>b>0$，并按题面长轴方向写标准方程；长轴${vertical?'在y轴':'在x轴'}。`
  ]};
 }
 function linear(s){
  if(!s.endsWith('=0'))return null;const body=s.slice(0,-2),n='(?:\\d+(?:\\.\\d+)?(?:/\\d+(?:\\.\\d+)?)?)',re=new RegExp('[+-]?(?:'+n+')?[xy]|[+-]?'+n,'g'),tokens=body.match(re);
  if(!tokens||tokens.join('')!==body)return null;const out={x:0,y:0,c:0};
  for(const t of tokens){const axis=/[xy]$/.exec(t)?.[0],raw=axis?t.slice(0,-1):t,coefficient=scalar(raw===''||raw==='+'?'1':raw==='-'?'-1':raw);if(coefficient==null)return null;out[axis||'c']+=coefficient;}
  return out.x||out.y?out:null;
 }
 function circle(raw){
  const s=plain(raw).replace(/(?<![a-z])([xy])\^2/g,'($1-0)^2'),m=/^(?:若|已知)?直线(.+?=0)是圆\(x-([^)]*)\)\^2\+\(y-([^)]*)\)\^2=([^,。;]+)的(?:一条)?对称轴[,。;]求([a-z])(?:的值)?[。;]?$/.exec(s);
  if(!m)return null;const l=linear(m[1]),unknown=m[5],parts=[m[2],m[3]],index=parts.findIndex(v=>v===unknown);
  if(!l||index<0||parts.filter(v=>v===unknown).length!==1||/[xy]/.test(unknown))return null;
  const fixed=scalar(parts[1-index]),r2=scalar(m[4]),coefficient=index===0?l.x:l.y,other=index===0?l.y:l.x;
  if(fixed==null||!(r2>0)||coefficient===0)return null;
  const value=-(other*fixed+l.c)/coefficient,h=index===0?value:fixed,k=index===0?fixed:value;
  if(!Number.isFinite(value)||Math.abs(value)>10000)return null;
  const line=l.y?{kind:'slope',m:-l.x/l.y,b:-l.c/l.y}:{kind:'vertical',x:-l.c/l.x};
  return{type:'circle',r:Math.sqrt(r2),h,k,showDynamic:false,showFeatures:true,points:{},lines:[{id:'basic-symmetry-axis',...line,label:'对称轴',source:'question',visible:true}],parameter:unknown,value,inferred_from_conditions:true,derivation:[
   `圆的标准式给出圆心为 $(${m[2]},${m[3]})$，半径平方为 $${tex(r2)}$。`,
   '圆的每条对称轴都经过圆心；经过圆心的直线也确为圆的一条对称轴，因此条件既必要又充分。',
   `将圆心代入题设直线，得 $(${tex(coefficient)})${unknown}+(${tex(other)})(${tex(fixed)})+(${tex(l.c)})=0$，解得 $${unknown}=${tex(value)}$。`,
   '回代圆心到直线的距离为0，半径为正；不把对称轴当成切线。'
  ]};
 }
 function parabola(raw){
  const s=plain(raw),m=/^(?:已知)?抛物线([xy])\^2=([+-]?(?:\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?)?)([a-z])([xy])\(\3>0\)的顶点到焦点的距离(?:为|是)([^,。;]+)[,。;](?:则\3=|求\3(?:的值)?)[。;]?$/.exec(s);
  if(!m||m[1]===m[4]||/[xy]/.test(m[3]))return null;
  const coefficient=scalar(m[2]===''?'1':m[2]==='-'?'-1':m[2]),focus=scalar(m[5]);if(!coefficient||!(focus>0))return null;
  const value=4*focus/Math.abs(coefficient),horizontal=m[4]==='x',direction=coefficient>0?1:-1;
  if(value>10000)return null;
  return{type:'parabola',p:focus,h:0,k:0,direction,orientation:horizontal?'horizontal':'vertical',showDynamic:false,showFeatures:true,points:{},lines:[],parameter:m[3],value,inferred_from_conditions:true,derivation:[
   `把原式与 $${m[1]}^2=4f${m[4]}$ 比较，其中 $|f|$ 是顶点到焦点的距离；原系数满足 $|${tex(coefficient)}${m[3]}|=4|f|$。`,
   `由 $|f|=${tex(focus)}$ 和 $${m[3]}>0$，得 $${m[3]}=4(${tex(focus)})/|${tex(coefficient)}|=${tex(value)}$。`,
   `焦点坐标为 $(${horizontal?tex(direction*focus):'0'},${horizontal?'0':tex(direction*focus)})$。画板参数存焦距，答案保留题中参数记号，两者不混淆。`
  ]};
 }
 function equation(s){if(s.type==='ellipse')return`\\frac{x^2}{${tex((s.orientation==='vertical'?s.b:s.a)**2)}}+\\frac{y^2}{${tex((s.orientation==='vertical'?s.a:s.b)**2)}}=1`;if(s.type==='parabola')return`${s.orientation==='horizontal'?'y':'x'}^2=${tex(4*s.p*s.direction)}${s.orientation==='horizontal'?'x':'y'}`;return`(x-(${tex(s.h)}))^2+(y-(${tex(s.k)}))^2=${tex(s.r*s.r)}`;}
 function infer(raw){return ellipse(raw)||circle(raw)||parabola(raw);}
 function solve(raw){
  const parts=root.DongQuestionParts.splitParts(raw);if(parts.length!==1)return null;
  let spec=circle(raw)||parabola(raw);
  if(!spec){const s=plain(raw).replace(/\(选取原题第\(1\)问。\)$/,''),m=/^(.*[。;])(?:求|写出)(?:椭圆([A-Z])?|([A-Z]))(?:的)?(?:标准)?方程[。;]?$/.exec(s);if(m){spec=ellipse(m[1]);if(spec&&(m[2]||m[3])&&(m[2]||m[3])!==spec.curve)spec=null;}}
  if(!spec)return null;
  const scene={schemaVersion:2,...spec,showDynamic:false,showFeatures:true,points:spec.points||{},lines:spec.lines||[],objects:[],basicConditions:{kind:spec.type},title:'基础条件与标准方程'},answer=spec.parameter?`$${spec.parameter}=${tex(spec.value)}$；曲线方程为 $${equation(spec)}$。`:`曲线方程为 $${equation(spec)}$。`;
  return{engineExtensions:['basic-conditions'],mode:'symbolic-fallback',title:'基础条件独立推导',restatement:raw,answer,strategy:'将几何定义转成参数方程，检查合法域，再以同一参数生成解析与图形。',parts:[{...parts[0],status:'answered',answer,steps:spec.derivation}],completion:{answered:1,total:1},scene,verification:{status:'locally-verified',counts:{verified:1,contradicted:0,unresolved:0},checks:[{id:'basic-condition',category:'curve',status:'verified',label:'定义与原条件回代',detail:'对称轴经过圆心；抛物线焦距与系数关系；椭圆定义、离心率和正半轴域分别按本题模型检查。'}]}};
 }
 root.DongBasicConditions={plain,scalar,ellipse,linear,circle,parabola,equation,infer,solve};
})(typeof window==='object'?window:globalThis);

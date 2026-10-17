/* Bounded focal-secant multiple choice model; no bank IDs or stored answers. */
(function(root){
  'use strict';
  const near=(a,b)=>Math.abs(a-b)<=128*Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b));
  const plain=s=>root.DongMathInput.toPlain(String(s)).replace(/\\n/g,'').replace(/[\s${}]/g,'').replace(/[（），：；]/g,c=>({'（':'(', '）':')','，':',','：':':','；':';'}[c])).replace(/[−–]/g,'-');
  const scalar=s=>{if(!/^[0-9+*/().-]{1,80}$/.test(s))return null;try{const n=root.DongEquationBuilder.scalar(s);return Number.isFinite(n)&&Math.abs(n)<=1e4?n:null;}catch{return null;}};
  const tex=n=>root.DongNumber.tex(n);
  function infer(raw){
    if(typeof raw!=='string'||raw.length>18000)return null;
    const s=plain(raw),at=s.search(/[A-H][.、]/);if(at<0)return null;
    const head=s.slice(0,at),tail=s.slice(at);
    // Consume the entire premise. Unmodelled clauses must not disappear.
    const m=/^([A-Z])为原点。直线y=([0-9+*/().-]+)\(x-([0-9+*/().-]+)\)经过抛物线([A-Z]):y\^2=2px\(p>0\)的焦点,与(?:曲线|抛物线|\4)交于([A-Z])[,、]([A-Z])(?:两点)?,准线为([a-z])。判断下列说法:$/.exec(head);
    if(!m||new Set([m[1],m[5],m[6]]).size!==3||[m[1],m[5],m[6]].some(x=>['F','V'].includes(x)))return null;
    const slope=scalar(m[2]),focus=scalar(m[3]);if(slope===null||Math.abs(slope)<.01||Math.abs(slope)>100||!(focus>=.01&&focus<=100))return null;
    const tokens=[...tail.matchAll(/([A-H])[.、]/g)];
    if(tokens.length<2||tokens.length>8||new Set(tokens.map(x=>x[1])).size!==tokens.length)return null;
    const options=tokens.map((token,i)=>({letter:token[1],body:tail.slice(token.index+token[0].length,tokens[i+1]?.index??tail.length).replace(/[;。]+$/,'')}));
    const y0=2*focus/slope,dy=2*focus*Math.sqrt(1+1/slope**2),points=[y0-dy,y0+dy].map(y=>[y*y/(4*focus),y]);
    const length=4*focus*(1+1/slope**2),mid=points[0].map((v,i)=>(v+points[1][i])/2),sides=[...points.map(p=>p[0]**2+p[1]**2),length**2];
    const spec={slope,focus,standardP:2*focus,origin:m[1],curve:m[4],ends:[m[5],m[6]],directrix:m[7],options,points,length,mid,sides};
    // Independent residuals guard the numerical model before any answer is emitted.
    if(!points.every(([x,y])=>near(y*y,4*focus*x)&&near(y,slope*(x-focus)))||!near(Math.hypot(points[0][0]-points[1][0],points[0][1]-points[1][1]),length)||!near(mid[0]+focus,length/2))return null;
    return spec;
  }
  function evaluate(body,s){
    const pair=s.ends.join(''),reverse=[...s.ends].reverse().join('');let m;
    if((m=/^p=(.+)$/.exec(body))){const value=scalar(m[1]);return value===null?null:{truth:near(s.standardP,value),detail:`焦点横坐标为 $p/2=${tex(s.focus)}$，故 $p=${tex(s.standardP)}$。`};}
    if((m=/^\|([A-Z]{2})\|=(.+)$/.exec(body))&&[pair,reverse].includes(m[1])){const value=scalar(m[2]);return value===null?null:{truth:near(s.length,value),detail:`由交点距离公式得 $|${pair}|=${tex(s.length)}$。`};}
    if(new RegExp(`^以(?:${pair}|${reverse})为直径的圆与(?:${s.directrix}|准线(?:${s.directrix})?)相切$`).test(body))return{truth:true,detail:`圆心为弦中点，横坐标 $${tex(s.mid[0])}$；到准线 $x=-${tex(s.focus)}$ 的距离为 $${tex(s.mid[0]+s.focus)}$，等于半弦长 $${tex(s.length/2)}$，故相切。`};
    if((m=/^△([A-Z]{3})为等腰三角形$/.exec(body))&&new Set(m[1]).size===3&&[...m[1]].every(x=>[s.origin,...s.ends].includes(x)))return{truth:s.sides.some((x,i)=>s.sides.some((y,j)=>j>i&&near(x,y))),detail:`三边平方分别为 $${s.sides.map(tex).join(',\\quad ')}$，比较是否有两项相等。`};
    return null;
  }
  function scene(s){
    const id=n=>'focal-choice-'+n,make=(name,op,refs,extra={})=>({id:id(name),kind:'construction',op,refs,source:'question',visible:true,...extra});
    const objects=[
      make('line','line_angle',['feature:F'],{angle:Math.atan(s.slope)*180/Math.PI,label:s.ends.join('')}),
      ...s.ends.map((label,branch)=>make('end'+branch,'intersection',[id('line'),'$conic'],{branch,label})),
      make('mid','midpoint',[id('end0'),id('end1')],{visible:false}),
      make('circle','circle',[id('mid'),id('end0')],{label:'直径圆'}),
      make('axis','line',['feature:V','feature:F'],{visible:false}),
      make('directrix-foot','reflect_center',['feature:F','feature:V'],{visible:false}),
      make('directrix','perpendicular',[id('directrix-foot'),id('axis')],{label:s.directrix}),
      make('touch','foot',[id('mid'),id('directrix')],{visible:false})
    ];
    return{schemaVersion:2,type:'parabola',p:s.focus,h:0,k:0,direction:1,orientation:'horizontal',showDynamic:false,showFeatures:false,problemMotion:true,points:{[s.origin]:[0,0]},lines:[],objects,polygons:[{id:id('triangle'),labels:[s.origin,...s.ends],label:'△'+s.origin+s.ends.join(''),source:'question'}],title:'焦点弦、直径圆与准线',focalChoice:{slope:s.slope,focus:s.focus}};
  }
  function solve(raw){
    const s=infer(raw);if(!s)return null;
    const evaluated=s.options.map(o=>({...o,result:evaluate(o.body,s)})),unknown=evaluated.filter(o=>!o.result),correct=evaluated.filter(o=>o.result?.truth).map(o=>o.letter);
    const answer=unknown.length?`已判断的正确选项为 ${correct.join('、')||'无'}；${unknown.map(o=>o.letter).join('、')} 尚未覆盖，不能据此确定完整答案。`:`正确选项为 ${correct.join('、')||'无'}。`;
    const steps=[`焦点为 $(p/2,0)$，代入已知直线得 $p/2=${tex(s.focus)}$，故抛物线为 $y^2=${tex(4*s.focus)}x$。`,
      `用直线 $y=m(x-f)$ 消去 $x$，得 $y^2-\\frac{4f}{m}y-4f^2=0$，其中 $m=${tex(s.slope)}$，$f=${tex(s.focus)}$。`,
      `解得两个交点（名称可交换）：$(${s.points[0].map(tex).join(',')})$ 与 $(${s.points[1].map(tex).join(',')})$。`,
      ...evaluated.map(o=>`${o.letter}：${o.result?(o.result.truth?'正确。':'错误。')+o.result.detail:'本选项的目标尚未覆盖，已保留原文：'+o.body}`)];
    const checks=[{id:'focal-choice-model',status:'verified',category:'construction',label:'焦点与弦端点回代',detail:'两个交点均满足直线和抛物线；弦长与中点到准线距离独立核对。'}];
    return{engineExtensions:['parabola-focal-choice'],mode:'symbolic-fallback',title:'焦点弦性质逐项判断',restatement:raw,answer,parts:[{index:0,label:'选项分析',status:unknown.length?'partial':'answered',answer,steps}],completion:{answered:unknown.length?0:1,total:1},scene:scene(s),verification:{status:'locally-verified',counts:{verified:1,contradicted:0,unresolved:unknown.length},checks},scene_notice:'交点、中点、直径圆和准线采用依赖构造。自由修改原题图形后，原题答案不随之改写。'};
  }
  root.DongParabolaFocalChoice={infer,evaluate,scene,solve};
})(typeof window==='object'?window:globalThis);

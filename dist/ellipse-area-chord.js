/* Origin-triangle area fixes chords through a point on either symmetry axis.
 * Solve a quadratic in w, then check every finite distinct-intersection branch. */
(function(root){
 'use strict';
 const tex=n=>root.DongNumber.tex(n),rootTex=n=>root.DongEllipseDistance.rootTex(n);
 function candidates(a,b,d,S){
  if(![a,b,d,S].every(n=>Number.isFinite(n)&&Math.abs(n)<=10000)||!(a>0&&b>0&&S>0)||d===0)return null;
  const a2=a*a,b2=b*b,s2=S*S,K=a2*b2*d*d,disc=1-4*s2/(a2*b2),eps=8*Number.EPSILON;
  if(disc < -eps)return [];
  const rad=Math.sqrt(Math.max(0,disc)),large=K*(1+rad)/(2*s2),small=2*d*d/(1+rad),ws=rad===0?[large]:[small,large],out=[];
  for(const w of ws){
   let k2=(w-b2)/a2;if(k2< -eps*Math.max(1,w/a2)||!(w>d*d))continue;k2=Math.max(0,k2);
   for(const k of k2===0?[0]:[-Math.sqrt(k2),Math.sqrt(k2)]){
    const A=b2+a2*k*k,B=2*a2*d*k,C=a2*(d*d-b2),D=4*a2*b2*(a2*k*k+b2-d*d);if(!(D>0))continue;
    const xs=[(-B-Math.sqrt(D))/(2*A),(-B+Math.sqrt(D))/(2*A)],points=xs.map(x=>({x,y:k*x+d})),length2=(1+k*k)*(xs[1]-xs[0])**2,area=Math.abs(d*(xs[1]-xs[0]))/2;
    if(![...points.flatMap(p=>[p.x,p.y]),length2].every(n=>Number.isFinite(n)&&Math.abs(n)<=100000)||Math.abs(area-S)>1e-8*Math.max(1,S)||points.some(p=>Math.abs(p.x*p.x/a2+p.y*p.y/b2-1)>1e-7))continue;
    // If the fixed point lies on the ellipse, use the other endpoint as the
    // driver so that the line through the anchor and driver remains defined.
    if(Math.hypot(points[0].x,points[0].y-d)<1e-8*Math.max(1,Math.abs(d)))points.reverse();
    if(!out.some(s=>Math.abs(s.k-k)<1e-12))out.push({k,k2,w,A,B,C,D,points,length2,t:Math.atan2(points[0].y/b,points[0].x/a)});
   }
  }
  return out;
 }
 function recognise(raw){
  const parts=root.DongQuestionParts.splitParts(raw);if(parts.length!==2)return null;
  const api=root.DongBasicConditions,first=parts[0],head=first.question.slice(0,first.question.length-first.body.length),base=api.ellipse(head);if(!base||!api.equationGoal(first.body,base.curve))return null;
  const chunks=api.clauses(parts[1].body);if(!chunks)return null;
  let declaration,origin,areaFact,goal;const constraints=[];
  for(const rawClause of chunks){
   const c=rawClause.replace(/^(?:其中|设)/,'');let m;
   if((m=/^过(?:定)?点([A-Z])?\(([^,]+),([^)]*)\)(?:的)?直线([a-z])与(?:椭圆)?([A-Z])(?:相)?交于([A-Z])[,、]([A-Z])(?:两点)?$/.exec(c))){if(declaration)return null;declaration=m;}
   else if((m=/^([A-Z])(?:为|是)坐标原点$/.exec(c))){if(origin)return null;origin=m[1];}
   else if((m=/^(?:若|已知)?(?:S△([A-Z]{3})=|(?:三角形|△)([A-Z]{3})(?:的)?面积(?:为|等于|是))(.+)$/.exec(c))){if(areaFact)return null;areaFact={labels:m[1]||m[2],value:api.scalar(m[3])};}
   else if((m=/^(?:求|求出)(?:\|([A-Z]{2})\||(?:弦)?([A-Z]{2})(?:的)?(?:长度|长))$/.exec(c))){if(goal)return null;goal=m[1]||m[2];}
   else if((m=/^(?:直线)?([a-z])(?:的)?斜率(?:为|是|等于|不小于|不大于|大于|小于|>=|<=|≥|≤|>|<|=)(.+)$/.exec(c))){const value=api.scalar(m[2]),op=c.slice(c.indexOf('斜率')+2,c.length-m[2].length);if(value==null)return null;constraints.push({kind:'slope',label:m[1],op,value,text:rawClause});}
   else if((m=/^(?:点)?([A-Z])在第([一二三四])象限$/.exec(c)))constraints.push({kind:'quadrant',label:m[1],value:'一二三四'.indexOf(m[2])+1,text:rawClause});
   else return null; // Keep the cloud's reasoning for every uncovered clause.
  }
  if(!declaration||!origin||!areaFact||!goal)return null;
  const m=declaration,A=m[6],B=m[7],O=origin,same=(a,b)=>a.split('').sort().join('')===b.split('').sort().join('');
  if(m[5]!==base.curve||!same(goal,A+B)||!same(areaFact.labels,A+B+O))return null;
  if(constraints.some(c=>c.kind==='slope'?c.label!==m[4]:![A,B].includes(c.label)))return null;
  if(new Set(constraints.map(c=>JSON.stringify([c.kind,c.label,c.op,c.value]))).size!==constraints.length)return null;
  const x=api.scalar(m[2]),y=api.scalar(m[3]),area=areaFact.value;if(x==null||y==null||!(area>0)||!(x===0&&y!==0||y===0&&x!==0))return null;
  if(new Set([A,B,O,base.curve,...(m[1]?[m[1]]:[])]).size!==(m[1]?5:4))return null;
  const axisA=base.orientation==='vertical'?base.b:base.a,axisB=base.orientation==='vertical'?base.a:base.b,swapped=y===0,a=swapped?axisB:axisA,b=swapped?axisA:axisB,d=swapped?x:y,rows=candidates(a,b,d,area);if(!rows?.length)return null;
  const labels=[A,B,O,base.curve],anchor=m[1]||['G','T','H','J'].find(s=>!labels.includes(s)),spec={...base,parts,areaPart:parts[1].index,x,y,d,area,axisA,axisB,swapped,anchor,line:m[4],A,B,O,constraints};
  // Point names are variables, not implicit left/right ordering. Test both
  // assignments when named endpoints are restricted, then retain legal ones.
  const assignments=constraints.some(c=>c.kind==='quadrant')?rows.flatMap(s=>[s,{...s,points:[...s.points].reverse()}]):rows;
  const solutions=assignments.filter(s=>matches(spec,s));if(!solutions.length)return null;
  return{...spec,solutions};
 }
 const world=(spec,p)=>spec.swapped?{x:p.y,y:p.x}:p;
 function physicalSlope(spec,solution){return spec.swapped?(solution.k===0?null:1/solution.k):solution.k;}
 function matches(spec,solution){
  return(spec.constraints||[]).every(c=>{
   if(c.kind==='quadrant'){const p=world(spec,solution.points[c.label===spec.A?0:1]),tolerance=32*Number.EPSILON*Math.max(1,spec.axisA,spec.axisB),quadrant=Math.abs(p.x)<=tolerance||Math.abs(p.y)<=tolerance?0:p.x>0?(p.y>0?1:4):(p.y>0?2:3);return quadrant===c.value;}
   const k=physicalSlope(spec,solution);if(k==null)return false;const difference=k-c.value,tolerance=32*Number.EPSILON*Math.max(1,Math.abs(k),Math.abs(c.value));
   if(['为','是','等于','='].includes(c.op))return Math.abs(difference)<=tolerance;
   if(['大于','>'].includes(c.op))return difference>tolerance;if(['小于','<'].includes(c.op))return difference< -tolerance;
   if(['不小于','>=','≥'].includes(c.op))return difference>=-tolerance;if(['不大于','<=','≤'].includes(c.op))return difference<=tolerance;
   return false;
  });
 }
 function poseMatches(spec,A,B){
  if(![A?.x,A?.y,B?.x,B?.y].every(Number.isFinite))return false;
  const points=[A,B].map(p=>world(spec,p)),dx=points[1].x-points[0].x,dy=points[1].y-points[0].y;
  return dx!==0&&matches(spec,{k:dy/dx,points});
 }
 function lengthTex(spec,solution){
  const exact=root.DongNumber.exact(Math.sqrt(solution.length2));if(exact)return exact.tex;
  const a2=(spec.swapped?spec.axisB:spec.axisA)**2,b2=(spec.swapped?spec.axisA:spec.axisB)**2,C=2*b2+4*spec.area**2/spec.d**2*(1-b2/a2),D=Math.max(0,1-4*spec.area**2/(a2*b2)),middle=a2*b2*spec.d**2/(2*spec.area**2),sign=solution.w<middle?'-':'+';
  if([C,D,2*b2].every(n=>root.DongNumber.rational(n)))return`\\sqrt{${tex(C)}${sign}${tex(2*b2)}\\sqrt{${tex(D)}}}`;
  return tex(Math.sqrt(solution.length2)); // Explicit approximation, never an exact decimal claim.
 }
 function parameter(spec,solution){const p=world(spec,solution.points[0]);return Math.atan2(p.y/spec.axisB,p.x/spec.axisA);}
 function sceneFor(spec){
  const t=parameter(spec,spec.solutions[0]),id=s=>'area-chord-'+s,part=spec.areaPart,common={kind:'construction',source:'derived',visible:true,part},motionDomain={parameter:{min:t,max:t}},metadata={a:spec.a,b:spec.b,orientation:spec.orientation,axisA:spec.axisA,axisB:spec.axisB,x:spec.x,y:spec.y,d:spec.d,area:spec.area,swapped:spec.swapped,anchor:spec.anchor,A:spec.A,B:spec.B,O:spec.O,line:spec.line,areaPart:part,constraints:spec.constraints,solutions:spec.solutions};
  return{schemaVersion:2,type:'ellipse',orientation:spec.orientation,a:spec.a,b:spec.b,h:0,k:0,showDynamic:false,showFeatures:false,showConic:true,problemMotion:true,points:{[spec.O]:[0,0],[spec.anchor]:[spec.x,spec.y]},pointParts:{[spec.anchor]:[part]},objects:[
   {...common,id:id('A'),op:'point_on',refs:['$conic'],t,label:spec.A,motionDomain},
   {...common,id:id('line'),op:'line',refs:['feature:'+spec.anchor,id('A')],label:spec.line},
   {...common,id:id('B'),op:'second_intersection',refs:[id('A'),id('line'),'$conic'],label:spec.B},
   {...common,id:id('OA'),op:'segment',refs:['feature:'+spec.O,id('A')],label:spec.O+spec.A},
   {...common,id:id('OB'),op:'segment',refs:['feature:'+spec.O,id('B')],label:spec.O+spec.B}
  ],lines:[],polygons:[{id:id('triangle'),labels:[spec.O,spec.A,spec.B],kind:'triangle',part,source:'derived',visible:true,label:'△'+spec.O+spec.A+spec.B}],areaChord:metadata,inferred_from_conditions:true,derivation:spec.derivation,exact:spec.exact,title:'面积条件与全部合法弦'};
 }
 function solve(raw){
  const spec=recognise(raw);if(!spec)return null;
  const first=spec.parts[0],second=spec.parts[1],X=spec.swapped?'y':'x',Y=spec.swapped?'x':'y',a2=(spec.swapped?spec.axisB:spec.axisA)**2,b2=(spec.swapped?spec.axisA:spec.axisB)**2,area=tex(spec.area),lengths=[...new Set(spec.solutions.map(s=>lengthTex(spec,s)))];
  const answer=`$|${spec.A+spec.B}|=${lengths.join('\\quad\\text{或}\\quad')}$。`,steps=[...spec.derivation,
   `点 $${spec.anchor}=(${tex(spec.x)},${tex(spec.y)})$ 仅作题中固定点的辅助命名。若直线为 $${X}=0$，两交点与原点共线，面积为0，不符合题设。故设 $${Y}=k${X}+(${tex(spec.d)})$。`,
   `按坐标顺序，曲线为 $${X}^2/${tex(a2)}+${Y}^2/${tex(b2)}=1$。联立得到 $(${tex(b2)}+${tex(a2)}k^2)${X}^2+(${tex(2*a2*spec.d)})k${X}+(${tex(a2*(spec.d*spec.d-b2))})=0$。`,
   `判别式 $\\Delta=4(${tex(a2)})(${tex(b2)})[${tex(a2)}k^2+${tex(b2)}-${tex(spec.d**2)}]>0$ 保证两个不同实交点。面积公式给出 $S=\\frac{|${tex(spec.d)}|}{2}|${X}_1-${X}_2|=${area}$。`,
   `由韦达得 $(${X}_1-${X}_2)^2=\\Delta/(${tex(b2)}+${tex(a2)}k^2)^2$。令 $w=${tex(a2)}k^2+${tex(b2)}$，得到 $S^2w^2-${tex(a2*b2*spec.d**2)}w+${tex(a2*b2*spec.d**4)}=0$。`,
   `求全部根，保留 $w\\ge ${tex(b2)}$ 且 $w>${tex(spec.d**2)}$，再取 $k=\\pm\\sqrt{(w-${tex(b2)})/${tex(a2)}}$（零斜率只计一次）。合法 $k^2$ 为 $${[...new Set(spec.solutions.map(s=>tex(s.k2)))].join('\\quad\\text{或}\\quad')}$。`,
   ...(spec.constraints.length?[`附加条件逐个回代：${spec.constraints.map(c=>c.text).join('；')}。斜率按原坐标系计算${spec.swapped?'（此处原直线斜率为1/k；k=0时竖直，斜率不存在）':''}；象限严格排除坐标轴，端点名称按条件分配，不默认A在左、B在右。保留 ${spec.solutions.length} 个合法命名构型。`]:[]),
   `最后 $|${spec.A+spec.B}|=\\sqrt{1+k^2}\\,|${X}_1-${X}_2|=\\frac{2S}{|${tex(spec.d)}|}\\sqrt{1+k^2}$，得 ${answer}`,
   '逐个候选回代曲线、固定点直线、正面积和判别式；没有把不同斜率的弦长默认合并，也不使用采样猜测。图像可切换全部合法构型，默认保持面积条件。'
  ];
  const parts=[{...first,status:'answered',answer:`$${root.DongBasicConditions.equation(spec)}$。`,steps:spec.derivation},{...second,status:'answered',answer,steps}];
  return{engineExtensions:['ellipse-area-chord'],mode:'symbolic-fallback',title:'椭圆面积条件与弦长独立推导',restatement:raw,answer:parts.map(p=>p.label+'：'+p.answer).join('\n'),strategy:'由长轴与离心率确定曲线；面积转成坐标差，用韦达解含参二次方程，并核对所有构型。',parts,completion:{answered:2,total:2},scene:sceneFor(spec),verification:{status:'locally-verified',counts:{verified:2,contradicted:0,unresolved:0},checks:[{id:'area-chord-parameters',category:'curve',status:'verified',label:'半轴与离心率回代',detail:'长轴长、离心率与正半轴条件一致。'},{id:'area-chord-candidates',category:'answer',part:spec.areaPart,status:'verified',label:'全体面积约束候选',detail:'二次方程候选逐一回代曲线、面积与正判别式，排除退化方向。'}]}};
 }
 root.DongEllipseAreaChord={candidates,recognise,world,physicalSlope,matches,poseMatches,lengthTex,parameter,sceneFor,solve};
})(typeof window==='object'?window:globalThis);

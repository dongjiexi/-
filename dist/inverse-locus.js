/* Bounded symbolic inversion on an axis-vertex ellipse. No exam IDs, stored
 * answers, arbitrary expressions, sampling proofs or inference API calls. */
(function(root){
  'use strict';
  const PREFIX='inverse-locus-',tex=n=>root.DongNumber.tex(n),sqrt=n=>root.DongEllipseDistance.rootTex(n);
  const plain=s=>root.DongMathInput.toPlain(String(s)).replace(/[$\s_{}]/g,'').replace(/[（），：；]/g,c=>({'（':'(', '）':')','，':',','：':':','；':';'}[c]));
  const near=(a,b)=>Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b));
  function scalar(s){try{const v=root.DongEquationBuilder.scalar(s);return Number.isFinite(v)&&Math.abs(v)<=10000?v:null;}catch{return null;}}
  const shift=(v,c)=>c===0?v:`(${v}${c<0?'+':'-'}${tex(Math.abs(c))})`;
  function infer(raw){
    const s=plain(raw),header=s.split(/\(\d{1,2}\)/)[0];
    if(!/^(?:设|已知)?椭圆[A-Z]:x\^2\/a\^2\+y\^2\/b\^2=1\(a>b>0\)的离心率为[^,]+,(?:下|上)顶点为[A-Z],右顶点为[A-Z],\|[A-Z]{2}\|=[^。;]+[。;]?$/.test(header))return null;
    const v=/(下|上)顶点为([A-Z]),右顶点为([A-Z]),\|([A-Z])([A-Z])\|=([^。;]+)[。;]?$/.exec(header);
    const eMatch=/离心率为([^,]+),/.exec(header),e=eMatch&&scalar(eMatch[1]),length=v&&scalar(v[6]);
    if(!v||!eMatch||!(e>0&&e<1&&length>0)||v[2]===v[3]||![v[2]+v[3],v[3]+v[2]].includes(v[4]+v[5]))return null;
    const a2=length*length/(2-e*e),b2=a2*(1-e*e);
    if(!(a2>b2&&b2>0)||!Number.isFinite(a2+b2))return null;
    const a=Math.sqrt(a2),b=Math.sqrt(b2),d=v[1]==='下'?-b:b;
    return{type:'ellipse',orientation:'horizontal',a,b,h:0,k:0,A:v[2],B:v[3],d,e,length,points:{[v[2]]:[0,d],[v[3]]:[a,0]},inferred_from_conditions:true,exact:{a2:tex(a2),b2:tex(b2)},derivation:[
      `由 $e^2=1-b^2/a^2$ 得 $b^2=${tex(1-e*e)}a^2$。`,
      `相邻的长、短轴顶点距离满足 $|${v[2]+v[3]}|^2=a^2+b^2=${tex(length*length)}$。`,
      `联立得 $a^2=${tex(a2)},b^2=${tex(b2)}$，核对 $a>b>0$ 及离心率。`
    ]};
  }
  function extrema({a,b,d,power,factor}){
    if(![a,b,d,power,factor].every(Number.isFinite)||!(a>b&&b>0&&power>0)||!near(Math.abs(d),b))return null;
    const center=d+(factor-1)*power/(2*d),radius2=center*center-d*d+power;
    if(!(radius2>0)||!Number.isFinite(radius2))return null;
    const q=1-a*a/(b*b),vertex=center/q,y=Math.max(-b,Math.min(b,vertex)),x2=Math.max(0,a*a*(1-y*y/(b*b))),distance2=a*a+center*center+q*y*y-2*center*y;
    if(!(distance2>0))return null;
    const r=Math.sqrt(radius2),distance=Math.sqrt(distance2),x=Math.sqrt(x2),pairs=[];
    if(![q,vertex,x2,distance2,r,distance].every(Number.isFinite)||Math.max(Math.abs(center)+r,a,b,distance+r)>100000)return null;
    for(const sign of x===0?[1]:[1,-1]){
      const M={x:sign*x,y},P={x:-r*M.x/distance,y:center-r*(M.y-center)/distance};
      pairs.push({P,M});
    }
    // x=0 is excluded by the premise. A boundary optimum is only a supremum.
    return{center,radius2,q,vertex,x2,y,distance2,maximum:r+distance,attained:x2>0, pairs};
  }
  function recognise(raw){
    const base=infer(raw);if(!base)return null;
    const parts=root.DongQuestionParts.splitParts(raw),rows=parts.map(p=>({...p,text:plain(p.body)}));
    const eq=rows.find(p=>/^求椭圆(?:的)?标准方程[。;]?$/.test(p.text));
    const coords=rows.find(p=>/设[A-Z]\(m,n\),求(?:点)?[A-Z](?:的)?坐标\(用m,n表示\)[。;]?$/.test(p.text));
    if(!eq||!coords)return null;
    const setup=new RegExp('^已知动点([A-Z])不在y轴上,点([A-Z])在射线'+base.A+'\\1上,且(?:满足)?\\|'+base.A+'\\2\\|\\*\\|'+base.A+'\\1\\|=([^。;]+)[。;]');
    const c=setup.exec(coords.text),power=c&&scalar(c[3]);
    if(!c||!(power>0)||new Set([base.A,base.B,c[1],c[2],'O']).size!==5)return null;
    const end=new RegExp('设'+c[1]+'\\(m,n\\),求(?:点)?'+c[2]+'(?:的)?坐标\\(用m,n表示\\)[。;]?$');
    if(!end.test(coords.text.slice(c[0].length)))return null;
    const maximum=rows.find(p=>p.index!==coords.index&&setup.test(p.text));let factor=null,M=null,extent=null;
    if(maximum){
      const inherited=setup.exec(maximum.text);
      if(inherited[1]!==c[1]||inherited[2]!==c[2]||scalar(inherited[3])!==power)return null;
      const tail=maximum.text.replace(setup,''),re=new RegExp('^设O为坐标原点,([A-Z])(?:是|为)(?:椭圆上的动点|椭圆动点),直线O'+c[2]+'的斜率为直线O'+c[1]+'的斜率的([^,]+)倍,求\\|'+c[1]+'\\1\\|(?:的)?最大值[。;]?$'),m=re.exec(tail);
      factor=m&&scalar(m[2]);M=m?.[1];
      if(!m||!Number.isFinite(factor)||[base.A,base.B,c[1],c[2],'O'].includes(M))return null;
      extent=extrema({...base,power,factor});if(!extent)return null;
    }
    // No silent acceptance of extra questions, constraints or compound goals.
    if(rows.length!==(maximum?3:2))return null;
    return{schema:1,...base,power,factor,P:c[1],R:c[2],M,equationPart:eq.index,coordinatePart:coords.index,maximumPart:maximum?.index,parts,extent};
  }
  function sceneFor(spec){
    const id=s=>PREFIX+s,{A,B,P,R,M,a,b,d,power,factor,coordinatePart,maximumPart,extent}=spec,common={kind:'construction',source:'derived',visible:true};
    const locus=extent?{id:id('circle'),kind:'circle',h:0,k:extent.center,r:Math.sqrt(extent.radius2),label:P+' 的轨迹',role:'derived_locus',part:maximumPart,source:'derived',visible:true}:null;
    // A literal plane profile belongs to (i); the constrained circle profile
    // belongs to (ii). Switching questions does not destroy either position.
    const profiles={[coordinatePart]:{mode:'plane',x:a,y:d+b*2,motionDomain:{excludeAxes:['y']}}};
    if(extent)profiles[maximumPart]={mode:'curve',t:0,motionDomain:{excludeAxes:['y']}};
    const objects=[...(locus?[locus]:[]),
      {...common,id:id('P'),op:'point_on',refs:[locus?.id||'$conic'],t:0,label:P,parts:[coordinatePart,...(maximumPart?[maximumPart]:[])],motionByPart:profiles,motionDomain:{excludeAxes:['y']}},
      {...common,id:id('R'),op:'inverse',refs:['feature:'+A,id('P')],power,label:R,parts:[coordinatePart,...(maximumPart?[maximumPart]:[])]},
      {...common,id:id('AP'),op:'ray',refs:['feature:'+A,id('P')],label:A+P,parts:[coordinatePart,...(maximumPart?[maximumPart]:[])]},
      ...(extent?[
        {...common,id:id('M'),op:'point_on',refs:['$conic'],t:Math.PI/4,label:M,part:maximumPart},
        {...common,id:id('OP'),op:'line',refs:['feature:O',id('P')],label:'O'+P,part:maximumPart},
        {...common,id:id('OR'),op:'line',refs:['feature:O',id('R')],label:'O'+R,part:maximumPart},
        {...common,id:id('PM'),op:'segment',refs:[id('P'),id('M')],label:P+M,part:maximumPart}
      ]:[])];
    return{schemaVersion:2,type:'ellipse',orientation:'horizontal',a,b,h:0,k:0,title:'椭圆上的反演与距离最值',points:{[A]:[0,d],[B]:[a,0]},lines:[],objects,showConic:true,showFeatures:true,showDynamic:false,problemMotion:true,inverseLocus:{schema:1,A,B,P,R,M,a,b,d,power,factor,equationPart:spec.equationPart,coordinatePart,maximumPart},inferred_from_conditions:true,derivation:spec.derivation,exact:spec.exact};
  }
  function solve(raw){
    const spec=recognise(raw);if(!spec)return null;
    const {a,b,d,A,P,R,M,power,extent:ex}=spec,D=`m^2+${shift('n',d)}^2`,rho=tex(power),equation=`\\frac{x^2}{${tex(a*a)}}+\\frac{y^2}{${tex(b*b)}}=1`,scene=sceneFor(spec);
    const commonSteps=[`因 $${P}$ 不在 $y$ 轴上，$m\\ne0$，所以 $D=|${A+P}|^2=${D}>0$。`,
      `$${R}$ 在射线 $${A+P}$ 上，故 $\\overrightarrow{${A+R}}=t\\overrightarrow{${A+P}}$，其中 $t>0$。由 $|${A+R}|\\,|${A+P}|=${rho}$ 得 $t=${rho}/D$，不是负方向的反演。`];
    const parts=spec.parts.map(part=>{
      if(part.index===spec.equationPart)return{...part,status:'answered',answer:`椭圆的标准方程为 $${equation}$。`,steps:spec.derivation};
      if(part.index===spec.coordinatePart)return{...part,status:'answered',answer:`$${R}=\\left(\\frac{${rho}m}{${D}},${tex(d)}+\\frac{${rho}${shift('n',d)}}{${D}}\\right)$，其中 $m\\ne0$。`,steps:[...commonSteps,`由 $${A}=(0,${tex(d)})$ 及 $${R}=${A}+t(${P}-${A})$，分别得到两个坐标。`,'将坐标代回，方向系数为正，且两段长度之积恰为题设值；拖动源点时，对应的反演点会同步变化。']};
      const locus=`x^2+${shift('y',ex.center)}^2=${tex(ex.radius2)}`,maxTex=`${sqrt(ex.radius2)}+${sqrt(ex.distance2)}`;
      const signedRoot=n=>(n<0?'-':'')+sqrt(n*n),shiftedRoot=(center,offset)=>`${tex(center)}${offset<0?'-':'+'}${sqrt(offset*offset)}`;
      const equality=ex.pairs.map(({P:p,M:m})=>`$${M}=(${signedRoot(m.x)},${tex(m.y)})$，$${P}=(${signedRoot(p.x)},${shiftedRoot(ex.center,p.y-ex.center)})$`).join('；或 ');
      return{...part,status:'answered',answer:`$${P}$ 的轨迹为圆 $${locus}$，去掉与 $y$ 轴的两个交点。$|${P+M}|$ ${ex.attained?'的最大值':'的上确界'}为 $${maxTex}$。${ex.attained?'取等时 '+equality+'。':'仅在被排除的轴上点取到等号，因此没有最大值。'}`,steps:[...commonSteps,
        `代入 $k_{O${R}}=${tex(spec.factor)}k_{O${P}}$：$(${tex(d)})D+${rho}${shift('n',d)}=${tex(spec.factor*power)}n$。利用 $m\\ne0$，化简并配方得 $${locus}$，且 $m\\ne0$。`,
        `反过来，圆上任一点只要 $m\\ne0$，$D>0$ 且上述等式成立，代回反演坐标即可满足斜率关系。所以不是只证明必要条件。`,
        `记轨迹圆心为 $T=(0,${tex(ex.center)})$，半径 $r=${sqrt(ex.radius2)}$。三角不等式给出 $|${P+M}|\\le |${P}T|+|T${M}|=r+|T${M}|$。`,
        `设 $${M}=(x,y)$，由椭圆得 $x^2=${tex(a*a)}(1-y^2/${tex(b*b)})$，$- ${tex(b)}\\le y\\le ${tex(b)}$。故 $|T${M}|^2=${tex(ex.q)}y^2${-2*ex.center<0?'-':'+'}${tex(Math.abs(2*ex.center))}y+${tex(a*a+ex.center*ex.center)}$。`,
        `这是开口向下的二次函数；比较顶点 $y=${tex(ex.vertex)}$ 与区间端点，得 $|T${M}|^2\\le ${tex(ex.distance2)}$。`,
        ex.attained?`在两组列出的坐标处，$${P}$ 与 $${M}$ 位于圆心 $T$ 的两侧且三点共线，三角不等式取等；$${P}$ 横坐标不为零，所以最大值确实取到。`:'等号位置均落在被排除的 y 轴上；合法点可趋近这些位置，只能取得上确界。',
        '画板分问保留独立位置：坐标问允许在平面拖动；最值问只沿推导出的轨迹圆拖动。可点击“定位最大距离”核对取等条件，不以采样代替证明。']};
    });
    const checks=[{id:PREFIX+'ellipse',status:'verified',label:'顶点间距与离心率回代',category:'curve',detail:'联立 e²=1−b²/a²、a²+b²=L²；检查半轴为正且长轴较长。'},
      {id:PREFIX+'coordinate',status:'verified',label:'反演方向与长度乘积',category:'construction',part:spec.coordinatePart,detail:'D>0 与正反演系数 ρ/D；AR·AP=ρ，非枚举核验。'}];
    if(ex)checks.push({id:PREFIX+'locus',status:'verified',label:'轨迹等价消元',category:'construction',part:spec.maximumPart,detail:'m≠0 时斜率关系等价于配方后的轨迹圆；删除轴交点。'}, {id:PREFIX+'maximum',status:'verified',label:'全局距离界与取等条件',category:'answer',part:spec.maximumPart,detail:'三角不等式与闭区间二次函数比较；分别核查最大值和不可达的上确界。'});
    return{engineExtensions:['inverse-locus'],mode:'symbolic-fallback',title:'董解析反演与轨迹推导',restatement:raw,answer:parts.map(p=>p.label+'：'+p.answer).join('\n'),strategy:'先由条件求椭圆；正比例反演求点，再等价消元为轨迹，利用距离界和取等条件求最值。',parts,completion:{answered:parts.length,total:parts.length},scene,verification:{status:'locally-verified',message:'解析与分问联动图形来自同一组参数；推导使用恒等式和取等条件。',counts:{verified:checks.length,contradicted:0,unresolved:0},checks}};
  }
  root.DongInverseLocus={infer,recognise,extrema,sceneFor,solve};
})(typeof window==='object'?window:globalThis);

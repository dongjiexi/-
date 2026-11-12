/* A focal secant of the asymptotes and its shared midpoint construction. */
(function(root){
  'use strict';

  const tex=n=>root.DongNumber.tex(n);
  const id=s=>'asymptote-midpoint-'+s;
  const near=(a,b)=>Math.abs(a-b)<=32*Number.EPSILON*Math.max(Math.abs(a),Math.abs(b));
  const proofRequest=/^从(?:下面|下列)?①[、,]?②[、,]?③中(?:任选|选取|选择)两个作为条件,证明(?:剩余|另(?:外)?)(?:一个)?(?:条件)?成立[:,]?/;
  const gradingNote=/(?:,)?(?:注:)?若选择不同的组合分别解答,则按第一个解答计分[.,]?$/;

  function recognise(raw){
    const api=root.DongBasicConditions,parts=root.DongQuestionParts.splitParts(raw);
    if(parts.length!==2)return null;
    const [first,second]=parts;
    const head=api.plain(first.question.slice(0,-first.body.length)).replace(/\\pm/g,'±');
    const givens=/^(?:已知|设)双曲线([A-Z]):x\^2\/a\^2-y\^2\/b\^2=1\(a>0,b>0\)的?右焦点(?:为|是)([A-Z])\(([^,]+),0\),渐近线(?:方程)?(?:为|是)y=±([^,。;]+)x[。;.]?$/.exec(head);
    if(!givens)return null;
    const [,curve,F,focus,slope]=givens,c=api.scalar(focus),s=api.scalar(slope);
    const equation=/^(?:求|写出)(?:双曲线)?([A-Z])的?(?:标准)?方程[。;.]?$/.exec(api.plain(first.body));
    if(!(c>0&&s>0)||equation?.[1]!==curve)return null;
    const a=c/Math.hypot(1,s),b=a*s;
    if(a<1e-4||b<1e-4||c>1000||s<0.02||s>50)return null;

    let body=api.plain(second.body).replace(/\\parallel|\/\/|∥/g,'∥').replace(/[。;、]/g,',').replace(gradingNote,'').replace(/[,.]$/,'');
    const line=/^过(?:点)?([A-Z])(?:的)?直线与(?:双曲线)?([A-Z])的(?:两条)?渐近线分别(?:相)?交于(?:点)?([A-Z])[,和与](?:点)?([A-Z])(?:两点)?,/.exec(body);
    if(!line||line[1]!==F||line[2]!==curve)return null;
    const A=line[3],B=line[4];
    body=body.slice(line[0].length);
    const points=/^点([A-Z])\(x(\d),y\2\)[,和与](?:点)?([A-Z])\(x(\d),y\4\)在(?:双曲线)?([A-Z])上,?(?:且|满足)x\2>x\4>0,y\2>0,/.exec(body);
    if(!points||points[2]===points[4]||points[5]!==curve)return null;
    const P=points[1],Q=points[3];
    body=body.slice(points[0].length);
    const parallels=/^过(?:点)?([A-Z])且斜率为([^,]+?)的直线与过(?:点)?([A-Z])且斜率为([^,]+?)的直线(?:相)?交于(?:点)?([A-Z]),/.exec(body);
    if(!parallels||parallels[1]!==P||parallels[3]!==Q)return null;
    const minus=api.scalar(parallels[2]),plus=api.scalar(parallels[4]),M=parallels[5];
    if(minus===null||plus===null||!near(minus,-s)||!near(plus,s))return null;
    if(new Set([curve,F,A,B,P,Q,M]).size!==7)return null;
    body=body.slice(parallels[0].length);
    if(!proofRequest.test(body))return null;
    body=body.replace(proofRequest,'');
    const conditions=/^①([A-Z])在(?:直线|线段)?([A-Z]{2})上,②([A-Z]{2})∥([A-Z]{2}),③\|([A-Z]{2})\|=\|([A-Z]{2})\|$/.exec(body);
    if(!conditions||conditions[1]!==M||conditions[2]!==A+B||conditions[3]!==P+Q||conditions[4]!==A+B)return null;
    const left=[conditions[5],conditions[6]].map(name=>[...name].sort().join('')).sort().join(',');
    const right=[M+A,M+B].map(name=>[...name].sort().join('')).sort().join(',');
    if(left!==right)return null;
    const T=[...'TUVWXYZHKN'].find(label=>![curve,F,A,B,P,Q,M].includes(label));
    return {parts,curve,F,c,s,a,b,A,B,P,Q,M,T};
  }

  function sceneFor(spec){
    const {parts,curve,F,c,s,a,b,A,B,P,Q,M,T}=spec,part=parts[1].index;
    const node=(key,op,label,refs,extra={})=>({id:id(key),kind:'construction',op,label,
      refs:refs.map(r=>r.startsWith('$')||r.startsWith('feature:')?r:id(r)),source:'derived',part,visible:true,...extra});
    // A bounded demonstration arc samples steep focal lines. It keeps the
    // infinite intersections near an asymptote out of the teaching controls.
    const angle=t=>Math.atan(s*t);
    return {schemaVersion:2,type:'hyperbola',orientation:'horizontal',h:0,k:0,a,b,curveLabel:curve,
      title:'双曲线与渐近线的弦中点',showDynamic:false,showFeatures:false,problemMotion:true,
      inferred_from_conditions:true,exact:{a2:tex(a*a),b2:tex(b*b)},points:{[F]:[c,0]},
      lines:[
        {id:id('positive'),kind:'slope',role:'asymptote',label:'y='+root.DongNumber.text(s)+' x',m:s,b:0,source:'question',visible:true},
        {id:id('negative'),kind:'slope',role:'asymptote',label:'y=−'+root.DongNumber.text(s)+' x',m:-s,b:0,source:'question',visible:true}
      ],
      objects:[
        {id:id('arc'),kind:'circle',label:'方向辅助圆',h:c,k:0,r:c*.55,source:'derived',visible:false,part},
        node('driver','point_on',T,['arc'],{t:angle(2.7),motionDomain:{parameter:{min:angle(1.35),max:angle(6)}}}),
        node('focal','line',A+B,['feature:'+F,'driver']),
        node('upper','intersection',A,['focal','positive']),
        node('lower','intersection',B,['focal','negative']),
        node('middle','midpoint',M,['upper','lower']),
        node('minus','parallel',P+M,['middle','negative']),
        node('plus','parallel',Q+M,['middle','positive']),
        node('p','intersection',P,['minus','$conic']),
        node('q','intersection',Q,['plus','$conic']),
        node('chord','line',P+Q,['p','q'])
      ],
      asymptoteMidpoint:{part,A,B,M,T}};
  }

  function solve(raw){
    const spec=recognise(raw);if(!spec)return null;
    const {parts,curve,F,c,s,a,b,A,B,P,Q,M,T}=spec,AB=A+B,PQ=P+Q;
    const eq=near(a*a,1)?`x^2-\\frac{y^2}{${tex(b*b)}}=1`:`\\frac{x^2}{${tex(a*a)}}-\\frac{y^2}{${tex(b*b)}}=1`;
    const answer1=`$${curve}:${eq}$。`;
    const answer2='①、②、③中任意两个条件都能推出第三个。';
    const steps1=[
      `右焦点 $${F}(${tex(c)},0)$ 给出 $c=${tex(c)}$。渐近线斜率的绝对值是 $s=b/a=${tex(s)}$。`,
      `由 $c^2=a^2+b^2=(1+s^2)a^2$，得 $a^2=${tex(a*a)}$，$b^2=${tex(b*b)}$。所以 ${answer1}`
    ];
    const steps2=[
      `设 $s=b/a$，作坐标代换 $u=x+y/s,\\ v=x-y/s$。双曲线变为 $uv=a^2$，两渐近线分别为 $u=0$ 和 $v=0$。过 $${P}$ 的负斜率直线固定 $u$，过 $${Q}$ 的正斜率直线固定 $v$，故 $${M}$ 的坐标为 $(u_${P},v_${Q})$。两点在右支，所以两个坐标均为正。`,
      `记 $D$ 为 $${PQ}$ 的方向，定义 $L_D(X)=u_X\\Delta v+v_X\\Delta u$，其中 $(\\Delta u,\\Delta v)$ 是方向 $D$ 在新坐标中的分量。对 $D=${P}-${Q}$，有 $L_D(${M})=u_${P}(v_${P}-v_${Q})+v_${Q}(u_${P}-u_${Q})=a^2-a^2=0$。`,
      `记 $${AB}$ 的中点坐标为 $z$，$E$ 为 $${AB}$ 的方向。$${A},${B}$ 都满足 $uv=0$。因 $${A},${B}$ 是不同的两点，将 $z\\pm E/2$ 代入并相减，得 $L_E(z)=0$，这里取 $E=${A}-${B}$。焦点在两渐近线之外，而 $${AB}$ 与两渐近线均有交点，故 $E$ 的两个新坐标分量都非零，所以直线 $${AB}$ 上恰有一个点满足 $L_E=0$。`,
      `①＋② ⇒ ③。②使 $D$ 和 $E$ 平行，所以 $L_E(${M})=0$。再由①，$${M}$ 是 $${AB}$ 上满足该式的唯一点，对应坐标 $z$，因而 $|${M+A}|=|${M+B}|$。`,
      `①＋③ ⇒ ②。直线 $${AB}$ 上到 $${A},${B}$ 等距的点只有中点，故 $${M}=z$。于是 $L_E(${M})=L_D(${M})=0$。$${M}\\ne (0,0)$，能满足这个线性关系的方向只组成一条直线，故 $E\\parallel D$。`,
      `②＋③ ⇒ ①。由②，$${M},z$ 都满足 $L_D=0$，所以差向量 $${M}-z$ 也满足。③说明此差向量与 $${AB}$ 垂直。设 $D=(d_x,d_y)$ 为原坐标中的方向，则 $L_D(X)=2(x_Xd_x-y_Xd_y/s^2)$。代入垂直方向 $(-d_y,d_x)$ 得 $-2d_xd_y(1+1/s^2)\\ne0$，因为两点横坐标不同，而右支同一纵坐标对应唯一横坐标。因此 $${M}=z$，即①成立。`,
      `拖动 $${T}$ 可查看一段合法构型。画板先从焦点直线得到渐近线弦中点，再作双曲线交点，展示三个条件同时成立的情况。`
    ];
    const solved=[{...parts[0],status:'answered',answer:answer1,steps:steps1},{...parts[1],status:'answered',answer:answer2,steps:steps2}];
    return {mode:'symbolic-fallback',engineExtensions:['hyperbola-asymptote-midpoint'],title:'焦点、渐近线与三种条件组合',
      restatement:raw,strategy:'把两渐近线化为坐标轴，利用乘积方程与弦中点的方向关系，逐一推出三个结论。',
      answer:solved.map(p=>p.label+'：'+p.answer).join('\n'),parts:solved,completion:{answered:2,total:2},scene:sceneFor(spec),
      verification:{status:'locally-verified',counts:{verified:2,contradicted:0,unresolved:0},checks:[
        {id:id('equation'),category:'curve',part:parts[0].index,status:'verified',label:'焦点与渐近线回代',detail:'两个正半轴满足焦距平方关系及渐近线斜率。'},
        {id:id('proof'),category:'answer',part:parts[1].index,status:'verified',label:'三种条件组合',detail:'用弦中点的方向关系验证全部推导，含焦点直线竖直时的适用条件。'}
      ]}};
  }

  root.DongHyperbolaAsymptoteMidpoint={solve};
})(typeof window==='object'?window:globalThis);

/* Distance extrema on an axis-aligned ellipse, with the fixed point on a symmetry axis. */
(() => {
  'use strict';
  const near=(a,b)=>Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(a),Math.abs(b));
  const number=x=>Number(x.toPrecision(12)).toString();
  function fraction(x){
    for(let d=1;d<=10000;d++){const n=Math.round(x*d);if(Number.isSafeInteger(n)&&Math.abs(n/d-x)<=1e-11*Math.max(1,Math.abs(x)))return[n,d];}
    return null;
  }
  function tex(x){const f=fraction(x);return f?(f[1]===1?String(f[0]):`${f[0]<0?'-':''}\\frac{${Math.abs(f[0])}}{${f[1]}}`):(window.DongNumber?.exact(x)?.tex??`\\approx ${number(x)}`);}
  function rootTex(x){
    if(near(x,0))return '0';
    const f=fraction(x);if(!f||f[0]<0)return x>=0?`\\approx ${number(Math.sqrt(x))}`:'\\text{未定义}';
    let rad=f[0]*f[1],outside=1;
    if(!Number.isSafeInteger(rad)||rad>1e10)return `\\sqrt{${tex(x)}}`;
    for(let n=2;n*n<=rad;n++){while(rad%(n*n)===0){rad/=n*n;outside*=n;}}
    if(rad===1)return tex(outside/f[1]);
    const coefficient=fraction(outside/f[1]),top=`${coefficient[0]===1?'':coefficient[0]}\\sqrt{${rad}}`;
    return coefficient[1]===1?top:`\\frac{${top}}{${coefficient[1]}}`;
  }
  function shiftedRoot(center,squared,sign){
    const root=Math.sqrt(Math.max(0,squared));if(fraction(root))return tex(center+sign*root);
    return `${center?tex(center):''}${sign<0?'-':center?'+':''}${rootTex(squared)}`;
  }
  const shift=(variable,center)=>near(center,0)?variable:`(${variable}${center<0?'+':'-'}${tex(Math.abs(center))})`;
  function polynomial(a,b,c){
    return [[a,'t^2'],[b,'t'],[c,'']].filter(([n])=>!near(n,0)).map(([n,v],i)=>`${n<0?'-':i?'+':''}${v&&near(Math.abs(n),1)?'':tex(Math.abs(n))}${v}`).join('')||'0';
  }
  function distanceTex(r,squared){
    if(fraction(squared))return rootTex(squared);
    const p=r.candidates.find(p=>near(p.squared,squared)),values=p&&[r.quadratic,r.linear,r.constant,p.t].map(tex);
    if(!values||values.some(t=>t.includes('\\approx')))return rootTex(squared);
    const [a,b,c,t]=values;return `\\sqrt{(${a})(${t})^2+(${b})(${t})+(${c})}`;
  }
  // Cut the ellipse only at analytic coordinate boundaries. On each resulting
  // arc the signs of every constraint are constant; a midpoint classifies the
  // whole arc, not a numerical search for extrema.
  function bounded(r,domain){
    if(domain==null)return r;
    let d;try{d=window.DongMotionDomain.validate(domain);}catch{return null;}
    if(!Object.keys(d).length)return r;
    if(d.arc||d.parameter||d.branch)return null;
    const tau=2*Math.PI,cuts=[0,tau],point=t=>({x:r.h+r.rx*Math.cos(t),y:r.k+r.ry*Math.sin(t)});
    const add=t=>{t=(t%tau+tau)%tau;if(!cuts.some(v=>near(v,t)))cuts.push(t);};
    const coordinateCut=(axis,v)=>{
      const z=(v-(axis==='x'?r.h:r.k))/(axis==='x'?r.rx:r.ry);if(z<-1||z>1)return;
      if(axis==='x'){const t=Math.acos(z);add(t);add(-t);}else{const t=Math.asin(z);add(t);add(Math.PI-t);}
    };
    for(const axis of ['x','y'])for(const v of [d[axis]?.min,d[axis]?.max])if(v!=null)coordinateCut(axis,v);
    if(d.quadrant){coordinateCut('x',0);coordinateCut('y',0);}
    for(const axis of d.excludeAxes||[])coordinateCut(axis==='x'?'y':'x',0);
    for(const xy of d.excludePoints||[])if(near(((xy[0]-r.h)/r.rx)**2+((xy[1]-r.k)/r.ry)**2,1))add(Math.atan2((xy[1]-r.k)/r.ry,(xy[0]-r.h)/r.rx));
    cuts.sort((a,b)=>a-b);
    function accepts(p,closure=false){
      for(const axis of ['x','y']){const b=d[axis];if(!b)continue;
        if(b.min!=null&&(p[axis]<b.min&&!near(p[axis],b.min)||!closure&&!b.minClosed&&near(p[axis],b.min)))return false;
        if(b.max!=null&&(p[axis]>b.max&&!near(p[axis],b.max)||!closure&&!b.maxClosed&&near(p[axis],b.max)))return false;
      }
      if(d.quadrant){const [sx,sy]=[[1,1],[-1,1],[-1,-1],[1,-1]][d.quadrant-1];for(const v of [p.x*sx,p.y*sy])if(v<0&&!near(v,0)||!closure&&near(v,0))return false;}
      if(!closure){if((d.excludeAxes||[]).some(axis=>near(axis==='x'?p.y:p.x,0)))return false;
        if((d.excludePoints||[]).some(xy=>near(p.x,xy[0])&&near(p.y,xy[1])))return false;}
      return true;
    }
    const arcs=[];for(let i=1;i<cuts.length;i++)if(accepts(point((cuts[i-1]+cuts[i])/2)))arcs.push([cuts[i-1],cuts[i]]);
    const inClosure=t=>arcs.some(([lo,hi])=>[t,t+tau,t-tau].some(v=>v>=lo-1e-10&&v<=hi+1e-10))||accepts(point(t));
    const candidates=[];
    const candidate=p=>{
      const angle=(Math.atan2((p.y-r.k)/r.ry,(p.x-r.h)/r.rx)+tau)%tau;if(!inClosure(angle))return;
      const t=r.vertical?p.y-r.k:p.x-r.h,otherValue=r.vertical?p.x-r.h:p.y-r.k;
      const row={...p,angle,t,otherSquared:otherValue*otherValue,sign:otherValue<0?-1:1,squared:Math.max(0,r.quadratic*t*t+r.linear*t+r.constant),attained:accepts(p)};
      if(!candidates.some(v=>near(v.x,p.x)&&near(v.y,p.y)))candidates.push(row);
    };
    for(const t of cuts)candidate(point(t));
    for(const c of r.candidates){const offset=Math.sqrt(Math.max(0,r.other*r.other*(1-c.t*c.t/(r.radius*r.radius))));
      for(const sign of [1,-1])candidate({x:r.h+(r.vertical?sign*offset:c.t),y:r.k+(r.vertical?c.t:sign*offset)});}
    if(r.constantDistance)for(const [lo,hi] of arcs)candidate(point((lo+hi)/2));
    if(!candidates.length)return null;
    const edge=kind=>{const squared=Math[kind](...candidates.map(p=>p.squared)),all=candidates.filter(p=>near(p.squared,squared)),points=all.filter(p=>p.attained),limitPoints=all.filter(p=>!p.attained);
      return{squared,distance:Math.sqrt(squared),points,limitPoints,attained:points.length>0};};
    const seed=candidates.find(p=>p.attained)||point((arcs[0][0]+arcs[0][1])/2);
    const ranges=arcs.map(([lo,hi])=>{
      const rows=candidates.filter(p=>[p.angle,p.angle+tau,p.angle-tau].some(t=>t>=lo-1e-10&&t<=hi+1e-10)),min=Math.min(...rows.map(p=>p.squared)),max=Math.max(...rows.map(p=>p.squared));
      return{min,max,minClosed:rows.some(p=>near(p.squared,min)&&p.attained),maxClosed:rows.some(p=>near(p.squared,max)&&p.attained)};
    });
    for(const p of candidates)if(p.attained&&!arcs.some(([lo,hi])=>[p.angle,p.angle+tau,p.angle-tau].some(t=>t>=lo-1e-10&&t<=hi+1e-10)))ranges.push({min:p.squared,max:p.squared,minClosed:true,maxClosed:true});
    ranges.sort((a,b)=>a.min-b.min);const union=[];
    for(const row of ranges){const last=union.at(-1);if(!last||row.min>last.max&&!near(row.min,last.max)||near(row.min,last.max)&&!row.minClosed&&!last.maxClosed){union.push({...row});continue;}
      if(near(row.min,last.min))last.minClosed||=row.minClosed;if(row.max>last.max&&!near(row.max,last.max)){last.max=row.max;last.maxClosed=row.maxClosed;}else if(near(row.max,last.max))last.maxClosed||=row.maxClosed;}
    return{...r,domain:d,arcs,candidates,min:edge('min'),max:edge('max'),seed,restricted:true,ranges:union};
  }
  function compute(model,values,source,domain){
    if(model.type!=='ellipse'||!source?.every(Number.isFinite))return null;
    const h=Number(values.h)||0,k=Number(values.k)||0,rx=Number(model.orientation==='vertical'?values.b:values.a),ry=Number(model.orientation==='vertical'?values.a:values.b);
    if(!(rx>0&&ry>0&&Number.isFinite(rx+ry)))return null;
    const vertical=near(source[0],h),horizontal=near(source[1],k);
    if(!vertical&&!horizontal)return null;
    const radius=vertical?ry:rx,other=vertical?rx:ry,d=vertical?source[1]-k:source[0]-h;
    const quadratic=1-other*other/(radius*radius),linear=-2*d,constant=other*other+d*d;
    const vertex=near(quadratic,0)?null:-linear/(2*quadratic),ts=[-radius,radius];
    if(vertex!=null&&vertex>-radius&&vertex<radius)ts.push(vertex);
    const value=t=>Math.max(0,quadratic*t*t+linear*t+constant),candidates=ts.map(t=>({t,squared:value(t)}));
    function edge(kind){
      const squared=Math[kind](...candidates.map(c=>c.squared)),chosen=candidates.filter(c=>near(c.squared,squared));
      const points=[];
      for(const c of chosen){const otherSquared=Math.max(0,other*other*(1-c.t*c.t/(radius*radius))),offset=Math.sqrt(otherSquared);
        for(const sign of near(offset,0)?[1]:[1,-1]){
          const x=h+(vertical?sign*offset:c.t),y=k+(vertical?c.t:sign*offset);
          if(!points.some(p=>near(p.x,x)&&near(p.y,y)))points.push({x,y,t:c.t,otherSquared,sign});
        }
      }
      return{squared,distance:Math.sqrt(squared),points,limitPoints:[],attained:true};
    }
    return bounded({h,k,rx,ry,vertical,radius,other,d,quadratic,linear,constant,vertex,candidates,min:edge('min'),max:edge('max'),constantDistance:near(quadratic,0)&&near(linear,0)},domain);
  }
  function scope(raw,part,moving,source,scene){
    const basic=window.DongBasicConditions;if(!basic)return null;
    const s=basic.plain(part.question||raw).replace(/²/g,'^2'),start=s.search(/求|写出|计算|确定/);if(start<0)return null;
    let goal=s.slice(start),edges=[];
    const pair=moving.label+source,reverse=source+moving.label;
    if(!goal.includes(pair)&&!goal.includes(reverse)&&!goal.includes(`${moving.label}到定点${source}`)&&!goal.includes(`${moving.label}到点${source}`))return null;
    if(/取值范围|最值/.test(goal))edges=['min','max'];else{if(/最小|最短/.test(goal))edges.push('min');if(/最大|最长/.test(goal))edges.push('max');}if(!edges.length)return null;
    for(const token of [pair,reverse,'取值范围','最大值','最小值','最长距离','最短距离','最值','此时','取得','达到','对应','并写出','写出','求出','计算','确定','求','坐标','距离','长度','定点','的','并','及','和','与','点','到',moving.label,source].sort((a,b)=>b.length-a.length))goal=goal.split(token).join('');
    if(goal.replace(/[|,。;、:]/g,''))return null;
    const chunks=basic.clauses(s.slice(0,start));if(!chunks)return null;
    const domain={},facts=new Set();let curve=false,driver=false,fixed=false;
    for(let clause of chunks){
      clause=clause.replace(/^(?:已知|设|若|且|并且)/,'');
      if(/^(?:在)?平面直角坐标系(?:中|xOy中)$/.test(clause))continue;
      const conic=/^椭圆([A-Z])?:([xy0-9+\-*/^().]+)=1(.*)$/.exec(clause);
      if(conic){if(curve||!equationMatches(conic[2],scene))return null;curve=true;const tail=conic[3];
        if(tail){if(tail!==`上有一动点${moving.label}`&&tail!==`上有动点${moving.label}`&&tail!==`上有一个动点${moving.label}`)return null;if(driver)return null;driver=true;}continue;}
      if([`${moving.label}为椭圆上的动点`,`${moving.label}是椭圆上的动点`,`点${moving.label}为椭圆上的动点`,`点${moving.label}在椭圆上运动`].includes(clause)){if(driver)return null;driver=true;continue;}
      const coord=new RegExp(`^(?:定点|点)${source}(?:的坐标(?:为|是))?\\((.+),(.+)\\)$`).exec(clause);
      if(coord){if(fixed)return null;const xy=coord.slice(1).map(basic.scalar);if(xy.some(v=>v==null)||!xy.every((v,i)=>near(v,scene.model.points[source][i])))return null;fixed=true;continue;}
      const quadrant=new RegExp(`^(?:点)?${moving.label}(?:在|位于)第([一二三四1234])象限$`).exec(clause);
      if(quadrant){if(facts.has('quadrant'))return null;facts.add('quadrant');domain.quadrant='一二三四'.indexOf(quadrant[1])+1||Number(quadrant[1]);continue;}
      const bound=new RegExp(`^(?:点)?${moving.label}(?:的)?(?:横坐标x?|纵坐标y?|[xy])(>=|<=|>|<|=|≥|≤|不小于|不大于|大于|小于|为)(.+)$`).exec(clause);
      if(bound){const axis=/横坐标|x/.test(clause.slice(0,clause.indexOf(bound[1])))?'x':'y',op=({'≥':'>=','≤':'<=','不小于':'>=','不大于':'<=','大于':'>','小于':'<','为':'='}[bound[1]]||bound[1]),value=basic.scalar(bound[2]);if(value==null)return null;
        const fields=op==='='?['min','max']:[op[0]==='>'?'min':'max'];domain[axis]||={};for(const field of fields){const key=axis+field;if(facts.has(key))return null;facts.add(key);domain[axis][field]=value;domain[axis][field+'Closed']=op.includes('=');}continue;}
      const exclude=new RegExp(`^(?:点)?${moving.label}不在([xy])轴上$`).exec(clause);
      if(exclude){if(facts.has('exclude'+exclude[1]))return null;facts.add('exclude'+exclude[1]);(domain.excludeAxes||=[]).push(exclude[1]);continue;}
      return null;
    }
    if(!curve||!driver||!fixed)return null;
    try{window.DongMotionDomain.validate(domain);}catch{return null;}
    return{edges,domain,range:/取值范围/.test(s.slice(start))};
  }
  function equationMatches(s,scene){
    let depth=0,cut=-1;for(let i=0;i<s.length;i++){if(s[i]==='(')depth++;if(s[i]===')')depth--;if(depth<0)return false;if(!depth&&s[i]==='+'){if(cut>=0)return false;cut=i;}}
    if(depth||cut<0)return false;const fields={};
    for(const term of [s.slice(0,cut),s.slice(cut+1)]){
      const m=/^(?:([xy])|\(([xy])([+-])(.+)\))\^2(?:\/(.+))?$/.exec(term);if(!m)return false;
      const axis=m[1]||m[2],center=m[1]?0:window.DongBasicConditions.scalar(m[4]),den=m[5]?window.DongBasicConditions.scalar(m[5]):1;
      if(center==null||!(den>0)||fields[axis])return false;fields[axis]={center:center*(m[3]==='+'?-1:1),den};
    }
    const p=scene.values,vertical=scene.model.orientation==='vertical';return fields.x&&fields.y&&near(fields.x.center,Number(p.h)||0)&&near(fields.y.center,Number(p.k)||0)&&near(fields.x.den,(vertical?p.b:p.a)**2)&&near(fields.y.den,(vertical?p.a:p.b)**2);
  }
  function install(scene,raw,part){
    const text=(window.DongMathInput?.toPlain(part.body||raw)??raw).replace(/\s/g,'').toUpperCase();
    if(!/最大|最小|最值|取值范围|最长|最短/.test(text)||/面积|周长|切线|轨迹|夹角|证明/.test(text))return null;
    const matches=[];
    for(const moving of scene.model.objects||[]){
      if(moving.op!=='point_on'||moving.refs?.[0]!=='$conic')continue;
      for(const source of Object.keys(scene.model.points||{})){
        if(text.includes(moving.label+source)||text.includes(source+moving.label)||new RegExp(`点?${moving.label}到(?:定?点)?${source}`).test(text))matches.push({moving,source});
      }
    }
    if(matches.length!==1)return null;
    const {moving,source}=matches[0],parsed=scope(raw,part,moving,source,scene);if(!parsed)return null;
    const {edges,domain}=parsed,result=compute(scene.model,scene.values,scene.model.points[source],domain);if(!result)return null;
    const spec={moving:moving.label,movingId:moving.id,source,edges,part:part.index,motionDomain:domain};
    const seed=result.seed||result.min.points[0],t=Math.atan2((seed.y-result.k)/result.ry,(seed.x-result.h)/result.rx);
    if(part.index===0){moving.motionDomain=domain;moving.t=t;}else{moving.motionByPart||={};moving.motionByPart[String(part.index)]={mode:'curve',t,motionDomain:domain};}
    scene.model.distanceExtrema||=[];
    if(!scene.model.distanceExtrema.some(s=>s.moving===spec.moving&&s.source===source&&s.part===spec.part))scene.model.distanceExtrema.push(spec);
    const id=`distance-segment-${moving.id}-${source}`;
    if(!scene.model.objects.some(o=>o.id===id))scene.model.objects.push({id,kind:'construction',op:'segment',refs:[moving.id,`feature:${source}`],label:moving.label+source,source:'question',visible:true});
    const pair=moving.label+source,r=result;
    const coordinate=p=>`(${r.vertical?shiftedRoot(r.h,p.otherSquared,p.sign):tex(r.h+p.t)},${r.vertical?tex(r.k+p.t):shiftedRoot(r.k,p.otherSquared,p.sign)})`;
    const steps=[`设动点 ${moving.label} 的坐标为 $(x,y)$，令 $t=${shift(r.vertical?'y':'x',r.vertical?r.k:r.h)}$，由椭圆方程得 $-${tex(r.radius)}\\le t\\le ${tex(r.radius)}$。`,
      `消去另一坐标的平方：$${shift(r.vertical?'x':'y',r.vertical?r.h:r.k)}^2=${tex(r.other*r.other)}\\left(1-\\frac{t^2}{${tex(r.radius*r.radius)}}\\right)$。`,
      `由两点距离公式，$|${pair}|^2=${polynomial(r.quadratic,r.linear,r.constant)}$。`];
    if(r.restricted)steps.push(`再施加题设运动条件：$${domainTex(domain,moving.label)}$。象限不含坐标轴；严格不等式的边界不能取得。不能直接采用整个椭圆的最值。`);
    if(r.vertex!=null)steps.push(`配方得 $|${pair}|^2=${tex(r.quadratic)}${shift('t',r.vertex)}^2+${tex(r.constant-r.linear*r.linear/(4*r.quadratic))}$。`);
    steps.push(`${r.restricted?'按坐标条件的边界将椭圆分成合法弧段，比较弧段端点的极限及合法的驻点':'在闭区间比较两端点及区间内的二次函数顶点'}：${r.candidates.map(c=>`$t=${tex(c.t)}$ 时 $|${pair}|^2=${tex(c.squared)}$${c.attained===false?'（仅边界极限）':''}`).join('；')}。`);
    const intervals=r.ranges||[{min:r.min.squared,max:r.max.squared,minClosed:true,maxClosed:true}];
    const answer=parsed.range?`$|${pair}|\\in ${intervals.map(b=>`${b.minClosed?'[':'('}${distanceTex(r,b.min)},${distanceTex(r,b.max)}${b.maxClosed?']':')'}`).join('\\cup')}$。${!r.min.attained||!r.max.attained?'开端点只能趋近，不能取得。':''}`:edges.map(kind=>{
      const e=r[kind],name=kind==='max'?'最大':'最小';
      const coordinates=e.points.map(coordinate).join('\\quad\\text{或}\\quad');
      if(!e.attained)return `$|${pair}|$ 不存在${name}值；${kind==='max'?'上确界':'下确界'}为 $${distanceTex(r,e.squared)}$，只能在允许弧段上无限接近，不能取得。`;
      return `$|${pair}|$ 的${name}值为 $${distanceTex(r,e.squared)}$。${r.constantDistance?'曲线是以定点为圆心的圆，允许范围内任意点均取得此值。':`此时 $${moving.label}=${coordinates}$。`}`;
    }).join('\n');
    steps.push('距离非负，距离平方与距离有相同的极值位置；逐点检查原条件和端点能否取得。范围由允许弧段上的连续距离函数得到。','画板只为合法取等点提供定位；未能取得的边界只提示确界，不作为可到达的极值点。改变题设参数后，画板重新计算，解析仍对应原题。');
    const checks=edges.flatMap(kind=>r[kind].points.map((p,i)=>{const residual=(p.x-r.h)**2/r.rx**2+(p.y-r.k)**2/r.ry**2-1,distance=(p.x-scene.model.points[source][0])**2+(p.y-scene.model.points[source][1])**2;return{id:`distance-${part.index}-${kind}-${i}`,label:'极值点代回核验',status:Math.abs(residual)<1e-8&&near(distance,r[kind].squared)?'verified':'contradicted',detail:'代入椭圆与距离公式；全局界由合法弧段边界与驻点比较，不是采样猜测。',category:'construction'};}));
    checks.push({id:`distance-domain-${part.index}`,label:'运动范围与开闭边界',status:'verified',detail:'原题每条已覆盖条件参与合法弧段筛选，逐项核对端点是否取得；不以规则未覆盖判定题目条件不足。',category:'construction'});
    return{status:'answered',answer,steps,checks};
  }
  function domainTex(d,label){
    const bits=[];if(d.quadrant)bits.push(`${label}\\text{在第${['一','二','三','四'][d.quadrant-1]}象限}`);
    for(const axis of ['x','y']){const b=d[axis];if(b)bits.push(`${axis}\\in ${b.min==null||b.minClosed===false?'(':'['}${b.min==null?'-\\infty':window.DongNumber.tex(b.min)},${b.max==null?'\\infty':window.DongNumber.tex(b.max)}${b.max==null||b.maxClosed===false?')':']'}`);}
    for(const axis of d.excludeAxes||[])bits.push(`${axis==='x'?'y':'x'}\\ne0`);
    return bits.join('\\quad ');
  }
  window.DongEllipseDistance={compute,install,scope,domainTex,tex,rootTex};
})();

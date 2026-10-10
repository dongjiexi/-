/* Literal motion domains; no expression evaluation or model-provided code. */
(function(){
  'use strict';
  const TAU=2*Math.PI,EPS=1e-8,finite=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=100000;
  const plain=o=>o&&typeof o==='object'&&!Array.isArray(o);
  const allowed=new Set(['parameter','arc','quadrant','branch','x','y','excludeAxes','excludePoints']);
  function interval(raw,required=false){
    if(!plain(raw)||Object.keys(raw).some(k=>!['min','max','minClosed','maxClosed'].includes(k)))throw new Error('范围只允许数字上下界与开闭端点。');
    if((raw.min==null&&raw.max==null)||(required&&(raw.min==null||raw.max==null)))throw new Error('范围缺少上下界。');
    if(raw.min!=null&&!finite(raw.min)||raw.max!=null&&!finite(raw.max))throw new Error('范围端点必须是有限数字。');
    for(const k of ['minClosed','maxClosed'])if(raw[k]!=null&&typeof raw[k]!=='boolean')throw new Error('范围端点开闭必须为布尔值。');
    if(!required&&raw.min!=null&&raw.max!=null&&(raw.min>raw.max||raw.min===raw.max&&(raw.minClosed===false||raw.maxClosed===false)))throw new Error('范围为空或上下界顺序错误。');
    return {...(raw.min!=null?{min:raw.min}:{}),...(raw.max!=null?{max:raw.max}:{}),minClosed:raw.minClosed!==false,maxClosed:raw.maxClosed!==false};
  }
  function validate(raw){
    if(raw==null)return {};
    if(!plain(raw)||Object.keys(raw).some(k=>!allowed.has(k)))throw new Error('动点范围含不支持的字段。');
    const d={};
    for(const k of ['parameter','x','y'])if(raw[k]!=null)d[k]=interval(raw[k]);
    if(raw.arc!=null){
      d.arc=interval(raw.arc,true);const a=d.arc;
      if(a.max<a.min)a.max+=TAU*Math.ceil((a.min-a.max)/TAU);
      if(a.max-a.min>TAU+EPS||a.max===a.min)throw new Error('圆周弧段必须大于0且不超过一周。');
    }
    if(raw.quadrant!=null){if(![1,2,3,4].includes(raw.quadrant))throw new Error('象限必须为1、2、3或4。');d.quadrant=raw.quadrant;}
    if(raw.branch!=null){if(![1,-1].includes(raw.branch))throw new Error('双曲线分支必须为1或-1。');d.branch=raw.branch;}
    if(raw.excludeAxes!=null){if(!Array.isArray(raw.excludeAxes)||raw.excludeAxes.length>2||raw.excludeAxes.some(k=>!['x','y'].includes(k)))throw new Error('排除轴只能为x或y。');d.excludeAxes=[...new Set(raw.excludeAxes)];}
    if(raw.excludePoints!=null){if(!Array.isArray(raw.excludePoints)||raw.excludePoints.length>12||raw.excludePoints.some(p=>!Array.isArray(p)||p.length!==2||!p.every(finite)))throw new Error('排除点最多12项，每项须为两个有限数字坐标。');d.excludePoints=raw.excludePoints.map(p=>p.slice());}
    return d;
  }
  function validateProfiles(raw,partIndexes){
    if(raw==null)return undefined;
    if(!plain(raw)||Object.keys(raw).length>12)throw new Error('分问运动配置最多12项。');
    const result={};
    for(const [key,p] of Object.entries(raw)){
      if(!/^(0|[1-9]\d{0,3})$/.test(key)||partIndexes&&!partIndexes.has(Number(key))||!plain(p)||Object.keys(p).some(k=>!['mode','x','y','t','branch','motionDomain'].includes(k)))throw new Error('分问运动配置或编号无效。');
      if(!['plane','curve'].includes(p.mode))throw new Error('分问运动模式须为plane或curve。');
      const row={mode:p.mode};
      for(const field of p.mode==='plane'?['x','y']:['t']){if(!finite(p[field]))throw new Error('分问动点缺少有效坐标或参数。');row[field]=p[field];}
      if(p.branch!=null){if(![1,-1].includes(p.branch))throw new Error('分问分支无效。');row.branch=p.branch;}
      row.motionDomain=validate(p.motionDomain);if(p.mode==='plane'&&['parameter','arc','branch'].some(k=>row.motionDomain[k]))throw new Error('平面动点不使用曲线参数范围或分支。');result[key]=row;
    }
    return result;
  }
  function storage(object,part){return part!=null&&Object.hasOwn(object.motionByPart||{},String(part))?object.motionByPart[String(part)]:object;}
  function driver(object,part){const row=storage(object,part);return row===object?{...object,mode:'curve'}:{...object,...row};}
  function contains(v,b){
    if(!b)return true;
    // A curve projection can round a lawful closed endpoint by one ulp.
    // Only absorb floating-point roundoff, never open up a strict boundary.
    const tolerance=16*Number.EPSILON*Math.max(1,Math.abs(v),Math.abs(b.min??0),Math.abs(b.max??0));
    return (b.min==null||(b.minClosed?v>=b.min-tolerance:v>b.min))&&(b.max==null||(b.maxClosed?v<=b.max+tolerance:v<b.max));
  }
  function lift(t,b){
    const center=(b.min+b.max)/2,value=t+TAU*Math.round((center-t)/TAU);
    return [value,value-TAU,value+TAU].find(n=>contains(n,b))??value;
  }
  function accepts(object,point,parameter){
    if(!point||!finite(point.x)||!finite(point.y))return false;
    let d;try{d=validate(object.motionDomain);}catch{return false;}
    if(!contains(point.x,d.x)||!contains(point.y,d.y))return false;
    if(d.quadrant){const [sx,sy]=[[1,1],[-1,1],[-1,-1],[1,-1]][d.quadrant-1];if(point.x*sx<=EPS||point.y*sy<=EPS)return false;}
    if((d.excludeAxes||[]).includes('x')&&Math.abs(point.y)<EPS||(d.excludeAxes||[]).includes('y')&&Math.abs(point.x)<EPS)return false;
    if((d.excludePoints||[]).some(p=>Math.hypot(point.x-p[0],point.y-p[1])<=EPS*Math.max(1,Math.abs(p[0]),Math.abs(p[1]))))return false;
    if(object.excludeAxis==='x'&&Math.abs(point.y)<1e-7||object.excludeAxis==='y'&&Math.abs(point.x)<1e-7)return false;
    if(d.parameter&&(!parameter||!finite(parameter.t)||!contains(parameter.t,d.parameter)))return false;
    if(d.arc&&(!parameter||!finite(parameter.t)||!contains(lift(parameter.t,d.arc),d.arc)))return false;
    if(d.branch!=null&&parameter?.branch!==d.branch)return false;
    return true;
  }
  function clamp(v,b){
    if(!b)return v;
    const width=b.min!=null&&b.max!=null?b.max-b.min:1,margin=Math.min(Math.max(1e-7,Math.abs(width)*1e-8),Math.max(width/4,Number.EPSILON));
    const lo=b.min==null?-Infinity:b.min+(b.minClosed?0:margin),hi=b.max==null?Infinity:b.max-(b.maxClosed?0:margin);
    return Math.max(lo,Math.min(hi,v));
  }
  function fit(object,parameter,{periodic=false,hyperbola=false}={}){
    if(!plain(parameter)||!finite(parameter.t))throw new Error('运动参数必须是有效的有限数字。');
    const d=validate(object.motionDomain),p={...parameter};
    if(d.arc&&!periodic)throw new Error('弧段只适用于圆或椭圆。');
    if(d.branch!=null&&!hyperbola)throw new Error('分支限制只适用于双曲线。');
    if(d.arc)p.t=clamp(lift(p.t,d.arc),d.arc);
    p.t=clamp(p.t,d.parameter);
    if(hyperbola)p.branch=d.branch??object.branch??1;
    return p;
  }
  function describe(object){
    let d;try{d=validate(object.motionDomain);}catch{return '约束配置无效';}
    const fmt=n=>globalThis.DongNumber?.text(n)??String(Number(n.toFixed(5))),range=b=>(b.min!=null&&b.minClosed?'[':'(')+(b.min==null?'-∞':fmt(b.min))+', '+(b.max==null?'∞':fmt(b.max))+(b.max!=null&&b.maxClosed?']':')');
    const bits=[object.mode==='plane'?'平面动点':'沿所在曲线'];
    if(d.quadrant)bits.push('第'+['一','二','三','四'][d.quadrant-1]+'象限');
    if(d.arc)bits.push('弧段 t∈'+range(d.arc)+'（弧度）');
    if(d.parameter)bits.push('t∈'+range(d.parameter));
    if(d.branch!=null)bits.push('固定'+(d.branch===1?'正':'负')+'分支');
    for(const k of ['x','y'])if(d[k])bits.push(k+'∈'+range(d[k]));
    const axes=new Set([...(d.excludeAxes||[]),...(object.excludeAxis?[object.excludeAxis]:[])]);for(const axis of axes)bits.push('排除'+axis+'轴');
    if(d.excludePoints?.length)bits.push('不取点 '+d.excludePoints.map(p=>'('+p.map(fmt).join(', ')+')').join('、'));
    return bits.join('；');
  }
  // Display geometry only: analytic boundary cuts, sampled smooth arcs. This
  // is not a proof of a locus equation or an inference of missing constraints.
  function periodicGeometry(shape,object){
    const kind=shape.kind==='circle'?'circle':shape.conicType;
    if(!['circle','ellipse'].includes(kind))return null;
    let d;try{d=validate(object.motionDomain);}catch{return null;}
    if(d.branch!=null)return null;
    const h=Number(shape.h||0),k=Number(shape.k||0),rx=kind==='circle'?shape.r:shape.orientation==='vertical'?shape.b:shape.a,ry=kind==='circle'?shape.r:shape.orientation==='vertical'?shape.a:shape.b;
    if(![h,k,rx,ry].every(finite)||!(rx>0&&ry>0))return null;
    let lo=0,hi=TAU;
    if(d.arc){lo=d.arc.min;hi=d.arc.max;}
    else if(d.parameter){lo=d.parameter.min??((d.parameter.max??TAU)-TAU);hi=Math.min(d.parameter.max??(lo+TAU),lo+TAU);}
    if(d.parameter){lo=Math.max(lo,d.parameter.min??lo);hi=Math.min(hi,d.parameter.max??hi);}
    if(hi<lo)return{paths:[],markers:[]};
    const bounds={x:[d.x?.min,d.x?.max],y:[d.y?.min,d.y?.max]};
    if(d.quadrant){bounds.x.push(0);bounds.y.push(0);}
    for(const axis of [...(d.excludeAxes||[]),...(object.excludeAxis?[object.excludeAxis]:[])])bounds[axis==='x'?'y':'x'].push(0);
    const point=t=>{const p={x:h+rx*Math.cos(t),y:k+ry*Math.sin(t)};for(const axis of ['x','y'])for(const v of bounds[axis])if(v!=null&&Math.abs(p[axis]-v)<=32*Number.EPSILON*Math.max(1,Math.abs(v),rx,ry))p[axis]=v;return p;},legal=t=>accepts(object,point(t),{t}),cuts=[lo,hi];
    const cut=t=>{const start=Math.ceil((lo-t)/TAU);for(let n=start;n<=start+2;n++){const v=t+n*TAU;if(v>=lo-1e-12&&v<=hi+1e-12)cuts.push(Math.max(lo,Math.min(hi,v)));}};
    const boundary=(axis,value)=>{const ratio=(value-(axis==='x'?h:k))/(axis==='x'?rx:ry);if(Math.abs(ratio)>1)return;const t=axis==='x'?Math.acos(ratio):Math.asin(ratio);cut(t);cut(axis==='x'?-t:Math.PI-t);};
    for(const axis of ['x','y']){for(const v of [d[axis]?.min,d[axis]?.max])if(v!=null)boundary(axis,v);}
    if(d.quadrant){boundary('x',0);boundary('y',0);}
    for(const axis of new Set([...(d.excludeAxes||[]),...(object.excludeAxis?[object.excludeAxis]:[])]))boundary(axis==='x'?'y':'x',0);
    for(const [x,y] of d.excludePoints||[]){const u=(x-h)/rx,v=(y-k)/ry;if(Math.abs(u*u+v*v-1)<1e-8)cut(Math.atan2(v,u));}
    const ts=cuts.sort((a,b)=>a-b).filter((t,i,a)=>!i||Math.abs(t-a[i-1])>1e-12),paths=[],markers=[],intervals=[];
    for(let i=0;i<ts.length-1;i++){
      const a=ts[i],b=ts[i+1],ok=legal((a+b)/2);intervals.push(ok);if(!ok)continue;
      const count=Math.max(2,Math.ceil((b-a)/TAU*720));paths.push(Array.from({length:count+1},(_,j)=>point(a+(b-a)*j/count)));
    }
    const periodic=Math.abs(hi-lo-TAU)<1e-10;
    for(let i=0;i<ts.length;i++){
      const left=i?intervals[i-1]:periodic?intervals.at(-1):false,right=i<intervals.length?intervals[i]:periodic?intervals[0]:false;
      const closed=legal(ts[i])||(periodic&&(i===0||i===ts.length-1)&&legal(i===0?hi:lo));
      if(left&&right&&closed||!left&&!right&&!closed)continue;
      const p=point(ts[i]),existing=markers.find(m=>Math.hypot(m.x-p.x,m.y-p.y)<1e-8);if(existing)existing.closed||=closed;else markers.push({...p,closed});
    }
    return{paths,markers};
  }
  function nonPeriodicGeometry(shape,object,view){
    const kind=shape.conicType;if(!['parabola','hyperbola'].includes(kind))return null;
    let d;try{d=validate(object.motionDomain);}catch{return null;}
    if(d.arc||!view||!['xmin','xmax','ymin','ymax'].every(key=>finite(view[key]))||view.xmin>=view.xmax||view.ymin>=view.ymax)return null;
    const vertical=shape.orientation==='vertical',h=Number(shape.h||0),k=Number(shape.k||0),a=Number(shape.a),b=Number(shape.b),p=Number(shape.p),direction=shape.direction===-1?-1:1,branch=d.branch??object.branch??1;
    if(![h,k].every(finite)||![-1,1].includes(branch)||kind==='parabola'&&(d.branch!=null||!finite(p)||p<=0)||kind==='hyperbola'&&(!finite(a)||!finite(b)||a<=0||b<=0))return null;
    const minor=vertical?'x':'y',center=vertical?h:k,major=vertical?'y':'x',majorCenter=vertical?k:h;
    const parameter=value=>kind==='parabola'?value-center:Math.asinh((value-center)/b);
    const lo=parameter(view[minor+'min']),hi=parameter(view[minor+'max']),critical=[];
    const bounds={x:[d.x?.min,d.x?.max],y:[d.y?.min,d.y?.max]};
    if(d.quadrant){bounds.x.push(0);bounds.y.push(0);}
    for(const axis of [...(d.excludeAxes||[]),...(object.excludeAxis?[object.excludeAxis]:[])])bounds[axis==='x'?'y':'x'].push(0);
    const point=t=>{const q=kind==='parabola'?{[minor]:center+t,[major]:majorCenter+direction*t*t/(4*p)}:{[minor]:center+b*Math.sinh(t),[major]:majorCenter+branch*a*Math.cosh(t)};for(const axis of ['x','y'])for(const v of bounds[axis])if(v!=null&&Number.isFinite(q[axis])&&Math.abs(q[axis]-v)<=32*Number.EPSILON*Math.max(1,Math.abs(v),Math.abs(q[axis])))q[axis]=v;return q;};
    const cut=t=>{if(Number.isFinite(t))critical.push(t);};
    for(const t of [d.parameter?.min,d.parameter?.max])if(t!=null)cut(t);
    for(const axis of ['x','y'])for(const value of bounds[axis])if(value!=null){
      if(axis===minor)cut(parameter(value));
      else if(kind==='parabola'){const square=4*p*(value-majorCenter)/direction;if(square>=0){cut(Math.sqrt(square));cut(-Math.sqrt(square));}}
      else{const ratio=(value-majorCenter)/(branch*a);if(ratio>=1){cut(Math.acosh(ratio));cut(-Math.acosh(ratio));}}
    }
    for(const excluded of d.excludePoints||[]){const target={x:excluded[0],y:excluded[1]},t=parameter(target[minor]),q=point(t);if(Math.hypot(q.x-target.x,q.y-target.y)<=1e-8*Math.max(1,Math.abs(target.x),Math.abs(target.y)))cut(t);}
    // Screen cuts improve sampling of very narrow visible branches without
    // turning the screen edge into a mathematical endpoint.
    const screenCuts=[];
    for(const value of [view[major+'min'],view[major+'max']]){
      if(kind==='parabola'){const square=4*p*(value-majorCenter)/direction;if(square>=0)screenCuts.push(Math.sqrt(square),-Math.sqrt(square));}
      else{const ratio=(value-majorCenter)/(branch*a);if(ratio>=1)screenCuts.push(Math.acosh(ratio),-Math.acosh(ratio));}
    }
    const ts=[lo,hi,...critical,...screenCuts].sort((x,y)=>x-y).filter((t,i,arr)=>!i||Math.abs(t-arr[i-1])>1e-12),legal=t=>accepts(object,point(t),{t,branch}),paths=[],markers=[];
    const intervals=ts.slice(0,-1).map((t,i)=>legal((t+ts[i+1])/2));
    for(let i=0;i<ts.length-1;i++){const left=ts[i],right=ts[i+1],middle=point((left+right)/2);if(!intervals[i]||left<lo||right>hi||middle[major]<view[major+'min']||middle[major]>view[major+'max'])continue;const n=Math.max(48,Math.min(600,Math.ceil((right-left)/(hi-lo)*600)));paths.push(Array.from({length:n+1},(_,j)=>point(left+(right-left)*j/n)));}
    for(let i=0;i<ts.length;i++){
      const t=ts[i];if(t<lo||t>hi||!critical.some(v=>Math.abs(v-t)<1e-12))continue;
      const left=i?intervals[i-1]:legal(t-1),right=i<intervals.length?intervals[i]:legal(t+1),closed=legal(t);
      if(left&&right&&closed||!left&&!right&&!closed)continue;
      const q=point(t);if(q.x>=view.xmin&&q.x<=view.xmax&&q.y>=view.ymin&&q.y<=view.ymax)markers.push({...q,closed});
    }
    return{paths,markers};
  }
  const exported={TAU,validate,validateProfiles,storage,driver,contains,accepts,fit,describe,periodicGeometry,nonPeriodicGeometry};
  globalThis.DongMotionDomain=exported;
  if(typeof window!=='undefined')window.DongMotionDomain=exported;
  if(typeof module!=='undefined')module.exports=exported;
})();

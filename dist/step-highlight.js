/* Link explanation text to existing, visible objects only. This is not a proof engine. */
(function () {
  'use strict';
  const primes = value => String(value ?? '').replace(/\^\s*(?:\{\s*(?:\\prime|['′’])\s*\}|\\prime|['′’])/g,'′').replace(/\\prime/g,'′').replace(/['’]/g,'′');
  const name = value => primes(value).replace(/[₀₁₂₃₄₅₆₇₈₉]/g,c=>'₀₁₂₃₄₅₆₇₈₉'.indexOf(c)).replace(/[_{}\s]/g,'');
  function plain(value) {
    return primes(value).replace(/\\(?:triangle|Delta)/g,'△').replace(/\\[a-zA-Z]+/g,' ').replace(/[₀₁₂₃₄₅₆₇₈₉]/g,c=>'₀₁₂₃₄₅₆₇₈₉'.indexOf(c)).replace(/[_{}$]/g,'');
  }
  function mentioned(text, label) {
    const target=name(label);if(!target)return false;
    const source=plain(text);
    if(!/^[A-Za-z][0-9′]*(?:[A-Z][0-9′]*)*$/.test(target))return target.length>1&&source.replace(/\s+/g,'').includes(target);
    const words=source.match(/[A-Za-z][A-Za-z0-9′]*/g)||[];
    const tokens=words.flatMap(word=>/^[A-Z0-9′]+$/.test(word)?word.match(/[A-Z][0-9]*′*/g)||[]:[word]);
    if(tokens.includes(target))return true;
    // AB, A′B, F₁F₂ and polygon names must not be confused with arbitrary words.
    if(/^[A-Z]/.test(target))return words.includes(target);
    return false;
  }
  function relationMatches(text,entries){
    const source=plain(text).replace(/\s+/g,'');
    const selected=new Set(),missing=[];
    const tangents=entries.filter(entry=>entry.relation==='tangent');
    const contact='([A-Z][0-9]*′*)';
    const nameList=contact+'(?:点)?[、,，和与及](?:点)?'+contact;
    const references=new Set();
    for(const match of source.matchAll(new RegExp('(?<![A-Za-z0-9′])(?:点)?'+nameList+'(?:两点|点)?(?:处)?(?:的)?(?:分别作|分别求|作|求)?切线','g'))){
      references.add(match[1]);references.add(match[2]);
    }
    for(const match of source.matchAll(new RegExp('(?<![A-Za-z0-9′])'+contact+'(?:点处|处|点)(?:的)?切线','g')))references.add(match[1]);
    for(const contactName of references){
      const matches=tangents.filter(entry=>name(entry.contact)===contactName);
      if(matches.length===1)selected.add(matches[0].id);
      else missing.push(contactName+' 点切线'+(matches.length?'（名称不唯一）':''));
    }
    const namedTangents=tangents.filter(entry=>[entry.label,...(Array.isArray(entry.aliases)?entry.aliases:[])]
      .some(label=>mentioned(text,label)));
    if(!references.size&&!namedTangents.length&&/(?:两条|双|二条)(?:参数)?切线/.test(source)){
      if(tangents.length===2)tangents.forEach(entry=>selected.add(entry.id));
      else missing.push('两条切线'+(tangents.length>2?'（对应关系不唯一）':''));
    }
    const unique=(relation,keyword)=>{
      const candidates=entries.filter(entry=>entry.relation===relation);
      if(candidates.length===1)selected.add(candidates[0].id);
      else if(candidates.length>1)missing.push(keyword+'（对应关系不唯一）');
    };
    if(/(?:恒过|经过|通过|交于|同一|同一个|求出|求|得到|得)(?:同一|同一个|这个|该)?(?:个)?(?:固定点|定点)/.test(source)||
      /(?:固定点|定点)(?:坐标|的坐标)/.test(source))unique('fixed-point','定点');
    if(/定直线/.test(source))unique('fixed-line','定直线');
    return {selected,missing};
  }
  function select(text, entries) {
    const aliases=entry=>(Array.isArray(entry.aliases)?entry.aliases.slice(0,12):[]).filter(value=>typeof value==='string'&&value.length<=40&&/^[A-Za-z][0-9′]*(?:[A-Z][0-9′]*)*$/.test(name(value)));
    const owners=new Map(),ambiguous=new Set();
    for(const entry of entries)for(const label of [entry.label,...aliases(entry)]){
      const key=name(label);if(!key)continue;
      if(!owners.has(key))owners.set(key,new Set());
      owners.get(key).add(entry.id);
    }
    const relation=relationMatches(text,entries);
    const matched=entries.filter(entry=>{
      let selected=relation.selected.has(entry.id);
      for(const label of [entry.label,...aliases(entry)])if(mentioned(text,label)){
        const key=name(label);
        if(owners.get(key)?.size>1)ambiguous.add(key);else selected=true;
      }
      return selected;
    });
    const known=new Set(matched.flatMap(entry=>[entry.label,...aliases(entry)].map(name)));
    const declared=window.DongSceneAudit?.declared(text)||[];
    const missing=declared.filter(label=>!known.has(name(label))&&!ambiguous.has(name(label)));
    return {matched:[...new Set(matched.map(entry=>entry.label))],missing:[...new Set([...missing,...relation.missing,...[...ambiguous].map(label=>label+'（名称不唯一）')])],ids:[...new Set(matched.map(entry=>entry.id))]};
  }
  function attach(api) {
    let selection=null;
    function clear(){selection=null;window.DongUnifiedBoard?.highlight([]);}
    function valid(){if(!selection)return true;if(selection.model!==api.model()||(selection.part!=null&&api.part()!=null&&Number(selection.part)!==Number(api.part())))return false;const visible=new Set(api.entries().map(entry=>entry.id));return selection.ids.every(id=>visible.has(id));}
    function highlight({text,part,index}={}) {
      const result=select(String(text??''),api.entries());
      selection={ids:result.ids,part,index,model:api.model()};
      window.DongUnifiedBoard?.highlight(result.ids);
      api.render();return {matched:result.matched,missing:result.missing};
    }
    function draw() {
      if(!selection)return;
      if(!valid()){clear();return;}
      const byId=new Map(api.entries().map(entry=>[entry.id,entry]));
      const ctx=api.ctx;ctx.save();ctx.strokeStyle='#d88708';ctx.fillStyle='rgba(235,166,36,.14)';ctx.lineWidth=4;ctx.lineJoin='round';
      for(const id of selection.ids){const entry=byId.get(id);if(!entry)continue;const shape=entry.shape;
        if(shape?.type==='point'){const q=api.xy(shape.x,shape.y);if(!Number.isFinite(q.x)||!Number.isFinite(q.y))continue;ctx.beginPath();ctx.arc(q.x,q.y,10,0,Math.PI*2);ctx.fill();ctx.stroke();}
        else if(entry.paths){
          for(const path of entry.paths){
            ctx.beginPath();let first=true;
            for(const p of path){
              const q=api.xy(p.x,p.y);if(!Number.isFinite(q.x)||!Number.isFinite(q.y))continue;
              first?ctx.moveTo(q.x,q.y):ctx.lineTo(q.x,q.y);first=false;
            }
            ctx.stroke();
          }
          for(const marker of entry.markers||[]){
            const q=api.xy(marker.x,marker.y);
            ctx.beginPath();ctx.arc(q.x,q.y,5,0,Math.PI*2);
            ctx.fillStyle=marker.closed?'#d88708':'#fff';
            ctx.fill();ctx.stroke();
          }
          ctx.fillStyle='rgba(235,166,36,.14)';
        }
        else if(shape?.type==='line'){const ends=api.clip(shape);if(ends){const a=api.xy(ends.a.x,ends.a.y),b=api.xy(ends.b.x,ends.b.y);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}
        else if(shape?.type==='circle'){ctx.beginPath();for(let i=0;i<=180;i++){const t=i*Math.PI/90,q=api.xy(shape.x+shape.r*Math.cos(t),shape.y+shape.r*Math.sin(t));i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);}ctx.stroke();}
        else if(shape?.type==='polygon'&&shape.points?.length>=3){ctx.beginPath();shape.points.forEach((p,i)=>{const q=api.xy(p.x,p.y);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.closePath();ctx.fill();ctx.stroke();}
      }
      ctx.restore();
    }
    return {highlight,clear,draw,valid,snapshot:()=>selection?{ids:[...selection.ids],part:selection.part,index:selection.index}:null};
  }
  window.DongStepHighlight={attach,select,mentioned};
})();

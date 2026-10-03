/* Independent answer/diagram progress and explicit, bounded cloud continuation.
 * This module neither solves questions nor certifies AI proofs. */
(function(root){
  'use strict';
  const complete=p=>!!(p?.status==='answered'&&typeof p.answer==='string'&&p.answer.trim()&&Array.isArray(p.steps)&&p.steps.some(s=>typeof s==='string'&&s.trim())&&!(p.derivation?.proof_obligations||[]).some(s=>typeof s==='string'&&s.trim()));
  const clone=x=>JSON.parse(JSON.stringify(x));
  function algebraConflicts(part){
    if(!root.DongMathInput||!root.DongEquationBuilder)return [];
    const plain=s=>root.DongMathInput.toPlain(s).replace(/\s|\$/g,'').replace(/[−–]/g,'-');
    const claim=/定直线([xy])=([+-]?\d+(?:\/\d+)?)(?:上|[。.]|$)/.exec(plain(part.answer));
    if(!claim)return [];
    const axis=claim[1],claimed=root.DongEquationBuilder.scalar(claim[2]),equations=[];
    for(const step of (part.steps||[]).slice(0,40)){
      const normalized=plain(step),escaped=claim[2].replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      // Bind the calculation to its explicit "solving gives" assertion.
      // A chord x=-4 is a different object from a locus x=-1: do not compare
      // unrelated equations merely because both happen to use x.
      if(!new RegExp('(?:解得|得到|故|所以)'+axis+'='+escaped+'(?![0-9/])').test(normalized))continue;
      for(const m of String(step).matchAll(/\$([^$]{1,500})\$/g))equations.push(m[1]);
    }
    const conflicts=[];
    for(const raw of equations.slice(0,100)){
      if(/[xy](?:[_0-9])/.test(raw))continue;
      const equation=plain(raw),sides=equation.split('=');
      if(sides.length!==2||!equation.includes(axis)||sides.some(s=>!s||s.length>256||!/^[xy0-9+*/^().-]+$/.test(s))||equation.includes(axis==='x'?'y':'x'))continue;
      if(new RegExp('^'+axis+'=[+-]?[0-9./]+$').test(equation))continue;
      try{
        const residual=n=>root.DongEquationBuilder.scalar(sides[0].replaceAll(axis,'('+n+')'))-root.DongEquationBuilder.scalar(sides[1].replaceAll(axis,'('+n+')'));
        const r0=residual(0),r1=residual(1),r2=residual(2),coefficient=r1-r0;
        // This checks only explicit affine arithmetic, not a general AI proof.
        if([r0,r1,r2].every(Number.isFinite)&&Math.abs(coefficient)>1e-10&&Math.abs(r2-2*r1+r0)<1e-10*(1+Math.abs(r0)+Math.abs(r1)+Math.abs(r2))){
          const expected=-r0/coefficient;
          if(Math.abs(expected-claimed)>1e-7*(1+Math.abs(expected)+Math.abs(claimed)))conflicts.push({part:part.index,label:'定直线结论与推导矛盾',kind:'affine-algebra',passed:false,equation,claimed,expected,detail:'代入结论 '+axis+'='+claim[2]+' 不能满足推导中的 '+equation+'；该方程给出 '+axis+'='+expected+'。'});
        }
      }catch{}
    }
    return conflicts;
  }
  function inspect(solution){
    const parts=solution?.parts||[],audit=solution?.sceneAudit;
    const items=['missing','answerMissing','missingLines','answerMissingLines','unavailable','missingPolygons','invalid','answerUnresolved','answerConflicts'];
    const issues=[...new Set(items.flatMap(key=>(audit?.[key]||[]).map(v=>typeof v==='string'?v:v?.label)).filter(Boolean))];
    for(const warning of solution?.scene_warnings||[])if(typeof warning==='string'&&!issues.includes(warning))issues.push(warning);
    for(const c of audit?.checks||[])if(c.passed===false&&!issues.includes(c.label))issues.push(c.label);
    const answered=parts.filter(complete).length;
    return {answered,total:parts.length,unanswered:parts.filter(p=>!complete(p)).map(p=>p.index),diagram:!solution?.scene?'not-generated':issues.length?'incomplete':audit?'checked':'unchecked',issues:issues.slice(0,60)};
  }
  function request(solution,question,focusPart=null){
    if(!solution||solution.restatement!==question||!Array.isArray(solution.parts)||!solution.parts.length)throw new Error('题目已修改或原解答不可用，请重新解题。');
    if(focusPart!==null&&!solution.parts.some(p=>p.index===focusPart))throw new Error('当前小问不存在。');
    const review=inspect(solution);
    const context={parts:solution.parts.slice(0,12).map(p=>({index:p.index,status:p.status,answer:String(p.answer||'').slice(0,900),steps:(p.steps||[]).filter(s=>typeof s==='string').slice(-4).map(s=>s.slice(0,500)),proof_obligations:(p.derivation?.proof_obligations||[]).filter(s=>typeof s==='string').slice(0,4).map(s=>s.slice(0,300))})),diagram_issues:review.issues.map(s=>String(s).slice(0,80)),algebra_issues:(solution.sceneAudit?.checks||[]).filter(c=>c.kind==='affine-algebra'&&c.passed===false).slice(0,6).map(c=>({part:c.part,equation:String(c.equation||'').slice(0,256),claimed:c.claimed,expected:c.expected}))};
    // Shorten data, never cut a JSON token or the source question.
    let encoded=JSON.stringify(context);
    if(encoded.length>12000){context.parts=context.parts.map(p=>({...p,steps:[],proof_obligations:[]}));encoded=JSON.stringify(context);}
    if(encoded.length>12000){context.parts=context.parts.map(p=>({...p,answer:p.answer.slice(0,300)}));encoded=JSON.stringify(context);}
    if(encoded.length>16000)throw new Error('补全上下文仍过长，请分题解答。原题稿保留。');
    return {focus_part:focusPart,repair_context:encoded};
  }
  function merge(previous,next){
    if(!previous||!next||previous.restatement!==next.restatement)throw new Error('补全结果不属于当前原题，原题稿保留。');
    const prior=new Map((previous.parts||[]).map(p=>[p.index,p])),incoming=next.parts||[];
    if(incoming.length!==prior.size||new Set(incoming.map(p=>p.index)).size!==prior.size||incoming.some(p=>!prior.has(p.index)))throw new Error('补全结果的小问不完整或编号不符，原题稿保留。');
    const result=clone(next),retained=[];
    result.parts=result.parts.map(p=>{
      const old=prior.get(p.index);
      if(complete(old)&&!complete(p)){retained.push(p.index);return clone(old);}
      return p;
    });
    for(const key of ['study','conversation'])if(previous[key]!=null)result[key]=clone(previous[key]);
    if(!result.scene&&previous.scene){result.scene=clone(previous.scene);result.scene_notice='本次未返回可用新图形，沿用上次图稿并重新核对；不代表补图已经完成。';}
    result.completion={answered:result.parts.filter(complete).length,total:result.parts.length};
    result.continuation={attempts:(Number(previous.continuation?.attempts)||0)+1,retainedParts:retained};
    if(retained.length){
      result.verification={status:'generated',level:0,counts:{verified:0,contradicted:0,unresolved:result.parts.length},message:'补全结果保留了此前已作答的小问；组合后的答案与图形需要重新核验。'};
      result.quality_notice='此次未完成的小问不会覆盖此前已作答的解析。此前完整图稿保留在“我的题本”的补全前备份中。';
    }
    return result;
  }
  root.DongSolutionReview=Object.freeze({complete,inspect,request,merge,algebraConflicts});
})(typeof window==='object'?window:globalThis);

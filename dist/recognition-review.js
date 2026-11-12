/* Advisory checks for transcription. Offsets always refer to the editable text. */
(function(root){
  'use strict';
  const parts=root.DongQuestionParts||(typeof module==='object'?require('./question-parts.js'):null);
  const messages={
    point:'核对点名，数字可能与字母混淆。',
    polygon:'核对图形的顶点字母。',
    segment:'核对线段名，开头的数字可能是字母。',
    angle:'核对角符号和角度单位。',
    vector:'核对向量箭头与运算符，数量积和减法的含义不同。',
    fraction:'核对分数线、分子和分母。'
  };
  const geometry=/(?:[△∆]|三角形|四边形|在[ \t]*[A-Z0-9]{3,4}[ \t]*中)/;
  const nearby=(text,index,end,radius=100)=>text.slice(Math.max(0,index-radius),end+radius);
  const lineStart=(text,index)=>Math.max(text.lastIndexOf('\n',index-1),text.lastIndexOf('\r',index-1))+1;

  function inspect(text){
    if(typeof text!=='string'||!text||text.length>18000)return [];
    const findings=[];
    const add=(kind,start,end,message=messages[kind])=>{
      if(end>start)findings.push({kind,start,end,message});
    };
    for(const match of text.matchAll(/点[ \t]*([0148][A-Z](?![A-Za-z0-9_])|[01](?=[ \t]*[（(][ \t]*[+\-−0-9]))/g)){
      const end=match.index+match[0].length;
      add('point',end-match[1].length,end);
    }
    for(const match of text.matchAll(/(?:[△∆]|三角形|四边形|在)[ \t]*([A-Z0-9]{3,4})(?![A-Za-z0-9_])/g)){
      const name=match[1],end=match.index+match[0].length;
      if(/[A-Z]/.test(name)&&/[0148]/.test(name)&&!/[235679]/.test(name)&&
          (!match[0].startsWith('在')||/^[ \t]*中/.test(text.slice(end,end+8)))){
        add('polygon',end-name.length,end);
      }
    }
    for(const match of text.matchAll(/(?<![A-Za-z0-9_])[0148][A-Z](?=[ \t]*[=＝][ \t]*[+\-−]?\d)/g)){
      const start=match.index,end=start+match[0].length,context=nearby(text,start,end);
      if(geometry.test(context)&&/[A-Z]{2}[ \t]*[=＝][ \t]*[+\-−]?\d/.test(context)&&
          !/(?:方程|等式|化为|令|设)[ \t]*$/.test(text.slice(Math.max(0,start-8),start)))add('segment',start,end);
    }
    for(const match of text.matchAll(/[Zz][A-Z]{1,3}[ \t]*[=＝][ \t]*\d{1,3}[ \t]*["”]/g)){
      const start=match.index,end=start+match[0].length;
      if(geometry.test(nearby(text,start,end)))add('angle',start,end);
    }
    for(const match of text.matchAll(/(?<![A-Za-z0-9_])(?:1[ \t]+)?[A-Z]{2}[ \t]*[-−—－][ \t]*[A-Z]{2}(?![A-Za-z0-9_])/g)){
      const start=match.index,end=start+match[0].length,context=nearby(text,start,end,60);
      const dotProduct=/^[ \t]*(?:的[ \t]*)?(?:数量积|点积)/.test(text.slice(end,end+12))||
        /(?:数量积|点积)[ \t]*[：:][ \t]*$/.test(text.slice(Math.max(0,start-12),start));
      if(dotProduct||(match[0].startsWith('1')&&geometry.test(nearby(text,start,end))&&/取\s*值\s*范\s*围/.test(context))){
        add('vector',start,end);
      }
    }
    for(const {start,end} of parts?.fractionReviewRanges(text)||[])add('fraction',start,end);
    for(const match of text.matchAll(/\\(?:dfrac|tfrac|frac)\s*(?:\{\s*\}\s*\{[^{}]*\}|\{[^{}]*\}\s*\{\s*\})|[xy](?:\^2|²)[ \t]*[/／][ \t]*(?=[+＋=＝])/g)){
      add('fraction',match.index,match.index+match[0].length);
    }

    const prompts=[...text.matchAll(/(?:是|为|正确的|错误的)[ \t]*[（(][ \t]*[）)]/g)];
    prompts.forEach((prompt,index)=>{
      const start=prompt.index+prompt[0].length;
      const end=Math.min(prompts[index+1]?.index??text.length,start+650);
      const excerpt=text.slice(start,end).split(/\r?\n[ \t]*(?:\d{1,2}[．.、][ \t]*(?=[\u4e00-\u9fff])|[（(]\d{1,2}[）)][ \t]*(?=[\u4e00-\u9fff]))/)[0];
      const labels=[...excerpt.matchAll(/(?<![A-Za-z0-9_])([A-DＡ-Ｄ])[．.、:：)）](?=[ \t]*[^\s])/g)];
      if(!labels.length)return;
      const seen=labels.map(label=>label[1].normalize('NFKC'));
      const missing=[...'ABCD'].filter(letter=>!seen.includes(letter));
      if(!missing.length&&seen.length===4&&seen.join('')==='ABCD')return;
      const first=start+labels[0].index,last=start+labels.at(-1).index;
      const lastEnd=text.indexOf('\n',last),excerptEnd=start+excerpt.length;
      add('choices',Math.max(start,lineStart(text,first)),Math.min(lastEnd<0?excerptEnd:lastEnd,excerptEnd),
        missing.length?'核对选项是否齐全，目前未找到 '+missing.join('、')+' 的编号。':'核对选项编号是否重复或顺序有误。');
    });
    return findings.sort((a,b)=>a.start-b.start).slice(0,12);
  }

  const api={inspect};
  root.DongRecognitionReview=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);

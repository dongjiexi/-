/* Ordered transcription assembly. Compare literal lines and retain ambiguous overlaps. */
(function(root){
  'use strict';
  const lineKey=line=>line.trim().replace(/[ \t　]+/g,' ');
  const asLines=text=>text.trim().split(/\r\n|\n|\r/);
  const substantial=lines=>lines.join('').replace(/\s/g,'').length>=16;

  function matchingPrefix(lines,keys){
    return lines.length>=keys.length&&keys.every((key,i)=>lineKey(lines[i])===key);
  }

  function boundaryOverlap(previous,next){
    const before=previous.map(lineKey),after=next.map(lineKey);
    for(let size=Math.min(before.length,after.length);size>0;size--){
      const start=before.length-size;
      if(after[0]!==before[start])continue;
      let same=true;
      for(let i=1;i<size;i++)if(after[i]!==before[start+i]){same=false;break;}
      if(!same)continue;
      const block=next.slice(0,size);
      if(substantial(block)||/^[（(]\s*\d{1,2}\s*[）)]\s*(?:求|证明|设|若).{2}/.test(after[0]))return size;
    }
    return 0;
  }

  function merge(transcriptions){
    const api=root.DongQuestionParts;
    if(!Array.isArray(transcriptions)||!transcriptions.length)throw new Error('请先识别题图。');
    let merged=[],removed=0;
    for(const text of transcriptions){
      let next=asLines(api.examContent(text));
      if(!next.some(line=>line.trim()))continue;
      if(merged.length){
        let overlap=boundaryOverlap(merged,next);
        if(!overlap){
          const current=merged.join('\n'),first=api.headings(current)[0];
          if(first&&first.index>0){
            const setup=asLines(current.slice(0,first.index));
            if(substantial(setup)&&matchingPrefix(next,setup.map(lineKey))){
              next=next.slice(setup.length);
              while(next.length&&!next[0].trim())next.shift();
              removed++;
              overlap=boundaryOverlap(merged,next);
            }
          }
        }
        if(overlap){next=next.slice(overlap);removed++;}
      }
      merged.push(...next);
      if(merged.join('\n').length>api.MAX_TEXT)throw new Error('合并题面超过 18000 字，请移除无关页或分题识别。');
    }
    return {text:api.examContent(merged.join('\n')).trim(),removed};
  }

  function inspectParts(text){
    const api=root.DongQuestionParts;
    if(typeof text!=='string'||text.length>api.MAX_TEXT)return null;
    let parts;
    try{parts=api.splitParts(text);}catch(error){
      if(error.code==='QUESTION_PARTS_DUPLICATE')return {blocking:true,message:'合并后出现重复小问编号。请核对页序或编辑题面。'};
      return null;
    }
    const parents=[...new Set(parts.map(part=>part.parent_index??part.index))];
    if(parents.some((value,i)=>i>0&&value<parents[i-1]))return {blocking:false,message:'小问编号顺序可能有误，请核对页序。'};
    if(parents.some((value,i)=>i>0&&value>parents[i-1]+1))return {blocking:false,message:'小问编号有跳号，请核对是否缺页。'};
    return null;
  }

  const api={merge,inspectParts};
  root.DongRecognitionPages=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);

/* Shared bounded question headings. References and arithmetic remain verbatim. */
(function(root,factory){
  'use strict';
  const api=factory();root.DongQuestionParts=api;
  if(root.window&&root.window!==root)root.window.DongQuestionParts=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MAX_TEXT=18000,MAX_PARTS=12;
  const ROMAN={i:1,ii:2,iii:3,iv:4,v:5,vi:6,vii:7,viii:8};
  const NUMBER='[0-9０-９]{1,2}',LETTER='viii|vii|vi|iv|v|iii|ii|i|[Ⅰ-Ⅷⅰ-ⅷ]';
  const TOKEN='(?:'+NUMBER+'|'+LETTER+')';
  const SCORE='[（(][ \\t　]*(?:(?:本(?:小)?题)?满分[ \\t　]*)?[0-9０-９]{1,3}(?:[.．][0-9０-９]{1,2})?[ \\t　]*分[ \\t　]*[）)]';
  const LEAD='已知|若|当|设|在|由|从|利用|记|取|过(?!后|去|了)|令|如图|如表|求|证明|求证|写出|确定|计算|讨论|判断|说明|试|找出|给出|建立|作|研究|分析|选择|是否|椭圆|双曲线|抛物线|圆|直线|点|函数|数列|矩形|三角形|向量';
  const headStart='(?:'+LEAD+'|\\$|\\\\[\\[(]|[（(][ \\t　]*'+TOKEN+'[ \\t　]*[）)])';
  const startsWithPrompt=new RegExp('^(?:'+LEAD+')');
  const examNumber=new RegExp('^\\s*(?:第[ \\t　]*'+NUMBER+'[ \\t　]*题[：:、．.]?|'+NUMBER+'[.．、](?![0-9０-９]))(?=[ \\t　]*(?:[\\r\\n]|'+SCORE+'|'+headStart+'))','i');
  const leadingScore=new RegExp('^(\\s*)'+SCORE+'(?=\\s*(?:'+headStart+'|$))','i');
  const trailingScore=new RegExp('([。；;！!？?]|\\r?\\n)[ \\t　]*'+SCORE+'(?=\\s*$)');
  const stripLeadingScore=value=>value.replace(leadingScore,'$1');
  const stripTrailingScore=value=>value.replace(trailingScore,'$1');
  const canonicalToken=value=>value.normalize('NFKC').toLowerCase();
  const examBanner=/^(?:(?:20[0-9０-９]{2}[ \t　]*年[ \t　]*)?普通高等学校招生全国统一考试(?:[ \t　]*[（(](?:新课标|新高考)?(?:全国)?[ⅠⅡⅢI一二三]+卷[）)])?(?:[ \t　]*数学(?:试题|试卷)?)?|数学(?:试题|试卷)|绝密[★☆]启用前)$/;
  const pageNumber=/^(?:数学(?:试题|试卷)[ \t　]*第[ \t　]*[0-9０-９]{1,3}[ \t　]*页|(?:数学(?:试题|试卷)[ \t　]*)?第[ \t　]*[0-9０-９]{1,3}[ \t　]*页[ \t　]*(?:[（(/／][ \t　]*)?共[ \t　]*[0-9０-９]{1,3}[ \t　]*页[）)]?)$/;
  const mathBlock=/(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<![\\$])\$(?:\\[\s\S]|[^$\\])*?\$(?!\$)/g;
  const squareTerm='[xy](?:\\^2|²)(?:[ \\t]*[/／][ \\t]*(?:[ab](?:\\^2|²)|\\d+(?:\\.\\d+)?))?';
  const lineBreak='[ \\t]*(?:\\r\\n|\\n|\\r)[ \\t]*';
  const acrossLine=op=>'([ \\t]*'+op+lineBreak+'|'+lineBreak+op+'(?:'+lineBreak+'|[ \\t]*))';
  const termJoin=new RegExp('('+squareTerm+')'+acrossLine('[+＋−-]')+'(?='+squareTerm+')','g');
  const equationJoin=new RegExp('('+squareTerm+')'+acrossLine('[=＝]')+'(?=[+-]?[0-9]+(?:\\.[0-9]+)?(?![0-9A-Za-z_.]))','g');
  const divisionJoin=new RegExp('([xy](?:\\^2|²))'+acrossLine('[/／]')+'(?=(?:[ab](?:\\^2|²)|[0-9]+(?:\\.[0-9]+)?)(?![0-9A-Za-z_.]))','g');
  const stackedFraction=/(?:^|[：:=＋+−-])[ \t]*([xy](?:\^2|²)[ \t]*(?:\r\n|\r|\n)[ \t]*(?:[ab](?:\^2|²)|[0-9０-９]+(?:\.[0-9０-９]+)?))[ \t]*(?=(?:(?:\r\n|\r|\n)[ \t]*)?[+＋−=＝-])/gm;
  const compactJoin=(match,left,bridge)=>left+bridge.replace(/\s/g,'');
  function removePageFurniture(text){
    const lines=text.replace(/\f/g,'\n').split(/(\r\n|\r|\n)/),kept=[];
    for(let i=0;i<lines.length;i+=2){
      const label=lines[i].trim();
      if(!examBanner.test(label)&&!pageNumber.test(label))kept.push(lines[i],lines[i+1]||'');
    }
    return kept.join('');
  }
  // Physical line breaks inside complete TeX delimiters are whitespace.
  // Bare equations need an explicit operator across the break.
  function foldFormulaLines(text){
    const pieces=[];
    let start=0;
    const joinPlain=part=>part.replace(divisionJoin,compactJoin).replace(termJoin,compactJoin).replace(equationJoin,compactJoin);
    for(const match of text.matchAll(mathBlock)){
      pieces.push(joinPlain(text.slice(start,match.index)),match[0].replace(/[ \t]*(?:\r\n|\r|\n)[ \t]*/g,' '));
      start=match.index+match[0].length;
    }
    pieces.push(joinPlain(text.slice(start)));
    return pieces.join('');
  }
  function needsFractionReview(value){
    return typeof value==='string'&&value.length<=MAX_TEXT&&fractionReviewRanges(removePageFurniture(value)).length>0;
  }
  function fractionReviewRanges(value){
    if(typeof value!=='string'||value.length>MAX_TEXT)return [];
    return Array.from(value.matchAll(stackedFraction),match=>{
      const start=match.index+match[0].indexOf(match[1]);
      return {start,end:start+match[1].length};
    });
  }
  const stripWrap=value=>value.replace(/(?:\$|\\\(|\\\)|\\\[|\\\])+/g,'');
  function fail(code,message){const error=new Error(message);error.code=code;throw error;}
  function checkedText(value){
    if(typeof value!=='string')fail('QUESTION_PARTS_TEXT','题目必须是文字。');
    if(value.length>MAX_TEXT)fail('QUESTION_PARTS_LENGTH',`题目超过 ${MAX_TEXT} 字符，请缩短或分题输入。`);
    return value;
  }
  function isHeading(text,start,end){
    const before=stripWrap(text.slice(Math.max(0,start-160),start)),after=stripWrap(text.slice(end,end+180)),left=before.trimEnd(),right=after.trimStart();
    // Function arguments, radicals, arithmetic coefficients and adjacent citations.
    if(/^[+\-*/^=<>≤≥),%0-9０-９]/.test(right))return false;
    const adjacentRight=new RegExp('^[（(]\\s*'+TOKEN+'\\s*[）)]','i');
    const adjacentLeft=new RegExp('[（(]\\s*'+TOKEN+'\\s*[）)]\\s*$','i');
    if(adjacentRight.test(right)||adjacentLeft.test(left))return false;
    // Common references: 在（1）的条件下、由（2）可知、原题第（1）问。
    if(/^(?:的?(?:条件|结论|结果|基础|假设|范围|小问)|问(?:[。；;,，）)]|$)|中(?:的|所得|所求|给出|提到|求)|所得|所求|给出|提到|可知|可得|成立|所示|与|和|、|及|或|至|到)/.test(right))return false;
    const lineLeft=text.slice(Math.max(text.lastIndexOf('\n',start-1),text.lastIndexOf('\r',start-1))+1,start);
    if(/^(?:\s|\$|\\[()\[\]])*$/.test(lineLeft))return true;
    if(/[A-Za-z0-9０-９_√π*/^+=-]\s*$/.test(left))return false;
    if(/(?:在|由|根据|依据|利用|结合|参见|见|第|前述|上述|小问|问题|题|求出|求|证明|式|编号|条件)\s*$/.test(left))return false;
    if(/[。；;:：!?！？]\s*$/.test(left))return true;
    // Inline parts can start with conditions or named mathematical subjects.
    return startsWithPrompt.test(stripLeadingScore(right).trimStart());
  }
  function scan(text,roman=false){
    const pattern=new RegExp('[（(]\\s*('+(roman?LETTER:NUMBER)+')\\s*[）)]',roman?'gi':'g'),result=[];
    for(const match of text.matchAll(pattern)){
      if(!isHeading(text,match.index,match.index+match[0].length))continue;
      const token=canonicalToken(match[1]),value=roman?token:Number(token);
      if(!roman&&value<1)continue;
      result.push({index:match.index,end:match.index+match[0].length,number:value,raw:match[0]});
    }
    return result;
  }
  function headings(value){return scan(checkedText(value));}
  // Keep offsets in headings() relative to the submitted text. Only the copy
  // sent for solving loses grade labels and gains canonical heading tokens.
  function examContent(value){
    const original=foldFormulaLines(removePageFurniture(checkedText(value))),withoutNumber=original.replace(examNumber,'');
    const text=withoutNumber===original?stripLeadingScore(original):stripLeadingScore(withoutNumber).trimStart();
    const numeric=scan(text),all=[];
    numeric.forEach((part,i)=>{
      all.push(part);
      const segment=text.slice(part.end,numeric[i+1]?.index??text.length);
      for(const child of scan(segment,true))all.push({...child,index:child.index+part.end,end:child.end+part.end});
    });
    if(!all.length)return stripTrailingScore(text);
    const content=[stripTrailingScore(text.slice(0,all[0].index))];
    all.forEach((part,i)=>{
      content.push(part.raw.replace(/[０-９Ⅰ-Ⅷⅰ-ⅷ]/g,canonicalToken));
      content.push(stripTrailingScore(stripLeadingScore(text.slice(part.end,all[i+1]?.index??text.length))));
    });
    return content.join('');
  }
  function splitParts(value){
    const text=examContent(value),matches=scan(text);
    if(!matches.length){const body=text.trim();return[{index:0,label:'完整题目',question:body,body}];}
    const parents=new Set();
    for(const heading of matches){if(parents.has(heading.number))fail('QUESTION_PARTS_DUPLICATE',`题目包含重复小问编号（${heading.number}），请修正编号后重试。`);parents.add(heading.number);}
    const preamble=text.slice(0,matches[0].index).trim(),parts=[];
    matches.forEach((heading,i)=>{
      const segment=text.slice(heading.end,matches[i+1]?.index??text.length),nested=scan(segment,true),number=heading.number;
      if(!nested.length){const body=segment.trim();parts.push({index:number,label:`第（${number}）问`,question:(preamble+'\n'+body).trim(),body});return;}
      const setup=segment.slice(0,nested[0].index).trim(),seen=new Set();
      nested.forEach((sub,j)=>{
        if(seen.has(sub.number))fail('QUESTION_PARTS_DUPLICATE',`题目包含重复小问编号（${number}）（${sub.number}），请修正编号后重试。`);seen.add(sub.number);
        const subBody=segment.slice(sub.end,nested[j+1]?.index??segment.length).trim(),body=(setup?setup+'\n'+subBody:subBody).trim();
        parts.push({index:number*100+ROMAN[sub.number],label:`第（${number}）（${sub.number}）问`,question:(preamble+'\n'+body).trim(),body,parent_index:number,sub_index:sub.number});
      });
    });
    if(parts.length>MAX_PARTS)fail('QUESTION_PARTS_MAX',`题目共有 ${parts.length} 个小问，超过最多 ${MAX_PARTS} 个的限制，请分题输入。`);
    return parts;
  }
  return {splitParts,headings,examContent,needsFractionReview,fractionReviewRanges,MAX_TEXT,MAX_PARTS};
});

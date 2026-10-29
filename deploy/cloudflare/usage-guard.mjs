// Aggregate admission accounting only. This module never calls the model or
// exposes hashed visitor/IP counters; it is not a provider billing ledger.
export const inferencePaused=env=>String(env.DONGJIEXI_INFERENCE_PAUSED||'').trim().toLowerCase()==='true';

const positive=(value,fallback,max)=>Number.isInteger(Number(value))&&Number(value)>0?Math.min(Number(value),max):fallback;
async function sameSecret(a,b){
  const encoder=new TextEncoder();
  const [left,right]=await Promise.all([a,b].map(value=>crypto.subtle.digest('SHA-256',encoder.encode(value))));
  const x=new Uint8Array(left),y=new Uint8Array(right);let difference=0;
  for(let i=0;i<x.length;i++)difference|=x[i]^y[i];
  return difference===0;
}

export async function adminUsage(request,env,now=Date.now()){
  const secret=env.DONGJIEXI_ADMIN_TOKEN;
  // An ordinary access password, model key or session-signing secret must never
  // double as the administration credential, including in a misconfiguration.
  if(typeof secret!=='string'||secret.length<32||secret.length>256||/\s/.test(secret)||
    [env.DONGJIEXI_ACCESS_KEY,env.DONGJIEXI_MODEL_API_KEY,env.SESSION_SECRET].includes(secret)||!env.DB)return null;
  const header=request.headers.get('Authorization')||'';
  if(header.length>512||!header.startsWith('Bearer ')||!await sameSecret(header.slice(7),secret))return null;
  const seconds=Math.floor(now/1000),bucket=Math.floor(seconds/86400);
  const [counter,leases]=await Promise.all([
    env.DB.prepare('SELECT count FROM counters WHERE id=?1').bind('global-day:'+bucket).first(),
    env.DB.prepare('SELECT count(*) AS total FROM leases WHERE expires > ?1').bind(seconds).first()
  ]);
  const maximum=positive(env.DONGJIEXI_DAILY_JOBS,50,200);
  const used=Math.max(0,Number(counter?.count)||0);
  const warningPercent=positive(env.DONGJIEXI_USAGE_WARNING_PERCENT,80,100);
  const warningAt=Math.ceil(maximum*warningPercent/100);
  const state=used>=maximum?'exhausted':used>=warningAt?'warning':'normal';
  const alerts=[];
  if(inferencePaused(env))alerts.push({code:'INFERENCE_PAUSED',severity:'info',message:'新解题、识图和追问请求已暂停；已受理请求可能仍在计费。'});
  if(state!=='normal')alerts.push({code:state==='exhausted'?'DAILY_ADMISSION_EXHAUSTED':'DAILY_ADMISSION_WARNING',severity:state==='exhausted'?'critical':'warning',message:state==='exhausted'?'本日请求保护上限已达到。':'本日请求量已达到预警阈值。'});
  return {
    inference_paused:inferencePaused(env),
    usage:{period:'UTC calendar day',starts_at:new Date(bucket*86400000).toISOString(),resets_at:new Date((bucket+1)*86400000).toISOString(),used,maximum,remaining:Math.max(0,maximum-used),warning_percent:warningPercent,warning_at:warningAt,state,active_leases:Number(leases?.total)||0},
    accounting:'Accepted requests plus current reservations; not currency or token billing. Rejected upstream reservations are refunded. Interrupted accepted streams may incur costs.',
    alerts
  };
}

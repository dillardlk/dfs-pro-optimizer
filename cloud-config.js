'use strict';
// Only publish a Supabase browser key. Reject secret/service-role keys even
// if the deployment accidentally puts one in the public-key variable.
module.exports=function publicCloudConfig(env=process.env,browserConfig={}){
 const hasEnvironmentConfig=Boolean(env.SUPABASE_URL||env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY);
 const url=hasEnvironmentConfig?env.SUPABASE_URL:browserConfig.url;
 const key=hasEnvironmentConfig?(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY):browserConfig.publishableKey;
 if(!url||!key)return {enabled:false};
 try{
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.search||parsed.hash||!['','/'].includes(parsed.pathname))return {enabled:false};
  let publicKey=/^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if(!publicKey&&key.split('.').length===3){
   const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8'));
   publicKey=claims.role==='anon';
  }
  return publicKey?{enabled:true,url:parsed.origin,publishableKey:key}:{enabled:false};
 }catch{return {enabled:false}}
};

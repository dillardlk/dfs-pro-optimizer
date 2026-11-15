(function(root){
'use strict';
function createUI({get,fetchConfig,loadSdk,capture,load,escape,schedule=setTimeout,storeFactory=client=>root.CloudProfiles.create(client,root.Profiles),appUrl=root.location?root.location.origin+root.location.pathname:'http://localhost'}){
 let client=null,store=null,user=null,rows=[],version=0,configured=false;
 const status=message=>{get('accountStatus').textContent=message};
 function buttons(){
  for(const id of ['accountSignIn','accountSignUp','accountResetPassword'])get(id).disabled=!configured;
  for(const id of ['accountSignOut','accountSavePreset','accountLoadPreset','accountRefreshPresets','accountDeletePreset'])get(id).disabled=!user;
 }
 async function refresh(){
  if(!user)return;
  const current=version,selected=get('accountPresets').value;
  try{
   const list=await store.list();if(current!==version)return;
   rows=list;
   get('accountPresets').innerHTML='<option value="">Select an account preset</option>'+rows.map(row=>`<option value="${escape(row.name)}">${escape(row.name)}</option>`).join('');
   get('accountPresets').value=rows.some(row=>row.name===selected)?selected:'';
   status(`Signed in as ${user.email}. ${rows.length} private preset(s) available. Save changes to your account to share them with your other devices.`);
  }catch(error){if(current===version)status(error.message)}
 }
 function changeUser(next){
  version++;user=next;rows=[];get('accountPassword').value='';
  get('accountPresets').innerHTML='<option value="">'+(user?'Select an account preset':'Sign in to load presets')+'</option>';
  buttons();
  if(user)refresh();else status('Sign in or create an optimizer account to save private settings across devices.');
 }
 function credentials(){
  const email=get('accountEmail').value.trim(),password=get('accountPassword').value;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email address.');
  if(password.length<8)throw Error('Use a password with at least 8 characters.');
  return {email,password};
 }
 async function authenticate(signup){
  if(!client)return;
  const current=version;
  get('accountSignIn').disabled=true;get('accountSignUp').disabled=true;
  try{
   const login=credentials();
   const response=signup?await client.auth.signUp({...login,options:{emailRedirectTo:appUrl}}):await client.auth.signInWithPassword(login);
   if(response.error)throw response.error;
   if(response.data.session)changeUser(response.data.session.user);
   else if(signup)status('Account created. Check your email to confirm the account, then sign in here on each device.');
  }catch(error){if(current===version)status('Sign-in failed: '+error.message)}
  finally{get('accountPassword').value='';buttons()}
 }
 get('accountSignIn').addEventListener('click',()=>authenticate(false));
 get('accountSignUp').addEventListener('click',()=>authenticate(true));
 get('accountSignOut').addEventListener('click',async()=>{
  if(!client)return;
  try{
   const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;
   changeUser(null);get('accountUpdatePassword').hidden=true;
  }catch(error){status('Sign-out failed: '+error.message)}
 });
 get('accountResetPassword').addEventListener('click',async()=>{
  if(!client)return;
  try{
   const email=get('accountEmail').value.trim();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter your account email first.');
   const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:appUrl});
   if(error)throw error;status('If the account exists, a password-reset email will arrive. Open it, enter a new password here, and select Set New Password.');
  }catch(error){status('Password reset failed: '+error.message)}
 });
 get('accountUpdatePassword').addEventListener('click',async()=>{
  if(!client)return;
  try{
   const password=get('accountPassword').value;if(password.length<8)throw Error('Use at least 8 characters.');
   const {error}=await client.auth.updateUser({password});if(error)throw error;
   get('accountUpdatePassword').hidden=true;status('Password updated. Sign in on your other device with the new password.');
  }catch(error){status('Password update failed: '+error.message)}
  finally{get('accountPassword').value=''}
 });
 get('accountRefreshPresets').addEventListener('click',refresh);
 get('accountSavePreset').addEventListener('click',async()=>{
  if(!user)return;
  const current=version;
  get('accountSavePreset').disabled=true;
  try{
   const profile=await capture();if(current!==version)return;
   await store.save(profile);if(current!==version)return;
   await refresh();if(current!==version)return;
   get('accountPresets').value=profile.name;
   status(`Saved “${profile.name}” privately to your account. Sign in on your other device, refresh its account presets, then load this preset.`);
  }catch(error){if(current===version)status('Account save failed: '+error.message)}
  finally{buttons()}
 });
 get('accountLoadPreset').addEventListener('click',async()=>{
  if(!user)return;
  const current=version;
  try{
   // Refresh before loading so another device's latest saved version is used.
   const name=get('accountPresets').value;
   const latest=await store.list();if(current!==version)return;
   const row=latest.find(row=>row.name===name);if(!row)throw Error('Select an existing account preset first.');
   await load(row.profile);if(current!==version)return;
   status(`Loaded account preset “${name}”. Check the preset status below for any pending slate-specific edits.`);
  }catch(error){if(current===version)status('Account load failed: '+error.message)}
 });
 get('accountDeletePreset').addEventListener('click',async()=>{
  if(!user)return;
  const current=version,name=get('accountPresets').value;
  try{
   if(!name)throw Error('Select an account preset first.');
   await store.remove(name);if(current!==version)return;
   await refresh();
  }catch(error){if(current===version)status('Account delete failed: '+error.message)}
 });
 async function initialize(){
  try{
   const config=await fetchConfig();
   if(!config.enabled){status('Private account storage is not configured yet. Projection editing and optional browser/file backups work.');buttons();return}
   const sdk=await loadSdk();
   client=sdk.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
   store=storeFactory(client);configured=true;buttons();
   client.auth.onAuthStateChange((event,session)=>schedule(()=>{
    changeUser(session?.user??null);
    if(event==='PASSWORD_RECOVERY'){get('accountUpdatePassword').hidden=false;status('Enter a new password, then select Set New Password.')}
   },0));
   const {data,error}=await client.auth.getSession();if(error)throw error;
   changeUser(data.session?.user??null);
  }catch(error){status('Private account connection failed: '+error.message);buttons()}
 }
 return {ready:initialize(),refresh};
}
if(typeof module==='object'&&module.exports)module.exports={createUI};
else {
 root.CloudUI={createUI};
 const ui=createUI({
  get:id=>document.getElementById(id),escape:safe,capture:()=>capturePreset(),load:profile=>loadPreset(profile),
  fetchConfig:async()=>{const r=await fetch('/api/config',{cache:'no-store'});if(!r.ok)throw Error('Unable to read account configuration.');return r.json()},
  loadSdk:()=>new Promise((resolve,reject)=>{
   if(root.supabase){resolve(root.supabase);return}
   const script=document.createElement('script');script.src='/vendor/supabase-2.119.0.js';
   script.onload=()=>resolve(root.supabase);script.onerror=()=>reject(Error('Unable to load the sign-in service. Refresh and try again.'));
   document.head.appendChild(script);
  })
 });
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')ui.refresh()});
}
})(typeof globalThis!=='undefined'?globalThis:this);

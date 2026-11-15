(function(root){
'use strict';
function create(client,profiles){
 const table='optimizer_presets';
 async function user(){
  const {data,error}=await client.auth.getUser();
  if(error||!data?.user?.id)throw Error('Sign in to your optimizer account first.');
  return data.user;
 }
 function checked(row){
  const profile=profiles.validate(row.profile);
  if(profile.name!==row.name)throw Error('The saved preset name does not match its contents.');
  return {name:row.name,profile,updatedAt:row.updated_at};
 }
 return {
  async list(){
   const current=await user();
   const {data,error}=await client.from(table).select('name,profile,updated_at').eq('user_id',current.id).order('name').limit(21);
   if(error)throw Error('Unable to load private settings. '+error.message);
   return (data||[]).map(checked);
  },
  async save(raw){
   const profile=profiles.validate(raw),current=await user();
   const {data,error}=await client.from(table).upsert({user_id:current.id,name:profile.name,profile},{onConflict:'user_id,name'}).select('name,profile,updated_at').single();
   if(error)throw Error('Unable to save private settings. '+error.message);
   return checked(data);
  },
  async remove(name){
   const current=await user();
   const {error}=await client.from(table).delete().eq('user_id',current.id).eq('name',name);
   if(error)throw Error('Unable to delete private settings. '+error.message);
  }
 };
}
const api={create};
if(typeof module==='object'&&module.exports)module.exports=api;else root.CloudProfiles=api;
})(typeof globalThis!=='undefined'?globalThis:this);

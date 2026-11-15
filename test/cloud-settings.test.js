const {test}=require('node:test');
const assert=require('node:assert/strict');
const publicCloudConfig=require('../cloud-config');
const Profiles=require('../public/profiles');
const CloudProfiles=require('../public/cloud-profiles');
const {createUI}=require('../public/cloud-ui');
const config={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_public_key'};
const profile={version:1,name:'My Rules',settings:{...Profiles.controlDefaults},slate:null,players:[]};
test('public configuration exposes only browser configuration and rejects admin keys',()=>{
 const safe=publicCloudConfig({...config,SPORTSDATAIO_API_KEY:'private-sports-key',SUPABASE_SERVICE_ROLE_KEY:'private-database-key'});
 assert.equal(safe.enabled,true);assert.equal(JSON.stringify(safe).includes('private-'),false);
 assert.deepEqual(publicCloudConfig({}),{enabled:false});
 assert.deepEqual(publicCloudConfig({...config,SUPABASE_PUBLISHABLE_KEY:'sb_secret_never_publish'}),{enabled:false});
 const jwt=role=>'header.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
 assert.equal(publicCloudConfig({SUPABASE_URL:config.SUPABASE_URL,SUPABASE_ANON_KEY:jwt('anon')}).enabled,true);
 assert.deepEqual(publicCloudConfig({SUPABASE_URL:config.SUPABASE_URL,SUPABASE_ANON_KEY:jwt('service_role')}),{enabled:false});
});
function fakeClient(id,db=[]){
 const calls=[];
 const auth={getUser:async()=>({data:{user:id?{id,email:id+'@example.test'}:null}})};
 function from(table){
  const query={table,op:'select',filters:[]};calls.push(query);
  const chain={
   select(){return chain},eq(key,value){query.filters.push([key,value]);return chain},order(){return chain},limit(){return chain},
   upsert(row){query.op='upsert';query.row=row;return chain},delete(){query.op='delete';return chain},
   single(){return chain.then(r=>({...r,data:r.data?.[0]}))},
   then(resolve,reject){
    try{
     const matches=row=>query.filters.every(([key,value])=>row[key]===value);
     let data;
     if(query.op==='upsert'){
      if(query.row.user_id!==id)throw Error('permission denied');
      const index=db.findIndex(row=>row.user_id===id&&row.name===query.row.name);
      const row={...query.row,updated_at:'2099-01-01'};
      if(index<0)db.push(row);else db[index]=row;data=[row];
     }else if(query.op==='delete'){
      for(let i=db.length-1;i>=0;i--)if(db[i].user_id===id&&matches(db[i]))db.splice(i,1);
      data=[];
     }else data=db.filter(row=>row.user_id===id&&matches(row));
     return Promise.resolve({data,error:null}).then(resolve,reject);
    }catch(error){return Promise.reject(error).then(resolve,reject)}
   }
  };return chain;
 }
 return {auth,from,calls};
}
test('account preset API scopes every operation to the authenticated owner',async()=>{
 const db=[],a=fakeClient('a',db),b=fakeClient('b',db);
 const aa=CloudProfiles.create(a,Profiles),bb=CloudProfiles.create(b,Profiles);
 await aa.save(profile);assert.equal((await aa.list()).length,1);assert.equal((await bb.list()).length,0);
 await bb.save({...profile,name:'Other'});assert.equal((await bb.list())[0].name,'Other');
 await bb.remove('My Rules');assert.equal((await aa.list()).length,1);
 await aa.remove('My Rules');assert.equal((await aa.list()).length,0);
 assert.ok(a.calls.filter(c=>c.op!=='upsert').every(c=>c.filters.some(([key,value])=>key==='user_id'&&value==='a')));
 await assert.rejects(CloudProfiles.create(fakeClient(null),Profiles).list(),/Sign in/);
});
test('private account UI handles sign-in and saving, and does not retain passwords',async()=>{
 const map=new Map(),get=id=>{if(!map.has(id))map.set(id,{value:'',innerHTML:'',textContent:'',addEventListener(e,fn){this[e]=fn}});return map.get(id)};
 const client=fakeClient('a');client.auth.getSession=async()=>({data:{session:null}});client.auth.onAuthStateChange=()=>{};
 client.auth.signInWithPassword=async()=>({data:{session:{user:{id:'a',email:'a@example.test'}}}});
 client.auth.signOut=async()=>({error:null});
 const ui=createUI({get,escape:x=>x,fetchConfig:async()=>({enabled:true,url:'https://example.supabase.co',publishableKey:'public'}),loadSdk:async()=>({createClient:()=>client}),capture:async()=>profile,load:async()=>{},storeFactory:c=>CloudProfiles.create(c,Profiles)});
 await ui.ready;get('accountEmail').value='a@example.test';get('accountPassword').value='test-password';
 await get('accountSignIn').click();assert.equal(get('accountPassword').value,'');
 await get('accountSavePreset').click();assert.match(get('accountStatus').textContent,/Saved.*privately/);
 assert.equal(get('accountPresets').value,'My Rules');
 await get('accountSignOut').click();assert.equal(get('accountSavePreset').disabled,true);assert.match(get('accountPresets').innerHTML,/Sign in/);
});
test('unconfigured account storage remains disabled without breaking local features',async()=>{
 const get=()=>({addEventListener(){}});
 let sdkLoaded=false;
 const ui=createUI({get,escape:x=>x,fetchConfig:async()=>({enabled:false}),loadSdk:async()=>{sdkLoaded=true},capture:async()=>profile,load:async()=>{}});
 await ui.ready;assert.equal(sdkLoaded,false);
});

test('vendored browser SDK provides the expected client entry point without a CDN dependency',()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const context=vm.createContext({console,URL,TextEncoder,TextDecoder,AbortController,setTimeout,clearTimeout});
 vm.runInContext(fs.readFileSync('public/vendor/supabase-2.119.0.js','utf8'),context);
 assert.equal(vm.runInContext('typeof supabase.createClient',context),'function');
});
test('deployment uses only the validated public project fallback and fails closed on bad environment overrides',()=>{
 const browser={url:config.SUPABASE_URL,publishableKey:config.SUPABASE_PUBLISHABLE_KEY};
 assert.equal(publicCloudConfig({},browser).enabled,true);
 assert.equal(publicCloudConfig({...config,SUPABASE_URL:'https://override.supabase.co'},browser).url,'https://override.supabase.co');
 assert.deepEqual(publicCloudConfig({SUPABASE_URL:'https://override.supabase.co'},browser),{enabled:false});
 assert.deepEqual(publicCloudConfig({...config,SUPABASE_PUBLISHABLE_KEY:'sb_secret_wrong'},browser),{enabled:false});
});
test('the committed browser configuration contains only a publishable Supabase key',()=>{
 const actual=require('../public/account-config.json');
 assert.deepEqual(Object.keys(actual).sort(),['publishableKey','url']);
 assert.match(actual.publishableKey,/^sb_publishable_[A-Za-z0-9_-]+$/);
 assert.equal(publicCloudConfig({},actual).enabled,true);
});

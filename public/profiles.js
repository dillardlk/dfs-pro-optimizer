(function(root){
'use strict';
const STORAGE_KEY='dfs-classic-presets-v1';
const controlDefaults={contestFormat:'classic',slateType:'main',num:10,minUnique:3,globalMaxExposure:100,stackCount:0,bringBack:false,avoidOpposingDST:false,season:2026,week:11};
function checkNumber(value,min,max,label,integer=true){
 if(typeof value!=='number'||!Number.isFinite(value)||(integer&&!Number.isInteger(value))||value<min||value>max)throw Error(`${label} must be ${integer?'a whole number':'a number'} between ${min} and ${max}.`);
 return value;
}
function validate(raw){
 if(!raw||raw.version!==1||typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>80)throw Error('Invalid or unsupported settings file.');
 const settings={contestFormat:raw.settings?.contestFormat??'classic',slateType:raw.settings?.slateType??'main'};
 if(!['classic','showdown'].includes(settings.contestFormat)||!['main','early','late','custom','single'].includes(settings.slateType))throw Error('Unsupported contest format or slate type.');
 if(settings.contestFormat==='showdown')settings.slateType='single';
 const ranges={num:[1,150],minUnique:[1,settings.contestFormat==='showdown'?6:9],globalMaxExposure:[0,100],stackCount:[0,2],season:[2020,2100],week:[1,22]};
 if(!raw.settings||typeof raw.settings!=='object')throw Error('Settings are missing.');
 for(const [key,[min,max]] of Object.entries(ranges))settings[key]=checkNumber(raw.settings[key],min,max,key);
 for(const key of ['bringBack','avoidOpposingDST']){
  if(typeof raw.settings[key]!=='boolean')throw Error(`Invalid ${key} setting.`);
  settings[key]=raw.settings[key];
 }
 if(raw.slate!==null&&(typeof raw.slate!=='string'||!/^[a-f0-9]{64}$/.test(raw.slate)))throw Error('Invalid settings slate identifier.');
 if(!Array.isArray(raw.players)||raw.players.length>2000)throw Error('Invalid player overrides.');
 const seen=new Set();
 const players=raw.players.map(p=>{
  if(!p||typeof p.dkId!=='string'||!/^\d{1,30}$/.test(p.dkId)||seen.has(p.dkId))throw Error('Invalid or duplicate player override ID.');
  seen.add(p.dkId);
  const result={dkId:p.dkId};
  if(p.projection!==undefined)result.projection=checkNumber(p.projection,-1000,1000,'Projection',false);
  for(const key of ['minExposure','maxExposure'])if(p[key]!==undefined)result[key]=checkNumber(p[key],0,100,key);
  for(const key of ['locked','excluded'])if(p[key]!==undefined){
   if(typeof p[key]!=='boolean')throw Error(`Invalid ${key} override.`);
   result[key]=p[key];
  }
  if(result.locked&&result.excluded)throw Error('A saved player cannot be both locked and excluded.');
  return result;
 });
 if(players.length&&raw.slate===null)throw Error('Player overrides require a matching DraftKings slate.');
 return {version:1,name:raw.name.trim(),settings,slate:raw.slate,players};
}
async function fingerprint(pool){
 if(!pool.length||pool.some(p=>p.source!=='dk'))return null;
 const content=JSON.stringify(pool.map(p=>(p.rosterSlot?[p.dkId,p.salary,p.pos,p.team,p.game,p.rosterSlot]:[p.dkId,p.salary,p.pos,p.team,p.game])).sort((a,b)=>a[0].localeCompare(b[0])));
 const bytes=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(content));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
async function capture(pool,settings,name){
 const slate=await fingerprint(pool);
 const players=slate?pool.flatMap(p=>{
  const row={dkId:p.dkId};
  if(p.projectionOverride!==undefined)row.projection=p.projectionOverride/(p.projectionMultiplier||1);
  if(p.minExposure!==undefined)row.minExposure=p.minExposure;
  if(p.maxExposure!==undefined)row.maxExposure=p.maxExposure;
  if(p.locked)row.locked=true;
  if(p.excluded!==Boolean(p.defaultExcluded))row.excluded=Boolean(p.excluded);
  return Object.keys(row).length>1?[row]:[];
 }):[];
 return validate({version:1,name,settings,slate,players});
}
async function matches(pool,profile){return !profile.players.length||profile.slate===await fingerprint(pool)}
async function applyPlayers(pool,raw){
 const profile=validate(raw);
 if(profile.slate===null||(!profile.players.length&&profile.slate!==await fingerprint(pool)))return 0;
 if(!await matches(pool,profile))throw Error('Import the matching DraftKings salaries CSV before applying these player overrides.');
 // Validate membership before changing any player. No salaries, positions,
 // team information, base projections or source credentials are imported.
 const byId=new Map(pool.map(p=>[p.dkId,p]));
 if(profile.players.some(p=>!byId.has(p.dkId)))throw Error('Saved player IDs are not present in this slate.');
 for(const p of pool){
  delete p.minExposure;delete p.maxExposure;delete p.projectionOverride;
  p.locked=false;p.excluded=Boolean(p.defaultExcluded);
  p.proj=p.baseProjection??p.csvAverage??p.proj;
 }
 for(const row of profile.players){
  const p=byId.get(row.dkId);
  for(const key of ['minExposure','maxExposure','locked','excluded'])if(row[key]!==undefined)p[key]=row[key];
  if(row.projection!==undefined){p.projectionOverride=row.projection*(p.projectionMultiplier||1);p.proj=p.projectionOverride}
  if(p.locked)p.excluded=false;
 }
 return profile.players.length;
}
function parse(text){
 if(typeof text!=='string'||text.length>300000)throw Error('Settings file is too large.');
 let value;try{value=JSON.parse(text)}catch{throw Error('Settings file is not valid JSON.')}
 return validate(value);
}
function encode(profile){
 const text=encodeURIComponent(JSON.stringify(validate(profile)));
 if(text.length>24000)throw Error('Too many overrides for a settings link. Use Export Settings File instead.');
 return '#settings='+text;
}
function decode(hash){
 if(!hash.startsWith('#settings='))return null;
 if(hash.length>24010)throw Error('Settings link is too large. Use a settings file.');
 try{return parse(decodeURIComponent(hash.slice(10)))}catch(error){throw Error('Invalid settings link: '+error.message)}
}
function readSaved(storage){
 const text=storage.getItem(STORAGE_KEY);
 if(!text)return [];
 const list=JSON.parse(text);
 if(!Array.isArray(list)||list.length>20)throw Error('Saved settings are invalid. Import a settings file to recover.');
 return list.map(validate);
}
function save(storage,raw){
 const profile=validate(raw),list=readSaved(storage);
 const index=list.findIndex(p=>p.name===profile.name);
 if(index<0){if(list.length===20)throw Error('You can save up to 20 presets. Delete one first.');list.push(profile)}else list[index]=profile;
 storage.setItem(STORAGE_KEY,JSON.stringify(list));
 return profile;
}
function remove(storage,name){storage.setItem(STORAGE_KEY,JSON.stringify(readSaved(storage).filter(p=>p.name!==name)))}
const api={STORAGE_KEY,controlDefaults,validate,fingerprint,capture,matches,applyPlayers,parse,encode,decode,readSaved,save,remove};
if(typeof module==='object'&&module.exports)module.exports=api;else root.Profiles=api;
})(typeof globalThis!=='undefined'?globalThis:this);

const {test}=require('node:test');
const assert=require('node:assert/strict');
const Profiles=require('../public/profiles');
const Classic=require('../public/classic');
const settings={...Profiles.controlDefaults};
const fixture=()=>['QB','RB','WR','TE','DST'].map((pos,i)=>({id:i+1,dkId:String(123400+i),source:'dk',name:'Player '+i,pos,team:'KC',game:'KC|DEN|2099',salary:5000,proj:12,baseProjection:12,defaultExcluded:false,excluded:false,locked:false}));
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)}};
test('cross-device preset roundtrip retains rules and player edits, not credentials or salary changes',async()=>{
 const p=fixture();p[0].projectionOverride=28.75;p[0].proj=28.75;p[1].locked=true;p[2].maxExposure=30;p[3].minExposure=20;p[4].excluded=true;
 const preset=await Profiles.capture(p,{...settings,stackCount:2,bringBack:true},'Desktop → iPad');
 const decoded=Profiles.decode(Profiles.encode({...preset,secret:'NEVER SERIALIZE'}));
 assert.equal(decoded.settings.stackCount,2);assert.equal(decoded.settings.bringBack,true);
 assert.equal(JSON.stringify(decoded).includes('NEVER SERIALIZE'),false);
 const other=fixture();other[0].baseProjection=18;
 await Profiles.applyPlayers(other,decoded);
 assert.equal(other[0].proj,28.75);assert.equal(other[0].baseProjection,18);
 assert.equal(other[1].locked,true);assert.equal(other[2].maxExposure,30);assert.equal(other[3].minExposure,20);assert.equal(other[4].excluded,true);
 assert.ok(other.every(p=>p.salary===5000));
});
test('slate fingerprints ignore row ordering but detect changed salaries, games and IDs before applying',async()=>{
 const p=fixture();p[0].projectionOverride=25;
 const preset=await Profiles.capture(p,settings,'One');
 assert.equal(await Profiles.fingerprint(p),await Profiles.fingerprint([...p].reverse()));
 for(const field of ['salary','game','dkId']){
  const other=fixture();other[0][field]=field==='salary'?5100:'different';
  const before=JSON.stringify(other);
  await assert.rejects(Profiles.applyPlayers(other,preset),/matching DraftKings/);
  assert.equal(JSON.stringify(other),before);
 }
});
test('named browser presets replace by name, survive reload and can be deleted',async()=>{
 const store=storage();const preset=await Profiles.capture(fixture(),settings,'My Rules');
 Profiles.save(store,preset);Profiles.save(store,{...preset,settings:{...settings,globalMaxExposure:60}});
 assert.equal(Profiles.readSaved(store).length,1);assert.equal(Profiles.readSaved(store)[0].settings.globalMaxExposure,60);
 Profiles.remove(store,'My Rules');assert.equal(Profiles.readSaved(store).length,0);
});
test('profile validation rejects unsupported, malformed, oversized and duplicate override payloads',async()=>{
 const profile=await Profiles.capture(fixture(),settings,'Safe');
 assert.throws(()=>Profiles.parse('not JSON'),/valid JSON/);
 assert.throws(()=>Profiles.parse(' '.repeat(300001)),/too large/);
 assert.throws(()=>Profiles.validate({...profile,version:2}),/unsupported/);
 assert.throws(()=>Profiles.validate({...profile,settings:{...settings,num:151}}),/num/);
 assert.throws(()=>Profiles.validate({...profile,players:[{dkId:'123',projection:Infinity}]}),/Projection/);
 assert.throws(()=>Profiles.validate({...profile,players:[{dkId:'123'},{dkId:'123'}]}),/duplicate/);
 assert.throws(()=>Profiles.decode('#settings=%xx'),/Invalid settings link/);
});
test('default injury exclusions are restored and a manual zero projection is retained',async()=>{
 const p=fixture();p[4].defaultExcluded=true;p[4].excluded=true;p[0].projectionOverride=0;p[0].proj=0;
 const preset=await Profiles.capture(p,settings,'Zero');
 const other=fixture();other[4].defaultExcluded=true;other[4].excluded=false;other[2].maxExposure=20;
 await Profiles.applyPlayers(other,preset);
 assert.equal(other[0].proj,0);assert.equal(other[4].excluded,true);assert.equal(other[2].maxExposure,undefined);
 const demo=[{id:1,pos:'QB',proj:12,baseProjection:12,projectionOverride:15}];
 const global=await Profiles.capture(demo,settings,'Rules only');assert.equal(global.slate,null);assert.equal(global.players.length,0);
 await Profiles.applyPlayers(demo,global);assert.equal(demo[0].projectionOverride,15);
});

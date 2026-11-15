const {test}=require('node:test');
const assert=require('node:assert/strict');
const Classic=require('../public/classic'),S=Classic.Showdown;
const Profiles=require('../public/profiles');
const rows=require('../test-support/showdown-fixture.cjs');
test('Showdown imports both role IDs, keeps imported Captain salary and multiplies base points once',()=>{
 const p=S.importRows(rows());assert.equal(p.length,32);
 const captain=p.find(p=>p.rosterSlot==='CPT'),flex=p.find(p=>p.personId===captain.personId&&p.rosterSlot==='FLEX');
 assert.equal(captain.salary,flex.salary*1.5);assert.equal(captain.proj,flex.proj*1.5);assert.notEqual(captain.dkId,flex.dkId);
 assert.throws(()=>Classic.importRows(rows()),/not NFL Classic/);
});
test('Showdown rejects duplicate people, malformed roles, cross-game slates and bad premium salaries',()=>{
 let r=rows();r[1][4]='9999';assert.throws(()=>S.importRows(r),/exactly 1.5/);
 r=rows();r[1][3]='QB/FLEX';assert.throws(()=>S.importRows(r),/CPT and FLEX/);
 r=rows();r.splice(1,1);assert.throws(()=>S.importRows(r),/both be present/);
 r=rows();r[1][5]='KC@BUF 12/02/2099 08:20PM ET';assert.throws(()=>S.importRows(r),/exactly one game/);
 const p=S.importRows(rows()),l=[p[0],p[1],p[3],p[5],p[7],p[9]];
 assert.match(S.validate(l,p).join(' '),/more than once/);
});
test('Showdown generates diverse capped portfolios and exports the exact role-specific IDs',()=>{
 const p=S.importRows(rows()),settings={minUnique:2,globalMaxExposure:60};
 const r=S.generate(p,10,settings);assert.equal(r.lineups.length,10);
 assert.deepEqual(S.validatePortfolio(r.lineups,p,settings),[]);
 const csv=S.exportCSV(r.lineups,p,settings).split('\r\n');
 assert.equal(csv[0],'CPT,FLEX,FLEX,FLEX,FLEX,FLEX');
 r.lineups.forEach((l,i)=>{
  assert.equal(l.length,6);assert.equal(l[0].rosterSlot,'CPT');assert.ok(l.slice(1).every(p=>p.rosterSlot==='FLEX'));
  assert.equal(new Set(l.map(p=>p.personId)).size,6);assert.equal(new Set(l.map(p=>p.team)).size,2);
  assert.ok(l.reduce((s,p)=>s+p.salary,0)<=50000);
  assert.deepEqual(csv[i+1].split(','),l.map(p=>p.dkId));
  for(let j=0;j<i;j++)assert.ok(6-l.filter(p=>r.lineups[j].some(other=>other.personId===p.personId)).length>=2);
 });
});
test('locks retain the selected role and exposure caps count people across Captain and FLEX',()=>{
 const p=S.importRows(rows());p[0].locked=true;
 const capped=p.find(p=>p.pos==='WR');capped.maxExposure=40;
 const r=S.generate(p,5,{minUnique:1,globalMaxExposure:80});assert.equal(r.lineups.length,5);
 assert.ok(r.lineups.every(l=>l[0]===p[0]));
 assert.ok(r.lineups.filter(l=>l.some(p=>p.personId===capped.personId)).length<=2);
 const other=p.find(other=>other.personId===p[0].personId&&other!==p[0]);other.locked=true;
 assert.throws(()=>S.generate(p,5),/both Captain and FLEX/);
});
test('100% minimum exposure is role-independent and Showdown source presets roundtrip',async()=>{
 const p=S.importRows(rows()),chosen=p.find(p=>p.pos==='WR');chosen.minExposure=100;
 const r=S.generate(p,3,{minUnique:1});assert.equal(r.lineups.length,3);
 assert.ok(r.lineups.every(l=>l.some(p=>p.personId===chosen.personId)));
 chosen.projectionOverride=30;chosen.proj=30;
 const profile=await Profiles.capture(p,{...Profiles.controlDefaults,contestFormat:'showdown',slateType:'single',minUnique:2},'Showdown');
 const other=S.importRows(rows());await Profiles.applyPlayers(other,Profiles.decode(Profiles.encode(profile)));
 assert.equal(other.find(p=>p.dkId===chosen.dkId).proj,30);assert.equal(profile.settings.contestFormat,'showdown');
});
test('Showdown validates the stacking rules for every selected QB',()=>{
 const p=S.importRows(rows()),l=[p[0],p.find(p=>p.team==='BUF'&&p.pos==='QB'&&p.rosterSlot==='FLEX'),p[5],p[7],p[9],p[11]];
 const errors=S.validatePortfolio([l],p,{stackCount:1});
 assert.match(errors.join(' '),/BUF Player 0: QB must/);
});
test('an unavailable status in either role excludes the person in both roles',()=>{
 const r=rows();r[1][8]='OUT';
 const p=S.importRows(r);
 assert.equal(p[0].excluded,true);assert.equal(p[1].excluded,true);assert.equal(p[1].status,'OUT');
});
test('Showdown single-lineup search matches exhaustive legal Captain/FLEX combinations on a small slate',()=>{
 const p=S.importRows(rows(6));
 let best=-Infinity;
 for(const cpt of p.filter(p=>p.rosterSlot==='CPT')){
  const flex=p.filter(p=>p.rosterSlot==='FLEX'&&p.personId!==cpt.personId);
  function visit(start,l){
   if(l.length===6){if(!S.validate(l,p).length)best=Math.max(best,l.reduce((s,p)=>s+p.proj,0));return}
   for(let i=start;i<=flex.length-(6-l.length);i++)visit(i+1,[...l,flex[i]]);
  }
  visit(0,[cpt]);
 }
 const actual=S.generate(p,1,{beamWidth:5000});
 assert.equal(actual.lineups.length,1);assert.equal(actual.lineups[0].reduce((s,p)=>s+p.proj,0),best);
});

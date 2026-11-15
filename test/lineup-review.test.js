const {test}=require('node:test');
const assert=require('node:assert/strict');
const Classic=require('../public/classic'),Review=require('../public/lineup-review');
function fixture(){
 const p=['QB','RB','RB','WR','WR','WR','TE','RB','DST','WR'].map((pos,i)=>({id:i+1,dkId:String(1000+i),name:'Player '+i,pos,team:i%2?'BUF':'KC',game:i%2?'BUF|NYJ':'KC|DEN',salary:i===9?6000:5000,proj:i===9?20:10}));
 return {p,lineups:[p.slice(0,9),[...p.slice(0,7),p[9],p[8]]]};
}
test('review calculates salary, remaining budget, projection range and actual player differences',()=>{
 const {p,lineups}=fixture(),r=Review.analyze(lineups,p,Classic);
 assert.equal(r.salaryAverage,45500);assert.equal(r.remainingAverage,4500);assert.equal(r.pointsMin,90);assert.equal(r.pointsMax,100);
 assert.equal(r.minimumDifference,1);assert.equal(r.averageOverlap,8);
 assert.equal(r.exposures.find(p=>p.id==='1000').percentage,100);assert.equal(r.exposures.find(p=>p.id==='1009').percentage,50);
 assert.ok(r.teams.every(t=>t.percentage===100));assert.equal(r.stackedLineups,2);
});
test('comparison isolates shared people and changes in each direction',()=>{
 const {lineups}=fixture(),r=Review.compare(...lineups,Classic);
 assert.equal(r.shared.length,8);assert.equal(r.onlyA[0].id,8);assert.equal(r.onlyB[0].id,10);
});
test('Captain swaps remain the same people but role exposures and totals show the difference',()=>{
 const S=Classic.Showdown,p=S.importRows(require('../test-support/showdown-fixture.cjs')());
 const first=S.generate(p,1).lineups[0],flex=first.find(p=>p.rosterSlot==='FLEX');
 const second=first.map(player=>player===first[0]?p.find(p=>p.personId===player.personId&&p.rosterSlot==='FLEX'):player===flex?p.find(p=>p.personId===player.personId&&p.rosterSlot==='CPT'):player);
 const comparison=Review.compare(first,second,S);assert.equal(comparison.onlyA.length,0);assert.equal(comparison.shared.length,6);assert.notEqual(comparison.captainA.personId,comparison.captainB.personId);
 const r=Review.analyze([first,second],p,S);assert.equal(r.minimumDifference,0);
 const captain=r.exposures.find(p=>p.id===first[0].personId);assert.equal(captain.count,2);assert.equal(captain.captain,1);assert.equal(captain.flex,1);
});
test('review handles an empty set and a single lineup without invented comparisons',()=>{
 assert.equal(Review.analyze([],[],Classic).count,0);
 const {p,lineups}=fixture(),r=Review.analyze([lineups[0]],p,Classic);assert.equal(r.minimumDifference,null);assert.equal(r.averageOverlap,null);
});

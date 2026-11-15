(function(root){
'use strict';
const average=values=>values.reduce((s,n)=>s+n,0)/values.length;
function compare(a,b,engine){
 const ai=new Set(a.map(engine.identity)),bi=new Set(b.map(engine.identity));
 return {shared:a.filter(p=>bi.has(engine.identity(p))),onlyA:a.filter(p=>!bi.has(engine.identity(p))),onlyB:b.filter(p=>!ai.has(engine.identity(p))),captainA:a.find(p=>p.rosterSlot==='CPT')||null,captainB:b.find(p=>p.rosterSlot==='CPT')||null};
}
function analyze(lineups,pool,engine,settings={}){
 if(!lineups.length)return {count:0,lineups:[],exposures:[],teams:[]};
 const people=new Map(),teams=new Map(),rows=[];let minimumDifference=engine.size,overlapSum=0,pairs=0;
 lineups.forEach((lineup,index)=>{
  const salary=lineup.reduce((s,p)=>s+p.salary,0),points=lineup.reduce((s,p)=>s+p.proj,0);
  const stacks=lineup.filter(p=>p.pos==='QB').map(qb=>({qb,teammates:lineup.filter(p=>['WR','TE'].includes(p.pos)&&p.team===qb.team&&p.game===qb.game),opponents:lineup.filter(p=>['RB','WR','TE'].includes(p.pos)&&p.team!==qb.team&&p.game===qb.game),opposingDST:lineup.some(p=>p.pos==='DST'&&p.team!==qb.team&&p.game===qb.game)}));
  rows.push({index,salary,remaining:50000-salary,points,stacks,captain:lineup.find(p=>p.rosterSlot==='CPT')||null});
  for(const p of lineup){
   const id=engine.identity(p);
   if(!people.has(id))people.set(id,{id,name:p.name,team:p.team,pos:p.pos,count:0,captain:0,flex:0});
   const row=people.get(id);row.count++;
   if(p.rosterSlot==='CPT')row.captain++;else if(p.rosterSlot==='FLEX')row.flex++;
  }
  for(const team of new Set(lineup.map(p=>p.team)))teams.set(team,(teams.get(team)||0)+1);
  for(let previous=0;previous<index;previous++){
   const difference=compare(lineup,lineups[previous],engine).onlyA.length;
   minimumDifference=Math.min(minimumDifference,difference);overlapSum+=engine.size-difference;pairs++;
  }
 });
 const exposures=[...people.values()].map(row=>{
  const entries=pool.filter(p=>engine.identity(p)===row.id),locked=entries.some(p=>p.locked);
  return {...row,percentage:row.count/lineups.length*100,min:locked?100:(entries.find(p=>p.minExposure!==undefined)?.minExposure??0),max:entries.find(p=>p.maxExposure!==undefined)?.maxExposure??(locked?100:settings.globalMaxExposure??100)};
 }).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
 const salaries=rows.map(r=>r.salary),points=rows.map(r=>r.points);
 return {count:lineups.length,lineups:rows,exposures,teams:[...teams].map(([team,count])=>({team,count,percentage:count/lineups.length*100})).sort((a,b)=>b.count-a.count||a.team.localeCompare(b.team)),salaryMin:Math.min(...salaries),salaryMax:Math.max(...salaries),salaryAverage:average(salaries),pointsMin:Math.min(...points),pointsMax:Math.max(...points),pointsAverage:average(points),remainingAverage:50000-average(salaries),minimumDifference:pairs?minimumDifference:null,averageOverlap:pairs?overlapSum/pairs:null,qbLineups:rows.filter(r=>r.stacks.length).length,stackedLineups:rows.filter(r=>r.stacks.some(s=>s.teammates.length)).length,bringBackLineups:rows.filter(r=>r.stacks.some(s=>s.opponents.length)).length};
}
const api={analyze,compare};
if(typeof module==='object'&&module.exports)module.exports=api;else root.LineupReview=api;
})(typeof globalThis!=='undefined'?globalThis:this);

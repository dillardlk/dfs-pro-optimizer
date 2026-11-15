(function(root){
'use strict';
const classic='QB,RB,RB,WR,WR,WR,TE,FLEX,DST',showdown='CPT,FLEX,FLEX,FLEX,FLEX,FLEX';
function normalize(data){
 if(!Array.isArray(data))throw Error('Unexpected slate response. Import the matching DraftKings salary CSV directly.');
 return data.flatMap(raw=>{
  if(raw.Operator!=='DraftKings'||raw.RemovedByOperator||raw.SalaryCap!==50000)return [];
  const roster=(raw.SlateRosterSlots||[]).join(',');
  const format=roster===classic?'classic':roster===showdown?'showdown':null;
  if(!format)return [];
  if(format==='showdown'&&raw.OperatorGameType&&!/^Showdown(?: Captain Mode)?$/i.test(raw.OperatorGameType))return [];
  const name=String(raw.OperatorName||'DraftKings slate');
  const type=format==='showdown'?'single':/early/i.test(name)?'early':/late/i.test(name)?'late':'main';
  const entries=(raw.DfsSlatePlayers||[]).filter(p=>!p.RemovedByOperator).map(p=>({id:String(p.OperatorSlatePlayerID||''),salary:Number(p.OperatorSalary)})).filter(p=>/^\d+$/.test(p.id));
  return [{id:String(raw.SlateID),operatorSlateId:String(raw.OperatorSlateID||''),name,format,type,start:String(raw.OperatorStartTime||''),games:Number(raw.NumberOfGames)||0,entries}];
 });
}
function validatePool(pool,{format='classic',slateType='main'}={},provider=null){
 if(provider){
  if(provider.format!==format)throw Error('Selected provider slate does not match the contest format.');
  const ids=new Map(provider.entries.map(p=>[p.id,p.salary]));
  for(const p of pool)if(ids.size&&(!ids.has(p.dkId)||ids.get(p.dkId)!==p.salary))throw Error('Salary CSV does not match the selected DraftKings slate IDs and salaries. Download its matching file, or choose “Use imported CSV” if provider data is stale.');
  const first=pool.reduce((a,p)=>p.startsAt<a?p.startsAt:a,Infinity);
  if(provider.start&&Number.isFinite(first)){
   const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(first);
   const value=type=>parts.find(p=>p.type===type).value;
   const kickoff=`${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
   if(provider.start.slice(0,16)!==kickoff)throw Error('Salary CSV kickoff does not match the selected provider slate. Import its matching file or choose Use imported CSV.');
  }
  const matchup=provider.format==='showdown'?provider.name.match(/^([A-Z]{2,3})\s*@\s*([A-Z]{2,3})$/):null;
  if(matchup&&pool.some(p=>!matchup.slice(1).includes(p.team)))throw Error('Showdown teams do not match the selected provider game.');
  if(provider.games&&new Set(pool.map(p=>p.game)).size!==provider.games)throw Error('Salary CSV game count does not match the selected provider slate.');
 }
 if(format==='classic'&&['early','late'].includes(slateType)){
  const hour=p=>Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',hourCycle:'h23'}).format(new Date(p.startsAt)));
  if(pool.some(p=>slateType==='early'?hour(p)>=16:hour(p)<16))throw Error(`This file includes games outside the ${slateType} window. Import the official DraftKings ${slateType}-slate file; do not reuse Main-slate player IDs for another contest.`);
 }
 return {providerIDsVerified:Boolean(provider?.entries.length)};
}
const api={normalize,validatePool};
if(typeof module==='object'&&module.exports)module.exports=api;else root.Slates=api;
})(typeof globalThis!=='undefined'?globalThis:this);

(function(root){
'use strict';
const slots=['QB','RB','RB','WR','WR','WR','TE','FLEX','DST'];
const eligible=(p,s)=>s==='FLEX'?['RB','WR','TE'].includes(p.pos):p.pos===s;
const identity=p=>p.dkId||String(p.id);
const key=l=>l.map(identity).sort().join('|');
function order(lineup){
 const remaining=[...lineup],result=[];
 for(const slot of slots){
  const i=remaining.findIndex(p=>eligible(p,slot));
  if(i<0)return null;
  result.push(remaining.splice(i,1)[0]);
 }
 return remaining.length?null:result;
}
function validate(lineup,pool,{forExport=false,now=Date.now()}={}){
 const errors=[];
 if(lineup.length!==9)errors.push('A lineup must contain exactly 9 players.');
 if(new Set(lineup.map(identity)).size!==lineup.length)errors.push('A player appears more than once.');
 if(!order(lineup))errors.push('Required roster: QB, 2 RB, 3 WR, TE, FLEX (RB/WR/TE), DST.');
 if(lineup.some(p=>!Number.isInteger(p.salary)||p.salary<=0))errors.push('Every player must have a positive whole-dollar salary.');
 if(lineup.reduce((n,p)=>n+p.salary,0)>50000)errors.push('Lineup exceeds the $50,000 salary cap.');
 for(const p of lineup){
  if(!pool.includes(p))errors.push(`${p.name} is not in the current slate.`);
  if(p.excluded)errors.push(`${p.name} is excluded.`);
 }
 if(pool.some(p=>p.locked&&!lineup.includes(p)))errors.push('Lineup is missing a locked player.');
 const imported=pool.some(p=>p.source==='dk');
 if(imported){
  if(lineup.some(p=>!Number.isFinite(p.startsAt)||p.startsAt<=now))errors.push('A player’s game has started or has an invalid start time. Import an upcoming slate.');
  if(lineup.some(p=>p.source!=='dk'||!p.game))errors.push('Every player must belong to the imported DraftKings slate.');
  if(new Set(lineup.map(p=>p.game)).size<2)errors.push('NFL Classic requires players from at least two different games.');
 }else if(new Set(lineup.map(p=>p.team)).size<2)errors.push('Use players from at least two teams.');
 if(forExport&&(!imported||lineup.some(p=>!/^\d+$/.test(p.dkId||''))))errors.push('Export requires player IDs from an imported DraftKings NFL Classic salaries file. Demo players cannot be exported.');
 return [...new Set(errors)];
}
function exportCSV(lineups,pool,options={}){
 if(!lineups.length)throw Error('Generate lineups first.');
 const portfolioErrors=validatePortfolio(lineups,pool,options);
 if(portfolioErrors.length)throw Error(portfolioErrors.join(' '));
 const seen=new Set();
 const rows=lineups.map((l,i)=>{
  const errors=validate(l,pool,{forExport:true});
  if(seen.has(key(l)))errors.push('Duplicate lineup.');
  seen.add(key(l));
  if(errors.length)throw Error(`Lineup ${i+1}: ${errors.join(' ')}`);
  return order(l).map(p=>p.dkId).join(',');
 });
 return [slots.join(','),...rows].join('\r\n');
}
function gameStart(date,time){
 const [month,day,year]=date.split('/').map(Number);
 const match=time.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
 const hour=Number(match[1]),minute=Number(match[2]);
 if(month<1||month>12||day<1||day>31||hour<1||hour>12||minute>59)return NaN;
 const utc=Date.UTC(year,month-1,day,hour%12+(match[3]==='PM'?12:0),minute);
 const check=new Date(utc);
 if(check.getUTCMonth()!==month-1||check.getUTCDate()!==day)return NaN;
 const zone=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',timeZoneName:'shortOffset'});
 const offset=timestamp=>Number(zone.formatToParts(timestamp).find(p=>p.type==='timeZoneName').value.replace('GMT',''));
 let result=utc-offset(utc)*3600000;
 return utc-offset(result)*3600000;
}
function importRows(rows){
 if(rows.length<2)throw Error('CSV contains no players.');
 const headers=rows[0].map(x=>x.trim().toLowerCase());
 const col=(...names)=>names.map(n=>headers.indexOf(n.toLowerCase())).find(i=>i>=0);
 const cols={name:col('Name','Player Name'),pos:col('Position'),salary:col('Salary'),team:col('TeamAbbrev','Team','Team Abbrev'),dkId:col('ID','Player ID'),game:col('Game Info'),roster:col('Roster Position'),avg:col('AvgPointsPerGame','Avg Points Per Game'),status:col('Status')};
 for(const field of ['name','pos','salary','team','dkId','game','roster'])if(cols[field]===undefined)throw Error(`Missing ${field} column. Import a DraftKings NFL Classic salaries CSV.`);
 const ids=new Set(),names=new Set();
 const players=rows.slice(1).map((row,i)=>{
  const get=k=>(row[cols[k]]||'').trim();
  const p={id:i+1,dkId:get('dkId'),name:get('name'),pos:get('pos').toUpperCase().replace(/^(D|DEF)$/,'DST'),team:get('team').toUpperCase(),salary:Number(get('salary').replace(/[$,]/g,'')),proj:Number(get('avg'))||0,source:'dk',locked:false,excluded:false};
  p.csvAverage=Number.isFinite(p.proj)?p.proj:0;
  p.baseProjection=p.csvAverage;p.proj=p.csvAverage;p.projectionSource='CSV average';
  p.status=get('status').toUpperCase();
  p.excluded=['OUT','IR','PUP','NFI','SUSP','SUSPENDED'].includes(p.status);
  p.defaultExcluded=p.excluded;
  const game=get('game').toUpperCase().match(/^([A-Z]{2,3})@([A-Z]{2,3})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2}(?:AM|PM))\s+ET$/);
  const fail=message=>{throw Error(`Row ${i+2}: ${message}`)};
  if(!p.name||!/^\d+$/.test(p.dkId))fail('Missing name or invalid DraftKings player ID.');
  if(!['QB','RB','WR','TE','DST'].includes(p.pos))fail('Only NFL Classic positions are supported.');
  const expected=['RB','WR','TE'].includes(p.pos)?[p.pos,'FLEX']:[p.pos];
  const roster=get('roster').toUpperCase().split('/').sort();
  if(roster.join('/')!==expected.sort().join('/'))fail('Roster Position is not NFL Classic (Showdown and SuperFlex are unsupported).');
  if(!Number.isInteger(p.salary)||p.salary<=0||p.salary>50000)fail('Invalid salary.');
  if(!game||![game[1],game[2]].includes(p.team))fail('Game Info must identify this player’s game and team.');
  p.startsAt=gameStart(game[3],game[4]);
  if(!Number.isFinite(p.startsAt))fail('Invalid game date or time.');
  p.game=game.slice(1,4).join('|');
  const nameKey=p.name.toLowerCase().replace(/[^a-z0-9]/g,'')+'|'+p.team;
  if(ids.has(p.dkId)||names.has(nameKey))fail('Duplicate player in salaries file.');
  ids.add(p.dkId);names.add(nameKey);
  return p;
 });
 if(new Set(players.map(p=>p.game)).size<2)throw Error('NFL Classic slate must contain at least two games.');
 if(!orderForPool(players))throw Error('Slate lacks enough players to fill QB, 2 RB, 3 WR, TE, FLEX, DST.');
 return players;
}
function orderForPool(pool){
 const remaining=[...pool];
 for(const slot of slots){const i=remaining.findIndex(p=>eligible(p,slot));if(i<0)return false;remaining.splice(i,1)}return true;
}
function readRules(options={}){
 const minUnique=options.minUnique??1;
 const globalMaxExposure=options.globalMaxExposure??100;
 const stackCount=options.stackCount??0;
 if(!Number.isInteger(minUnique)||minUnique<1||minUnique>9)throw Error('Minimum different players must be between 1 and 9.');
 if(!Number.isInteger(globalMaxExposure)||globalMaxExposure<0||globalMaxExposure>100)throw Error('Default maximum exposure must be a whole percentage from 0 to 100.');
 if(![0,1,2].includes(stackCount))throw Error('QB stack must be off, QB + 1, or QB + 2 WR/TE.');
 return {minUnique,globalMaxExposure,stackCount,bringBack:Boolean(options.bringBack),avoidOpposingDST:Boolean(options.avoidOpposingDST)};
}
function exposureFor(p,rules){
 const min=p.locked?100:(p.minExposure??0);
 // A lock overrides the default maximum, but never an explicit player cap.
 const max=p.maxExposure??(p.locked?100:rules.globalMaxExposure);
 if(!Number.isInteger(min)||!Number.isInteger(max)||min<0||max>100||max<0||min>100)throw Error(`${p.name}: exposure must be a whole percentage from 0 to 100.`);
 if(min>max)throw Error(`${p.name}: minimum exposure (or lock) exceeds maximum exposure. Raise the player cap or remove the lock.`);
 return {min,max};
}
function stackErrors(lineup,rules){
 const qb=lineup.find(p=>p.pos==='QB');
 if(!qb)return [];
 const errors=[];
 if(rules.stackCount&&lineup.filter(p=>['WR','TE'].includes(p.pos)&&p.team===qb.team&&p.game===qb.game).length<rules.stackCount)errors.push(`QB must have at least ${rules.stackCount} WR/TE teammate(s) from the same game.`);
 if(rules.bringBack&&!lineup.some(p=>['RB','WR','TE'].includes(p.pos)&&p.game===qb.game&&p.team!==qb.team))errors.push('QB game requires an opposing RB/WR/TE bring-back.');
 if(rules.avoidOpposingDST&&lineup.some(p=>p.pos==='DST'&&p.game===qb.game&&p.team!==qb.team))errors.push('QB cannot face the selected opposing DST.');
 return errors;
}
// Check whether unfilled slots can still satisfy a QB stack or bring-back.
// Position counts avoid counting a WR twice through WR and FLEX eligibility.
const stackInventoryCache=new WeakMap();
function canCompleteStack(players,remaining,available,rules){
 if(!rules.stackCount&&!rules.bringBack&&!rules.avoidOpposingDST)return true;
 const qb=players.find(p=>p.pos==='QB');
 if(!qb)return true;
 if(rules.avoidOpposingDST&&players.some(p=>p.pos==='DST'&&p.game===qb.game&&p.team!==qb.team))return false;
 const teammate=p=>['WR','TE'].includes(p.pos)&&p.team===qb.team&&p.game===qb.game;
 const opponent=p=>['RB','WR','TE'].includes(p.pos)&&p.team!==qb.team&&p.game===qb.game;
 let cache=stackInventoryCache.get(available);
 if(!cache){cache=new Map();stackInventoryCache.set(available,cache)}
 const cacheKey=qb.team+'|'+qb.game;
 if(!cache.has(cacheKey)){
  const inventory={teammate:{RB:0,WR:0,TE:0},opponent:{RB:0,WR:0,TE:0}};
  for(const p of available){if(teammate(p))inventory.teammate[p.pos]++;if(opponent(p))inventory.opponent[p.pos]++}
  cache.set(cacheKey,inventory);
 }
 function possible(side,predicate){
  const counts={...cache.get(cacheKey)[side]};
  for(const p of players)if(predicate(p))counts[p.pos]--;
  let total=0;
  for(const pos of ['RB','WR','TE']){
   const taken=Math.min(counts[pos],remaining.filter(s=>s===pos).length);
   total+=taken;counts[pos]-=taken;
  }
  return total+Math.min(remaining.filter(s=>s==='FLEX').length,counts.RB+counts.WR+counts.TE);
 }
 if(rules.stackCount&&players.filter(teammate).length+possible('teammate',teammate)<rules.stackCount)return false;
 if(rules.bringBack&&!players.some(opponent)&&possible('opponent',opponent)<1)return false;
 return true;
}

function validatePortfolio(lineups,pool,options={}){
 const rules=readRules(options),errors=[];
 const seen=new Set(),counts=new Map();
 for(const [i,lineup] of lineups.entries()){
  for(const error of [...validate(lineup,pool,options),...stackErrors(lineup,rules)])errors.push(`Lineup ${i+1}: ${error}`);
  if(seen.has(key(lineup)))errors.push(`Lineup ${i+1}: Duplicate lineup.`);
  seen.add(key(lineup));
  const ids=new Set(lineup.map(identity));
  for(const id of ids)counts.set(id,(counts.get(id)||0)+1);
  for(let j=0;j<i;j++)if(lineups[j].filter(p=>ids.has(identity(p))).length>9-rules.minUnique)errors.push(`Lineups ${j+1} and ${i+1} do not meet the minimum player difference.`);
 }
 if(lineups.length)for(const p of pool){
  const {min,max}=exposureFor(p,rules),used=counts.get(identity(p))||0;
  if(used*100<min*lineups.length||used*100>max*lineups.length)errors.push(`${p.name}: exposure ${used}/${lineups.length} is outside ${min}–${max}%.`);
 }
 return [...new Set(errors)];
}

// Bounded beam search. Relaxed suffix scores rank partial lineups while
// preserving enough salary to finish; duplicate choices in the relaxation
// make it optimistic. Final results always pass the full Classic validator.
function search(pool,count,{now=Date.now(),beamWidth=Math.max(300,count*8),minUnique=1,avoid=[],blocked=new Set(),required=new Set(),bonuses=new Map(),rules=readRules()}={}){
 if(!Number.isInteger(count)||count<1||count>150)throw Error('Choose between 1 and 150 lineups.');
 if(!Number.isInteger(beamWidth)||beamWidth<1||beamWidth>5000)throw Error('Invalid search width.');
 const available=pool.filter(p=>!p.excluded&&!blocked.has(identity(p))&&Number.isFinite(p.proj)&&
  Number.isInteger(p.salary)&&p.salary>0&&p.salary<=50000&&
  (p.source!=='dk'||p.startsAt>now));
 if(new Set(available.map(identity)).size!==available.length)throw Error('The player pool contains duplicate player IDs. Reimport salaries.');
 const locked=pool.filter(p=>p.locked||required.has(identity(p)));
 if(locked.some(p=>!available.includes(p)))throw Error('A locked player is excluded, has invalid data, or their game has started.');
 if(locked.length>9)throw Error('You have locked more than 9 players.');
 const lockedSalary=locked.reduce((s,p)=>s+p.salary,0);
 if(lockedSalary>50000)throw Error('Locked players exceed the $50,000 salary cap.');
 const slotOrder=['QB','DST','TE','RB','RB','WR','WR','WR','FLEX'];
 function placeLocks(i,open){
  if(i===locked.length)return open;
  for(let j=0;j<open.length;j++)if(eligible(locked[i],open[j])){
   const next=open.slice();next.splice(j,1);
   const result=placeLocks(i+1,next);if(result)return result;
  }
  return null;
 }
 const open=placeLocks(0,slotOrder);
 if(!open)throw Error('Locked players cannot fit QB, 2 RB, 3 WR, TE, FLEX, DST.');
 const unlocked=available.filter(p=>!locked.includes(p));
 for(const pos of new Set(open.filter(s=>s!=='FLEX'))){
  const needed=open.filter(s=>s===pos).length;
  if(unlocked.filter(p=>p.pos===pos).length<needed)throw Error(`Not enough eligible ${pos} players; need ${needed}.`);
 }
 if(unlocked.filter(p=>['RB','WR','TE'].includes(p.pos)).length<open.filter(s=>['RB','WR','TE','FLEX'].includes(s)).length)throw Error('Not enough eligible RB/WR/TE players including FLEX.');
 const imported=pool.some(p=>p.source==='dk');
 const group=p=>imported?p.game:p.team;
 if(new Set(available.map(group)).size<2)throw Error('Eligible players must span at least two games (two teams in demo mode).');
 if((rules.stackCount||rules.bringBack||rules.avoidOpposingDST)&&available.some(p=>!p.game))throw Error('Stacking requires game information. Import DraftKings salaries or reload demo players.');
 if(!canCompleteStack(locked,open,available,rules))throw Error('Locked players cannot satisfy the QB stack, bring-back, or opposing DST rule. Adjust locks or stacking settings.');
 const candidates=open.map(slot=>unlocked.filter(p=>eligible(p,slot)));
 const projection=p=>p.proj+(bonuses.get(identity(p))||0);
 // Salary units remain exact even for non-$100 salaries.
 const gcd=(a,b)=>b?gcd(b,a%b):a;
 const unit=available.reduce((n,p)=>gcd(n,p.salary),50000);
 const budget=(50000-lockedSalary)/unit;
 const suffix=Array(open.length+1);
 suffix[open.length]=new Float64Array(budget+1);
 for(let depth=open.length-1;depth>=0;depth--){
  const bestAtSalary=new Map();
  for(const p of candidates[depth]){
   const cost=p.salary/unit;
   if(!bestAtSalary.has(cost)||bestAtSalary.get(cost)<projection(p))bestAtSalary.set(cost,projection(p));
  }
  const values=new Float64Array(budget+1);values.fill(-Infinity);
  for(const [cost,points] of bestAtSalary){
   for(let b=cost;b<=budget;b++)values[b]=Math.max(values[b],points+suffix[depth+1][b-cost]);
  }
  suffix[depth]=values;
 }
 if(suffix[0][budget]===-Infinity)throw Error('No lineup fits the $50,000 salary cap with these selections.');
 const priorSets=avoid.map(l=>new Set(l.map(identity)));
 const maxShared=9-minUnique;
 const baseOverlaps=priorSets.map(set=>locked.filter(p=>set.has(identity(p))).length);
 if(baseOverlaps.some(n=>n>maxShared))return {lineups:[],examined:0,limited:false};
 const baseScore=locked.reduce((s,p)=>s+projection(p),0);
 let beam=[{players:locked.slice(),used:new Set(locked.map(identity)),salary:lockedSalary,score:baseScore,bound:baseScore+suffix[0][budget],last:-1,overlaps:baseOverlaps}];
 let examined=0,pruned=false;
 // A min-heap keeps only the strongest partial lineups without sorting
 // every candidate expansion. Tie-breaking is stable and deterministic.
 const better=(a,b)=>a.bound>b.bound||(a.bound===b.bound&&(a.score>b.score||(a.score===b.score&&a.salary<b.salary)));
 for(let depth=0;depth<open.length;depth++){
  const heap=[];
  function retain(state){
   if(heap.length>=beamWidth){
    pruned=true;
    if(!better(state,heap[0]))return;
    heap[0]=state;
    let i=0;
    while(true){let j=i*2+1;if(j>=heap.length)break;
     if(j+1<heap.length&&better(heap[j],heap[j+1]))j++;
     if(!better(heap[i],heap[j]))break;
     [heap[i],heap[j]]=[heap[j],heap[i]];i=j;
    }
   }else{
    heap.push(state);let i=heap.length-1;
    while(i>0){const j=(i-1)>>1;if(!better(heap[j],heap[i]))break;
     [heap[i],heap[j]]=[heap[j],heap[i]];i=j;
    }
   }
  }
  const seen=new Set();
  for(const state of beam){
   for(let index=0;index<candidates[depth].length;index++){
    const p=candidates[depth][index];examined++;
    if(depth>0&&open[depth]===open[depth-1]&&index<=state.last)continue;
    const id=identity(p);if(state.used.has(id))continue;
    const salary=state.salary+p.salary;
    if(salary>50000)continue;
    const future=suffix[depth+1][(50000-salary)/unit];
    if(future===-Infinity)continue;
    const score=state.score+projection(p),bound=score+future;
    if(heap.length>=beamWidth&&!better({bound,score,salary},heap[0])){pruned=true;continue}
    const overlaps=priorSets.map((set,i)=>state.overlaps[i]+Number(set.has(id)));
    if(overlaps.some(n=>n>maxShared))continue;
    const players=[...state.players,p];
    if(!canCompleteStack(players,open.slice(depth+1),available,rules))continue;
    const groups=new Set(players.map(group));
    if(groups.size<2&&!candidates.slice(depth+1).some(list=>list.some(next=>!state.used.has(identity(next))&&identity(next)!==id&&group(next)!==group(p))))continue;
    const fingerprint=key(players);if(seen.has(fingerprint))continue;
    seen.add(fingerprint);
    if(depth===open.length-1&&(validate(players,pool,{now}).length||stackErrors(players,rules).length))continue;
    retain({players,used:new Set([...state.used,id]),salary,score,bound,last:index,overlaps});
   }
  }
  beam=heap;
  if(!beam.length)break;
 }
 const lineups=beam.filter(s=>s.players.length===9&&!validate(s.players,pool,{now}).length&&!stackErrors(s.players,rules).length)
  .sort((a,b)=>b.score-a.score||a.salary-b.salary).slice(0,count).map(s=>order(s.players));
 return {lineups,examined,limited:pruned};
}

// Select a portfolio, then repeat the bounded search with overlap constraints
// against every accepted lineup. This finds alternatives beyond near-identical
// variations among the highest raw scores. Locks always remain in every lineup.
function generate(pool,count,options={}){
 const rules=readRules(options),{minUnique}=rules;
 if(!Number.isInteger(count)||count<1||count>150)throw Error('Choose between 1 and 150 lineups.');
 const quotas=new Map();
 for(const p of pool){
  const {min,max}=exposureFor(p,rules);
  if(p.excluded&&min>0)throw Error(`${p.name}: an excluded player cannot have minimum exposure.`);
  const low=Math.ceil(min*count/100),high=Math.floor(max*count/100);
  if(low>high)throw Error(`${p.name}: exposure percentages cannot be met with ${count} lineups. Widen the range or change the lineup count.`);
  quotas.set(identity(p),{low,high});
 }
 const hasExposure=[...quotas.values()].some(q=>q.low>0||q.high<count);
 if(minUnique===1&&!hasExposure)return search(pool,count,{...options,rules});
 if(count>1&&minUnique>1&&pool.filter(p=>p.locked).length>9-minUnique)throw Error(`Too many locked players for ${minUnique} different players per lineup. Reduce locks or the minimum difference.`);
 const lineups=[],usage=new Map();
 let examined=0,limited=false,rounds=0;
 const deadline=Date.now()+15000;
 const maxRounds=Math.max(30,count);
 const maxProjection=Math.max(1,...pool.filter(p=>Number.isFinite(p.proj)).map(p=>Math.abs(p.proj)));
 while(lineups.length<count&&rounds<maxRounds&&Date.now()<deadline){
  const remaining=count-lineups.length,blocked=new Set(),required=new Set(),bonuses=new Map();
  for(const p of pool){
   const id=identity(p),{low,high}=quotas.get(id),used=usage.get(id)||0;
   if(used>=high)blocked.add(id);
   const deficit=Math.max(0,low-used);
   if(deficit>=remaining&&deficit>0)required.add(id);
   if(deficit>0)bonuses.set(id,(maxProjection*2+1)*deficit/remaining);
  }
  let result;
  try{result=search(pool,remaining,{...options,rules,minUnique,avoid:lineups,blocked,required,bonuses})}
  catch(error){if(!lineups.length)throw error;break}
  examined+=result.examined;limited=limited||result.limited;rounds++;
  let added=0;
  for(const lineup of result.lineups){
   const ids=new Set(lineup.map(identity));
   if(!lineups.every(previous=>previous.filter(p=>ids.has(identity(p))).length<=9-minUnique))continue;
   const after=count-lineups.length-1;
   let feasible=true;
   for(const [id,{low,high}] of quotas){
    const next=(usage.get(id)||0)+Number(ids.has(id));
    if(next>high||low-next>after){feasible=false;break}
   }
   if(!feasible)continue;
   lineups.push(lineup);added++;
   for(const id of ids)usage.set(id,(usage.get(id)||0)+1);
   if(lineups.length===count)break;
  }
  if(!added)break;
 }
 if(rounds===maxRounds||Date.now()>=deadline)limited=true;
 lineups.sort((a,b)=>b.reduce((s,p)=>s+p.proj,0)-a.reduce((s,p)=>s+p.proj,0));
 // Caps and minimums describe percentages of the actual returned set. Never
 // return a short portfolio that silently violates them using the request size.
 const errors=validatePortfolio(lineups,pool,{...options,...rules});
 if(errors.length)throw Error('Could not build a set meeting all exposure and stacking rules. Increase maximum exposure, reduce minimum exposure/difference, or request fewer lineups. '+errors.slice(0,3).join(' '));
 return {lineups,examined,limited};
}

const api={slots,eligible,key,order,validate,exportCSV,importRows,generate,validatePortfolio};
if(typeof module==='object'&&module.exports)module.exports=api;else root.Classic=api;
})(typeof globalThis!=='undefined'?globalThis:this);

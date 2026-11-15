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
function exportCSV(lineups,pool){
 if(!lineups.length)throw Error('Generate lineups first.');
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
 const cols={name:col('Name','Player Name'),pos:col('Position'),salary:col('Salary'),team:col('TeamAbbrev','Team','Team Abbrev'),dkId:col('ID','Player ID'),game:col('Game Info'),roster:col('Roster Position'),avg:col('AvgPointsPerGame','Avg Points Per Game')};
 for(const field of ['name','pos','salary','team','dkId','game','roster'])if(cols[field]===undefined)throw Error(`Missing ${field} column. Import a DraftKings NFL Classic salaries CSV.`);
 const ids=new Set(),names=new Set();
 const players=rows.slice(1).map((row,i)=>{
  const get=k=>(row[cols[k]]||'').trim();
  const p={id:i+1,dkId:get('dkId'),name:get('name'),pos:get('pos').toUpperCase().replace(/^(D|DEF)$/,'DST'),team:get('team').toUpperCase(),salary:Number(get('salary').replace(/[$,]/g,'')),proj:Number(get('avg'))||0,source:'dk',locked:false,excluded:false};
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
const api={slots,eligible,key,order,validate,exportCSV,importRows};
if(typeof module==='object'&&module.exports)module.exports=api;else root.Classic=api;
})(typeof globalThis!=='undefined'?globalThis:this);

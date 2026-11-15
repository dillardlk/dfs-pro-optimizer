(function(root){
'use strict';
const nameKey=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z0-9]/g,'');
const teamKey=value=>{const code=String(value||'').trim().toUpperCase();return {JAC:'JAX',LA:'LAR',STL:'LAR',SD:'LAC',OAK:'LV',WSH:'WAS'}[code]||code};
const header=value=>String(value).trim().toLowerCase().replace(/[^a-z0-9]/g,'');
function plan(rows,pool,engine,{slotAdjusted=false,keepManual=true,matchBy='auto'}={}){
 if(!['auto','name'].includes(matchBy))throw Error('Unknown projection matching mode.');
 if(!pool.length)throw Error('Import the matching DraftKings salaries first.');
 if(rows.length<2)throw Error('Projection CSV contains no player rows.');
 const headings=rows[0].map(header),col=(...names)=>names.map(n=>headings.indexOf(header(n))).find(i=>i>=0);
 const idCol=col('ID','DK ID','DraftKings ID','Player ID'),nameIdCol=col('Name + ID');
 const nameCol=col('Name','Player Name','Player'),teamCol=col('Team','TeamAbbrev','Team Abbrev'),posCol=col('Position','Pos');
 const pointsCol=col('Projection','Projected Points','Projected Fantasy Points','Proj','FPTS','FantasyPointsDraftKings');
 const roleCol=col('Roster Position','Roster Slot','Slot');
 if(pointsCol===undefined)throw Error('Missing Projection column. Use the downloadable template or a Projection/Projected Points/FPTS column.');
 if((matchBy==='name'||(idCol===undefined&&nameIdCol===undefined))&&(nameCol===undefined||teamCol===undefined))throw Error('Include DK ID or Name + ID, or both Name and Team columns.');
 const byId=new Map(pool.filter(p=>p.dkId).map(p=>[p.dkId,p]));
 const groups=new Map();
 for(const p of pool){const id=engine.identity(p);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(p)}
 const byNameTeam=new Map();
 for(const entries of groups.values()){
  const p=entries[0],key=nameKey(p.name)+'|'+teamKey(p.team);
  if(!byNameTeam.has(key))byNameTeam.set(key,[]);byNameTeam.get(key).push(entries);
 }
 const updates=new Map();let unmatchedRows=0,duplicateRows=0,preservedPlayers=0;
 for(const [i,row] of rows.slice(1).entries()){
  const cell=column=>column===undefined?'':String(row[column]??'').trim();
  const role=cell(roleCol).toUpperCase();
  let target=null;
  const byName=matchBy==='name'||(idCol===undefined&&nameIdCol===undefined);
  if(!byName){
   const id=idCol!==undefined?cell(idCol):(cell(nameIdCol).match(/\((\d+)\)\s*$/)?.[1]||'');
   target=byId.get(id)||null;
  }else{
   const position=cell(posCol).toUpperCase().replace(/^(D|DEF)$/,'DST').replace(/^PK$/,'K');
   const matches=(byNameTeam.get(nameKey(cell(nameCol))+'|'+teamKey(cell(teamCol)))||[]).filter(entries=>!position||entries.some(p=>p.pos===position));
   if(matches.length>1)throw Error(`Row ${i+2}: ambiguous player name. Use the exact DK ID.`);
   if(matches.length)target=matches[0].find(p=>p.rosterSlot===(role||'FLEX'))||matches[0][0];
  }
  if(!target){unmatchedRows++;continue}
  const raw=cell(pointsCol),value=Number(raw);
  if(role&&target.rosterSlot&&role!==target.rosterSlot)throw Error(`Row ${i+2}: roster slot does not match this DK ID.`);
  if(slotAdjusted&&engine.format==='showdown'&&byName&&!role)throw Error(`Row ${i+2}: slot-adjusted Showdown projections require a DK ID or Roster Position.`);
  let multiplier=slotAdjusted?(target.projectionMultiplier||1):1;
  if(slotAdjusted&&role==='CPT'&&byName)multiplier=1.5;
  const base=value/multiplier;
  if(!raw||!Number.isFinite(base)||Math.abs(base)>1000)throw Error(`Row ${i+2}: projection must be a finite base value between -1000 and 1000. Zero is allowed.`);
  const id=engine.identity(target),previous=updates.get(id);
  if(previous){if(Math.abs(previous.base-base)>1e-8)throw Error(`Row ${i+2}: conflicting projections for ${target.name}. CPT/FLEX rows must agree after the multiplier.`);duplicateRows++;continue}
  updates.set(id,{base,entries:groups.get(id)});
 }
 if(!updates.size)throw Error('No projection rows matched this player pool. Check the slate’s DK IDs, or use Name and Team.');
 const changes=[];
 for(const update of updates.values()){
  if(keepManual&&update.entries.some(p=>p.projectionOverride!==undefined&&p.projectionOverrideSource!=='Projection CSV')){preservedPlayers++;continue}
  changes.push(update);
 }
 return {changes,matchedPlayers:updates.size,changedPlayers:changes.length,preservedPlayers,unmatchedRows,duplicateRows};
}
function apply(result){
 for(const {base,entries} of result.changes)for(const p of entries){
  p.projectionOverride=base*(p.projectionMultiplier||1);p.proj=p.projectionOverride;p.projectionOverrideSource='Projection CSV';
 }
 return result;
}
function csvCell(value){
 let text=String(value);
 if(typeof value==='string'&&/^[=+\-@\t\r]/.test(text))text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
function template(pool,engine){
 if(!pool.length||pool.some(p=>!p.dkId))throw Error('Import official DraftKings salaries before downloading a projection template.');
 const unique=new Map();
 for(const p of pool){const id=engine.identity(p);if(!unique.has(id)||p.rosterSlot==='FLEX')unique.set(id,p)}
 const rows=[['ID','Name','Team','Position','Projection'],...[...unique.values()].map(p=>[p.dkId,p.name,p.team,p.pos,Number((p.proj/(p.projectionMultiplier||1)).toFixed(4))])];
 return rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
}
const api={plan,apply,template};
if(typeof module==='object'&&module.exports)module.exports=api;else root.ProjectionCSV=api;
})(typeof globalThis!=='undefined'?globalThis:this);

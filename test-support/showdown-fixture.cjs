module.exports=function showdownRows(perTeam=8){
 const rows=[['Position','Name','ID','Roster Position','Salary','Game Info','TeamAbbrev','AvgPointsPerGame','Status']];
 let id=88000000;
 for(const team of ['KC','BUF'])for(let i=0;i<perTeam;i++){
  const pos=['QB','RB','WR','WR','TE','K','DST','QB'][i%8];
  const salary=3000+i*400;
  for(const slot of ['CPT','FLEX'])rows.push([pos,`${team} Player ${i}`,String(++id),slot,String(salary*(slot==='CPT'?1.5:1)),'KC@BUF 12/01/2099 08:20PM ET',team,String(20-i),'']);
 }
 return rows;
};

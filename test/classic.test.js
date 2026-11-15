const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Classic=require('../public/classic');
const headers=['Position','Name','ID','Roster Position','Salary','Game Info','TeamAbbrev','AvgPointsPerGame'];
const positions=['QB','RB','RB','WR','WR','WR','TE','RB','DST'];
const rows=()=>[[...headers],...positions.map((pos,i)=>[pos,`Player ${i}`,`${100000+i}`,['RB','WR','TE'].includes(pos)?`${pos}/FLEX`:pos,'5000',i%2?'BUF@NYJ 11/22/2099 01:00PM ET':'KC@DEN 11/22/2099 04:25PM ET',i%2?'BUF':'KC','12'])];
const pool=()=>Classic.importRows(rows());
test('valid NFL Classic roster is assigned to nine export slots using exact imported IDs',()=>{
 const p=pool();
 assert.deepEqual(Classic.validate(p,p),[]);
 const csv=Classic.exportCSV([[...p].reverse()],p).split('\r\n');
 assert.equal(csv[0],'QB,RB,RB,WR,WR,WR,TE,FLEX,DST');
 const ordered=Classic.order([...p].reverse());
 assert.deepEqual(csv[1].split(','),ordered.map(p=>p.dkId));
 ordered.forEach((p,i)=>assert.ok(Classic.eligible(p,Classic.slots[i])));
});
test('salary cap boundary and malformed salaries',()=>{
 const p=pool();p[0].salary=10000;
 assert.deepEqual(Classic.validate(p,p),[]);
 p[0].salary++;
 assert.match(Classic.validate(p,p).join(' '),/50,000/);
 p[0].salary=NaN;
 assert.match(Classic.validate(p,p).join(' '),/salary/);
});
test('duplicate player IDs and duplicate lineups across slot permutations are rejected',()=>{
 const p=pool();
 assert.throws(()=>Classic.exportCSV([p,[...p].reverse()],p),/Duplicate lineup/);
 const duplicate=[...p];duplicate[7]={...p[1]};
 assert.match(Classic.validate(duplicate,p).join(' '),/more than once/);
});
test('roster, locks, exclusions, slate membership and two-game rule are enforced',()=>{
 const p=pool();
 assert.match(Classic.validate(p.slice(1),p).join(' '),/exactly 9/);
 p[0].pos='WR';assert.match(Classic.validate(p,p).join(' '),/Required roster/);p[0].pos='QB';
 p[1].excluded=true;assert.match(Classic.validate(p,p).join(' '),/excluded/);p[1].excluded=false;
 const extra={...p[1],id:99,dkId:'999',locked:true};
 assert.match(Classic.validate(p,[...p,extra]).join(' '),/missing a locked/);
 assert.match(Classic.validate(p,p.slice(1)).join(' '),/current slate/);
 p.forEach(x=>x.game='one');assert.match(Classic.validate(p,p).join(' '),/two different games/);
});
test('demo lineups and missing DK IDs cannot be exported',()=>{
 const p=pool();p.forEach(x=>{delete x.source;delete x.dkId});
 assert.throws(()=>Classic.exportCSV([p],p),/Demo players cannot/);
 const real=pool();real[0].dkId='';
 assert.throws(()=>Classic.exportCSV([real],real),/player IDs/);
 assert.throws(()=>Classic.exportCSV([],real),/Generate/);
});
test('imports reject duplicate IDs, duplicate players, unsupported formats and malformed slate data',()=>{
 let r=rows();r[2][2]=r[1][2];assert.throws(()=>Classic.importRows(r),/Duplicate player/);
 r=rows();r[3][1]=r[1][1];assert.throws(()=>Classic.importRows(r),/Duplicate player/);
 r=rows();r[1][3]='CPT';assert.throws(()=>Classic.importRows(r),/not NFL Classic/);
 r=rows();r[1][0]='CPT';assert.throws(()=>Classic.importRows(r),/Only NFL Classic/);
 r=rows();r[1][4]='5000.25';assert.throws(()=>Classic.importRows(r),/Invalid salary/);
 r=rows();r[1][6]='DAL';assert.throws(()=>Classic.importRows(r),/Game Info/);
 r=rows();r.forEach((x,i)=>{if(i){x[5]='KC@DEN 11/22/2099 04:25PM ET';x[6]='KC'}});
 assert.throws(()=>Classic.importRows(r),/two games/);
 r=rows();r[0][2]='Other';assert.throws(()=>Classic.importRows(r),/Missing dkId/);
 r=rows();r.splice(2,1);assert.throws(()=>Classic.importRows(r),/lacks enough/);
});
function browser(){
 const elements=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',innerHTML:'',addEventListener(event,fn){this[event]=fn}});return elements.get(id)};
 const context=vm.createContext({Classic,document:{getElementById:get},console,Math,Number,Set,Map,Blob,URL,setTimeout,alert:()=>{}});
 const html=fs.readFileSync('public/index.html','utf8');
 vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
 return {context,get,run:s=>vm.runInContext(s,context)};
}
test('browser CSV parser handles BOM, CRLF, embedded commas, quotes and newlines',()=>{
 const b=browser();
 assert.equal(JSON.stringify(b.run('parseCSV("\\uFEFFName,ID\\r\\n\\"A, B\\",123\\r\\n\\"C\\"\\"D\\nE\\",456")')),JSON.stringify([['Name','ID'],['A, B','123'],['C"D\nE','456']]));
 assert.throws(()=>b.run('parseCSV(\'"unclosed\')'),/unclosed quote/);
});
test('generator creates unique valid ordered lineups and selections invalidate them',()=>{
 const b=browser();b.context.fixture=pool();b.get('num').value='2';
 b.run('pool=fixture;generate()');
 assert.equal(b.run('lineups.length'),1);
 assert.deepEqual(Classic.validate(b.run('lineups[0]'),b.context.fixture),[]);
 assert.equal(b.get('generated').textContent,1);
 b.get('players').change({target:{dataset:{id:'1',action:'exclude'},checked:true}});
 assert.equal(b.run('lineups.length'),0);
 assert.equal(b.get('generated').textContent,'0');
 b.run('generate()');assert.equal(b.run('lineups.length'),0);
});
test('generation shows explicit invalid-lock errors and demo resets generated count',()=>{
 const b=browser();b.get('num').value='1';b.context.fixture=pool();
 b.run('pool=fixture;pool.forEach(p=>{p.locked=true;p.salary=6000});generate()');
 assert.match(b.get('results').textContent,/Locked players exceed/);
 b.get('mock').click();assert.equal(b.get('generated').textContent,'0');
});
test('game timestamps use Eastern time in winter and summer, reject invalid dates, and block started games',()=>{
 let r=rows();r.slice(1).forEach(x=>{x[5]=x[5].replace('11/22/2099','01/22/2099')});
 let p=Classic.importRows(r);
 assert.equal(new Date(p[1].startsAt).getUTCHours(),18);
 r=rows();r.slice(1).forEach(x=>{x[5]=x[5].replace('11/22/2099','07/22/2099')});
 p=Classic.importRows(r);assert.equal(new Date(p[1].startsAt).getUTCHours(),17);
 assert.match(Classic.validate(p,p,{now:Date.UTC(2100,0,1)}).join(' '),/game has started/);
 r=rows();r[1][5]='KC@DEN 02/30/2099 04:25PM ET';assert.throws(()=>Classic.importRows(r),/Invalid game date/);
});
test('actual import handler preserves DK IDs and projections handler updates the imported pool',async()=>{
 const b=browser();
 b.get('csvFile').files=[{name:'DKSalaries.csv',text:async()=>rows().map(r=>r.join(',')).join('\r\n')}];
 await b.get('importCSV').click();
 assert.equal(b.run('pool[0].dkId'),'100000');
 assert.match(b.get('csvStatus').textContent,/Imported 9/);
 b.context.fetch=async()=>({ok:true,json:async()=>[{Name:'Player 0',Team:'KC',Position:'QB',FantasyPointsDraftKings:25}]});
 await b.get('projections').click();
 assert.equal(b.run('pool[0].proj'),25);
 assert.equal(b.run('pool[0].dkId'),'100000');
 assert.equal(b.run('lineups.length'),0);
 assert.match(b.get('status').textContent,/matched 1 of 9/);
 b.context.fetch=async()=>({ok:false,json:async()=>({error:'SportsDataIO API key not configured'})});
 await b.get('projections').click();
 assert.match(b.get('status').textContent,/Projection loading failed/);
});

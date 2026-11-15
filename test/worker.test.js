const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');
const path=require('node:path');
const Classic=require('../public/classic');
// Run the shipped browser worker in a real separate thread. The adapter only
// supplies importScripts/postMessage; the optimizer scripts run unchanged.
function worker(){
 return new Worker(`
  const {parentPort,workerData}=require('node:worker_threads');
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const sandbox={self:{postMessage:data=>parentPort.postMessage(data)}};
  const context=vm.createContext(sandbox);
  sandbox.importScripts=url=>vm.runInContext(fs.readFileSync(path.join(workerData,url),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(workerData,'optimizer-worker.js'),'utf8'),context);
  parentPort.on('message',data=>sandbox.self.onmessage({data}));
 `,{eval:true,workerData:path.resolve(__dirname,'../public')});
}
function request(w,data){return new Promise((resolve,reject)=>{w.once('message',resolve);w.once('error',reject);w.postMessage(data)})}
test('background worker returns original player IDs that map to valid exportable lineups',async t=>{
 const w=worker();t.after(()=>w.terminate());
 const p=['QB','RB','RB','WR','WR','WR','TE','RB','DST'].map((pos,i)=>({id:i+1,dkId:String(10000+i),name:`Player ${i}`,pos,team:i%2?'KC':'BUF',game:i%2?'one':'two',salary:5000,proj:10+i,source:'dk',startsAt:Date.UTC(2099,0,1)}));
 const result=await request(w,{pool:p,count:10});
 assert.equal(result.error,undefined);assert.equal(result.lineups.length,1);
 const mapped=result.lineups.map(l=>l.map(id=>p.find(p=>p.id===id)));
 assert.deepEqual(Classic.validate(mapped[0],p),[]);
 assert.equal(Classic.exportCSV(mapped,p).split('\r\n').length,2);
 const badDifference=await request(w,{pool:p,count:10,minUnique:10});
 assert.match(badDifference.error,/Minimum different players/);
 const invalid=await request(w,{pool:p,count:151});
 assert.match(invalid.error,/1 and 150/);
});
test('worker enforces exposure, stacking and player differences together',async t=>{
 const w=worker();t.after(()=>w.terminate());
 const p=[];
 for(const team of ['KC','DEN','BUF','NYJ'])for(const pos of ['QB','RB','RB','RB','WR','WR','WR','WR','TE','TE','DST']){
  const id=p.length+1;
  p.push({id,dkId:String(400000+id),name:`${team} ${id}`,team,pos,game:['KC','DEN'].includes(team)?'KC|DEN':'BUF|NYJ',salary:5000,proj:10+id/10,source:'dk',startsAt:Date.UTC(2099,0,1)});
 }
 const settings={minUnique:2,globalMaxExposure:75,stackCount:1,bringBack:true,avoidOpposingDST:true};
 const result=await request(w,{pool:p,count:4,...settings});
 assert.equal(result.error,undefined);assert.equal(result.lineups.length,4);
 const mapped=result.lineups.map(l=>l.map(id=>p.find(p=>p.id===id)));
 assert.deepEqual(Classic.validatePortfolio(mapped,p,settings),[]);
 assert.equal(Classic.exportCSV(mapped,p,settings).split('\r\n').length,5);
});
test('background worker dispatches Showdown and returns valid six-slot export IDs',async t=>{
 const w=worker();t.after(()=>w.terminate());
 const p=Classic.Showdown.importRows(require('../test-support/showdown-fixture.cjs')());
 const result=await request(w,{pool:p,count:10,contestFormat:'showdown',minUnique:2,globalMaxExposure:60});
 assert.equal(result.error,undefined);assert.equal(result.lineups.length,10);
 const mapped=result.lineups.map(l=>l.map(id=>p.find(p=>p.id===id)));
 assert.deepEqual(Classic.Showdown.validatePortfolio(mapped,p,{minUnique:2,globalMaxExposure:60}),[]);
 assert.match(Classic.Showdown.exportCSV(mapped,p,{minUnique:2,globalMaxExposure:60}),/^CPT,FLEX,FLEX,FLEX,FLEX,FLEX\r\n/);
});

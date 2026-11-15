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
 const invalid=await request(w,{pool:p,count:151});
 assert.match(invalid.error,/1 and 150/);
});

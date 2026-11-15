const {test}=require('node:test');
const assert=require('node:assert/strict');
const Slates=require('../public/slates');
const Classic=require('../public/classic');
const rows=require('../test-support/showdown-fixture.cjs');
const base={Operator:'DraftKings',SalaryCap:50000,SlateID:1,OperatorName:'Main',SlateRosterSlots:Classic.slots,NumberOfGames:2,DfsSlatePlayers:[]};
test('slate catalog filters supported DraftKings formats and classifies Main/Early/Late and Showdown',()=>{
 const data=[base,{...base,SlateID:2,OperatorName:'Early'},{...base,SlateID:3,OperatorName:'Late'},{...base,SlateID:4,OperatorName:'KC @ BUF',OperatorGameType:'Showdown Captain Mode',SlateRosterSlots:Classic.Showdown.slots,NumberOfGames:1},{...base,Operator:'FanDuel'},{...base,RemovedByOperator:true},{...base,SlateRosterSlots:['T1','T2']},{...base,OperatorGameType:'NFL In-Game Showdown H2',SlateRosterSlots:Classic.Showdown.slots}];
 const slates=Slates.normalize(data);assert.equal(slates.length,4);assert.deepEqual(slates.map(s=>s.type),['main','early','late','single']);
 assert.throws(()=>Slates.normalize({}),/Unexpected slate response/);
});
test('provider slate player IDs and salaries must match the entire imported pool',()=>{
 const pool=Classic.Showdown.importRows(rows());
 const [meta]=Slates.normalize([{...base,OperatorName:'KC @ BUF',SlateRosterSlots:Classic.Showdown.slots,NumberOfGames:1,DfsSlatePlayers:pool.map(p=>({OperatorSlatePlayerID:p.dkId,OperatorSalary:p.salary}))}]);
 assert.equal(Slates.validatePool(pool,{format:'showdown'},meta).providerIDsVerified,true);
 pool[0].salary++;
 assert.throws(()=>Slates.validatePool(pool,{format:'showdown'},meta),/does not match.*IDs and salaries/);
});
test('metadata-only slates remain usable but do not claim ID verification, and check game/time',()=>{
 const pool=Classic.Showdown.importRows(rows());
 const [meta]=Slates.normalize([{...base,OperatorName:'KC @ BUF',SlateRosterSlots:Classic.Showdown.slots,NumberOfGames:1,OperatorStartTime:'2099-12-01T20:20:00'}]);
 assert.equal(Slates.validatePool(pool,{format:'showdown'},meta).providerIDsVerified,false);
 assert.throws(()=>Slates.validatePool(pool,{format:'showdown'},{...meta,name:'IND @ HOU'}),/teams do not match/);
 assert.throws(()=>Slates.validatePool(pool,{format:'showdown'},{...meta,start:'2099-12-02T20:20:00'}),/kickoff does not match/);
});
test('early/late import windows reject a broad file instead of reusing another slate’s IDs',()=>{
 const early=Date.parse('2099-12-01T18:00:00Z'),late=Date.parse('2099-12-01T21:25:00Z');
 assert.equal(Slates.validatePool([{startsAt:early}],{slateType:'early'}).providerIDsVerified,false);
 assert.doesNotThrow(()=>Slates.validatePool([{startsAt:late}],{slateType:'late'}));
 assert.throws(()=>Slates.validatePool([{startsAt:early},{startsAt:late}],{slateType:'early'}),/official DraftKings early-slate file/);
 assert.throws(()=>Slates.validatePool([{startsAt:early}],{slateType:'late'}),/outside the late window/);
});

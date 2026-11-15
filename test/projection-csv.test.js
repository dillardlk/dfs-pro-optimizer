const {test}=require('node:test');
const assert=require('node:assert/strict');
const Classic=require('../public/classic');
const Import=require('../public/projection-csv');
const Profiles=require('../public/profiles');
const sdRows=require('../test-support/showdown-fixture.cjs');
const pool=()=>Classic.Showdown.importRows(sdRows());
test('projection imports prefer exact DK IDs, preserve zero and negatives, and never change salaries',()=>{
 const p=pool(),before=p.map(p=>[p.id,p.dkId,p.salary,p.rosterSlot]);
 const rows=[['ID','Projection'],[p[1].dkId,'0'],[p[3].dkId,'-2.5'],['999999','40']];
 const result=Import.plan(rows,p,Classic.Showdown);assert.equal(result.unmatchedRows,1);assert.equal(result.matchedPlayers,2);
 Import.apply(result);assert.equal(p[0].proj,0);assert.equal(p[1].proj,0);assert.equal(p[2].proj,-3.75);assert.equal(p[3].proj,-2.5);
 assert.deepEqual(p.map(p=>[p.id,p.dkId,p.salary,p.rosterSlot]),before);assert.equal(p[1].projectionOverrideSource,'Projection CSV');
});
test('slot-adjusted Captain values are divided once and conflicting duplicate rows fail atomically',()=>{
 const p=pool();const rows=[['ID','Projected Points'],[p[0].dkId,'33'],[p[1].dkId,'22']];
 const plan=Import.plan(rows,p,Classic.Showdown,{slotAdjusted:true});assert.equal(plan.duplicateRows,1);Import.apply(plan);
 assert.equal(p[0].proj,33);assert.equal(p[1].proj,22);
 const before=p.map(p=>p.proj);rows[2][1]='23';
 assert.throws(()=>Import.plan(rows,p,Classic.Showdown,{slotAdjusted:true}),/conflicting projections/);assert.deepEqual(p.map(p=>p.proj),before);
});
test('name/team matching supports aliases and can ignore another provider’s IDs explicitly',()=>{
 const p=pool();p[0].name='José Walker Jr.';p[1].name='José Walker Jr.';p[0].team='JAX';p[1].team='JAX';
 const rows=[['Player ID','Name','Team','FPTS'],['career-id','Jose Walker','JAC','21']];
 assert.throws(()=>Import.plan(rows,p,Classic.Showdown),/No projection rows matched/);
 Import.apply(Import.plan(rows,p,Classic.Showdown,{matchBy:'name'}));assert.equal(p[0].proj,31.5);assert.equal(p[1].proj,21);
});
test('name matches with ambiguous identities require a DK ID, and matched malformed numbers fail',()=>{
 const p=[{id:1,dkId:'1',name:'John Smith',team:'KC',pos:'WR',proj:10},{id:2,dkId:'2',name:'John Smith',team:'KC',pos:'WR',proj:20}];
 assert.throws(()=>Import.plan([['Name','Team','Projection'],['John Smith','KC','25']],p,Classic),/ambiguous/);
 assert.throws(()=>Import.plan([['ID','Projection'],['1','']],p,Classic),/finite base value/);
 assert.throws(()=>Import.plan([['ID','Projection'],['1','Infinity']],p,Classic),/finite base value/);
 assert.equal(p[0].proj,10);
});
test('file imports replace prior imports while the keep-hand-edits setting protects typed values',()=>{
 const p=pool(),rows=[['ID','Projection'],[p[1].dkId,'25']];
 p[0].projectionOverride=40;p[0].proj=40;p[1].projectionOverride=40/1.5;p[1].proj=40/1.5;
 let result=Import.plan(rows,p,Classic.Showdown);assert.equal(result.preservedPlayers,1);assert.equal(result.changedPlayers,0);
 result=Import.plan(rows,p,Classic.Showdown,{keepManual:false});Import.apply(result);assert.equal(p[0].proj,37.5);
 rows[1][1]='26';result=Import.plan(rows,p,Classic.Showdown);assert.equal(result.changedPlayers,1);Import.apply(result);assert.equal(p[0].proj,39);
});
test('template is one base row per person and imports back without Captain inflation',()=>{
 const p=pool(),text=Import.template(p,Classic.Showdown),lines=text.split('\r\n');
 assert.equal(lines.length,17);assert.ok(lines[1].includes('"'+p[1].dkId+'"'));
 const rows=lines.map(line=>line.slice(1,-1).split('","'));
 const result=Import.plan(rows,p,Classic.Showdown);Import.apply(result);assert.equal(p[0].proj,p[1].proj*1.5);
});
test('slot-adjusted name rows require and respect the declared roster role',()=>{
 const p=pool();
 assert.throws(()=>Import.plan([['Name','Team','Projection'],[p[0].name,'KC','30']],p,Classic.Showdown,{slotAdjusted:true}),/require a DK ID or Roster Position/);
 const rows=[['Name','Team','Roster Position','Projection'],[p[0].name,'KC','CPT','30']];
 Import.apply(Import.plan(rows,p,Classic.Showdown,{slotAdjusted:true}));assert.equal(p[0].proj,30);assert.equal(p[1].proj,20);
});
test('CSV source markers and base points survive saved-preset transfers',async()=>{
 const p=pool();Import.apply(Import.plan([['ID','Projection'],[p[1].dkId,'23']],p,Classic.Showdown));
 const profile=await Profiles.capture(p,{...Profiles.controlDefaults,contestFormat:'showdown'},'CSV projections');
 const other=pool();await Profiles.applyPlayers(other,Profiles.parse(JSON.stringify(profile)));
 assert.equal(other[0].proj,34.5);assert.equal(other[1].proj,23);assert.equal(other[1].projectionOverrideSource,'Projection CSV');
});

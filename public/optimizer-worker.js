'use strict';
importScripts('/classic.js');
self.onmessage=({data})=>{
 try{
  const engine=data.contestFormat==='showdown'?Classic.Showdown:Classic;
  const result=engine.generate(data.pool,data.count,{minUnique:data.minUnique??1,globalMaxExposure:data.globalMaxExposure??100,stackCount:data.stackCount??0,bringBack:data.bringBack,avoidOpposingDST:data.avoidOpposingDST});
  self.postMessage({lineups:result.lineups.map(l=>l.map(p=>p.id)),limited:result.limited});
 }catch(error){self.postMessage({error:error.message})}
};

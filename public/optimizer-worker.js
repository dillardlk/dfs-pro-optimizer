'use strict';
importScripts('/classic.js');
self.onmessage=({data})=>{
 try{
  const result=Classic.generate(data.pool,data.count);
  self.postMessage({lineups:result.lineups.map(l=>l.map(p=>p.id)),limited:result.limited});
 }catch(error){self.postMessage({error:error.message})}
};

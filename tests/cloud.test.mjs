
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../dist/engine.js';
globalThis.sessionStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const {cloud}=await import('../dist/cloud.js');
test('Cloud save validates full read-back and refuses mismatch',async()=>{
 const state=initialState();let responseState=state;
 globalThis.fetch=async url=>({ok:true,text:async()=>JSON.stringify(url.includes('/auth/')?{access_token:'test',refresh_token:'test',expires_in:3600,user:{email:'test@example.test'}}:url.includes('/rpc/')?1:[{revision:1,state:responseState}])});
 await cloud.login('test@example.test','test');
 assert.equal(await cloud.save(state,0),1);
 assert.equal(cloud.verification.verifiedSave,true);
 responseState={...state,sourceNotes:['mismatched save']};
 await assert.rejects(()=>cloud.save(state,0),/could not be verified/);
 globalThis.fetch=async()=>({ok:false,text:async()=>JSON.stringify({message:'Another save changed the league.'})});
 await assert.rejects(()=>cloud.save(state,0),/Another save changed/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,playoffSeeds} from '../dist/engine.js';
import {loadConfirmedRoster} from '../dist/roster.js';
import {applySuppliedEnteringAverages,BOWLER_LIST} from '../dist/bowler-averages.js';

test('Entering average migration preserves identities, actuals, history and existing values',()=>{
 const s=loadConfirmedRoster(initialState());
 for(const b of s.bowlers){b.entering=null;delete b.enteringSource;delete b.enteringSourceName;}
 const doug=s.bowlers.find(b=>b.name==='Doug Smith');doug.entering=229;
 s.bowlers[0].history=[{date:'2025-09-01',scores:[200,210,220]}];
 s.results=[{week:1,actual:true,matches:[{players:[{bowlerId:doug.id,scores:[220,240,248],types:['actual','actual','actual']}]}]}];
 const before=structuredClone(s),r=applySuppliedEnteringAverages(s);
 assert.equal(r.updated.length,73);assert.deepEqual(s,before);
 assert.deepEqual(r.state.results,s.results);assert.deepEqual(r.state.teams,s.teams);
 assert.deepEqual(r.state.bowlers.map(b=>[b.id,b.name,b.history]),s.bowlers.map(b=>[b.id,b.name,b.history]));
 assert.equal(r.state.bowlers.find(b=>b.id===doug.id).entering,229);
 assert.equal(r.state.bowlers.find(b=>b.name==='Kayla Wright').entering,182);
 assert.equal(r.state.bowlers.find(b=>b.name==='Ric Kovaleski').entering,182);
 assert.equal(r.state.bowlers.find(b=>b.name==='Jason Koval').entering,166);
 assert.ok(r.state.bowlers.filter(b=>b.team===20).every(b=>b.entering===null));
 assert.ok(r.state.bowlers.filter(b=>b.team===6&&b.name.includes('Johnson')).every(b=>b.entering===null));
 assert.deepEqual(applySuppliedEnteringAverages(r.state).updated,[]);
});
test('Source zero averages remain missing and no summary scores enter actuals',()=>{
 assert.equal(BOWLER_LIST.length,94);
 assert.equal(BOWLER_LIST.find(b=>b.sourceName==='Eisenhaur, Tyler').entering,null);
 const s=initialState();s.bowlers=[{id:'tyler',name:'Tyler Eisenhaur',team:2,entering:null}];
 assert.deepEqual(applySuppliedEnteringAverages(s).updated,[]);
 assert.deepEqual(loadConfirmedRoster(initialState()).results,[]);
});
test('Wildcards use highest season points excluding all locked-in teams',()=>{
 const rows=Array.from({length:20},(_,i)=>({number:i+1,points:600-i*10}));
 const rank=rs=>rs.map(r=>r.number);
 assert.deepEqual(playoffSeeds(rows,[3,6,10,12,15,18],rank),[3,6,10,12,15,18,1,2]);
 assert.deepEqual(playoffSeeds(rows,[3,6,10,3,6,10],rank),[3,6,10,1,2,4,5,7]);
});

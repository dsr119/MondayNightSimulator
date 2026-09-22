import test from 'node:test';
import assert from 'node:assert/strict';
import {sexLeaders} from '../dist/stats.js';
import {initialState} from '../dist/engine.js';
import {loadConfirmedRoster} from '../dist/roster.js';
import {importRoster} from '../dist/imports.js';
const bowler=(id,sex)=>({id,name:id,sex,entering:300,history:[{scores:[300,300,300]}]});
const player=(id,scores,types=['actual','actual','actual'])=>({bowlerId:id,team:1,scores,types});
function fixture(weeks){
 return {bowlers:[bowler('regular','female'),bowler('sub','female'),bowler('man','male'),bowler('unknown',undefined)],results:Array.from({length:weeks},(_,i)=>({week:i+1,actual:true,matches:[{players:[player('regular',[180,190,200]),player('man',[210,220,230]),player('unknown',[300,300,300]),...(i===0?[player('sub',[290,290,290])]:[])]}]}))};
}
test('Before Week 5, substitutes qualify; history and unassigned bowlers do not',()=>{
 const s=fixture(4),f=sexLeaders(s,'female'),m=sexLeaders(s,'male');
 assert.equal(f.minGames,1);assert.equal(f.average.id,'sub');assert.equal(f.average.average,290);
 assert.equal(f.pins.id,'regular');assert.equal(f.pins.pins,2280);
 assert.equal(f.game.high,290);assert.equal(f.series.highSeries,870);
 assert.equal(m.average.id,'man');assert.equal(m.average.average,220);
});
test('Week 5 enforces 10 actual games; partial blinds do not count',()=>{
 const s=fixture(5);s.results.forEach((r,i)=>r.matches[0].players.push(player('boundary',[250,250,250],i<3?['actual','actual','actual']:i===3?['actual','blind','vacancy']:['blind','blind','blind'])));
 s.bowlers.push(bowler('boundary','female'));
 const f=sexLeaders(s,'female');assert.equal(f.minGames,10);assert.equal(f.eligible,2);assert.equal(f.average.id,'boundary');assert.equal(f.average.games,10);
 s.results[3].matches[0].players.at(-1).types[0]='blind';
 assert.equal(sexLeaders(s,'female').average.id,'regular');
 assert.equal(sexLeaders(fixture(6),'female').minGames,12);
});
test('Partial actual sessions have no full series and empty categories have no winner',()=>{
 const s=fixture(1);s.results[0].matches[0].players=[player('sub',[299,300,300],['actual','blind','vacancy'])];
 const f=sexLeaders(s,'female');assert.equal(f.average.average,299);assert.equal(f.pins.pins,299);assert.equal(f.series,null);
 assert.equal(sexLeaders(s,'male').average,null);assert.equal(sexLeaders({bowlers:[],results:[]},'female').eligible,0);
});
test('Roster replacement preserves sex assignments by bowler ID',()=>{
 const s=loadConfirmedRoster(initialState());s.bowlers[0].sex='female';
 const csv='team,team_name,division,slot,bowler_id,bowler,entering\n'+s.teams.flatMap(t=>t.players.map((id,i)=>{const b=s.bowlers.find(b=>b.id===id);return [t.number,t.name,t.division,i+1,id,b.name,b.entering??''].map(v=>JSON.stringify(String(v))).join(',');})).join('\n');
 assert.equal(importRoster(s,csv).bowlers[0].sex,'female');
});

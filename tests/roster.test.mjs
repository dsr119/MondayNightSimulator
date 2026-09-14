import test from 'node:test';import assert from 'node:assert/strict';
import {initialState,validateWorkspace,forecastIssues,profile} from '../dist/engine.js';
import {loadConfirmedRoster} from '../dist/roster.js';
import {scoresTemplate} from '../dist/imports.js';
test('Confirmed roster preserves 20 teams, 96 names and four vacancies',()=>{
 const state=loadConfirmedRoster(initialState());validateWorkspace(state);
 assert.equal(state.teams.length,20);assert.equal(state.bowlers.filter(b=>!b.vacancy).length,96);
 assert.deepEqual(state.bowlers.filter(b=>b.vacancy).map(b=>b.team),[18,20,20,20]);
 assert.deepEqual(state.teams.find(t=>t.number===10).players.map(id=>state.bowlers.find(b=>b.id===id).name),['Jason Koval','Kayla Wright','Ashley Eakle','Christian Kramer','Doug Smith']);
 assert.equal(new Set(state.bowlers.map(b=>b.id)).size,100);
 assert.ok(state.bowlers.every(b=>b.entering===null));
 assert.ok(state.teams.every(t=>t.division===''));
 assert.equal(profile(state,state.bowlers[0]).mean,null);
 assert.equal(forecastIssues(state).filter(i=>i.startsWith('Entering average required:')).length,96);
 assert.throws(()=>loadConfirmedRoster(state),/empty workspace/);
 state.schedule=[{week:1,kind:'regular',pairs:[[18,20]]}];
 const template=scoresTemplate(state,1);assert.equal((template.match(/"vacancy","vacancy","vacancy"/g)||[]).length,4);
});
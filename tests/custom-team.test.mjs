import test from 'node:test';import assert from 'node:assert/strict';
import {initialState,simulate,forecastIssues} from '../dist/engine.js';
import {buildCustomLeague,baselineLeague,homeTeam,openTeamNumber,REPLACEMENT_SPREAD} from '../dist/custom-team.js';
// Nine teams plus a bye; team n bowls 150+10n, except star bowler 1-1 at 240.
function league(){
 const s=initialState();s.rules.assumptionsConfirmed=true;
 for(let n=1;n<=9;n++){const players=[];for(let i=1;i<=5;i++){const id=n+'-'+i;players.push(id);s.bowlers.push({id,name:'Bowler '+id,entering:n===1&&i===1?240:150+10*n,team:n,history:[]});}s.teams.push({number:n,name:'Team '+n,division:'Division '+((n-1)%3+1),players});}
 s.bowlers.push({id:'sub',name:'Sub',entering:180,team:0,history:[]});
 for(let w=1;w<=32;w++)s.schedule.push({week:w,kind:'regular',pairs:[[1,2],[3,4],[5,6],[7,8],[9,0]],lanes:[]});
 return s;
}
test('Custom team takes the bye and each losing team gets a replacement between the leaver and the rest',()=>{
 const s=league(),picks=['1-1','2-1','3-1','4-1','5-1'];
 const c=buildCustomLeague(s,{picks,name:'Dream',division:'Division 2',seed:3});
 assert.equal(c.number,10);
 const team=c.state.teams.find(t=>t.number===10);
 assert.deepEqual([team.name,team.division,team.players],['Dream','Division 2',picks]);
 assert.ok(c.state.schedule.every(w=>w.pairs.some(p=>p[0]===9&&p[1]===10)));
 assert.deepEqual(c.state.results,[]);
 const star=c.replacements.find(r=>r.leaving==='1-1');
 assert.equal(star.leftAverage,240);assert.equal(star.restAverage,160);assert.equal(star.target,200);
 assert.ok(Math.abs(star.average-200)<=REPLACEMENT_SPREAD);
 const one=c.state.teams.find(t=>t.number===1);
 assert.equal(one.players[0],star.id);assert.equal(c.state.bowlers.find(b=>b.id===star.id).entering,star.average);
 assert.ok(c.options.pools[1].some(p=>p.id===star.id)&&!c.options.pools[1].some(p=>p.id==='1-1'));
 assert.deepEqual(c.options.rotating,[]);
 assert.deepEqual(forecastIssues(c.state),[]);
 const r=simulate(c.state,3,1,()=>{},c.options);
 assert.equal(r.teams.length,10);
 assert.equal(sum(r.teams.map(t=>t.playoffs)),8);
 // Same seed, same replacements.
 assert.deepEqual(buildCustomLeague(s,{picks,name:'Dream',division:'Division 2',seed:3}).replacements,c.replacements);
});
const sum=a=>a.reduce((x,y)=>x+y,0);
test('Six picks rotate and only the custom team draws from them',()=>{
 const s=league(),picks=['1-1','1-2','2-1','3-1','4-1','sub'];
 const c=buildCustomLeague(s,{picks,division:'Division 1',seed:1});
 assert.deepEqual(c.options.rotating,[10]);
 assert.equal(c.options.pools[10].length,6);
 assert.equal(c.replacements.filter(r=>r.team===1).length,2);
 assert.equal(c.replacements.some(r=>r.leaving==='sub'),false);
 assert.ok(Object.entries(c.options.pools).every(([n,pool])=>n==='10'||pool.every(p=>!picks.includes(p.id))));
 s.rules.lineupModel='fixed';
 const f=buildCustomLeague(s,{picks,division:'Division 1',seed:1}),r=simulate(f.state,2,5,()=>{},f.options);
 assert.equal(r.teams.length,10);
});
test('Builder rejects bad picks and leagues without a bye',()=>{
 const s=league();
 assert.throws(()=>buildCustomLeague(s,{picks:['1-1','1-1','2-1','3-1','4-1'],division:'Division 1'}),/only once/);
 assert.throws(()=>buildCustomLeague(s,{picks:['1-1','2-1','3-1','4-1'],division:'Division 1'}),/five bowlers/);
 assert.throws(()=>buildCustomLeague(s,{picks:['1-1','2-1','3-1','4-1','5-1'],division:'Division 9'}),/division/);
 s.schedule[4].pairs=[[1,2],[3,4],[5,6],[7,8],[9,0],[0,0]];
 assert.throws(()=>openTeamNumber(s),/Week 5/);
});
test('Subs belong to the team they bowled for most',()=>{
 const p=(team,id,n)=>({team,bowlerId:id,types:Array(3).fill('x').map((_,i)=>i<n?'actual':'blind')});
 const s={teams:[{number:1,players:['a']},{number:2,players:[]}],results:[{matches:[{players:[p(1,'sub',1),p(2,'sub',3)]}]},{matches:[{players:[p(1,'sub',1)]}]}]};
 assert.equal(homeTeam(s,'a'),1);assert.equal(homeTeam(s,'sub'),2);assert.equal(homeTeam(s,'nobody'),null);
});
test('Baseline replays the unchanged league from Week 1',()=>{
 const s=league(),b=baselineLeague(s);
 assert.equal(b.state.teams.length,9);assert.deepEqual(b.state.results,[]);assert.equal(Object.keys(b.options.pools).length,9);
});

import test from 'node:test';import assert from 'node:assert/strict';
import {initialState,scoreMatch,profile,leagueAverage,handicap,random,sum} from '../dist/engine.js';
import {permutations,planLineup,likelyLineup,opponentFor,nextWeek,entersFirst} from '../dist/lineup.js';
// Four teams plus a bye. Team 1 bowls 160–200, team 2 bowls 180–220; one week played.
function league(){
 const s=initialState();s.rules.assumptionsConfirmed=true;
 for(let n=1;n<=4;n++){const players=[];for(let i=1;i<=6;i++){const id=n+'-'+i;if(i<=5)players.push(id);s.bowlers.push({id,name:'Bowler '+id,entering:140+20*n+10*(i-1),team:n,history:[]});}s.teams.push({number:n,name:'Team '+n,division:'A',players});}
 for(let w=1;w<=32;w++)s.schedule.push({week:w,kind:'regular',pairs:w%2?[[1,2],[3,4]]:[[1,3],[2,4]],lanes:[]});
 const lineup=(team,ids)=>ids.map((id,i)=>{const avg=s.bowlers.find(b=>b.id===id).entering;return {team,slot:i+1,bowlerId:id,average:avg,handicap:handicap(avg,s.rules),scores:[avg,avg,avg],types:['actual','actual','actual']};});
 s.results.push({week:1,actual:true,matches:[{teamA:1,teamB:2,players:[...lineup(1,['1-6','1-5','1-4','1-3','1-2']),...lineup(2,['2-1','2-2','2-3','2-4','2-5'])]},{teamA:3,teamB:4,players:[...lineup(3,['3-1','3-2','3-3','3-4','3-5']),...lineup(4,['4-1','4-2','4-3','4-4','4-5'])]}]});
 return s;
}
test('Every pairing of five is considered once',()=>{
 const p=permutations(5);assert.equal(p.length,120);assert.equal(new Set(p.map(String)).size,120);
 assert.ok(p.every(o=>[...o].sort().join()==='0,1,2,3,4'));
});
test('Schedule, likely lineups and Rule 7 entry order',()=>{
 const s=league();
 assert.equal(nextWeek(s),2);assert.equal(opponentFor(s,1,2),3);assert.equal(opponentFor(s,1,3),2);
 // Last night's order first; the sixth bowler is in it, so the unused starter drops out.
 assert.deepEqual(likelyLineup(s,1),['1-6','1-5','1-4','1-3','1-2']);
 assert.equal(entersFirst(s,['1-1','1-2','1-3','1-4','1-5'],['2-1','2-2','2-3','2-4','2-5'],2),'theirs');
 assert.equal(entersFirst(s,['2-1','2-2','2-3','2-4','2-5'],['1-1','1-2','1-3','1-4','1-5'],2),'mine');
});
test('Ranked orders match the 30-point scorer and the best pairing maximises head-to-head points',()=>{
 const s=league(),mine=['1-1','1-2','1-3','1-4','1-5'],theirs=['2-1','2-2','2-3','2-4','2-5'];
 const r=planLineup(s,mine,theirs,2,{nights:6000,seed:7});
 assert.equal(r.orders.length,120);assert.equal(r.entersFirst,'theirs');
 assert.ok(r.orders.every((o,i)=>!i||r.orders[i-1].points>=o.points));
 for(const o of r.orders){assert.ok(Math.abs(o.points-r.teamPoints-o.individual)<1e-9);assert.ok(o.win+o.tie<=1);}
 // Brute force over the pair matrix finds the same best order.
 const at=id=>mine.indexOf(id),score=o=>sum(o.map((i,pos)=>r.pairs[i][pos].points));
 const best=permutations(5).reduce((a,b)=>score(b)>score(a)?b:a);
 assert.deepEqual(r.best.order,best.map(i=>mine[i]));assert.ok(Math.abs(score(r.best.order.map(at))-r.best.individual)<1e-9);
 assert.equal(r.entered.order.join(),mine.join());assert.equal(r.entered.gain,0);
 // An independent replay through scoreMatch agrees on the entered order's expected points.
 const rng=random(99),normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-12,rng())))*Math.cos(2*Math.PI*rng());let total=0;const N=6000;
 for(let n=0;n<N;n++){const shared=normal()*5,players=[];for(const [team,ids] of [[1,mine],[2,theirs]])ids.forEach((id,slot)=>{const p=profile(s,s.bowlers.find(b=>b.id===id)),avg=leagueAverage(s,id,2),night=normal()*8;players.push({team,slot:slot+1,bowlerId:id,average:avg,handicap:handicap(avg,s.rules),types:['actual','actual','actual'],scores:[0,1,2].map(()=>Math.max(0,Math.min(300,Math.round(p.mean+shared+night+normal()*Math.sqrt(Math.max(1,p.sd*p.sd-89))))))});});total+=scoreMatch({teamA:1,teamB:2,players}).points[0];}
 assert.ok(Math.abs(total/N-r.entered.points)<0.25,total/N+' vs '+r.entered.points);
});
test('The planner rejects incomplete or overlapping lineups',()=>{
 const s=league();
 assert.throws(()=>planLineup(s,['1-1','1-2','1-3','1-4'],['2-1','2-2','2-3','2-4','2-5'],2),/five/);
 assert.throws(()=>planLineup(s,['1-1','1-2','1-3','1-4','2-1'],['2-1','2-2','2-3','2-4','2-5'],2),/one spot/);
});

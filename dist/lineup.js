import {leagueAverage,handicap,profile,rotationPool,weekMean,standings,random,sum} from './engine.js';
// Lineup planner: simulate one night between two fives and rank every way of
// pairing them head to head. Position k on one team bowls position k on the other
// (1 point per game each); team game and series points do not depend on the order.
const fail=m=>{throw Error(m);};
export function permutations(n){
 if(n<=1)return [[0]];
 const out=[];for(const p of permutations(n-1))for(let i=0;i<n;i++)out.push([...p.slice(0,i),n-1,...p.slice(i)]);return out;
}
export const nextWeek=state=>{for(let w=1;w<=32;w++)if(!state.results.some(r=>r.week===w))return w;return null;};
// Scheduled opponent; position rounds pair 1v2, 3v4… within the division on that half's standings.
export function opponentFor(state,team,week){
 const s=state.schedule.find(s=>s.week===week);if(!s)return null;
 let pairs=s.pairs;
 if(s.kind==='position'){
  const rows=standings(state,Math.ceil(week/16));pairs=[];
  const groups=state.rules.positionScope==='league'?[rows]:[...new Set(rows.map(r=>r.division))].map(d=>rows.filter(r=>r.division===d));
  for(const g of groups)for(let i=0;i<g.length;i+=2)pairs.push([g[i].number,g[i+1]?.number||0]);
 }
 const p=pairs.find(p=>p.includes(team));return p?(p[0]===team?p[1]:p[0]):null;
}
const usable=(state,id)=>{const b=state.bowlers.find(b=>b.id===id);return b&&!b.vacancy&&Number.isFinite(b.entering);};
// Most recent night's order for the team, topped up from its rotation by how often they bowl.
export function likelyLineup(state,team){
 const t=state.teams.find(t=>t.number===team);if(!t)fail('Unknown team '+team);
 const last=[...state.results].sort((a,b)=>b.week-a.week).flatMap(r=>r.matches).find(m=>m.teamA===team||m.teamB===team);
 const ids=last?last.players.filter(p=>p.team===team&&p.types.some(x=>x==='actual')).sort((a,b)=>a.slot-b.slot).map(p=>p.bowlerId).filter(id=>usable(state,id)):[];
 for(const p of rotationPool(state,t))if(ids.length<5&&!ids.includes(p.id))ids.push(p.id);
 for(const id of t.players)if(ids.length<5&&!ids.includes(id)&&usable(state,id))ids.push(id);
 return ids.slice(0,5);
}
export function bowlerLine(state,id,week){const avg=leagueAverage(state,id,week);return {id,name:state.bowlers.find(b=>b.id===id)?.name||id,average:avg,handicap:handicap(avg,state.rules)};}
export const teamAverage=(state,ids,week)=>sum(ids.map(id=>leagueAverage(state,id,week)));
// Rule 7: the team with the higher team average enters its lineup first.
export function entersFirst(state,mine,theirs,week){const a=teamAverage(state,mine,week),b=teamAverage(state,theirs,week);return a===b?'tie':a>b?'mine':'theirs';}
// mine/theirs: five bowler ids each, theirs in their lane order. Returns every order
// of mine ranked by expected points, with per-pair odds from the same simulated nights.
export function planLineup(state,mine,theirs,week,{nights=10000,seed=20261005,onProgress=()=>{}}={}){
 if(mine.length!==5||theirs.length!==5)fail('Pick five bowlers for each team.');
 const all=[...mine,...theirs];if(new Set(all).size!==10)fail('Each bowler can only be in one spot.');
 for(const id of all)if(!usable(state,id))fail('Unknown or unavailable bowler: '+id);
 if(!Number.isInteger(nights)||nights<100||nights>100000)fail('Choose 100–100,000 nights.');
 const rng=random(seed),normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-12,rng())))*Math.cos(2*Math.PI*rng());
 const lines=all.map(id=>bowlerLine(state,id,week)),models=all.map(id=>{const p=profile(state,state.bowlers.find(b=>b.id===id));return {mu:weekMean(state,p,id,week),noise:Math.sqrt(Math.max(1,p.sd*p.sd-89))};});
 const perms=permutations(5),P=perms.length;
 const pairPts=Array.from({length:5},()=>new Float64Array(5)),pairGames=Array.from({length:5},()=>new Float64Array(5));
 const base=perms.findIndex(o=>o.every((i,k)=>i===k)),dsum=new Float64Array(P),dsq=new Float64Array(P),pts=new Float64Array(P);
 const tot=new Float64Array(P),win=new Float64Array(P),tie=new Float64Array(P),sq=new Float64Array(P);let teamTotal=0;
 const sc=Array.from({length:10},()=>[0,0,0]),night=Array.from({length:5},()=>new Float64Array(5));
 for(let n=0;n<nights;n++){
  const shared=normal()*5;
  for(let i=0;i<10;i++){const m=models[i],day=normal()*8;for(let g=0;g<3;g++)sc[i][g]=Math.max(0,Math.min(300,Math.round(m.mu+shared+day+normal()*m.noise)))+lines[i].handicap;}
  let team=0,sa=0,sb=0;
  for(let g=0;g<3;g++){let a=0,b=0;for(let i=0;i<5;i++){a+=sc[i][g];b+=sc[i+5][g];}sa+=a;sb+=b;team+=a>b?4:a===b?2:0;}
  team+=sa>sb?3:sa===sb?1.5:0;teamTotal+=team;
  for(let i=0;i<5;i++)for(let j=0;j<5;j++){let p=0;for(let g=0;g<3;g++){const x=sc[i][g],y=sc[j+5][g];p+=x>y?1:x===y?.5:0;}night[i][j]=p;pairPts[i][j]+=p;pairGames[i][j]+=p===3?1:0;}
  for(let k=0;k<P;k++){const o=perms[k],p=team+night[o[0]][0]+night[o[1]][1]+night[o[2]][2]+night[o[3]][3]+night[o[4]][4];pts[k]=p;tot[k]+=p;sq[k]+=p*p;if(p>15)win[k]++;else if(p===15)tie[k]++;}
  for(let k=0;k<P;k++){const d=pts[k]-pts[base];dsum[k]+=d;dsq[k]+=d*d;}
  if(n%2000===0)onProgress(n/nights);
 }
 // order[k] = index into mine of the bowler facing theirs[k].
 const orders=perms.map((o,k)=>({order:o.map(i=>mine[i]),points:tot[k]/nights,win:win[k]/nights,tie:tie[k]/nights,sd:Math.sqrt(Math.max(0,sq[k]/nights-(tot[k]/nights)**2)),individual:sum(o.map((i,pos)=>pairPts[i][pos]))/nights,
  // gain over the order as entered, with its standard error (same simulated nights for both)
  gain:dsum[k]/nights,gainError:Math.sqrt(Math.max(0,dsq[k]/nights-(dsum[k]/nights)**2)/nights)}));
 const as=orders[base];
 orders.sort((a,b)=>b.points-a.points||b.win-a.win);
 const pairs=mine.map((id,i)=>theirs.map((jd,j)=>({mine:id,theirs:jd,points:pairPts[i][j]/nights,sweep:pairGames[i][j]/nights})));
 return {week,nights,seed,mine:lines.slice(0,5),theirs:lines.slice(5),teamPoints:teamTotal/nights,orders,entered:as,best:orders[0],worst:orders[orders.length-1],pairs,
  entersFirst:entersFirst(state,mine,theirs,week),teamAverages:[teamAverage(state,mine,week),teamAverage(state,theirs,week)]};
}

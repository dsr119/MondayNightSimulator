
import {sum,mean,scoreMatch} from './engine.js';
export function sessions(state,id){return state.results.slice().sort((a,b)=>a.week-b.week).flatMap(r=>r.matches.flatMap(m=>m.players.filter(p=>p.bowlerId===id).map(p=>({week:r.week,team:p.team,scores:p.scores.filter((g,i)=>p.types[i]==='actual')})))).filter(s=>s.scores.length);}
export function playerStats(state,b){
 const s=sessions(state,b.id),games=s.flatMap(x=>x.scores),avg=games.length?mean(games):null,series=s.filter(s=>s.scores.length===3).map(s=>sum(s.scores)),recent=n=>games.length?mean(games.slice(-n)):null;
 return {id:b.id,name:b.name,entering:b.entering,games:games.length,pins:sum(games),average:avg,improvement:avg===null||!Number.isFinite(b.entering)?null:avg-b.entering,high:games.length?Math.max(...games):null,low:games.length?Math.min(...games):null,highSeries:series.length?Math.max(...series):null,averageSeries:series.length?mean(series):null,sd:games.length>1?Math.sqrt(sum(games.map(g=>(g-avg)**2))/(games.length-1)):null,last3:recent(3),last6:recent(6),last9:recent(9),g200:games.filter(g=>g>=200).length,g250:games.filter(g=>g>=250).length,g300:games.filter(g=>g===300).length,sessions:s};
}
export function allPlay(state,week=0){
 const rows=state.teams.map(t=>({number:t.number,name:t.name,wins:0,ties:0,losses:0})),map=Object.fromEntries(rows.map(r=>[r.number,r]));
 for(const r of state.results.filter(r=>!week||r.week===week)){
  const teams=r.matches.flatMap(m=>{const s=scoreMatch(m);return [m.teamA,m.teamB].filter(Boolean).map(n=>({n,total:sum(s.adjusted[n===m.teamA?0:1])}));});
  for(let i=0;i<teams.length;i++)for(let j=i+1;j<teams.length;j++){const a=teams[i],b=teams[j];if(a.total===b.total){map[a.n].ties++;map[b.n].ties++;}else {map[a.total>b.total?a.n:b.n].wins++;map[a.total>b.total?b.n:a.n].losses++;}}
 }
 return rows.map(r=>({...r,pct:(r.wins+r.ties/2)/(r.wins+r.ties+r.losses||1)})).sort((a,b)=>b.pct-a.pct||a.number-b.number);
}


export function sexLeaders(state,sex){
 const completedWeeks=new Set(state.results.map(r=>r.week)).size;
 const minGames=completedWeeks>=5?Math.ceil(completedWeeks*3*2/3):1;
 const rows=state.bowlers
  .filter(b=>b.sex===sex)
  .map(b=>playerStats(state,b))
  .filter(r=>r.games>=minGames);
 const top=(key)=>rows.filter(r=>r[key]!=null).sort((a,b)=>(b[key]??-Infinity)-(a[key]??-Infinity)||a.name.localeCompare(b.name))[0]||null;
 return {
  sex,
  completedWeeks,
  minGames,
  eligible:rows.length,
  average:top('average'),
  pins:top('pins'),
  game:top('high'),
  series:top('highSeries')
 };
}

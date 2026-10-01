import {leagueAverage,rotationPool,profile,random,sum,validateWorkspace} from './engine.js';
// Build-a-team what-if: hand-picked bowlers form a new team in the bye slot,
// each departing bowler's team gets a replacement, and the whole season is replayed.
export const REPLACEMENT_SPREAD=5;
const fail=m=>{throw Error(m);};
export function currentAverage(state,id){try{return leagueAverage(state,id,33);}catch{return null;}}
// A listed starter belongs to that team; a sub belongs to the team they have bowled for most.
export function homeTeam(state,id){
 const listed=state.teams.find(t=>t.players.includes(id));if(listed)return listed.number;
 const games={};
 for(const r of state.results)for(const m of r.matches)for(const p of m.players)if(p.bowlerId===id&&p.team)games[p.team]=(games[p.team]||0)+p.types.filter(t=>t==='actual').length;
 const best=Object.entries(games).filter(([,g])=>g>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0];
 return best?Number(best[0]):null;
}
export function pickableBowlers(state){
 return state.bowlers.filter(b=>!b.vacancy&&Number.isFinite(b.entering)).map(b=>({id:b.id,name:b.name,average:currentAverage(state,b.id),team:homeTeam(state,b.id)})).sort((a,b)=>a.name.localeCompare(b.name));
}
export function divisions(state){return [...new Set(state.teams.map(t=>t.division).filter(Boolean))].sort();}
export function openTeamNumber(state){
 if(state.teams.length>=20)fail('The league already has 20 teams, so there is no bye slot for a new team.');
 const weeks=state.schedule.filter(s=>s.kind!=='position'&&s.week<=32);
 if(!weeks.length)fail('Import the schedule before building a team.');
 for(const s of weeks)if(s.pairs.filter(p=>p.includes(0)).length!==1)fail('Week '+s.week+' needs exactly one bye for the new team to take.');
 let n=1;while(state.teams.some(t=>t.number===n))n++;return n;
}
const weightedAverage=entries=>{const known=entries.filter(e=>e.average!=null&&e.weight>0),w=sum(known.map(e=>e.weight));return w?sum(known.map(e=>e.average*e.weight))/w:null;};
// Fresh season for the unchanged league, using the same bowler models as the what-if.
export function baselineLeague(state){
 return {state:{...structuredClone(state),results:[],halfWinners:{},runs:[]},options:{profiles:Object.fromEntries(state.bowlers.map(b=>[b.id,profile(state,b)])),pools:Object.fromEntries(state.teams.map(t=>[t.number,rotationPool(state,t)]))}};
}
export function buildCustomLeague(state,{picks,name='Custom team',division,seed=1}){
 validateWorkspace(state);
 if(new Set(picks).size!==picks.length)fail('Pick each bowler only once.');
 if(picks.length!==5&&picks.length!==6)fail('Pick five bowlers for a fixed lineup or six for a rotation.');
 const byId=Object.fromEntries(state.bowlers.map(b=>[b.id,b]));
 for(const id of picks)if(!byId[id]||byId[id].vacancy||!Number.isFinite(byId[id].entering))fail('Unknown or unavailable bowler: '+id);
 const divs=divisions(state);if(!divs.includes(division))fail('Choose a division for the new team.');
 const number=openTeamNumber(state),rng=random(seed),picked=new Set(picks);
 const base=baselineLeague(state),profiles=base.options.profiles,pools=base.options.pools;
 const teams=structuredClone(state.teams),bowlers=structuredClone(state.bowlers),replacements=[];
 const byTeam={};for(const id of picks){const t=homeTeam(state,id);if(t!=null)(byTeam[t]??=[]).push(id);}
 for(const [num,leaving] of Object.entries(byTeam)){
  const team=teams.find(t=>t.number===Number(num)),pool=pools[num],stay=pool.filter(p=>!picked.has(p.id));
  const restAverage=weightedAverage(stay.map(p=>({average:currentAverage(state,p.id),weight:p.weight})));
  leaving.forEach((id,k)=>{
   const leftAverage=currentAverage(state,id),target=restAverage==null?leftAverage:(leftAverage+restAverage)/2;
   const average=Math.max(0,Math.min(300,Math.round(target+(rng()*2-1)*REPLACEMENT_SPREAD)));
   const rep={id:'replacement-'+num+'-'+(k+1),name:'Sub for '+byId[id].name,team:team.number,entering:average,vacancy:false,history:[],replacement:true};
   bowlers.push(rep);profiles[rep.id]=profile({...state,results:[]},rep);
   const slot=team.players.indexOf(id);if(slot>=0)team.players[slot]=rep.id;
   stay.push({id:rep.id,weight:pool.find(p=>p.id===id)?.weight||3});
   replacements.push({team:team.number,teamName:team.name,leaving:id,leavingName:byId[id].name,leftAverage,restAverage,target,average,id:rep.id});
  });
  pools[num]=stay;
 }
 // A picked sub leaves every other team's rotation too.
 for(const t of teams){
  pools[t.number]=pools[t.number].filter(p=>!picked.has(p.id));
  if(t.players.some(id=>picked.has(id)))fail(byId[t.players.find(id=>picked.has(id))].name+' could not be replaced on '+t.name+'.');
 }
 for(const b of bowlers)if(picked.has(b.id))b.team=number;
 teams.push({number,name:name.trim()||'Custom team',division,players:picks.slice(0,5),custom:true});
 pools[number]=picks.map(id=>({id,weight:1}));
 const schedule=state.schedule.map(s=>s.kind==='position'?structuredClone(s):{...structuredClone(s),pairs:s.pairs.map(p=>p.map(n=>n===0?number:n))});
 const league={...structuredClone(state),teams,bowlers,schedule,results:[],halfWinners:{},runs:[]};
 for(const t of teams){const total=sum(pools[t.number].map(p=>p.weight));pools[t.number]=pools[t.number].map(p=>({...p,share:total?Math.min(1,5*p.weight/total):0})).sort((a,b)=>b.weight-a.weight);}
 return {state:league,options:{profiles,pools,rotating:picks.length===6?[number]:[]},number,replacements};
}

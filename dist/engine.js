
export const VERSION='monday-0.1.0';
export const sum=a=>a.reduce((s,x)=>s+x,0);
export const mean=a=>a.length?sum(a)/a.length:0;
export const POSITION_WEEKS=[10,13,16,26,29,32];
export function initialState(){return {schemaVersion:1,league:'Carbondale Commercial',season:'2026-2027',teams:[],bowlers:[],schedule:[],results:[],adjustments:{},halfWinners:{},runs:[],rules:{rounding:'floor',negativeHandicap:false,positionScope:'division',fillEightWithWildcards:false,assumptionsConfirmed:false},sourceNotes:['2026–2027 Carbondale Commercial Bowling League rules supplied by user.','Official roster assignments and schedule still required.']};}
const fail=m=>{throw Error(m);};
export function actualGames(state,id,before=33){return state.results.filter(r=>r.week<before&&r.actual!==false).sort((a,b)=>a.week-b.week).flatMap(r=>r.matches.flatMap(m=>m.players.filter(p=>p.bowlerId===id).flatMap(p=>p.scores.filter((g,i)=>p.types[i]==='actual'))));}
export function leagueAverage(state,id,week){const b=state.bowlers.find(b=>b.id===id);if(!b)fail('Unknown bowler '+id);const games=actualGames(state,id,week);if(games.length>=9)return Math.floor(mean(games));if(!Number.isFinite(b.entering))fail('Entering average required for '+b.name);return Math.floor(b.entering);}
export function handicap(avg,rules){let h=(240-avg)*.85;if(!rules.negativeHandicap)h=Math.max(0,h);return rules.rounding==='nearest'?Math.round(h):Math.floor(h);}
export function scoreMatch(m){
 const a=m.players.filter(p=>p.team===m.teamA).sort((a,b)=>a.slot-b.slot);
 const bye=m.teamB===0;
 const b=bye?[]:m.players.filter(p=>p.team===m.teamB).sort((a,b)=>a.slot-b.slot);
 if(a.length!==5||(!bye&&b.length!==5))fail('A match needs five positions on each real team.');
 const points=[0,0],gamePoints=[],scratch=[[],[]],adjusted=[[],[]];
 for(let g=0;g<3;g++){
  const gp=[0,0];
  for(let i=0;i<5;i++){
   const x=a[i],y=b[i],xa=x.scores[g]+x.handicap;
   if(bye){if(x.types[g]==='actual'&&x.scores[g]>=x.average-10)gp[0]++;continue;}
   const ya=y.scores[g]+y.handicap,xb=x.types[g]!=='actual',yb=y.types[g]!=='actual';
   if(xb&&yb)fail('Two blind/vacancy positions cannot face each other.');
   if(xb){if(ya>xa)gp[1]++;}else if(yb){if(xa>ya)gp[0]++;}else if(xa===ya){gp[0]+=.5;gp[1]+=.5;}else gp[xa>ya?0:1]++;
  }
  const sa=sum(a.map(p=>p.scores[g])),sb=bye?0:sum(b.map(p=>p.scores[g]));
  const aa=sa+sum(a.map(p=>p.handicap)),bb=bye?0:sb+sum(b.map(p=>p.handicap));
  scratch[0].push(sa);scratch[1].push(sb);adjusted[0].push(aa);adjusted[1].push(bb);
  if(bye){if(sa>=sum(a.map(p=>p.average))-50)gp[0]+=4;}
  else if(aa===bb){gp[0]+=2;gp[1]+=2;}else gp[aa>bb?0:1]+=4;
  points[0]+=gp[0];points[1]+=gp[1];gamePoints.push(gp);
 }
 const series=[0,0];
 if(bye){if(sum(scratch[0])>=3*sum(a.map(p=>p.average))-150)series[0]=3;}
 else {const aa=sum(adjusted[0]),bb=sum(adjusted[1]);if(aa===bb){series[0]=1.5;series[1]=1.5;}else series[aa>bb?0:1]=3;}
 points[0]+=series[0];points[1]+=series[1];
 return {points,gamePoints,series,scratch,adjusted,unawarded:30-sum(points)};
}
export function standings(state,half=0){
 const rows=state.teams.map(t=>({...t,points:0,pins:0,games:0,played:0})),map=Object.fromEntries(rows.map(r=>[r.number,r]));
 for(const r of state.results){if(half&&Math.ceil(r.week/16)!==half)continue;for(const m of r.matches){const s=scoreMatch(m);[m.teamA,m.teamB].forEach((n,i)=>{if(!n)return;map[n].points+=s.points[i];map[n].pins+=sum(s.scratch[i]);map[n].games+=3;map[n].played++;});}}
 return rows.map(r=>({...r,average:r.games?r.pins/r.games:null})).sort((a,b)=>b.points-a.points||(b.average??0)-(a.average??0)||a.number-b.number);
}
export function validation(state){
 const issues=[],add=(ok,msg)=>{if(!ok)issues.push(msg);};
 add(state.schemaVersion===1,'Unsupported backup version.');
 add(state.teams.length>=8&&state.teams.length<=20,'Import 8–20 teams.');
 add(new Set(state.teams.map(t=>t.number)).size===state.teams.length,'Duplicate team numbers.');
 add(new Set(state.bowlers.map(b=>b.id)).size===state.bowlers.length,'Duplicate bowler IDs.');
 const starters=[];
 for(const t of state.teams){add(Number.isInteger(t.number)&&t.number>0,'Invalid team number.');add(t.players.length===5,'Set five starters for '+t.name);starters.push(...t.players);for(const id of t.players)add(state.bowlers.some(b=>b.id===id),'Unknown starter on '+t.name);}
 add(new Set(starters).size===starters.length,'A bowler starts on multiple teams.');
 for(const b of state.bowlers)add(Number.isFinite(b.entering)&&b.entering>=0&&b.entering<=300,'Entering average required: '+b.name);
 return issues;
}
export function forecastIssues(state){
 const issues=validation(state),divs=[...new Set(state.teams.map(t=>t.division))];
 if(!state.rules.assumptionsConfirmed)issues.push('Review and confirm forecast assumptions in Setup.');
 if(state.teams.some(t=>!t.division)||divs.length!==(state.teams.length===20?4:3))issues.push('Assign the required '+(state.teams.length===20?4:3)+' divisions.');
 if(divs.length===3&&!state.rules.fillEightWithWildcards)issues.push('Three divisions provide six half-winner berths; confirm how the other two playoff spots are filled.');
 for(let w=1;w<=32;w++){if(state.results.some(r=>r.week===w))continue;const s=state.schedule.find(s=>s.week===w);if(!s)issues.push('Schedule missing Week '+w);else if(s.kind!=='position'){const ids=s.pairs.flat().filter(Boolean);if(ids.length!==state.teams.length||new Set(ids).size!==ids.length||ids.some(n=>!state.teams.some(t=>t.number===n)))issues.push('Incomplete/invalid schedule Week '+w);}}
 const weeks=state.results.map(r=>r.week).sort((a,b)=>a-b);
 if(weeks.some((w,i)=>w!==i+1))issues.push('Complete results in weekly order before simulating.');
 return issues;
}
export function validateWorkspace(state){
 if(!state||state.schemaVersion!==1||!['teams','bowlers','schedule','results','runs'].every(k=>Array.isArray(state[k]))||!state.rules||!state.adjustments||!state.halfWinners)fail('Not a Monday Night backup.');
 const basic=state.teams.length?validation(state):[];
 if(basic.length)fail(basic.join(' '));
 const weeks=new Set();
 for(const r of state.results){
  if(!Number.isInteger(r.week)||r.week<1||r.week>32||weeks.has(r.week)||!Array.isArray(r.matches)||r.actual!==true)fail('Invalid or duplicated results week.');
  weeks.add(r.week);const teams=[],ids=[];
  for(const m of r.matches){
   if(!state.teams.some(t=>t.number===m.teamA)||!(m.teamB===0||state.teams.some(t=>t.number===m.teamB))||m.teamA===m.teamB)fail('Unknown matchup team.');
   teams.push(m.teamA);if(m.teamB)teams.push(m.teamB);
   for(const p of m.players){
    if(![m.teamA,m.teamB].includes(p.team)||!p.team||!Number.isInteger(p.slot)||p.slot<1||p.slot>5||!Array.isArray(p.scores)||p.scores.length!==3||!Array.isArray(p.types)||p.types.length!==3||p.scores.some(g=>!Number.isInteger(g)||g<0||g>300)||p.types.some(t=>!['actual','blind','vacancy'].includes(t))||!Number.isFinite(p.average)||p.average<0||p.average>300||!Number.isInteger(p.handicap))fail('Invalid player score row.');
    if(p.types.some(t=>t!=='vacancy')){if(!state.bowlers.some(b=>b.id===p.bowlerId))fail('Unknown result bowler.');ids.push(p.bowlerId);}
   }
   for(const team of [m.teamA,m.teamB].filter(Boolean)){const slots=m.players.filter(p=>p.team===team).map(p=>p.slot);if(new Set(slots).size!==5)fail('Five unique lineup positions required.');}
   scoreMatch(m);
  }
  if(new Set(teams).size!==state.teams.length||teams.length!==state.teams.length||new Set(ids).size!==ids.length)fail('Each team and bowler may appear only once per week; import the entire week.');
 }
 return state;
}
export function random(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function profile(state,b){
 const prior=(b.history||[]).flatMap(h=>h.scores||[]).filter(Number.isFinite),recent=actualGames(state,b.id),anchor=b.entering;
 const priorMean=prior.length?(sum(prior)+anchor*12)/(prior.length+12):anchor;
 const mu=(sum(recent)+priorMean*30)/(recent.length+30),all=[...prior,...recent],avg=mean(all);
 const variance=(sum(all.map(x=>(x-avg)**2))+24*900)/(Math.max(0,all.length-1)+24);
 return {mean:mu,sd:Math.max(15,Math.sqrt(variance)),priorGames:prior.length,currentGames:recent.length};
}
export function simulate(state,iterations=1000,seed=202627,onProgress=()=>{}){
 validateWorkspace(state);const issues=forecastIssues(state);if(issues.length)fail(issues.join('\n'));
 if(!Number.isInteger(iterations)||iterations<1||iterations>20000)fail('Choose 1–20,000 simulations.');
 const rng=random(seed),normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-12,rng())))*Math.cos(2*Math.PI*rng());
 const nums=state.teams.map(t=>t.number),teamMap=Object.fromEntries(state.teams.map(t=>[t.number,t]));
 const profiles=Object.fromEntries(state.bowlers.map(b=>[b.id,profile(state,b)]));
 const agg=Object.fromEntries(nums.map(n=>[n,{number:n,points:0,halfPoints:[0,0],halves:[0,0],playoffs:0,champion:0}]));
 const weekly=Array.from({length:32},(_,i)=>({week:i+1,teams:Object.fromEntries(nums.map(n=>[n,{number:n,points:0,win:0,tie:0,opponents:{}}]))}));
 for(let run=0;run<iterations;run++){
  const simulated=structuredClone(state);simulated.runs=[];
  const winners=[];
  const makeMatch=(a,b,w)=>{
   const shared=normal()*5,players=[];
   for(const team of [a,b].filter(Boolean))teamMap[team].players.forEach((id,slot)=>{
    const p=profiles[id],adj=state.adjustments[id],fraction=adj?(adj.end===adj.start?(w>=adj.start?1:0):Math.max(0,Math.min(1,(w-adj.start)/(adj.end-adj.start)))):0;
    const mu=Math.max(0,Math.min(300,p.mean+(adj?.delta||0)*fraction)),night=normal()*8;
    const average=leagueAverage(simulated,id,w),h=handicap(average,state.rules);
    players.push({bowlerId:id,team,slot:slot+1,average,handicap:h,types:['actual','actual','actual'],scores:Array.from({length:3},()=>Math.max(0,Math.min(300,Math.round(mu+shared+night+normal()*Math.sqrt(Math.max(1,p.sd*p.sd-89))))))});
   });return {teamA:a,teamB:b,players};
  };
  // Roll-off: one game worth nine points. Half ties use team pins next (Rule 9).
  const duel=(a,b,w,oneGame=false)=>{
   for(let attempt=0;attempt<100;attempt++){
    const m=makeMatch(a,b,w),s=scoreMatch(m),p=oneGame?s.gamePoints[0]:s.points;
    if(p[0]!==p[1])return p[0]>p[1]?a:b;
    if(oneGame&&s.adjusted[0][0]!==s.adjusted[1][0])return s.adjusted[0][0]>s.adjusted[1][0]?a:b;
    oneGame=true;
   }fail('Unable to resolve playoff roll-off.');
  };
  const rankTies=(rows,w)=>{
   const out=[];for(let i=0;i<rows.length;){let j=i+1;while(j<rows.length&&rows[j].points===rows[i].points)j++;
    // A shuffled knockout is a stated model assumption for multi-team qualification ties.
    const group=rows.slice(i,j).map(r=>r.number);
    for(let k=group.length-1;k>0;k--){const p=Math.floor(rng()*(k+1));[group[k],group[p]]=[group[p],group[k]];}
    while(group.length){let winner=group[0];for(const n of group.slice(1))winner=duel(winner,n,w,true);out.push(winner);group.splice(group.indexOf(winner),1);}
    i=j;
   }return out;
  };
  for(let w=1;w<=32;w++){
   let result=state.results.find(r=>r.week===w);
   if(!result){
    const sch=state.schedule.find(s=>s.week===w);let pairs=sch.pairs;
    if(sch.kind==='position'){
     pairs=[];const rows=standings(simulated,Math.ceil(w/16));
     const groups=state.rules.positionScope==='league'?[rows]:[...new Set(rows.map(r=>r.division))].map(d=>rows.filter(r=>r.division===d));
     for(const group of groups)for(let i=0;i<group.length;i+=2)pairs.push([group[i].number,group[i+1]?.number||0]);
    }
    result={week:w,actual:true,matches:pairs.map(([a,b])=>makeMatch(a,b,w))};simulated.results.push(result);
   }
   for(const m of result.matches){const p=scoreMatch(m).points;[m.teamA,m.teamB].forEach((n,i)=>{if(!n)return;const opp=i?m.teamA:m.teamB,t=weekly[w-1].teams[n],o=t.opponents[opp]??={number:opp,count:0,points:0,win:0,tie:0};const won=p[i]>(opp?p[1-i]:15),tie=p[i]===(opp?p[1-i]:15);t.points+=p[i];t.win+=won;t.tie+=tie;o.count++;o.points+=p[i];o.win+=won;o.tie+=tie;});}
   if(w===16||w===32){
    const half=w/16,rows=standings(simulated,half);
    for(const row of rows)agg[row.number].halfPoints[half-1]+=row.points;
    for(const div of [...new Set(rows.map(r=>r.division))]){
     const divisionRows=rows.filter(r=>r.division===div),override=state.halfWinners[half+':'+div];
     let winner;
     if(override&&state.results.some(r=>r.week===w)){if(!divisionRows.some(r=>r.number===override&&r.points===divisionRows[0].points))fail('Recorded half winner is not tied for first.');winner=override;}
     else winner=rankTies(divisionRows,w)[0];
     winners.push(winner);agg[winner].halves[half-1]++;
    }
   }
  }
  const rows=standings(simulated),qualifiers=[...new Set(winners)];
  rows.forEach(r=>agg[r.number].points+=r.points);
  const seeds=rankTies(rows.filter(r=>qualifiers.includes(r.number)),32);
  seeds.push(...rankTies(rows.filter(r=>!qualifiers.includes(r.number)),32).slice(0,8-seeds.length));
  seeds.forEach(n=>agg[n].playoffs++);
  const q1=duel(seeds[0],seeds[7],33),q2=duel(seeds[1],seeds[6],33),q3=duel(seeds[2],seeds[5],33),q4=duel(seeds[3],seeds[4],33);
  const s1=duel(q1,q4,34),s2=duel(q3,q2,34);agg[duel(s1,s2,35)].champion++;
  if(run%25===0)onProgress(run/iterations);
 }
 return {version:VERSION,createdAt:new Date().toISOString(),iterations,seed,completedWeeks:state.results.length,inputKey:inputKey(state),teams:Object.values(agg).map(t=>({...t,points:t.points/iterations,halfPoints:t.halfPoints.map(n=>n/iterations),halves:t.halves.map(n=>n/iterations),playoffs:t.playoffs/iterations,champion:t.champion/iterations})),weekly:weekly.map(w=>({week:w.week,actual:state.results.some(r=>r.week===w.week),teams:Object.values(w.teams).map(t=>({...t,points:t.points/iterations,win:t.win/iterations,tie:t.tie/iterations,opponents:Object.values(t.opponents).map(o=>({...o,probability:o.count/iterations,points:o.points/o.count,win:o.win/o.count,tie:o.tie/o.count}))}))}))};
}
export function inputKey(state){return JSON.stringify({teams:state.teams,bowlers:state.bowlers,schedule:state.schedule,results:state.results,adjustments:state.adjustments,rules:state.rules,halfWinners:state.halfWinners});}

import {validateWorkspace,rotationPool,VERSION} from './engine.js';
import {applySuppliedEnteringAverages} from './bowler-averages.js';
import {planLineup,likelyLineup,opponentFor,nextWeek} from './lineup.js';
import {pickableBowlers} from './custom-team.js';
import {cloud} from './cloud.js';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=1)=>n==null?'—':Number(n).toFixed(d),pct=n=>n==null?'—':fmt(n*100,1)+'%',signed=(n,d=2)=>(n>0?'+':'')+fmt(n,d);
const table=(headers,rows)=>'<div class="table-wrap" tabindex="0"><table><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr'+(r.highlight?' class="highlight"':'')+'>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const panel=(title,body)=>'<section class="panel"><div class="panel-head"><h2>'+title+'</h2></div><div class="panel-body">'+body+'</div></section>';
let league=null,loadError='',busy=false,result=null;
let draft={team:null,week:null,opponent:null,mine:[],theirs:[],nights:20000,seed:20261005};
try{Object.assign(draft,JSON.parse(localStorage.getItem('monday-lineup')||'{}'));}catch{}
function loadLocal(){
 try{const saved=JSON.parse(localStorage.getItem('monday-workspace')||'null');league=saved?validateWorkspace(applySuppliedEnteringAverages(saved.state).state):null;}
 catch(e){league=null;loadError='Saved league data could not be opened: '+e.message;}
}
function remember(){try{localStorage.setItem('monday-lineup',JSON.stringify(draft));}catch{}}
function toast(m){$('#toast').textContent=m;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',7000);}
const teamName=n=>league.teams.find(t=>t.number===n)?.name||'Bye';
const bowlerName=id=>league.bowlers.find(b=>b.id===id)?.name||id;
// Fill in anything missing: team, next week, scheduled opponent and both likely fives.
function settle(){
 const nums=league.teams.map(t=>t.number);
 if(!nums.includes(draft.team))draft.team=league.teams.find(t=>t.players.includes('doug-smith'))?.number??nums[0];
 if(!(draft.week>=1&&draft.week<=32))draft.week=nextWeek(league)||32;
 if(!nums.includes(draft.opponent)||draft.opponent===draft.team){const o=opponentFor(league,draft.team,draft.week);draft.opponent=nums.includes(o)&&o!==draft.team?o:nums.find(n=>n!==draft.team);}
 const known=new Set(pickableBowlers(league).map(b=>b.id)),ok=ids=>ids.length===5&&ids.every(id=>known.has(id));
 if(!ok(draft.mine))draft.mine=likelyLineup(league,draft.team);
 if(!ok(draft.theirs))draft.theirs=likelyLineup(league,draft.opponent);
}
function render(){
 const nav='<nav><a class="nav-button" href="./"><span class="nav-index">←</span>League app</a><a class="nav-button" href="./custom.html"><span class="nav-index">★</span>Build a team</a><a class="nav-button active" href="./lineup.html"><span class="nav-index">⇄</span>Lineup planner</a></nav>';
 $('#app').innerHTML='<div class="shell"><aside class="sidebar"><div class="brand">Monday Night<span>CARBONDALE COMMERCIAL</span></div><div class="season-tag">2026–2027 · Valley Bowling Lanes</div>'+nav+'<div class="sidebar-foot">Head-to-head planner<strong>Nothing here changes your league</strong></div></aside><main class="main"><header class="topbar"><span>'+esc(cloud.email||'Local workspace')+'</span><div class="top-actions">'+(cloud.email?'<button data-action="load" '+(busy?'disabled':'')+'>Load saved league</button>':'')+'</div></header>'+body()+'<footer class="footer"><span>Simulated nights only. Nothing is saved to the league.</span><span>'+VERSION+'</span></footer></main></div>';
}
function picker(side,i,ids,pool){
 const all=pickableBowlers(league),inPool=new Set(pool.map(p=>p.id)),opt=b=>'<option value="'+esc(b.id)+'" '+(b.id===ids[i]?'selected':'')+'>'+esc(b.name)+' · '+(b.average??'—')+'</option>';
 return '<label>'+(side==='theirs'?'Position '+(i+1):'Bowler '+(i+1))+'<select class="lineup-pick" data-side="'+side+'" data-slot="'+i+'">'+
  '<optgroup label="Team rotation">'+all.filter(b=>inPool.has(b.id)).map(opt).join('')+'</optgroup><optgroup label="Everyone else">'+all.filter(b=>!inPool.has(b.id)).map(opt).join('')+'</optgroup></select></label>';
}
function body(){
 const head='<div class="page-head"><div><div class="eyebrow">MONDAY NIGHT LEAGUE</div><h1>Lineup planner</h1><p>Pick your five and theirs, then simulate the night to see which head-to-head pairings give you the most points and the best chance to win.</p></div></div>';
 if(loadError)return head+'<div class="notice error">'+esc(loadError)+'</div>';
 if(!league||!league.teams.length||!league.schedule.length)return head+panel('Load your league first','<p>This page uses the league saved in this browser. Open the <a href="./">league app</a>, load or import your roster, schedule and scores, then come back.</p>');
 settle();remember();
 const teams=[...league.teams].sort((a,b)=>a.name.localeCompare(b.name)),teamOpts=sel=>teams.map(t=>'<option value="'+t.number+'" '+(t.number===sel?'selected':'')+'>'+esc(t.name)+'</option>').join('');
 const scheduled=opponentFor(league,draft.team,draft.week),played=league.results.some(r=>r.week===draft.week);
 const note=(scheduled===0?'Week '+draft.week+' is a bye for '+esc(teamName(draft.team))+' on the schedule.':scheduled==null?'No schedule found for week '+draft.week+'.':scheduled===draft.opponent?'Scheduled opponent for week '+draft.week+'.':'The schedule has '+esc(teamName(scheduled))+' for week '+draft.week+'.')+(played?' Week '+draft.week+' is already bowled; the odds use today’s averages.':'');
 const poolMine=rotationPool(league,league.teams.find(t=>t.number===draft.team)),poolTheirs=rotationPool(league,league.teams.find(t=>t.number===draft.opponent));
 const setup=panel('Matchup','<div class="controls"><label>Your team<select id="team">'+teamOpts(draft.team)+'</select></label><label>Week<select id="week">'+Array.from({length:32},(_,i)=>'<option '+(i+1===draft.week?'selected':'')+'>'+(i+1)+'</option>').join('')+'</select></label><label>Opponent<select id="opponent">'+teamOpts(draft.opponent)+'</select></label><button data-action="reset" '+(busy?'disabled':'')+'>Refill likely lineups</button></div><p class="fine muted">'+note+' Lineups start from each team’s last night, topped up by who bowls most.</p>'+
  '<div class="grid-two" style="margin-top:1rem"><div><h3>Your five</h3><div class="stack">'+draft.mine.map((_,i)=>picker('mine',i,draft.mine,poolMine)).join('')+'</div><p class="fine muted">The order here is “your order” in the results.</p></div><div><h3>'+esc(teamName(draft.opponent))+', in lane order</h3><div class="stack">'+draft.theirs.map((_,i)=>picker('theirs',i,draft.theirs,poolTheirs)).join('')+'</div><p class="fine muted">Position 1 bowls your position 1, and so on.</p></div></div>');
 const run=panel('Simulate the night','<div class="controls"><label>Nights<input id="nights" type="number" min="100" max="100000" value="'+draft.nights+'"></label><label>Seed<input id="seed" type="number" value="'+draft.seed+'"></label><button class="primary" data-action="plan" '+(busy?'disabled':'')+'>'+(busy?'Simulating…':'Find the best pairings')+'</button></div><p class="fine muted">Every night, all ten bowlers get three games from the same skill model the season forecast uses, then all 120 ways of pairing your five against theirs are scored on those same games.</p>');
 return head+setup+run+results();
}
function results(){
 if(!result)return '';
 const r=result.plan,stale=JSON.stringify(result.key)!==JSON.stringify(key());
 const line=b=>esc(b.name)+'<span class="subline">avg '+b.average+' · hdcp '+b.handicap+'</span>',byId=Object.fromEntries([...r.mine,...r.theirs].map(b=>[b.id,b]));
 const pairPts=(id,pos)=>r.pairs[r.mine.findIndex(b=>b.id===id)][pos];
 const metrics='<div class="metrics"><div class="metric"><div class="label">Best order, expected points</div><div class="value">'+fmt(r.best.points,2)+'</div></div><div class="metric"><div class="label">Best order, chance to win the night</div><div class="value">'+pct(r.best.win)+'</div></div><div class="metric"><div class="label">Your order</div><div class="value">'+fmt(r.entered.points,2)+' · '+pct(r.entered.win)+'</div></div><div class="metric"><div class="label">Best vs worst order</div><div class="value">'+signed(r.best.points-r.worst.points)+' pts</div></div></div>';
 const first=r.entersFirst==='theirs'?'<div class="notice">Their team average ('+r.teamAverages[1]+') is higher than yours ('+r.teamAverages[0]+'), so under Rule 7 they enter their lineup first. Once you see their order, line up to match it with the recommended pairings.</div>'
  :r.entersFirst==='mine'?'<div class="notice">Your team average ('+r.teamAverages[0]+') is higher than theirs ('+r.teamAverages[1]+'), so under Rule 7 you enter first. These odds assume they keep the order shown. If their captain counters your order, they choose the pairings, and the worst pairing leaves you '+fmt(r.worst.points,2)+' expected points.</div>'
  :'<div class="notice">Both team averages are '+r.teamAverages[0]+', so Rule 7 does not say who enters first.</div>';
 const best=table(['Position','Their bowler','Your bowler','Expected points (of 3)','Sweep all 3'],r.theirs.map((t,pos)=>{const p=pairPts(r.best.order[pos],pos);return ['<strong>'+(pos+1)+'</strong>',line(t),line(byId[r.best.order[pos]]),fmt(p.points,2),pct(p.sweep)];}));
 const grid=table(['Your bowler ↓ · their position →',...r.theirs.map((t,i)=>(i+1)+'. '+esc(t.name))],r.mine.map((m,i)=>[line(m),...r.pairs[i].map((p,pos)=>r.best.order[pos]===m.id?'<strong>'+fmt(p.points,2)+'</strong>':fmt(p.points,2))]));
 const top=r.orders.slice(0,10);if(!top.includes(r.entered))top.push(r.entered);
 const orders=table(['Rank','Your bowlers for positions 1–5','Expected points','Win the night','vs your order'],top.map(o=>{const row=[String(r.orders.indexOf(o)+1),o.order.map(id=>esc(bowlerName(id))).join(' · ')+(o===r.entered?' <span class="badge">your order</span>':''),fmt(o.points,2),pct(o.win),o===r.entered?'—':signed(o.gain)+' ± '+fmt(2*o.gainError,2)];row.highlight=o===r.best;return row;}));
 return panel('Recommended pairings · week '+r.week+' vs '+esc(teamName(result.key.opponent)),(stale?'<div class="notice">The lineups changed since this run. Simulate again to update.</div>':'')+metrics+first+best+'<p class="fine muted">Team game and series points don’t depend on the order, and average '+fmt(r.teamPoints,2)+' of 15 here. Only the 15 head-to-head points move.</p>')+
  panel('Every head-to-head matchup',grid+'<p class="fine muted">Expected individual points out of 3 for each of your bowlers against each of theirs, with handicap. Bold cells are the recommended pairings.</p>')+
  panel('Top orders',orders+'<p class="fine muted">'+r.nights.toLocaleString()+' simulated nights · seed '+r.seed+'. The ± is two standard errors, so a gain smaller than its ± is within the noise.</p>');
}
const key=()=>({team:draft.team,week:draft.week,opponent:draft.opponent,mine:draft.mine,theirs:draft.theirs});
function planNow(){
 const nights=Number($('#nights').value),seed=Number($('#seed').value);
 if(!Number.isInteger(nights)||nights<100||nights>100000||!Number.isInteger(seed))throw Error('Choose 100–100,000 nights and a whole-number seed.');
 draft.nights=nights;draft.seed=seed;remember();
 busy=true;render();
 setTimeout(()=>{try{result={plan:planLineup(league,draft.mine,draft.theirs,draft.week,{nights,seed}),key:structuredClone(key())};}catch(e){toast(e.message);}finally{busy=false;render();}},20);
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b?.dataset.action)return;
 try{
  const a=b.dataset.action;
  if(a==='plan')planNow();
  if(a==='reset'){draft.mine=[];draft.theirs=[];render();}
  if(a==='load'){busy=true;render();try{const saved=await cloud.load();if(!saved)toast('No saved league online yet.');else{league=validateWorkspace(applySuppliedEnteringAverages(saved.state).state);loadError='';result=null;toast('Loaded saved league, revision '+saved.revision+'.');}}finally{busy=false;render();}}
 }catch(err){toast(err.message);}
});
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.classList.contains('lineup-pick')){
  const side=draft[t.dataset.side],i=Number(t.dataset.slot),j=side.indexOf(t.value),other=draft[t.dataset.side==='mine'?'theirs':'mine'];
  if(other.includes(t.value)){toast(bowlerName(t.value)+' is already in the other lineup.');render();return;}
  if(j>=0&&j!==i)side[j]=side[i];// picking someone already listed swaps the two spots
  side[i]=t.value;
 }
 else if(t.id==='team'){draft.team=Number(t.value);draft.opponent=null;draft.mine=[];draft.theirs=[];}
 else if(t.id==='week'){draft.week=Number(t.value);const o=opponentFor(league,draft.team,draft.week);if(o&&o!==draft.opponent){draft.opponent=o;draft.theirs=[];}}
 else if(t.id==='opponent'){draft.opponent=Number(t.value);draft.theirs=[];}
 else return;
 remember();render();
});
loadLocal();render();

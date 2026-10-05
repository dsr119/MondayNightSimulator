import {validateWorkspace,forecastIssues,VERSION} from './engine.js';
import {applySuppliedEnteringAverages} from './bowler-averages.js';
import {buildCustomLeague,baselineLeague,pickableBowlers,divisions,openTeamNumber} from './custom-team.js';
import {cloud} from './cloud.js';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=1)=>n==null?'—':Number(n).toFixed(d),pct=n=>n==null?'—':fmt(n*100,1)+'%',signed=n=>(n>0?'+':'')+fmt(n*100,1);
const table=(headers,rows)=>'<div class="table-wrap" tabindex="0"><table><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr'+(r.highlight?' class="highlight"':'')+'>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const panel=(title,body)=>'<section class="panel"><div class="panel-head"><h2>'+title+'</h2></div><div class="panel-body">'+body+'</div></section>';
let league=null,loadError='',busy=false,worker=null,result=null;
let draft={size:5,picks:[],name:'Custom team',division:'',replacementSeed:1,iterations:500,seed:202627,compare:true};
try{Object.assign(draft,JSON.parse(localStorage.getItem('monday-custom-team')||'{}'));}catch{}
function loadLocal(){
 try{const saved=JSON.parse(localStorage.getItem('monday-workspace')||'null');league=saved?validateWorkspace(applySuppliedEnteringAverages(saved.state).state):null;}
 catch(e){league=null;loadError='Saved league data could not be opened: '+e.message;}
}
function remember(){try{localStorage.setItem('monday-custom-team',JSON.stringify(draft));}catch{}}
function toast(m){$('#toast').textContent=m;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',7000);}
const teamName=n=>league.teams.find(t=>t.number===n)?.name||'No team';
const label=b=>b.name+' · '+(b.team==null?'No team':teamName(b.team))+' · '+(b.average??'—');
function findBowler(value){
 const v=value.trim().toLowerCase();if(!v)return null;const all=pickableBowlers(league);
 return all.find(b=>label(b).toLowerCase()===v)||(all.filter(b=>b.name.toLowerCase()===v).length===1?all.find(b=>b.name.toLowerCase()===v):null);
}
function attempt(){
 const picks=draft.picks.slice(0,draft.size).filter(Boolean);
 if(picks.length<draft.size)return {error:'Pick '+draft.size+' bowlers.'};
 try{const built=buildCustomLeague(league,{picks,name:draft.name,division:draft.division,seed:draft.replacementSeed});return {built,issues:forecastIssues(built.state)};}
 catch(e){return {error:e.message};}
}
function render(){
 const nav='<nav><a class="nav-button" href="./"><span class="nav-index">←</span>League app</a><a class="nav-button active" href="./custom.html"><span class="nav-index">★</span>Build a team</a><a class="nav-button" href="./lineup.html"><span class="nav-index">⇄</span>Lineup planner</a></nav>';
 $('#app').innerHTML='<div class="shell"><aside class="sidebar"><div class="brand">Monday Night<span>CARBONDALE COMMERCIAL</span></div><div class="season-tag">2026–2027 · Valley Bowling Lanes</div>'+nav+'<div class="sidebar-foot">What-if team builder<strong>Nothing here changes your league</strong></div></aside><main class="main"><header class="topbar"><span>'+esc(cloud.email||'Local workspace')+'</span><div class="top-actions">'+(cloud.email?'<button data-action="load" '+(busy?'disabled':'')+'>Load saved league</button>':'')+'</div></header>'+body()+'<footer class="footer"><span>Hypothetical season. Results are not saved to the league.</span><span>'+VERSION+'</span></footer></main></div>';
}
function body(){
 const head='<div class="page-head"><div><div class="eyebrow">MONDAY NIGHT LEAGUE</div><h1>Build a team</h1><p>Hand-pick a team, give every team that loses a bowler a replacement near their level, and replay the season to see your playoff odds.</p></div></div>';
 if(loadError)return head+'<div class="notice error">'+esc(loadError)+'</div>';
 if(!league||!league.teams.length||!league.schedule.length)return head+panel('Load your league first','<p>This page uses the league saved in this browser. Open the <a href="./">league app</a>, load or import your roster, schedule and scores, then come back.</p>');
 let open='';try{openTeamNumber(league);}catch(e){open=e.message;}
 if(open)return head+'<div class="notice error">'+esc(open)+'</div>';
 const divs=divisions(league);if(!divs.includes(draft.division))draft.division=divs[0]||'';
 const bowlers=pickableBowlers(league),chosen=draft.picks.slice(0,draft.size);
 const rows=Array.from({length:draft.size},(_,i)=>{const b=bowlers.find(b=>b.id===chosen[i]);return '<label>Bowler '+(i+1)+'<input class="pick" data-slot="'+i+'" list="bowler-list" autocomplete="off" placeholder="Type a name" value="'+esc(b?label(b):'')+'" '+(busy?'disabled':'')+'></label>';}).join('');
 const builder=panel('Your team','<div class="controls"><label>Team name<input id="team-name" value="'+esc(draft.name)+'" style="width:220px"></label><label>Lineup<select id="team-size"><option value="5" '+(draft.size===5?'selected':'')+'>5 bowlers, same five every week</option><option value="6" '+(draft.size===6?'selected':'')+'>6 bowlers, rotating</option></select></label><label>Division<select id="team-division">'+divs.map(d=>'<option '+(d===draft.division?'selected':'')+'>'+esc(d)+'</option>').join('')+'</select></label></div><div class="controls custom-picks">'+rows+'</div><datalist id="bowler-list">'+bowlers.map(b=>'<option value="'+esc(label(b))+'"></option>').join('')+'</datalist><p class="fine muted">Each entry shows the bowler, the team they leave, and their current average. Your team takes the bye slot in the schedule'+(draft.size===6?' and rotates five of its six bowlers each week, evenly':'')+'.</p>');
 const a=attempt();
 if(a.error)return head+builder+(draft.picks.filter(Boolean).length?'<div class="notice">'+esc(a.error)+'</div>':'');
 const reps=a.built.replacements;
 const repPanel=panel('Replacements',(reps.length?table(['Team','Losing','Their average','Rest of team','Replacement average'],reps.map(r=>[esc(r.teamName),esc(r.leavingName),r.leftAverage,fmt(r.restAverage),'<strong>'+r.average+'</strong>'])):'<p>None of your picks belong to a team, so no team needs a replacement.</p>')+'<div class="controls" style="margin-top:1rem"><button data-action="reroll" '+(busy?'disabled':'')+'>Reroll replacements</button></div><p class="fine muted">A replacement averages halfway between the bowler who left and the rest of that team (weighted by how often each bowls), plus or minus up to '+5+' pins at random. They take over the departed bowler\'s share of nights.</p>');
 const issues=a.issues;
 const runPanel=panel('Replay the season','<div class="controls"><label>Seasons<input id="iterations" type="number" min="1" max="20000" value="'+draft.iterations+'"></label><label>Seed<input id="seed" type="number" value="'+draft.seed+'"></label><label style="flex-direction:row;align-items:center"><input id="compare" type="checkbox" style="width:auto" '+(draft.compare?'checked':'')+'> Compare with the unchanged league</label><button class="primary" data-action="simulate" '+(busy||issues.length?'disabled':'')+'>'+(busy?'Simulating…':'Run simulation')+'</button><button data-action="cancel" '+(!busy?'disabled':'')+'>Cancel</button></div><progress id="progress" max="1" value="0"></progress>'+(issues.length?'<div class="notice"><strong>Forecast inputs needed</strong><ul>'+issues.map(i=>'<li>'+esc(i)+'</li>').join('')+'</ul></div>':'')+'<p class="fine muted">This replays all 32 weeks from Week 1 with the new lineups. Everyone\'s skill comes from their scores so far, but the actual Week 1–'+league.results.length+' results are not kept, because your team did not bowl them. The comparison replays the real league the same way.</p>');
 return head+builder+repPanel+runPanel+resultsPanel(a.built);
}
function resultsPanel(built){
 if(!result)return '';
 const {custom,baseline,number,names}=result,base=baseline?Object.fromEntries(baseline.teams.map(t=>[t.number,t])):{};
 const me=custom.teams.find(t=>t.number===number),divisionOf=n=>result.divisions[n]||'';
 const metrics='<div class="metrics"><div class="metric"><div class="label">Make the playoffs</div><div class="value">'+pct(me.playoffs)+'</div></div><div class="metric"><div class="label">Win the league</div><div class="value">'+pct(me.champion)+'</div></div><div class="metric"><div class="label">Projected points</div><div class="value">'+fmt(me.points)+'</div></div><div class="metric"><div class="label">Win division, half 1 / half 2</div><div class="value">'+me.halves.map(pct).join(' / ')+'</div></div></div>';
 const rows=[...custom.teams].sort((a,b)=>b.playoffs-a.playoffs||b.points-a.points).map(t=>{const b=base[t.number],r=[esc(names[t.number])+(t.number===number?' <strong>(yours)</strong>':''),esc(divisionOf(t.number)),fmt(t.points),pct(t.playoffs),pct(t.champion)];if(baseline)r.push(b?pct(b.playoffs):'—',b?signed(t.playoffs-b.playoffs):'—');r.highlight=t.number===number;return r;});
 const stale=JSON.stringify(result.key)!==JSON.stringify(currentKey(built));
 return panel('Playoff odds · '+esc(names[number]),(stale?'<div class="notice">Your picks changed since this run. Run the simulation again to update.</div>':'')+metrics+table(['Team','Division','Projected points','Playoffs','Win league',...(baseline?['Unchanged league','Change']:[])],rows)+'<p class="fine muted">'+custom.iterations+' seasons · seed '+custom.seed+' · '+esc(custom.createdAt)+'</p>');
}
const currentKey=built=>({picks:draft.picks.slice(0,draft.size),size:draft.size,division:draft.division,replacements:built.replacements.map(r=>r.average)});
function simulateNow(){
 const iterations=Number($('#iterations').value),seed=Number($('#seed').value);
 if(!Number.isInteger(iterations)||iterations<1||iterations>20000||!Number.isInteger(seed))throw Error('Choose 1–20,000 seasons and a whole-number seed.');
 draft.iterations=iterations;draft.seed=seed;draft.compare=$('#compare').checked;remember();
 const a=attempt();if(a.error)throw Error(a.error);
 const built=a.built,names=Object.fromEntries(built.state.teams.map(t=>[t.number,t.name])),divs=Object.fromEntries(built.state.teams.map(t=>[t.number,t.division])),key=currentKey(built);
 busy=true;render();
 worker=new Worker('./custom-worker.js',{type:'module'});
 worker.onmessage=({data})=>{
  if(data.progress!=null){const p=$('#progress');if(p)p.value=data.progress;return;}
  worker.terminate();worker=null;busy=false;
  if(data.error){toast(data.error);render();return;}
  result={...data.result,number:built.number,names,divisions:divs,key};render();
 };
 worker.onerror=e=>{worker?.terminate();worker=null;busy=false;render();toast(e.message||'Simulation worker failed.');};
 worker.postMessage({custom:{state:built.state,options:built.options},baseline:draft.compare?baselineLeague(league):null,iterations,seed});
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b?.dataset.action)return;
 try{
  const a=b.dataset.action;
  if(a==='reroll'){draft.replacementSeed=(draft.replacementSeed%2147483647)+1;remember();render();}
  if(a==='cancel'){worker?.terminate();worker=null;busy=false;render();}
  if(a==='simulate')simulateNow();
  if(a==='load'){busy=true;render();try{const saved=await cloud.load();if(!saved)toast('No saved league online yet.');else{league=validateWorkspace(applySuppliedEnteringAverages(saved.state).state);loadError='';result=null;toast('Loaded saved league, revision '+saved.revision+'.');}}finally{busy=false;render();}}
 }catch(err){toast(err.message);}
});
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.classList.contains('pick')){const i=Number(t.dataset.slot),bowler=findBowler(t.value);if(t.value.trim()&&!bowler){toast('No bowler matches “'+t.value+'”. Pick a name from the list.');}draft.picks[i]=bowler?.id||'';}
 else if(t.id==='team-size')draft.size=Number(t.value);
 else if(t.id==='team-division')draft.division=t.value;
 else if(t.id==='team-name')draft.name=t.value;
 else return;
 remember();render();
});
loadLocal();render();

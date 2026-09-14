
import {initialState,validateWorkspace,leagueAverage,handicap,POSITION_WEEKS} from './engine.js';
export function parseCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell.length)throw Error('Unexpected quote in CSV.');else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell.trim());cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw Error('Unclosed CSV quote.');row.push(cell.trim());if(row.some(Boolean))rows.push(row);
 if(!rows.length)throw Error('CSV is empty.');const headers=rows.shift().map(h=>h.toLowerCase());
 if(new Set(headers).size!==headers.length)throw Error('Duplicate CSV columns.');
 return rows.map((r,i)=>{if(r.length!==headers.length)throw Error('CSV row '+(i+2)+' has the wrong number of columns.');return Object.fromEntries(headers.map((h,k)=>[h,r[k]]));});
}
const num=(v,label,min=0,max=300)=>{if(v===''||v==null||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max)throw Error('Invalid '+label+': '+v);return Number(v);};
const integer=(v,label,min=0,max=300)=>{const n=num(v,label,min,max);if(!Number.isInteger(n))throw Error(label+' must be an integer.');return n;};
export const TEMPLATES={
 roster:'team,team_name,division,slot,bowler_id,bowler,entering\n',
 schedule:'week,kind,team_a,team_b,lane\n',
 scores:'week,team,opponent,slot,bowler_id,game1,game2,game3,type1,type2,type3,average,handicap\n',
 history:'bowler_id,date,game1,game2,game3\n'
};
export function importRoster(state,text){
 if(state.results.length)throw Error('Roster replacement is locked after results. Use a backup to preserve existing bowler identities.');
 const rows=parseCSV(text),next=structuredClone(state),teams=new Map(),bowlers=new Map();
 if(!rows.length)throw Error('Add roster rows.');
 for(const r of rows){
  const team=integer(r.team,'team',0,99),slot=integer(r.slot,'slot',0,5);
  if(!r.bowler_id||!r.bowler)throw Error('Bowler ID and name are required.');
  if(bowlers.has(r.bowler_id))throw Error('Duplicate bowler ID '+r.bowler_id);
  const old=state.bowlers.find(b=>b.id===r.bowler_id);
  bowlers.set(r.bowler_id,{id:r.bowler_id,name:r.bowler,team,entering:num(r.entering,'entering average'),history:old?.history||[]});
  if(team){
   if(!r.team_name||slot<1)throw Error('Regular bowlers need a team name and slot 1–5.');
   let t=teams.get(team);if(!t){t={number:team,name:r.team_name,division:r.division,players:Array(5).fill(null)};teams.set(team,t);}
   if(t.name!==r.team_name||t.division!==r.division)throw Error('Conflicting team name/division.');
   if(t.players[slot-1])throw Error('Duplicate lineup position.');t.players[slot-1]=r.bowler_id;
  }else if(slot!==0)throw Error('Substitutes use team 0 and slot 0.');
 }
 next.teams=[...teams.values()].sort((a,b)=>a.number-b.number);next.bowlers=[...bowlers.values()];
 validateWorkspace(next);return next;
}
export function importSchedule(state,text){
 const rows=parseCSV(text),weeks=new Map(),known=new Set(state.teams.map(t=>t.number));
 if(!known.size)throw Error('Import rosters first.');
 for(const r of rows){
  const week=integer(r.week,'week',1,32),kind=r.kind||'regular';
  if(!['regular','position'].includes(kind))throw Error('Schedule kind must be regular or position.');
  let s=weeks.get(week);if(!s){s={week,kind,pairs:[],lanes:[]};weeks.set(week,s);}else if(s.kind!==kind||kind==='position')throw Error('Conflicting schedule week.');
  if(kind==='position'){if(!POSITION_WEEKS.includes(week))throw Error('Position rounds belong in Weeks 10, 13, 16, 26, 29, 32.');continue;}
  const a=integer(r.team_a,'team A',1,99),b=integer(r.team_b,'team B',0,99);
  if(!known.has(a)||(b&&!known.has(b))||a===b)throw Error('Invalid scheduled opponents.');
  s.pairs.push([a,b]);s.lanes.push(r.lane?integer(r.lane,'lane',1,19):null);
 }
 for(const s of weeks.values())if(s.kind==='regular'){const ids=s.pairs.flat().filter(Boolean);if(ids.length!==known.size||new Set(ids).size!==known.size)throw Error('Each team must appear once in Week '+s.week);}
 for(const w of POSITION_WEEKS)if(!weeks.has(w))weeks.set(w,{week:w,kind:'position',pairs:[],lanes:[]});
 const next=structuredClone(state);next.schedule=[...weeks.values()].sort((a,b)=>a.week-b.week);return next;
}
export function importScores(state,text,{replace=false,officerConfirmed=false}={}){
 const rows=parseCSV(text);if(!rows.length)throw Error('Add score rows.');
 const week=integer(rows[0].week,'week',1,32),exists=state.results.some(r=>r.week===week);
 if(exists&&(!replace||!officerConfirmed))throw Error('A correction requires Replace week and Officer confirmed.');
 const next=structuredClone(state);next.results=next.results.filter(r=>r.week!==week);
 const matches=new Map(),known=new Set(state.teams.map(t=>t.number));
 for(const r of rows){
  if(integer(r.week,'week',1,32)!==week)throw Error('Import one complete week at a time.');
  const team=integer(r.team,'team',1,99),opponent=integer(r.opponent,'opponent',0,99),slot=integer(r.slot,'slot',1,5);
  if(!known.has(team)||(opponent&&!known.has(opponent))||team===opponent)throw Error('Unknown or invalid matchup.');
  const pair=opponent?[team,opponent].sort((a,b)=>a-b):[team,0],key=pair.join(':');
  let match=matches.get(key);if(!match){match={teamA:pair[0],teamB:pair[1],players:[]};matches.set(key,match);}
  const types=[1,2,3].map(g=>r['type'+g]||'actual');
  if(types.some(t=>!['actual','blind','vacancy'].includes(t)))throw Error('Type must be actual, blind, or vacancy.');
  if(types.includes('vacancy')&&!types.every(t=>t==='vacancy'))throw Error('Use a separate full vacancy position; partial games support actual/blind.');
  const vacancy=types.every(t=>t==='vacancy'),bowler=state.bowlers.find(b=>b.id===r.bowler_id);
  if(!vacancy&&!bowler)throw Error('Unknown bowler ID '+r.bowler_id+'. Add substitutes to the roster before importing.');
  const average=r.average!==''&&r.average!=null?num(r.average,'official average'):vacancy?150:leagueAverage(next,bowler.id,week);
  const h=r.handicap!==''&&r.handicap!=null?integer(r.handicap,'official handicap',-100,240):handicap(average,state.rules);
  const scores=types.map((type,i)=>type==='vacancy'?150:type==='blind'?Math.max(0,Math.floor(average)-10):integer(r['game'+(i+1)],'game score'));
  match.players.push({team,slot,bowlerId:vacancy?'vacancy-'+team+'-'+slot:bowler.id,average,handicap:h,scores,types});
 }
 const scheduled=state.schedule.find(s=>s.week===week);
 if(scheduled?.kind==='regular'){const expected=scheduled.pairs.map(([a,b])=>(b?[a,b].sort((a,b)=>a-b):[a,0]).join(':')).sort();if(JSON.stringify(expected)!==JSON.stringify([...matches.keys()].sort()))throw Error('Results do not match the scheduled opponents.');}
 next.results.push({week,actual:true,correction:exists,officerConfirmed:exists&&officerConfirmed,matches:[...matches.values()]});next.results.sort((a,b)=>a.week-b.week);
 validateWorkspace(next);return next;
}
export function importHistory(state,text){
 const rows=parseCSV(text),next=structuredClone(state),seen=new Set(next.bowlers.flatMap(b=>(b.history||[]).map(h=>b.id+'|'+h.date)));
 for(const r of rows){const b=next.bowlers.find(b=>b.id===r.bowler_id);if(!b)throw Error('Unknown bowler ID '+r.bowler_id);if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date))throw Error('Use YYYY-MM-DD history dates.');const key=b.id+'|'+r.date;if(seen.has(key))throw Error('Duplicate historical session '+key);seen.add(key);b.history.push({date:r.date,scores:[1,2,3].map(g=>integer(r['game'+g],'history score'))});}
 return next;
}
export function scoresTemplate(state,week){
 const s=state.schedule.find(s=>s.week===week);if(!s||s.kind==='position')return TEMPLATES.scores;
 const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
 return TEMPLATES.scores+s.pairs.flatMap(([a,b])=>[a,b].filter(Boolean).flatMap(team=>state.teams.find(t=>t.number===team).players.map((id,i)=>[week,team,team===a?b:a,i+1,id,'','','','actual','actual','actual',leagueAverage(state,id,week),handicap(leagueAverage(state,id,week),state.rules)].map(quote).join(',')))).join('\n')+'\n';
}

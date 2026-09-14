
import {initialState,scoreMatch,handicap,leagueAverage,simulate,forecastIssues,validateWorkspace,inputKey} from '../dist/engine.js';
import {parseCSV,importRoster,importSchedule,importScores,TEMPLATES} from '../dist/imports.js';
import {playerStats} from '../dist/stats.js';
export function scenarios(){
 const passed=[],assert=(v,m)=>{if(!v)throw Error(m);},eq=(a,b,m)=>assert(JSON.stringify(a)===JSON.stringify(b),m+' '+JSON.stringify(a));
 const test=(name,fn)=>{fn();passed.push(name);};
 const throws=fn=>{let did=false;try{fn();}catch{did=true;}assert(did,'Expected rejection');};
 const player=(team,slot,score=200)=>({team,slot,bowlerId:team+'-'+slot,average:200,handicap:34,types:['actual','actual','actual'],scores:[score,score,score]});
 const match=(a=200,b=190)=>({teamA:1,teamB:2,players:[...Array.from({length:5},(_,i)=>player(1,i+1,a)),...Array.from({length:5},(_,i)=>player(2,i+1,b))]});
 function fixture(count=8){
  const s=initialState();s.rules.assumptionsConfirmed=true;s.rules.fillEightWithWildcards=true;
  for(let n=1;n<=count;n++){const players=[];for(let i=1;i<=5;i++){const id=n+'-'+i;players.push(id);s.bowlers.push({id,name:'Bowler '+id,entering:200,team:n,history:[]});}s.teams.push({number:n,name:'Team '+n,division:String((n-1)%(count===20?4:3)+1),players});}
  for(let w=1;w<=32;w++)s.schedule.push({week:w,kind:'regular',pairs:Array.from({length:count/2},(_,i)=>[i*2+1,i*2+2]),lanes:[]});
  return s;
 }
 test('30-point sweep',()=>eq(scoreMatch(match()).points,[30,0],'Sweep'));
 test('All tied games split 15–15',()=>eq(scoreMatch(match(200,200)).points,[15,15],'Tie'));
 test('Blind cannot win or split an individual point',()=>{const m=match(200,190);m.players[0].types=['blind','blind','blind'];m.players[0].scores=[190,190,190];const s=scoreMatch(m);eq(s.points,[27,0],'Blind points');eq(s.unawarded,3,'Unawarded');});
 test('Actual opponent must beat blind plus handicap',()=>{const m=match(190,191);m.players.slice(0,5).forEach(p=>{p.types=['blind','blind','blind'];});eq(scoreMatch(m).points,[0,30],'Beats blind');});
 test('Blind versus blind rejected',()=>{const m=match();m.players[0].types[0]='blind';m.players[5].types[0]='blind';throws(()=>scoreMatch(m));});
 test('Bye thresholds inclusive',()=>{const m={teamA:1,teamB:0,players:Array.from({length:5},(_,i)=>player(1,i+1,190))};eq(scoreMatch(m).points,[30,0],'Bye at threshold');m.players.forEach(p=>p.scores=[189,189,189]);eq(scoreMatch(m).points,[0,0],'Bye below threshold');});
 test('Handicap rounding and cap explicit',()=>{eq(handicap(201,{rounding:'floor'}),33,'Floor');eq(handicap(241,{rounding:'floor'}),0,'Cap');eq(handicap(241,{rounding:'floor',negativeHandicap:true}),-1,'Negative');});
 test('CSV quoted commas, escaped quotes and CRLF',()=>eq(parseCSV('id,name\r\n1,"Smith, ""Doug"""\r\n'),[{id:'1',name:'Smith, "Doug"'}],'CSV'));
 test('Malformed CSV rejected',()=>{throws(()=>parseCSV('a,b\n1,"x'));throws(()=>parseCSV('a,a\n1,2'));});
 const scoreCSV=(week=1)=>TEMPLATES.scores+fixture().teams.flatMap(t=>t.players.map((id,i)=>[week,t.number,t.number%2?t.number+1:t.number-1,i+1,id,200,210,220,'actual','actual','actual','',''].join(','))).join('\n');
 test('Atomic complete weekly score import',()=>{const s=fixture(),n=importScores(s,scoreCSV());eq(s.results.length,0,'Original untouched');eq(n.results.length,1,'Week imported');eq(n.results[0].matches.length,4,'Matches');validateWorkspace(n);});
 test('Incomplete import and duplicates rejected',()=>{const csv=scoreCSV();throws(()=>importScores(fixture(),csv.split('\n').slice(0,-1).join('\n')));throws(()=>importScores(fixture(),csv+'\n'+csv.split('\n')[1]));});
 test('Corrections require officer confirmation',()=>{const s=importScores(fixture(),scoreCSV());throws(()=>importScores(s,scoreCSV()));throws(()=>importScores(s,scoreCSV(),{replace:true}));eq(importScores(s,scoreCSV(),{replace:true,officerConfirmed:true}).results.length,1,'Replaces once');});
 test('Actual stats exclude history and partial blind games',()=>{const s=importScores(fixture(),scoreCSV());const p=s.results[0].matches[0].players[0];p.types[0]='blind';p.scores[0]=190;s.bowlers[0].history=[{date:'2025-01-01',scores:[300,300,300]}];const stats=playerStats(s,s.bowlers[0]);eq(stats.games,2,'Games');eq(stats.pins,430,'Pins');eq(stats.average,215,'Average');eq(stats.highSeries,null,'Partial series excluded');});
 test('Current handicap average starts after nine games',()=>{let s=fixture();s=importScores(s,scoreCSV(1));s=importScores(s,scoreCSV(2));eq(leagueAverage(s,'1-1',3),200,'Entering until nine');s=importScores(s,scoreCSV(3));eq(leagueAverage(s,'1-1',4),210,'Actual after nine');});
 test('Floating substitute credited by ID',()=>{const s=fixture();s.bowlers.push({id:'sub',name:'Sub',entering:180,team:0,history:[]});const csv=scoreCSV().replace(',1-1,',',sub,');const n=importScores(s,csv);eq(playerStats(n,n.bowlers.find(b=>b.id==='sub')).games,3,'Sub actuals');eq(playerStats(n,n.bowlers[0]).games,0,'Regular absent');});
 test('Roster duplicates rejected',()=>throws(()=>importRoster(initialState(),TEMPLATES.roster+'1,Team,1,1,a,A,200\n1,Team,1,2,a,A,200')));
 test('Missing schedule blocks forecast',()=>{const s=fixture();s.schedule=[];assert(forecastIssues(s).some(x=>x.includes('Schedule missing')),'Missing schedule');});
 test('Three-division wildcard ambiguity blocks forecast',()=>{const s=fixture();s.rules.fillEightWithWildcards=false;assert(forecastIssues(s).some(x=>x.includes('six half-winner')),'Wildcard gate');});
 test('Invalid backup week duplication rejected',()=>{const s=importScores(fixture(),scoreCSV());s.results.push(structuredClone(s.results[0]));throws(()=>validateWorkspace(s));});
 test('Forecast seed reproducible, totals reconcile, actual week fixed',()=>{
  const s=importScores(fixture(),scoreCSV()),a=simulate(s,3,1234),b=simulate(s,3,1234);
  eq(a.teams,b.teams,'Seeded teams');eq(a.weekly,b.weekly,'Seeded weekly');
  assert(Math.abs(a.teams.reduce((n,t)=>n+t.playoffs,0)-8)<1e-9,'Eight berths');
  assert(Math.abs(a.teams.reduce((n,t)=>n+t.champion,0)-1)<1e-9,'One champion');
  eq(a.weekly[0].teams.map(t=>t.points),Array(8).fill(15),'Actual scores fixed');
  for(const t of a.teams){const total=a.weekly.reduce((n,w)=>n+w.teams.find(x=>x.number===t.number).points,0);assert(Math.abs(total-t.points)<1e-8,'Weekly points reconcile');assert(Math.abs(t.halfPoints[0]+t.halfPoints[1]-t.points)<1e-8,'Half points reconcile');}
 });
 test('Forecast invalidated by changed scores or settings',()=>{const s=fixture(),a=inputKey(s);s.rules.rounding='nearest';assert(inputKey(s)!==a,'Settings key');});

 test('Twelve-team qualification and position rounds reconcile',()=>{const s=fixture(12);for(const sch of s.schedule)if([10,13,16,26,29,32].includes(sch.week)){sch.kind='position';sch.pairs=[];}const r=simulate(s,4,42);assert(Math.abs(r.teams.reduce((n,t)=>n+t.playoffs,0)-8)<1e-8,'12-team playoff count');for(let h=0;h<2;h++)assert(Math.abs(r.teams.reduce((n,t)=>n+t.halves[h],0)-3)<1e-8,'Three division winners');assert(r.teams.some(t=>t.playoffs<1),'Teams miss playoffs');});
 test('Twenty-team four-division format',()=>{const s=fixture(20);s.rules.fillEightWithWildcards=false;eq(forecastIssues(s),[],'Four divisions ready');const r=simulate(s,2,99);for(let h=0;h<2;h++)assert(Math.abs(r.teams.reduce((n,t)=>n+t.halves[h],0)-4)<1e-8,'Four half winners');});
 test('Complete roster and schedule import',()=>{const s=fixture(),csv=TEMPLATES.roster+s.teams.flatMap(t=>t.players.map((id,i)=>[t.number,t.name,t.division,i+1,id,'Bowler '+id,200].join(','))).join('\n');const roster=importRoster(initialState(),csv);eq(roster.teams.length,8,'Roster');const sch=importSchedule(roster,TEMPLATES.schedule+'1,regular,1,2,1\n1,regular,3,4,3\n1,regular,5,6,5\n1,regular,7,8,7');eq(sch.schedule.length,7,'Six position rounds plus week one');});
 return passed;
}


import {validateWorkspace} from './engine.js';
const URL='https://qfzoyultwhzsensbfegf.supabase.co';
const KEY='sb_publishable_kT5YW053RjB8SOvirQmM-A_Aa3pFN6S';
let session=null;try{session=JSON.parse(sessionStorage.getItem('monday-auth')||'null');}catch{}
let verification=null;
function remember(s){session=s;if(s)sessionStorage.setItem('monday-auth',JSON.stringify(s));else sessionStorage.removeItem('monday-auth');}
export function sameWorkspace(a,b){const order=v=>Array.isArray(v)?v.map(order):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,order(v[k])])):v;return JSON.stringify(order(a))===JSON.stringify(order(b));}
async function request(path,options={}){
 const r=await fetch(URL+path,{...options,headers:{apikey:KEY,'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{}),...options.headers}});
 const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={message:text};}
 if(!r.ok)throw Error(data.message||data.msg||data.error_description||'Database request failed.');return data;
}
async function refresh(){if(!session)throw Error('Sign in first.');if(Date.now()/1000>(session.expires_at||0)-60){try{const s=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});remember({...s,expires_at:Date.now()/1000+s.expires_in});}catch(e){remember(null);throw e;}}}
export const cloud={
 get email(){return session?.user?.email||null;},get verification(){return verification;},
 async login(email,password){const s=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});remember({...s,expires_at:Date.now()/1000+s.expires_in});verification=null;},
 async logout(){try{await request('/auth/v1/logout',{method:'POST'});}finally{remember(null);verification=null;}},
 async load(){await refresh();const rows=await request('/rest/v1/monday_workspaces?id=eq.2026-2027&select=state,revision');if(!rows.length){verification={readAt:new Date().toISOString(),present:false};return null;}validateWorkspace(rows[0].state);verification={readAt:new Date().toISOString(),present:true,revision:rows[0].revision,weeks:rows[0].state.results.map(r=>r.week)};return rows[0];},
 async save(state,revision){validateWorkspace(state);await refresh();const next=await request('/rest/v1/rpc/save_monday_workspace',{method:'POST',body:JSON.stringify({p_state:state,p_revision:revision})});const saved=await this.load();if(!saved||saved.revision!==next||!sameWorkspace(saved.state,state))throw Error('Save could not be verified. Load the saved league before retrying.');verification.verifiedSave=true;return next;}
};

(()=>{
const APP_VERSION="2.0";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ICON_URI="icon-96.png";
$("#brandIcon").src=ICON_URI;

const CUR={DZD:{sym:"DA",name:"Dinar"},USD:{sym:"$",name:"Dollar"},EUR:{sym:"€",name:"Euro"},KRW:{sym:"₩",name:"Won"},CNY:{sym:"¥",name:"Yuan"},GBP:{sym:"£",name:"Pound"}};
const DEF_CATS={
  in:[["car","Car export","CE"],["korea","Korea clients (web/apps)","KR"],["apps","App sales to showrooms","AP"],["design","Design work","DS"],["docs","Car papers & stamps","PS"],["other_in","Other freelance","FR"]],
  out:[["food","Food & café","FD"],["fuel","Fuel & transport","TR"],["phone","Phone & internet","PH"],["soft","Software & subs","SW"],["gear","Gear & devices","GR"],["work","Work costs","WK"],["home","Home & bills","HM"],["family","Family","FM"],["clothes","Clothes","CL"],["health","Health","HL"],["fun","Going out","GO"],["other_out","Other","OT"]]
};
const toCatObj=([id,name,code])=>({id,name,code});
const DEF_ACCOUNTS=[{id:"Cash",name:"Cash (dinars)",cur:"DZD"},{id:"CCP / BaridiMob",name:"CCP / BaridiMob",cur:"DZD"},{id:"Bank",name:"Bank",cur:"DZD"},
  {id:"Online (Wise, Payoneer…)",name:"Online (Wise, Payoneer…)",cur:"USD"},{id:"eur_cash",name:"Euros cash",cur:"EUR"},{id:"usd_cash",name:"Dollars cash",cur:"USD"},
  {id:"pot_main",name:"Savings",cur:"DZD",kind:"savings",goal:0}];
const SPECIAL={fees:{id:"fees",name:"Transfer & withdrawal fees",code:"FE"},debt:{id:"debt",name:"Debt",code:"DB"},move:{id:"move",name:"Move",code:"MV"}};
const DEF_RATES={USD:245,EUR:265,KRW:0.18,CNY:34,GBP:300};
const PALETTE=["#117a5a","#3457d5","#b5781c","#7c4dbd","#c4472f","#1f8fa8","#5b6b3a","#a3375f"];

let state={txs:[],rates:{...DEF_RATES},cats:{in:DEF_CATS.in.map(toCatObj),out:DEF_CATS.out.map(toCatObj)},accounts:DEF_ACCOUNTS.map(a=>({...a})),
  mode:"loading",demo:false,view:"home",month:ym(new Date()),filter:{type:"all",q:"",scope:"month",acc:""},catTab:"out",loaded:false,standalone:!!window.__MASROUF_STANDALONE__};
let txCol=null,setDoc=null,dl=null,installEvt=null;

/* ---------- helpers ---------- */
function ym(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")}
function today(){const d=new Date();return ym(d)+"-"+String(d.getDate()).padStart(2,"0")}
function shiftMonth(m,n){const[y,mo]=m.split("-").map(Number);return ym(new Date(y,mo-1+n,1))}
const MN=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function mLabel(m,short){const[y,mo]=m.split("-");return MN[mo-1]+(short?"":" "+y)}
function dayLabel(d){const t=today(),y=new Date();y.setDate(y.getDate()-1);
  if(d===t)return"Today";if(d===ym(y)+"-"+String(y.getDate()).padStart(2,"0"))return"Yesterday";
  const dt=new Date(d+"T12:00");return dt.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",...(d.slice(0,4)!==t.slice(0,4)?{year:"numeric"}:{})})}
function grp(n,dec=0){const s=Math.abs(n).toFixed(dec);const[i,f]=s.split(".");return i.replace(/\B(?=(\d{3})+(?!\d))/g," ")+(f?"."+f:"")}
function da(n,sign){return (sign&&n>0?"+":"")+(n<0?"−":"")+grp(Math.round(Math.abs(n)))+" DA"}
function cts(n){const m=Math.abs(n)/10000;if(m<1)return"";return"≈ "+(m>=100?grp(m):m.toFixed(m<10?2:1).replace(/\.0+$/,""))+" million (centimes)"}
function fmtCur(v,cur){const dec=cur==="KRW"||cur==="DZD"?0:2;const r=Math.round(v*10**dec)/10**dec;return(r<0?"−":"")+(cur==="DZD"?grp(Math.abs(r))+" DA":CUR[cur].sym+grp(Math.abs(r),Math.abs(r)%1?dec:0))}
function orig(t){if(t.cur==="DZD")return"";const dec=t.cur==="KRW"?0:2;return CUR[t.cur].sym+grp(t.amount,t.amount%1?dec:0)+" @ "+t.rate}
const num=v=>parseFloat(String(v??"").replace(/\s/g,"").replace(",","."));
const toDA=(v,cur)=>cur==="DZD"?v:v*(state.rates[cur]||0);
const catsOf=type=>state.cats[type].filter(c=>!c.hidden);
const catOf=id=>{const c=[...state.cats.in,...state.cats.out].find(c=>c.id===id)||SPECIAL[id]||{id,name:"Other",code:"··"};return[c.id,c.name,c.code]};
const accounts=()=>state.accounts.filter(a=>!a.hidden);
const accOf=id=>state.accounts.find(a=>a.id===id)||{id:id||"Cash",name:id||"Cash",cur:"DZD"};
const accName=id=>accOf(id).name;
const isPot=a=>a&&a.kind==="savings";
const mkCode=n=>{const w=n.trim().split(/[\s&\/,-]+/).filter(Boolean);return((w.length>1?w[0][0]+w[1][0]:(w[0]||"??").slice(0,2))).toUpperCase()};
const accColor=id=>{const i=Math.max(0,state.accounts.findIndex(a=>a.id===id));return PALETTE[i%PALETTE.length]};

/* ---------- storage ---------- */
const LKEY="masrouf.v1";
function applySettings(d){state.rates={...DEF_RATES,...(d.rates||{})};if(d.cats&&d.cats.in&&d.cats.out)state.cats=d.cats;if(Array.isArray(d.accounts)&&d.accounts.length)state.accounts=d.accounts}
const settingsBody=()=>({rates:state.rates,cats:state.cats,accounts:state.accounts});
function loadLocal(){try{const j=JSON.parse(localStorage.getItem(LKEY)||"null");if(j){state.txs=j.txs||[];applySettings(j)}}catch(e){}}
function saveLocal(){try{localStorage.setItem(LKEY,JSON.stringify({txs:state.txs,...settingsBody()}))}catch(e){}}
function pref(k,v){try{if(v===undefined)return localStorage.getItem("masrouf.p."+k);localStorage.setItem("masrouf.p."+k,v)}catch(e){return null}}

async function init(){
  const th=pref("theme");if(th==="dark"||th==="light")document.documentElement.dataset.theme=th;
  const h=location.hash.replace("#","");if(["home","wallet","debts","history","prefs"].includes(h))state.view=h;
  render();
  let db=null,user=null;
  try{if(window.claude&&window.claude.use){[db,user]=await Promise.all([window.claude.use("db"),window.claude.use("user")]);dl=await window.claude.use("downloads")}}catch(e){}
  let uid=null;try{uid=user?await user.id():null}catch(e){}
  if(db&&uid){
    state.mode="db";
    const base="data/users/"+uid;
    txCol=db.doc(base+"/ledger").collection("tx");
    setDoc=db.doc(base+"/settings");
    const timer=setTimeout(()=>{if(!state.loaded){$("#sync").textContent="Can't reach your data yet…"}},10000);
    txCol.onSnapshot(s=>{state.txs=s.docs.map(d=>({id:d.id,...d.data()}));if(!s.metadata.fromCache){state.loaded=true;clearTimeout(timer)}render()},
      e=>{clearTimeout(timer);state.loaded=true;$("#sync").textContent="Sync stopped — reopen the app";render()});
    setDoc.onSnapshot(s=>{if(s.exists){applySettings(s.data());if(!document.activeElement||!document.activeElement.closest("#view .setedit"))render()}},()=>{});
  }else{
    state.mode="local";loadLocal();state.loaded=true;render();
    try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
  }
}
async function putTx(t){
  if(state.mode==="db"){const{id,...body}=t;await txCol.doc(id).set(body)}
  else{const i=state.txs.findIndex(x=>x.id===t.id);if(i>=0)state.txs[i]=t;else state.txs.push(t);saveLocal();render()}
}
async function delTx(id){
  if(state.mode==="db")await txCol.doc(id).delete();
  else{state.txs=state.txs.filter(x=>x.id!==id);saveLocal();render()}
}
let setChain=Promise.resolve();
function putSettings(patch){
  Object.assign(state,patch);render();
  setChain=setChain.then(()=>state.mode==="db"?setDoc.set(settingsBody()):saveLocal());
  return setChain;
}

/* ---------- demo ---------- */
function demoTxs(){
  let n=0;const m=state.month,mk=(d,type,cat,amount,cur,note,wallet)=>{const rate=cur==="DZD"?1:DEF_RATES[cur];return{id:"demo"+(n++),date:m+"-"+String(d).padStart(2,"0"),type,cat,amount,cur,rate,dzd:Math.round(amount*rate),note,wallet}};
  const p=shiftMonth(m,-1),pk=(d,...a)=>{const t=mk(d,...a);t.date=p+t.date.slice(7);return t};
  return[
    mk(3,"in","car",350000,"DZD","Commission — Tucson 2023 from Incheon","Cash"),
    mk(6,"in","korea",1200,"USD","Landing page for a Busan client","Online (Wise, Payoneer…)"),
    mk(9,"in","docs",15000,"DZD","Carte grise + stamps, 3 cars","Cash"),
    mk(14,"in","apps",80000,"DZD","Showroom stock app — Oran","CCP / BaridiMob"),
    mk(18,"in","design",25000,"DZD","Logo for a garage","Cash"),
    mk(2,"out","fuel",4500,"DZD","Full tank","Cash"),
    mk(4,"out","food",1800,"DZD","Lunch with the showroom guys","Cash"),
    mk(5,"out","phone",2000,"DZD","Mobilis 4G pack","CCP / BaridiMob"),
    mk(7,"out","soft",20,"USD","Figma","Online (Wise, Payoneer…)"),
    mk(11,"out","family",30000,"DZD","For mama","Cash"),
    mk(12,"out","home",9500,"DZD","Sonelgaz + water","CCP / BaridiMob"),
    mk(15,"out","gear",45000,"DZD","SSD + phone case","Cash"),
    mk(16,"out","food",650,"DZD","Coffee & msemen","Cash"),
    mk(19,"out","fun",6000,"DZD","Dinner out","Cash"),
    mk(21,"out","fuel",3000,"DZD","Fuel","Cash"),
    mk(22,"out","clothes",12000,"DZD","Jacket","Cash"),
    pk(5,"in","car",280000,"DZD","Commission — Chinese EV","Cash"),
    pk(12,"in","korea",800,"USD","App fixes","Online (Wise, Payoneer…)"),
    pk(8,"out","food",14000,"DZD","Food, whole month","Cash"),
    pk(20,"out","family",30000,"DZD","For mama","Cash"),
    pk(22,"out","gear",8000,"DZD","Cable + charger","Cash"),
    {...mk(8,"move","move",800,"USD","Sold dollars at the square",""),from:"Online (Wise, Payoneer…)",to:"Cash",amountIn:200000,curIn:"DZD",fee:0},
    {...mk(13,"move","move",40000,"DZD","Withdrew at the post office",""),from:"CCP / BaridiMob",to:"Cash",amountIn:39800,curIn:"DZD",fee:200},
    {...mk(20,"move","move",100000,"DZD","Putting away for the car",""),from:"Cash",to:"pot_main",amountIn:100000,curIn:"DZD",fee:0},
    {...pk(25,"move","move",60000,"DZD","",""),from:"Cash",to:"pot_main",amountIn:60000,curIn:"DZD",fee:0},
    {...mk(10,"debt","debt",100000,"DZD","For the laptop","Cash"),dir:"owe",held:true,who:"Karim",payments:[{date:m+"-20",dzd:40000,amount:40000,cur:"DZD",wallet:"Cash"}]},
    {...mk(17,"debt","debt",500,"USD","Second half of the app","Online (Wise, Payoneer…)"),dir:"owed",who:"Seoul client (Mr. Park)",payments:[]},
  ];
}
const list=()=>state.demo?demoTxs():state.txs;

/* ---------- calculations ---------- */
function totals(txs){let i=0,o=0;for(const t of txs){if(t.type==="in")i+=t.dzd;else if(t.type==="out")o+=t.dzd;else if(t.type==="move")o+=t.fee||0}return{i,o,n:i-o}}
function byCat(txs,type){const m={};for(const t of txs){if(t.type===type)m[t.cat]=(m[t.cat]||0)+t.dzd;else if(type==="out"&&t.type==="move"&&t.fee)m.fees=(m.fees||0)+t.fee}return Object.entries(m).sort((a,b)=>b[1]-a[1])}
function sortTx(a){return a.slice().sort((x,y)=>(y.date+(y.createdAt||0)).localeCompare(x.date+(x.createdAt||0))||(y.createdAt||0)-(x.createdAt||0))}
const paid=t=>(t.payments||[]).reduce((s,p)=>s+p.dzd,0);
const remain=t=>Math.max(0,t.dzd-paid(t));
function accBalances(txs){
  const b={};state.accounts.forEach(a=>b[a.id]=0);
  const val=(id,t)=>{const a=accOf(id);return t.cur===a.cur?t.amount:a.cur==="DZD"?t.dzd:t.dzd/(state.rates[a.cur]||1)};
  const add=(id,v)=>{id=id||"Cash";b[id]=(b[id]||0)+v};
  for(const t of txs){
    if(t.type==="in")add(t.wallet,val(t.wallet,t));
    else if(t.type==="out")add(t.wallet,-val(t.wallet,t));
    else if(t.type==="move"){add(t.from,-t.amount);add(t.to,t.amountIn)}
    else if(t.type==="debt"){
      const legacy=(t.payments||[]).filter(p=>!p.wallet&&!p.nowallet).reduce((s,p)=>s+p.dzd,0);
      if(t.dir==="owe"&&t.held===true&&t.dzd>0)add(t.wallet,val(t.wallet,t)*Math.max(0,t.dzd-legacy)/t.dzd);
      if(t.dir==="owed"&&t.lent===true)add(t.wallet,-val(t.wallet,t));
      for(const p of t.payments||[])if(p.wallet){const a=accOf(p.wallet),v=p.amount!=null&&p.cur===a.cur?p.amount:a.cur==="DZD"?p.dzd:p.dzd/(state.rates[a.cur]||1);add(p.wallet,t.dir==="owe"?-v:v)}
    }
  }
  return b;
}
function summary(all){
  const b=accBalances(all);let total=0,savings=0,owe=0,owed=0,held=0;
  for(const id in b){const a=accOf(id),v=toDA(b[id],a.cur);if(isPot(a))savings+=v;else total+=v}
  for(const t of all)if(t.type==="debt"){if(t.dir==="owe"){owe+=remain(t);if(t.held===true)held+=remain(t)}else owed+=remain(t)}
  return{b,total,savings,owe,owed,held};
}
function touches(t,id){return t.wallet===id||t.from===id||t.to===id||(t.payments||[]).some(p=>p.wallet===id)}

/* ---------- shared HTML ---------- */
const icon=n=>({
  minus:'<svg class="i" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  plus:'<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  swap:'<svg class="i" viewBox="0 0 24 24"><path d="M7 10h11l-3-3M17 14H6l3 3"/></svg>',
  pot:'<svg class="i" viewBox="0 0 24 24"><path d="M5 9h14l-1.2 9.5a2 2 0 0 1-2 1.5H8.2a2 2 0 0 1-2-1.5zM9 9V7a3 3 0 0 1 6 0v2M12 13v3"/></svg>'
})[n]||"";
function txRow(t){
  if(t.type==="debt")return `<button class="row" data-debt="${esc(t.id)}"><span class="mono debt">${t.dir==="owe"?"IO":"OM"}</span><span class="t"><b>${t.dir==="owe"?"Borrowed from ":"Lent to "}${esc(t.who)}</b><span>${esc(t.note||(remain(t)>0?grp(remain(t))+" DA left":"Paid off"))}</span></span><span class="a debt">${grp(t.dzd)}<small>${esc(orig(t)||"debt")}</small></span></button>`;
  if(t.type==="move"){const toPot=isPot(accOf(t.to)),fromPot=isPot(accOf(t.from));
    return `<button class="row" data-edit="${esc(t.id)}"><span class="mono ${toPot||fromPot?"pot":"move"}">${toPot?"SV":fromPot?"TK":t.cur!==t.curIn?"FX":accOf(t.to).id==="Cash"?"WD":"MV"}</span><span class="t"><b>${esc(accName(t.from))} → ${esc(accName(t.to))}</b><span>${esc(t.note||(toPot?"Saved":fromPot?"Taken from savings":t.cur!==t.curIn?"Converted":"Moved"))}</span></span><span class="a move">${fmtCur(t.amount,t.cur)}<small>→ ${fmtCur(t.amountIn,t.curIn)}${t.fee?" · fee "+grp(t.fee):""}</small></span></button>`}
  const c=catOf(t.cat);
  return `<button class="row" data-edit="${esc(t.id)}"><span class="mono ${t.type}">${esc(c[2])}</span><span class="t"><b>${esc(c[1])}</b><span>${esc(t.note||accName(t.wallet))}</span></span><span class="a ${t.type}">${t.type==="in"?"+":"−"}${grp(t.dzd)}<small>${esc(orig(t)||accName(t.wallet))}</small></span></button>`;
}
function rowsHTML(txs){
  const byDay={};for(const t of sortTx(txs))(byDay[t.date]=byDay[t.date]||[]).push(t);
  return Object.entries(byDay).map(([d,arr])=>{
    const net=arr.reduce((s,t)=>s+(t.type==="in"?t.dzd:t.type==="out"?-t.dzd:t.type==="move"?-(t.fee||0):0),0);
    return `<div><div class="day"><span>${dayLabel(d)}</span><span class="num">${da(net,true)}</span></div><div class="rows">${arr.map(txRow).join("")}</div></div>`}).join("");
}
function barsHTML(rows,total,cls){
  if(!rows.length)return`<p class="empty-note">Nothing yet this month.</p>`;
  const max=rows[0][1];
  return `<div class="bars ${cls}">${rows.map(([k,v])=>`<div class="bar"><div class="top"><span>${esc(catOf(k)[1])}<span class="pct">${Math.round(v/total*100)}%</span></span><span class="num">${grp(v)} DA</span></div><div class="track"><div class="fill" style="width:${Math.max(2,v/max*100)}%"></div></div></div>`).join("")}</div>`;
}
function accountRows(all,S,pots){
  const rows=state.accounts.filter(a=>isPot(a)===pots&&(!a.hidden||Math.abs(S.b[a.id]||0)>0.005));
  if(!rows.length)return `<p class="empty-note">${pots?"No savings pot yet.":"No accounts."}</p>`;
  return `<div class="rows acclist">${rows.map(a=>{const v=S.b[a.id]||0;
    return `<button class="row" data-acc="${esc(a.id)}"><span class="mono ${pots?"pot":"acc-m"}">${pots?icon("pot"):CUR[a.cur].sym}</span><span class="t"><b>${esc(a.name)}</b><span>${pots&&a.goal?grp(Math.round(v/a.goal*100))+"% of "+fmtCur(a.goal,a.cur):a.cur==="DZD"?"Dinars":CUR[a.cur].name+"s"}</span></span><span class="a ${v<0?"neg":""}">${fmtCur(v,a.cur)}${a.cur!=="DZD"&&v?`<small>≈ ${grp(Math.round(toDA(v,a.cur)))} DA</small>`:""}</span></button>`}).join("")}</div>`;
}
function demoBar(){return state.demo?`<div class="demo"><span>Example data — not saved</span><button data-act="exitdemo">Exit example</button></div>`:""}

/* ---------- views ---------- */
function homeView(){
  const all=list(),mtx=all.filter(t=>t.date.startsWith(state.month)),T=totals(mtx),S=summary(all);
  let h=demoBar();
  if(!all.length&&state.loaded){
    return h+`<div class="panel welcome"><div class="lbl">Start here</div><h2 style="margin:0;font-size:22px">Log what comes in and what goes out.</h2>
      <p>A commission from the showroom, a Korean client paying in dollars, fuel, a coffee. Each takes about five seconds. After a week you'll see exactly where it goes.</p>
      <button class="btn" data-act="add">Add the first one</button><button class="btn ghost" data-act="demo">Show me an example</button>
      ${state.standalone?`<button class="btn ghost" data-v="prefs">Restore a backup</button>`:""}</div>`;
  }
  const segs=state.accounts.filter(a=>!isPot(a)&&!a.hidden).map(a=>({a,v:toDA(S.b[a.id]||0,a.cur)})).filter(x=>x.v>0);
  const segTotal=segs.reduce((s,x)=>s+x.v,0);
  h+=`<div class="hero"><div class="lbl">What's left · right now</div>
    <div class="big">${S.total<0?"−":""}${grp(Math.abs(S.total))}<small>DA</small></div>
    <div class="sub">${cts(S.total)||"All accounts at your rates, savings kept aside"}</div>
    ${segs.length?`<div class="segbar">${segs.map(x=>`<i style="width:${Math.max(1.5,x.v/segTotal*100)}%;background:${accColor(x.a.id)}"></i>`).join("")}</div>
    <div class="seglegend">${segs.map(x=>`<span><i style="background:${accColor(x.a.id)}"></i>${esc(x.a.name)} <b class="num">${fmtCur(S.b[x.a.id],x.a.cur)}</b></span>`).join("")}</div>`:""}
    <div class="pills">
      <button class="pill save" data-v="wallet">${icon("pot")} Savings <b>${grp(S.savings)} DA</b></button>
      <button class="pill owe" data-v="debts">I owe <b>${grp(S.owe)} DA</b></button>
      <button class="pill owed" data-v="debts">Owed to me <b>${grp(S.owed)} DA</b></button>
    </div></div>
  <div class="quick"><button data-act="add-out"><span class="ic out">${icon("minus")}</span>Expense</button><button data-act="add-in"><span class="ic in">${icon("plus")}</span>Income</button><button data-act="move"><span class="ic mv">${icon("swap")}</span>Move</button></div>`;
  const mx2=Math.max(1,T.i,T.o);
  h+=`<div class="mcard"><div class="row2"><div><div class="lbl">${mLabel(state.month)} · came in</div><div class="v in">${grp(T.i)} DA</div></div><div><div class="lbl">went out</div><div class="v out">${grp(T.o)} DA</div></div></div>
    <div class="iobar"><i style="width:${T.i/(T.i+T.o||1)*100}%;background:var(--in)"></i><i style="width:${T.o/(T.i+T.o||1)*100}%;background:var(--out)"></i></div>
    <div class="net"><span class="muted">Month result</span><span class="num" style="font-weight:700;color:${T.n<0?"var(--out)":"var(--in)"}">${da(T.n,true)}</span></div></div>`;
  h+=`<section><h2>Where it went</h2><div class="panel">${barsHTML(byCat(mtx,"out"),T.o,"exp")}</div></section>
  <section><h2>Where it came from</h2><div class="panel">${barsHTML(byCat(mtx,"in"),T.i,"inc")}</div></section>`;
  const ms=[...Array(6)].map((_,k)=>shiftMonth(state.month,k-5)),vals=ms.map(m=>totals(all.filter(t=>t.date.startsWith(m))));
  const mx=Math.max(1,...vals.flatMap(v=>[v.i,v.o]));
  h+=`<section><h2>Last 6 months</h2><div class="panel"><div class="months">${ms.map((m,k)=>`<button class="mcol ${m===state.month?"cur":""}" data-month="${m}" aria-label="${mLabel(m)}: in ${grp(vals[k].i)} DA, out ${grp(vals[k].o)} DA"><div class="pair"><div class="b i" style="height:${vals[k].i/mx*100}%"></div><div class="b o" style="height:${vals[k].o/mx*100}%"></div></div><span>${mLabel(m,1)}</span></button>`).join("")}</div>
    <div class="legend"><span><i style="background:var(--in)"></i>Came in</span><span><i style="background:var(--out)"></i>Went out</span><span class="num" style="margin-left:auto">peak ${grp(mx)} DA</span></div></div></section>`;
  const recent=sortTx(mtx).slice(0,8);
  h+=`<section><h2>${mLabel(state.month)}<button data-v="history">See all</button></h2>${recent.length?rowsHTML(recent):`<p class="empty-note">No entries in ${mLabel(state.month)}.</p>`}</section>`;
  return h;
}

function walletView(){
  const all=list(),S=summary(all);
  const pots=state.accounts.filter(a=>isPot(a)&&!a.hidden);
  let h=demoBar();
  h+=`<div class="hero"><div class="lbl">In my accounts</div><div class="big">${S.total<0?"−":""}${grp(Math.abs(S.total))}<small>DA</small></div>
    <div class="sub">Savings kept aside: <b class="num" style="color:var(--save)">${grp(S.savings)} DA</b> · together ${da(S.total+S.savings)}</div></div>
  <div class="quick"><button data-act="move"><span class="ic mv">${icon("swap")}</span>Move</button><button data-act="newacc"><span class="ic in">${icon("plus")}</span>Account</button><button data-act="newpot"><span class="ic mv" style="background:var(--save);color:#fff">${icon("pot")}</span>Savings pot</button></div>
  <section><h2>Accounts</h2>${accountRows(all,S,false)}</section>
  <section><h2>Savings pots</h2>${pots.length?`<div class="pots">${pots.map(a=>{const v=S.b[a.id]||0,pc=a.goal?Math.min(100,v/a.goal*100):0;
    return `<button class="potcard" data-acc="${esc(a.id)}"><div class="top"><b>${esc(a.name)}</b><span class="num">${fmtCur(v,a.cur)}</span></div><div class="meta">${a.goal?`${Math.round(pc)}% of ${fmtCur(a.goal,a.cur)} · ${fmtCur(Math.max(0,a.goal-v),a.cur)} to go`:"No goal set · not counted in what's left"}</div>${a.goal?`<div class="prog"><i style="width:${pc}%"></i></div>`:""}</button>`}).join("")}</div>`:`<p class="empty-note">Put money aside and it leaves "what's left" without leaving you.</p>`}</section>`;
  return h;
}

function debtRows(arr){return arr.map(t=>{const p=paid(t),pc=t.dzd?Math.min(100,p/t.dzd*100):0,lent=t.dir!=="owe";
  return `<button class="drow ${lent?"lent":""} ${remain(t)<=0?"done":""}" data-debt="${esc(t.id)}"><div class="top"><b>${esc(t.who)}</b><span class="num">${remain(t)<=0?"Paid off":grp(remain(t))+" DA"}</span></div>
  <div class="meta">${!lent&&remain(t)>0?(t.held===true?"In hand · ":"Spent · "):""}${dayLabel(t.date)} · ${grp(t.dzd)} DA${p?" · "+grp(p)+" paid back":""}${t.note?" · "+esc(t.note):""}</div><div class="prog ${lent?"lent":"owe"}"><i style="width:${pc}%"></i></div></button>`}).join("")}
function debtsView(){
  const all=list(),S=summary(all),debts=sortTx(all.filter(t=>t.type==="debt"));
  const open=d=>debts.filter(t=>t.dir===d&&remain(t)>0),done=debts.filter(t=>remain(t)<=0);
  return demoBar()+`<div class="big3">
    <div class="bigt owe"><span class="lbl">I owe</span><span class="v">${grp(S.owe)} DA</span><span class="sub">${open("owe").length} open · ${grp(S.held)} DA of it still in hand · not taken off what's left</span></div>
    <div class="bigt lent"><span class="lbl">Owed to me</span><span class="v">${grp(S.owed)} DA</span><span class="sub">${open("owed").length} person${open("owed").length===1?"":"s"} still to pay you back</span></div></div>
  <section><h2>I owe<button data-act="adddebt" data-dir="owe">+ Add</button></h2>${open("owe").length?`<div class="rows">${debtRows(open("owe"))}</div>`:`<p class="empty-note">You don't owe anyone. Keep it that way.</p>`}</section>
  <section><h2>Owed to me<button data-act="adddebt" data-dir="owed">+ Add</button></h2>${open("owed").length?`<div class="rows">${debtRows(open("owed"))}</div>`:`<p class="empty-note">Nobody owes you right now.</p>`}</section>
  ${done.length?`<section><h2>Paid off <span class="muted" style="font-weight:500;font-size:13px">tap one to cancel a repayment</span></h2><div class="rows">${debtRows(done)}</div></section>`:""}`;
}

function historyView(){
  const f=state.filter,q=f.q.trim().toLowerCase();
  let txs=list();if(f.scope==="month")txs=txs.filter(t=>t.date.startsWith(state.month));
  if(f.type!=="all")txs=txs.filter(t=>t.type===f.type);
  if(f.acc)txs=txs.filter(t=>touches(t,f.acc));
  if(q)txs=txs.filter(t=>((t.type==="debt"?"debt "+(t.who||""):t.type==="move"?"move "+accName(t.from)+" "+accName(t.to)+" "+t.curIn:catOf(t.cat)[1])+" "+(t.note||"")+" "+accName(t.wallet)+" "+t.cur).toLowerCase().includes(q));
  const T=totals(txs);
  return demoBar()+`<div class="filters"><input class="search" id="q" type="search" placeholder="Search notes, categories, people" value="${esc(f.q)}">
  <div class="seg">${[["month",mLabel(state.month)],["all","All time"]].map(([k,l])=>`<button data-fscope="${k}" aria-pressed="${f.scope===k}">${l}</button>`).join("")}</div>
  <div class="seg">${[["all","All"],["out","Out"],["in","In"],["move","Moves"],["debt","Debts"]].map(([k,l])=>`<button data-ftype="${k}" aria-pressed="${f.type===k}">${l}</button>`).join("")}</div>
  <select class="txt" id="facc" aria-label="Account"><option value="">Every account</option>${state.accounts.filter(a=>!a.hidden).map(a=>`<option value="${esc(a.id)}" ${f.acc===a.id?"selected":""}>${esc(a.name)}</option>`).join("")}</select>
  <div class="sumline"><span>${txs.length} entr${txs.length===1?"y":"ies"}</span><span class="num">${f.type==="in"?grp(T.i)+" DA":f.type==="out"?grp(T.o)+" DA":f.type==="debt"?grp(txs.reduce((a,t)=>a+t.dzd,0))+" DA borrowed/lent":f.type==="move"?(T.o?"fees "+grp(T.o)+" DA":"no fees"):da(T.n,true)}</span></div></div>
  <div>${txs.length?rowsHTML(txs):`<p class="empty-note">Nothing matches.</p>`}</div>`;
}

function prefsView(){
  const r=state.rates,ct=state.catTab,used=new Set(state.txs.map(t=>t.cat));
  const live=state.cats[ct].filter(c=>!c.hidden),gone=state.cats[ct].filter(c=>c.hidden);
  const th=pref("theme")||"system";
  return `<section><h2>Appearance</h2><div class="panel"><div class="seg">${[["system","Auto"],["light","Light"],["dark","Dark"]].map(([k,l])=>`<button data-theme-set="${k}" aria-pressed="${th===k}">${l}</button>`).join("")}</div></div></section>
  <section class="setedit"><h2>My categories</h2><div class="panel stack">
    <div class="seg">${[["out","Expenses"],["in","Income"]].map(([k,l])=>`<button data-cattab="${k}" aria-pressed="${ct===k}">${l}</button>`).join("")}</div>
    <div class="edlist">${live.map(c=>`<div class="edrow"><span class="mono ${ct}">${esc(c.code)}</span><input id="cat_${esc(c.id)}" data-catname="${esc(c.id)}" value="${esc(c.name)}" aria-label="Category name"><button class="mini" data-cathide="${esc(c.id)}">Remove</button></div>`).join("")}</div>
    <div class="edrow add"><input id="newcat" placeholder="New ${ct==="in"?"income source":"expense category"}" aria-label="New category name"><button class="mini solid" data-act="addcat">Add</button></div>
    ${gone.length?`<details><summary>Removed (${gone.length})</summary><div class="edlist" style="margin-top:6px">${gone.map(c=>`<div class="edrow"><span class="mono ${ct}">${esc(c.code)}</span><span class="nm">${esc(c.name)}${used.has(c.id)?` <span class="muted">· in old entries</span>`:""}</span><button class="mini" data-catshow="${esc(c.id)}">Restore</button></div>`).join("")}</div></details>`:""}
    <p class="hint">Tap a name to rename it. Old entries follow. Removed ones leave the picker but stay on old entries.</p></div></section>
  <section><h2>Your exchange rates</h2><div class="panel"><p class="hint" style="margin-bottom:6px">Use the rate you actually get (square or bank). Balances in foreign currency are converted with these.</p>
    ${Object.keys(CUR).filter(c=>c!=="DZD").map(c=>`<div class="setrow"><label for="r_${c}">1 ${CUR[c].sym} <span class="muted">${CUR[c].name}</span></label><span style="display:flex;align-items:center;gap:6px"><input id="r_${c}" inputmode="decimal" value="${r[c]}"><span class="muted">DA</span></span></div>`).join("")}
    <button class="btn" data-act="saverates" style="margin-top:8px">Save rates</button></div></section>
  <section><h2>Backup</h2><div class="panel stack">
    <div class="notice">${state.mode==="db"?"Your entries sync to your Claude account and are private to you.":"Entries live on this device only. Export a backup now and then, and restore it on a new phone."}</div>
    <button class="btn ghost" data-act="csv">Export spreadsheet (.csv)</button>
    <button class="btn ghost" data-act="json">Export full backup (.json)</button>
    <label class="btn ghost" style="text-align:center" for="imp">Restore from backup…</label><input id="imp" type="file" accept=".json,application/json" hidden>
    <p class="err" id="setErr"></p></div></section>
  ${state.standalone?`<section><h2>Install</h2><div class="panel stack">${installEvt?`<button class="btn" data-act="install">Add Masrouf to home screen</button>`:window.matchMedia("(display-mode: standalone)").matches?`<div class="notice">Installed. Works offline.</div>`:`<div class="notice">Chrome: menu ⋮ → <b>Add to Home screen</b> → Install. Safari: Share → Add to Home Screen.</div>`}</div></section>`:""}
  <p class="hint" style="text-align:center">Masrouf ${APP_VERSION} · ${state.mode==="db"?"synced":"on-device"}</p>`;
}

function render(){
  $("#mLabel").textContent=mLabel(state.month);
  $("#monthCtl").hidden=!(state.view==="home"||(state.view==="history"&&state.filter.scope==="month"));
  $("#sync").textContent=!state.loaded?"Loading…":state.demo?"Example data":state.mode==="db"?"Synced · private to you":"Saved on this device";
  const v=$("#view"),focusQ=document.activeElement&&document.activeElement.id==="q";
  v.innerHTML={home:homeView,wallet:walletView,debts:debtsView,history:historyView,prefs:prefsView}[state.view]();
  if(focusQ){const q=$("#q");q.focus();q.setSelectionRange(q.value.length,q.value.length)}
  document.querySelectorAll("nav button").forEach(b=>b.setAttribute("aria-current",b.dataset.v===state.view?"page":"false"));
  $("#fab").hidden=state.view==="prefs";
}
function go(v){state.view=v;try{if(location.hash!=="#"+v)history.replaceState(null,"","#"+v)}catch(e){}render();scrollTo(0,0)}
window.addEventListener("hashchange",()=>{const h=location.hash.replace("#","");if(["home","wallet","debts","history","prefs"].includes(h)&&h!==state.view){state.view=h;render()}});

/* ---------- entry sheet ---------- */
function openSheet(tx,preset){
  const editing=!!tx;
  const lastCur=pref("cur")||"DZD";
  const t=tx?{...tx}:{id:"t"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),type:pref("type")||"out",amount:"",cur:lastCur,rate:lastCur==="DZD"?1:state.rates[lastCur],cat:"",wallet:pref("wallet")||"Cash",note:"",date:today(),dir:"owe",who:"",held:true,lent:false,payments:[],from:"",to:"",amountIn:""};
  if(preset)Object.assign(t,preset);
  if(!tx&&t.type!=="move"){const a=accOf(t.wallet);if(a.hidden||!state.accounts.find(x=>x.id===a.id))t.wallet=(accounts().find(x=>!isPot(x))||accounts()[0]||{id:"Cash"}).id;const ac=accOf(t.wallet).cur;if(!preset||!preset.cur){t.cur=ac;t.rate=ac==="DZD"?1:state.rates[ac]}}
  let confirmDel=false;
  const root=$("#sheetRoot");
  const typeSeg=()=>[["out","Expense"],["in","Income"],["move","Move"],["debt","Debt"]].map(([k,l])=>`<button data-type="${k}" aria-pressed="${t.type===k}">${l}</button>`).join("");
  const bal=()=>accBalances(state.txs.filter(x=>x.id!==t.id));
  const autoIn=()=>{const a=num(t.amount)||0,fc=accOf(t.from).cur,tc=accOf(t.to).cur;if(!a||!t.from||!t.to)return 0;return fc===tc?a:toDA(a,fc)/(tc==="DZD"?1:state.rates[tc]||1)};
  const moveInfo=(a,ai,fc,tc)=>{if(!a||!ai)return"&nbsp;";if(fc!==tc){const r=tc==="DZD"?ai/a:fc==="DZD"?a/ai:ai/a;return tc==="DZD"?"Rate: 1 "+CUR[fc].sym+" = "+(Math.round(r*100)/100)+" DA":fc==="DZD"?"Rate: 1 "+CUR[tc].sym+" = "+(Math.round(r*100)/100)+" DA":"1 "+CUR[fc].sym+" = "+(Math.round(r*10000)/10000)+" "+CUR[tc].sym}
    return a>ai?"Fee: "+fmtCur(a-ai,fc)+" (counted as an expense)":a<ai?"More arrived than left. Check the amounts.":"No fee"};
  const accChips=(key,sel,skip)=>accounts().filter(x=>x.id!==skip).map(x=>`<button class="chip ${isPot(x)?"save":""}" data-${key}="${esc(x.id)}" aria-pressed="${sel===x.id}">${isPot(x)?"◆ ":""}${esc(x.name)}${x.cur!=="DZD"?" · "+CUR[x.cur].sym:""}</button>`).join("");
  const drawMove=()=>{
    const B=bal(),fa=t.from?accOf(t.from):null,ta=t.to?accOf(t.to):null,fc=fa?fa.cur:"DZD",tc=ta?ta.cur:fc;
    const a=num(t.amount)||0,ai=num(t.amountIn)||autoIn();
    const chips=(key,sel,skip)=>accounts().filter(x=>x.id!==skip).map(x=>`<button class="chip ${isPot(x)?"save":""}" data-${key}="${esc(x.id)}" aria-pressed="${sel===x.id}">${isPot(x)?"◆ ":""}${esc(x.name)} <span class="muted">${fmtCur(B[x.id]||0,x.cur)}</span></button>`).join("");
    const kind=!fa||!ta?"":isPot(ta)?"Putting into savings":isPot(fa)?"Taking out of savings":fc!==tc?"Converting "+CUR[fc].name.toLowerCase()+"s to "+CUR[tc].name.toLowerCase()+"s":ta.id==="Cash"?"Withdrawing to cash":"Moving between accounts";
    root.innerHTML=`<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-label="${editing?"Edit move":"Move money"}">
      <div class="grab"></div>
      <h3>${editing?"Edit move":"Move money"}<button data-x>Close</button></h3>
      <div class="seg">${typeSeg()}</div>
      <p class="hint">Withdrawals, deposits, exchange, savings in and out. Not income, not spending.</p>
      <div class="field"><span class="lbl">From</span><div class="chips">${chips("mfrom",t.from)}</div></div>
      <div class="field"><span class="lbl">To</span><div class="chips">${chips("mto",t.to,t.from)}</div></div>
      ${fa&&ta?`<div class="field"><span class="lbl">${kind}</span>
        <div class="amount"><input id="amt" inputmode="decimal" placeholder="0" value="${esc(t.amount)}" aria-label="Amount taken out"><span class="c">${CUR[fc].sym}</span></div>
        <div class="chips"><button class="chip" data-all>All of it (${fmtCur(B[fa.id]||0,fc)})</button></div></div>
      <div class="field"><label class="lbl" for="amtin">${fc===tc?"Amount that arrived (lower if there was a fee)":"Amount you got"}</label>
        <div class="amount"><input id="amtin" inputmode="decimal" placeholder="${esc(ai?String(Math.round(ai*100)/100):"0")}" value="${esc(t.amountIn)}" aria-label="Amount received"><span class="c">${CUR[tc].sym}</span></div>
        <span class="muted num" id="mvinfo" style="font-size:12.5px">${moveInfo(a,ai,fc,tc)}</span></div>`:""}
      <div class="two"><div class="field"><label class="lbl" for="date">Date</label><input class="txt" id="date" type="date" value="${esc(t.date)}"></div>
        <div class="field"><label class="lbl" for="note">Note</label><input class="txt" id="note" placeholder="Square, post office…" value="${esc(t.note)}"></div></div>
      <p class="err" id="err"></p>
      <button class="btn" data-save>${editing?"Save changes":"Save move"}</button>
      ${editing?(confirmDel?`<div class="two"><button class="btn ghost" data-nodel>Keep it</button><button class="btn danger" data-del>Delete for good</button></div>`:`<button class="btn ghost" data-askdel>Delete entry</button>`):""}
    </div></div>`;
  };
  const draw=()=>{
    if(t.type==="move")return drawMove();
    const isDebt=t.type==="debt",cats=isDebt?[]:catsOf(t.type).map(c=>[c.id,c.name,c.code]);
    if(!isDebt&&!cats.find(c=>c[0]===t.cat)){if(editing&&tx.cat===t.cat&&t.cat)cats.push(catOf(t.cat));else t.cat=""}
    const amt=num(t.amount)||0,dz=Math.round(amt*(t.cur==="DZD"?1:num(t.rate)||0));
    root.innerHTML=`<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-label="${editing?"Edit entry":"New entry"}">
      <div class="grab"></div>
      <h3>${editing?"Edit entry":"New entry"}<button data-x>Close</button></h3>
      <div class="seg">${typeSeg()}</div>
      ${isDebt?`<div class="seg">${[["owe","I owe someone"],["owed","Someone owes me"]].map(([k,l])=>`<button data-dir="${k}" aria-pressed="${t.dir===k}">${l}</button>`).join("")}</div>`:""}
      <div class="field"><div class="amount"><input id="amt" inputmode="decimal" placeholder="0" value="${esc(t.amount)}" aria-label="Amount"><span class="c">${CUR[t.cur].sym}</span></div>
        <div class="chips">${Object.keys(CUR).map(c=>`<button class="chip" data-cur="${c}" aria-pressed="${t.cur===c}">${CUR[c].sym} ${c==="DZD"?"Dinar":c}</button>`).join("")}</div></div>
      ${t.cur!=="DZD"?`<div class="rate"><span>1 ${CUR[t.cur].sym} =</span><input id="rate" inputmode="decimal" value="${esc(t.rate)}" aria-label="Rate in dinars"><span>DA</span><span class="num" style="margin-left:auto;font-weight:600" id="conv">= ${grp(dz)} DA</span></div>`:""}
      ${isDebt&&t.dir==="owed"?`<div class="field"><span class="lbl">How</span><div class="seg">${[[1,"I lent cash"],[0,"Unpaid work or sale"]].map(([k,l])=>`<button data-lent="${k}" aria-pressed="${(t.lent===true)===!!k}">${l}</button>`).join("")}</div><p class="hint">${t.lent?"The cash leaves the account you pick. It comes back when they repay you.":"Nothing left your accounts. Repayments land in the account you choose."}</p></div>`:""}
      ${isDebt&&t.dir==="owe"?`<div class="field"><span class="lbl">This debt is</span><div class="seg">${[[1,"Debt I have now"],[0,"Debt I spent or used"]].map(([k,l])=>`<button data-held="${k}" aria-pressed="${t.held===!!k}">${l}</button>`).join("")}</div><p class="hint">${t.held?"The money sits in one of your accounts and counts in what's left. What you owe is shown separately, never taken off.":"Already gone. Only the debt itself is tracked."}</p></div>`:""}
      ${isDebt?`<div class="field"><label class="lbl" for="who">${t.dir==="owe"?"Who you owe":"Who owes you"}</label><input class="txt" id="who" placeholder="Name" value="${esc(t.who)}"></div>`
      :`<div class="field"><span class="lbl">${t.type==="in"?"Where it came from":"What it was for"}</span><div class="chips">${cats.map(c=>`<button class="chip" data-cat="${esc(c[0])}" aria-pressed="${t.cat===c[0]}">${esc(c[1])}</button>`).join("")}<button class="chip" data-act="newcat-inline" style="border-style:dashed">+ New</button></div></div>`}
      ${isDebt&&!((t.dir==="owe"&&t.held)||(t.dir==="owed"&&t.lent))?"":`<div class="field"><span class="lbl">${isDebt?(t.dir==="owe"?"Where the money is now":"Lent from"):"Paid "+(t.type==="in"?"into":"from")}</span><div class="chips">${accChips("wallet",t.wallet)}</div></div>`}
      <div class="two"><div class="field"><label class="lbl" for="date">Date</label><input class="txt" id="date" type="date" value="${esc(t.date)}"></div>
        <div class="field"><label class="lbl" for="note">Note</label><input class="txt" id="note" placeholder="${t.type==="in"?"Client, car…":"What exactly?"}" value="${esc(t.note)}"></div></div>
      <p class="err" id="err"></p>
      <button class="btn" data-save>${editing?"Save changes":"Save"}</button>
      ${editing?(confirmDel?`<div class="two"><button class="btn ghost" data-nodel>Keep it</button><button class="btn danger" data-del>Delete for good</button></div>`:`<button class="btn ghost" data-askdel>Delete entry</button>`):""}
    </div></div>`;
  };
  const read=()=>{const g=id=>$("#"+id);if(g("amtin"))t.amountIn=g("amtin").value;if(g("amt"))t.amount=g("amt").value;if(g("rate"))t.rate=g("rate").value;if(g("date"))t.date=g("date").value;if(g("note"))t.note=g("note").value;if(g("who"))t.who=g("who").value};
  const close=()=>{root.innerHTML="";root.onclick=null;root.oninput=null};
  draw();
  if(!editing&&t.type!=="move")setTimeout(()=>{const a=$("#amt");a&&a.focus()},60);
  root.onclick=async e=>{
    if(e.target.id==="scrim"||e.target.closest("[data-x]"))return close();
    const b=e.target.closest("button");if(!b)return;read();
    if(b.dataset.type){t.type=b.dataset.type;draw()}
    else if(b.dataset.mfrom){t.from=b.dataset.mfrom;if(t.to===t.from)t.to="";t.amountIn="";draw()}
    else if(b.dataset.mto){t.to=b.dataset.mto;t.amountIn="";draw()}
    else if("all" in b.dataset){const v=bal()[t.from]||0;t.amount=String(Math.max(0,Math.round(v*100)/100));t.amountIn="";draw()}
    else if(b.dataset.cur){t.cur=b.dataset.cur;t.rate=t.cur==="DZD"?1:state.rates[t.cur];draw()}
    else if(b.dataset.cat){t.cat=b.dataset.cat;draw()}
    else if(b.dataset.act==="newcat-inline"){if(!root.querySelector("#qcat")){const d=document.createElement("div");d.className="edrow add";d.innerHTML=`<input id="qcat" placeholder="New category name" aria-label="New category name"><button class="mini solid" data-qcat>Add</button>`;b.closest(".field").appendChild(d)}$("#qcat").focus()}
    else if("qcat" in b.dataset){const n=($("#qcat").value||"").trim();if(!n)return;const type=t.type;const c={id:"c"+Date.now().toString(36),name:n,code:mkCode(n)};await putSettings({cats:{...state.cats,[type]:[...state.cats[type],c]}});t.cat=c.id;draw()}
    else if(b.dataset.dir){t.dir=b.dataset.dir;draw()}
    else if(b.dataset.held){t.held=b.dataset.held==="1";draw()}
    else if(b.dataset.lent){t.lent=b.dataset.lent==="1";draw()}
    else if(b.dataset.wallet){t.wallet=b.dataset.wallet;const ac=accOf(t.wallet).cur;if(ac!==t.cur){t.cur=ac;t.rate=ac==="DZD"?1:state.rates[ac]}draw()}
    else if("askdel" in b.dataset){confirmDel=true;draw()}
    else if("nodel" in b.dataset){confirmDel=false;draw()}
    else if("del" in b.dataset){const snap={...tx};try{await delTx(t.id);close();toast("Deleted",{label:"Undo",fn:()=>putTx(snap)})}catch(err){$("#err").textContent="Couldn't delete. Check your connection and try again."}}
    else if("save" in b.dataset&&t.type==="move"){
      const amt=num(t.amount),ai=String(t.amountIn).trim()?num(t.amountIn):autoIn();
      if(!t.from||!t.to)return $("#err").textContent="Pick where the money leaves and where it lands.";
      if(!(amt>0))return $("#err").textContent="Enter how much left "+accName(t.from)+".";
      if(!(ai>0))return $("#err").textContent="Enter how much arrived in "+accName(t.to)+".";
      if(!t.date)return $("#err").textContent="Pick a date.";
      const fc=accOf(t.from).cur,tc=accOf(t.to).cur,rate=fc==="DZD"?1:state.rates[fc];
      if(fc===tc&&ai>amt)return $("#err").textContent="More arrived than left. Check the amounts.";
      const out={id:t.id,type:"move",from:t.from,to:t.to,amount:amt,cur:fc,amountIn:Math.round(ai*100)/100,curIn:tc,rate,dzd:Math.round(amt*rate),fee:fc===tc?Math.round((amt-ai)*rate):0,cat:"move",note:t.note.trim(),date:t.date,createdAt:tx?.createdAt||Date.now()};
      if(state.demo)state.demo=false;
      b.disabled=true;
      try{await putTx(out);close();toast(editing?"Saved":"Moved "+fmtCur(amt,fc)+" → "+accName(t.to))}
      catch(err){b.disabled=false;$("#err").textContent="Couldn't save. Check your connection and try again."}
    }
    else if("save" in b.dataset){
      const amt=num(t.amount),rate=t.cur==="DZD"?1:num(t.rate);
      if(!(amt>0))return $("#err").textContent="Enter an amount above zero.";
      if(!(rate>0))return $("#err").textContent="Enter the rate you got for "+CUR[t.cur].name+".";
      if(t.type==="debt"&&!t.who.trim())return $("#err").textContent="Add a name so you know who it's with.";
      if(t.type!=="debt"&&!t.cat)return $("#err").textContent="Pick a category.";
      if(!t.date)return $("#err").textContent="Pick a date.";
      const out={id:t.id,type:t.type,amount:amt,cur:t.cur,rate,dzd:Math.round(amt*rate),cat:t.cat,wallet:t.wallet,note:t.note.trim(),date:t.date,createdAt:tx?.createdAt||Date.now()};
      if(t.type==="debt"){out.cat="debt";out.dir=t.dir;out.who=t.who.trim();if(t.dir==="owe")out.held=t.held===true;else out.lent=t.lent===true;out.payments=t.payments||[]}
      if(state.demo)state.demo=false;
      b.disabled=true;
      try{await putTx(out);pref("cur",t.cur);pref("type",t.type==="debt"?"out":t.type);pref("wallet",t.wallet);close();toast(editing?"Saved":t.type==="debt"?"Debt added":"Added "+(t.type==="in"?"+":"−")+grp(out.dzd)+" DA");
        if(!editing&&out.type!=="debt"&&!out.date.startsWith(state.month)){state.month=out.date.slice(0,7);render()}}
      catch(err){b.disabled=false;$("#err").textContent=err&&err.code==="quota_exceeded"?"Storage is full. Export a backup and remove old entries.":"Couldn't save. Check your connection and try again."}
    }
  };
  root.oninput=e=>{
    if(t.type==="move"&&(e.target.id==="amt"||e.target.id==="amtin")){read();const a=num(t.amount)||0,ai=String(t.amountIn).trim()?num(t.amountIn):autoIn(),inp=$("#amtin");if(inp&&!String(t.amountIn).trim())inp.placeholder=ai?String(Math.round(ai*100)/100):"0";const m=$("#mvinfo");if(m)m.innerHTML=moveInfo(a,ai,accOf(t.from).cur,accOf(t.to).cur);return}
    if(e.target.id==="amt"||e.target.id==="rate"){read();const c=$("#conv");if(c){c.textContent="= "+grp(Math.round((num(t.amount)||0)*(num(t.rate)||0)))+" DA"}}
  };
  root.onkeydown=e=>{if(e.key==="Enter"&&e.target.id==="qcat"){e.preventDefault();root.querySelector("[data-qcat]").click()}};
}

/* ---------- debt sheet ---------- */
function openDebt(id){
  const root=$("#sheetRoot");let confirmDel=false,amount="",date=today(),err="",pw=null,cancelK=-1;
  const draw=()=>{
    const t=list().find(x=>x.id===id);if(!t){root.innerHTML="";return}
    const owe=t.dir==="owe",r=remain(t),pays=t.payments||[];
    if(pw===null)pw=(owe&&t.held)||(!owe&&t.lent)?t.wallet:(pref("wallet")||"Cash");if(pw&&!state.accounts.find(a=>a.id===pw&&!a.hidden))pw=(accounts().find(a=>!isPot(a))||{id:""}).id;
    const pa=pw?accOf(pw):null,pcur=pa?pa.cur:"DZD",rLocal=pcur==="DZD"?r:r/(state.rates[pcur]||1);
    root.innerHTML=`<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-label="Debt">
      <div class="grab"></div>
      <h3>${owe?"You owe ":""}${esc(t.who)}${owe?"":" owes you"}<button data-x>Close</button></h3>
      <div class="bigt ${owe?"owe":"lent"}"><span class="lbl">${r>0?"Still to pay":"Paid off"}</span><span class="v">${grp(r)} DA</span>
        <span class="sub">${grp(t.dzd)} DA ${owe?"owed":"owed to you"} since ${dayLabel(t.date)}${t.cur!=="DZD"?" ("+orig(t)+")":""}${t.note?" · "+esc(t.note):""}${owe&&t.held&&r>0?" · in "+esc(accName(t.wallet)):!owe&&t.lent?" · lent from "+esc(accName(t.wallet)):""}</span>
        <div class="prog ${owe?"owe":"lent"}"><i style="width:${t.dzd?Math.min(100,paid(t)/t.dzd*100):0}%"></i></div></div>
      ${owe&&r>0?`<div class="field"><span class="lbl">Status</span><div class="seg">${[[1,"I have it now"],[0,"Spent or used"]].map(([k,l])=>`<button data-setheld="${k}" aria-pressed="${(t.held===true)===!!k}" ${state.demo?"disabled":""}>${l}</button>`).join("")}</div></div>`:""}
      ${pays.length?`<div class="field"><span class="lbl">Paid back so far</span><div class="pays">${pays.map((p,k)=>`<div><span>${dayLabel(p.date)}<span class="muted"> · ${p.wallet?esc(accName(p.wallet)):p.nowallet?"not from my accounts":"—"}</span></span><span><span class="num">${grp(p.dzd)} DA</span> ${state.demo?"":cancelK===k?`<button data-rmpay="${k}" class="mini" style="color:#fff;background:var(--out);border-color:var(--out)">Yes, cancel it</button> <button data-nocancel class="mini">Keep</button>`:`<button data-askpay="${k}" class="mini">Cancel</button>`}</span></div>`).join("")}</div>
        <p class="hint">Cancelling a repayment puts the amount back on the debt${owe?" and back into the account it was paid from":" and takes it back out of the account it landed in"}.</p></div>`:""}
      ${r>0&&!state.demo?`<div class="field"><span class="lbl">${owe?"Paid from":"Received into"}</span><div class="chips">${accounts().map(a=>`<button class="chip ${isPot(a)?"save":""}" data-pw="${esc(a.id)}" aria-pressed="${pw===a.id}">${isPot(a)?"◆ ":""}${esc(a.name)}${a.cur!=="DZD"?" · "+CUR[a.cur].sym:""}</button>`).join("")}<button class="chip" data-pw="" aria-pressed="${pw===""}" style="border-style:dashed">Not from my accounts</button></div>
        <p class="hint">${pw?(owe?"Leaves "+esc(pa.name)+", so it comes off what's left.":"Lands in "+esc(pa.name)+", so it adds to what's left."):"Someone else paid, or you settled it another way. Your accounts don't move."}</p></div>
      <div class="field"><span class="lbl">${owe?"I paid back":"They paid me back"}</span>
        <div class="amount"><input id="pay" inputmode="decimal" placeholder="${fmtCur(rLocal,pcur).replace(/[^\d.,\u202F ]/g,"").trim()}" value="${esc(amount)}" aria-label="Amount paid back"><span class="c">${CUR[pcur].sym}</span></div>
        <div class="chips"><button class="chip" data-full>All of it (${fmtCur(rLocal,pcur)})</button></div>${pcur!=="DZD"?`<p class="hint">Counted at your rate: 1 ${CUR[pcur].sym} = ${state.rates[pcur]} DA</p>`:""}</div>
      <div class="field"><label class="lbl" for="pdate">Date</label><input class="txt" id="pdate" type="date" value="${esc(date)}"></div>
      <p class="err" id="err">${esc(err)}</p>
      <button class="btn" data-pay>Record repayment</button>`:""}
      ${state.demo?"":`<div class="two"><button class="btn ghost" data-editdebt>Edit</button>${confirmDel?`<button class="btn danger" data-del>Delete for good</button>`:`<button class="btn ghost" data-askdel>Delete</button>`}</div>`}
    </div></div>`;
  };
  const read=()=>{const a=$("#pay"),d=$("#pdate");if(a)amount=a.value;if(d)date=d.value};
  draw();root.oninput=null;root.onkeydown=null;
  root.onclick=async e=>{
    if(e.target.id==="scrim"||e.target.closest("[data-x]")){root.innerHTML="";return}
    const b=e.target.closest("button");if(!b)return;read();
    const t=state.txs.find(x=>x.id===id);if(!t)return;
    if(b.dataset.askpay!==undefined){cancelK=+b.dataset.askpay;draw()}
    else if("nocancel" in b.dataset){cancelK=-1;draw()}
    else if(b.dataset.pw!==undefined){pw=b.dataset.pw;amount="";draw()}
    else if("full" in b.dataset){const c=pw?accOf(pw).cur:"DZD";amount=String(c==="DZD"?remain(t):Math.round(remain(t)/(state.rates[c]||1)*100)/100);draw()}
    else if("askdel" in b.dataset){confirmDel=true;draw()}
    else if("editdebt" in b.dataset){openSheet(t)}
    else if("del" in b.dataset){const snap={...t};try{await delTx(id);root.innerHTML="";toast("Debt deleted",{label:"Undo",fn:()=>putTx(snap)})}catch(x){err="Couldn't delete. Try again.";draw()}}
    else if(b.dataset.setheld){try{await putTx({...t,held:b.dataset.setheld==="1"});toast(b.dataset.setheld==="1"?"Marked: in hand":"Marked: spent");draw()}catch(x){err="Couldn't save. Try again.";draw()}}
    else if(b.dataset.rmpay!==undefined){const k=+b.dataset.rmpay,old=t.payments||[],p=old.filter((_,i)=>i!==k);cancelK=-1;
      try{await putTx({...t,payments:p});draw();toast("Repayment cancelled",{label:"Undo",fn:async()=>{const cur=state.txs.find(x=>x.id===id);if(cur){await putTx({...cur,payments:old});if($("#sheetRoot").innerHTML)draw()}}})}catch(x){err="Couldn't save. Try again.";draw()}}
    else if("pay" in b.dataset){
      const c=pw?accOf(pw).cur:"DZD",raw=num(amount)||0,v=Math.round(toDA(raw,c));
      if(!(raw>0)){err="Enter how much was paid back.";return draw()}
      if(v>remain(t)+1){err="That's more than what's left ("+grp(remain(t))+" DA).";return draw()}
      if(!date){err="Pick a date.";return draw()}
      b.disabled=true;
      const np=[...(t.payments||[]),{date,dzd:Math.min(v,remain(t)),amount:raw,cur:c,...(pw?{wallet:pw}:{nowallet:true})}];
      if(pw)pref("wallet",pw);
      const before=t.payments||[];
      try{await putTx({...t,payments:np});amount="";err="";draw();toast(remain({...t,payments:np})<=0?"Paid off":"Repayment recorded",{label:"Undo",fn:async()=>{const cur=state.txs.find(x=>x.id===id);if(cur){await putTx({...cur,payments:before});if($("#sheetRoot").innerHTML)draw()}}})}
      catch(x){err="Couldn't save. Check your connection and try again.";draw()}
    }
  };
}

/* ---------- account / pot sheet ---------- */
function openAccount(id,mode){
  const root=$("#sheetRoot");let err="",confirmDel=false,edit=mode==="edit";
  const draw=()=>{
    const a=accOf(id),all=list(),S=summary(all),v=S.b[id]||0,pot=isPot(a),used=all.some(t=>touches(t,id));
    const txs=sortTx(all.filter(t=>touches(t,id))).slice(0,30);
    root.innerHTML=`<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-label="${esc(a.name)}">
      <div class="grab"></div>
      <h3>${esc(a.name)}<button data-x>Close</button></h3>
      <div class="bigt ${pot?"save":""}"><span class="lbl">${pot?"Saved":"Balance"}</span><span class="v ${v<0?"neg":""}">${fmtCur(v,a.cur)}</span>
        <span class="sub">${a.cur!=="DZD"?"≈ "+grp(Math.round(toDA(v,a.cur)))+" DA at your rate · ":""}${pot?(a.goal?`${Math.round(Math.min(100,v/a.goal*100))}% of ${fmtCur(a.goal,a.cur)} goal`:"no goal set")+" · kept out of what's left":"counted in what's left"}</span>
        ${pot&&a.goal?`<div class="prog"><i style="width:${Math.min(100,v/a.goal*100)}%"></i></div>`:""}</div>
      ${state.demo?"":`<div class="two">${pot?`<button class="btn save" data-putin>Put in</button><button class="btn ghost" data-takeout>Take out</button>`:`<button class="btn" data-movefrom>Move out</button><button class="btn ghost" data-moveto>Move in</button>`}</div>`}
      ${edit?`<div class="panel stack" style="background:var(--surface2)">
        <div class="field"><label class="lbl" for="aname">Name</label><input class="txt" id="aname" value="${esc(a.name)}"></div>
        <div class="field"><label class="lbl" for="acur">Currency${used?" (locked, has entries)":""}</label><select class="txt" id="acur" ${used?"disabled":""}>${Object.keys(CUR).map(c=>`<option value="${c}" ${c===a.cur?"selected":""}>${CUR[c].sym} ${CUR[c].name}</option>`).join("")}</select></div>
        ${pot?`<div class="field"><label class="lbl" for="agoal">Goal (${CUR[a.cur].sym}) · leave 0 for none</label><input class="txt num" id="agoal" inputmode="decimal" value="${a.goal||0}"></div>`:""}
        <p class="err" id="err">${esc(err)}</p>
        <button class="btn" data-saveacc>Save</button>
        ${confirmDel?`<button class="btn danger" data-hideacc>Yes, remove it</button>`:`<button class="btn ghost" data-askhide>Remove ${pot?"pot":"account"}</button>`}
        <p class="hint">Removing hides it. Old entries keep it, and you can restore it from Settings → accounts.</p></div>`
      :state.demo?"":`<button class="linkbtn" data-editacc style="text-align:left">Rename, change goal or remove…</button>`}
      <section><h2 style="font-size:15px">Recent activity</h2>${txs.length?`<div class="rows">${txs.map(txRow).join("")}</div>`:`<p class="empty-note">Nothing here yet.</p>`}</section>
    </div></div>`;
  };
  draw();root.oninput=null;root.onkeydown=null;
  root.onclick=async e=>{
    if(e.target.id==="scrim"||e.target.closest("[data-x]")){root.innerHTML="";return}
    const b=e.target.closest("button");if(!b)return;
    if(b.dataset.edit||b.dataset.debt)return; // handled globally
    const a=accOf(id);
    if("putin" in b.dataset||"moveto" in b.dataset)openSheet(null,{type:"move",to:id});
    else if("takeout" in b.dataset||"movefrom" in b.dataset)openSheet(null,{type:"move",from:id});
    else if("editacc" in b.dataset){edit=true;draw()}
    else if("askhide" in b.dataset){confirmDel=true;draw()}
    else if("hideacc" in b.dataset){if(!isPot(a)&&accounts().filter(x=>!isPot(x)).length<2){err="Keep at least one account.";return draw()}await putSettings({accounts:state.accounts.map(x=>x.id===id?{...x,hidden:true}:x)});root.innerHTML="";toast("Removed")}
    else if("saveacc" in b.dataset){const n=$("#aname").value.trim(),c=$("#acur").value,g=$("#agoal")?Math.max(0,num($("#agoal").value)||0):undefined;if(!n){err="Give it a name.";return draw()}
      await putSettings({accounts:state.accounts.map(x=>x.id===id?{...x,name:n,cur:c,...(g!==undefined?{goal:g}:{})}:x)});toast("Saved");edit=false;err="";draw()}
  };
}
function openNewAccount(pot){
  const root=$("#sheetRoot");let err="";
  const draw=()=>{root.innerHTML=`<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-label="${pot?"New savings pot":"New account"}">
    <div class="grab"></div><h3>${pot?"New savings pot":"New account"}<button data-x>Close</button></h3>
    <p class="hint">${pot?"Money in a pot is yours but kept out of \"what's left\". Good for the car, the wedding, the rainy day.":"One account, one currency. Cash, CCP, a bank, Wise, a drawer of euros."}</p>
    <div class="field"><label class="lbl" for="nname">Name</label><input class="txt" id="nname" placeholder="${pot?"New car":"Wise EUR"}"></div>
    <div class="field"><label class="lbl" for="ncur">Currency</label><select class="txt" id="ncur">${Object.keys(CUR).map(c=>`<option value="${c}">${CUR[c].sym} ${CUR[c].name}</option>`).join("")}</select></div>
    ${pot?`<div class="field"><label class="lbl" for="ngoal">Goal · optional</label><input class="txt num" id="ngoal" inputmode="decimal" placeholder="0"></div>`:""}
    <p class="err" id="err">${esc(err)}</p><button class="btn ${pot?"save":""}" data-create>Create</button></div></div>`;setTimeout(()=>$("#nname")&&$("#nname").focus(),60)};
  draw();root.oninput=null;root.onkeydown=e=>{if(e.key==="Enter"&&e.target.id==="nname"){root.querySelector("[data-create]").click()}};
  root.onclick=async e=>{
    if(e.target.id==="scrim"||e.target.closest("[data-x]")){root.innerHTML="";return}
    if(!e.target.closest("[data-create]"))return;
    const n=$("#nname").value.trim(),c=$("#ncur").value,g=pot?Math.max(0,num($("#ngoal").value)||0):undefined;
    if(!n){err="Give it a name.";return draw()}
    const acc={id:(pot?"p":"a")+Date.now().toString(36),name:n,cur:c,...(pot?{kind:"savings",goal:g}:{})};
    try{await putSettings({accounts:[...state.accounts,acc]});root.innerHTML="";toast("Added "+n);if(pot)openAccount(acc.id)}catch(x){err="Couldn't save.";draw()}
  };
}

/* ---------- toast / files ---------- */
function toast(msg,action){const r=$("#toastRoot");r.innerHTML=`<div class="toast" role="status">${esc(msg)}${action?`<button id="toastAct">${esc(action.label)}</button>`:""}</div>`;
  if(action)$("#toastAct").onclick=()=>{r.innerHTML="";action.fn()};clearTimeout(toast.t);toast.t=setTimeout(()=>r.innerHTML="",action?5000:2200)}
async function saveFile(name,data,type){
  const blob=new Blob([data],{type});
  if(dl){try{await dl.save({filename:name,data:blob});toast("File ready")}catch(e){if(e&&e.code!=="declined")$("#setErr").textContent="Couldn't save the file ("+(e.code||"error")+")."}return}
  try{const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);toast("Downloading "+name)}
  catch(e){$("#setErr").textContent="Couldn't save the file."}
}
function csv(){
  const h=["date","type","category","account","amount","currency","rate","amount_dzd","note","debt_with","debt_paid_back","debt_left","debt_status","move_to","amount_in","currency_in","fee_dzd"];
  const q=v=>{v=String(v??"");return/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
  return [h.join(","),...sortTx(state.txs).reverse().map(t=>[t.date,t.type==="in"?"income":t.type==="out"?"expense":t.type==="move"?"move":(t.dir==="owe"?"debt (I owe)":"debt (owed to me)"),t.type==="debt"?"Debt":t.type==="move"?"Move":catOf(t.cat)[1],t.type==="debt"&&!t.held?"":accName(t.type==="move"?t.from:t.wallet),t.amount,t.cur,t.rate,t.dzd,t.note,t.who||"",t.type==="debt"?paid(t):"",t.type==="debt"?remain(t):"",t.type==="debt"&&t.dir==="owe"?(t.held===true?"in hand":"spent"):"",t.type==="move"?accName(t.to):"",t.type==="move"?t.amountIn:"",t.type==="move"?t.curIn:"",t.type==="move"?t.fee||0:""].map(q).join(","))].join("\n");
}

/* ---------- events ---------- */
document.addEventListener("click",async e=>{
  const sel="[data-v],[data-act],[data-edit],[data-debt],[data-acc],[data-month],[data-ftype],[data-fscope],[data-cattab],[data-cathide],[data-catshow],[data-theme-set],#mPrev,#mNext,#fab";
  const b=e.target.closest(sel);if(!b)return;
  if(b.closest("#sheetRoot")&&!(b.dataset.edit||b.dataset.debt))return;
  if(b.id==="mPrev"){state.month=shiftMonth(state.month,-1);render()}
  else if(b.id==="mNext"){state.month=shiftMonth(state.month,1);render()}
  else if(b.id==="fab")openSheet(null,state.view==="debts"?{type:"debt"}:state.view==="wallet"?{type:"move"}:null);
  else if(b.dataset.v)go(b.dataset.v);
  else if(b.dataset.month){state.month=b.dataset.month;render()}
  else if(b.dataset.ftype){state.filter.type=b.dataset.ftype;render()}
  else if(b.dataset.fscope){state.filter.scope=b.dataset.fscope;render()}
  else if(b.dataset.themeSet){const v=b.dataset.themeSet;pref("theme",v);if(v==="system")delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=v;render()}
  else if(b.dataset.debt){openDebt(b.dataset.debt)}
  else if(b.dataset.acc){openAccount(b.dataset.acc)}
  else if(b.dataset.cattab){state.catTab=b.dataset.cattab;render()}
  else if(b.dataset.cathide||b.dataset.catshow){const id=b.dataset.cathide||b.dataset.catshow,ct=state.catTab;putSettings({cats:{...state.cats,[ct]:state.cats[ct].map(c=>c.id===id?{...c,hidden:!!b.dataset.cathide}:c)}}).then(()=>toast(b.dataset.cathide?"Category removed":"Category restored"),()=>toast("Couldn't save"))}
  else if(b.dataset.edit){if(state.demo){toast("Example entries can't be edited");return}const t=state.txs.find(x=>x.id===b.dataset.edit);if(t)openSheet(t)}
  else{const a=b.dataset.act;
    if(a==="add")openSheet();
    else if(a==="add-out")openSheet(null,{type:"out"});
    else if(a==="add-in")openSheet(null,{type:"in"});
    else if(a==="move")openSheet(null,{type:"move"});
    else if(a==="adddebt")openSheet(null,{type:"debt",dir:b.dataset.dir,cur:"DZD",rate:1});
    else if(a==="newacc")openNewAccount(false);
    else if(a==="newpot")openNewAccount(true);
    else if(a==="demo"){state.demo=true;render()}
    else if(a==="exitdemo"){state.demo=false;render()}
    else if(a==="install"){if(installEvt){installEvt.prompt();installEvt=null;render()}}
    else if(a==="addcat"){const n=$("#newcat").value.trim(),ct=state.catTab;if(!n){$("#newcat").focus();return}
      if(state.cats[ct].some(c=>!c.hidden&&c.name.toLowerCase()===n.toLowerCase())){toast("You already have that one");return}
      putSettings({cats:{...state.cats,[ct]:[...state.cats[ct],{id:"c"+Date.now().toString(36),name:n,code:mkCode(n)}]}}).then(()=>toast("Added "+n),()=>toast("Couldn't save"))}
    else if(a==="saverates"){const r={};for(const c of Object.keys(CUR).filter(c=>c!=="DZD")){const v=num($("#r_"+c).value);if(!(v>0)){$("#setErr").textContent="Each rate must be a number above zero.";return}r[c]=v}
      try{await putSettings({rates:r});toast("Rates saved")}catch(err){$("#setErr").textContent="Couldn't save rates. Try again."}}
    else if(a==="csv")saveFile("masrouf-"+today()+".csv",csv(),"text/csv");
    else if(a==="json")saveFile("masrouf-backup-"+today()+".json",JSON.stringify({app:"masrouf",v:2,...settingsBody(),txs:state.txs},null,1),"application/json");
  }
});
document.addEventListener("keydown",e=>{if(e.key==="Enter"){if(e.target.id==="newcat")document.querySelector('[data-act="addcat"]').click();else if(e.target.dataset&&e.target.dataset.catname)e.target.blur()}});
document.addEventListener("input",e=>{if(e.target.id==="q"){state.filter.q=e.target.value;render()}});
document.addEventListener("change",async e=>{
  const el=e.target;
  if(el.id==="facc"){state.filter.acc=el.value;render();return}
  if(el.dataset.catname){const n=el.value.trim(),ct=state.catTab;if(!n){render();return}putSettings({cats:{...state.cats,[ct]:state.cats[ct].map(c=>c.id===el.dataset.catname?{...c,name:n,code:mkCode(n)}:c)}}).then(()=>toast("Renamed"),()=>toast("Couldn't save"));return}
  if(el.id!=="imp")return;const f=el.files[0];if(!f)return;
  try{const j=JSON.parse(await f.text());if(!Array.isArray(j.txs))throw 0;
    const have=new Set(state.txs.map(t=>t.id));let n=0;
    if(j.accounts||j.cats||j.rates)await putSettings({rates:{...state.rates,...(j.rates||{})},...(j.cats&&j.cats.in?{cats:j.cats}:{}),...(Array.isArray(j.accounts)&&j.accounts.length?{accounts:j.accounts}:{})});
    for(const t of j.txs){if(t&&t.id&&!have.has(t.id)&&t.date&&t.dzd>=0){await putTx(t);n++}}
    toast(n?"Restored "+n+" entries":"Nothing new in that backup");
  }catch(err){$("#setErr").textContent="That file isn't a Masrouf backup."}
  el.value="";
});
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvt=e;if(state.view==="prefs")render()});

init();
})();

import {useEffect,useMemo,useState} from 'react';
import {ComposedChart,Area,Line,BarChart,Bar,Cell,XAxis,YAxis,Tooltip,CartesianGrid,ResponsiveContainer} from 'recharts';
import {API_URL,SAMPLE,CURRENCY} from './config.js';


// ===== LÓGICA: parseo, formatos, KPIs, semáforo e insights =====
const L = CURRENCY.locale;
const f0 = new Intl.NumberFormat(L,{style:'currency',currency:CURRENCY.code,maximumFractionDigits:0});
const f2 = new Intl.NumberFormat(L,{style:'currency',currency:CURRENCY.code,minimumFractionDigits:2});
const money = n => f0.format(n||0);
const money2 = n => f2.format(n||0);
const pct = n => n.toLocaleString(L,{maximumFractionDigits:1})+'%';
const monthLabel = ym => { const [y,m]=ym.split('-'); const s=new Date(+y,+m-1,1).toLocaleDateString(L,{month:'long',year:'numeric'}); return s[0].toUpperCase()+s.slice(1); };
const monthName = ym => new Date(+ym.slice(0,4),+ym.slice(5)-1,1).toLocaleDateString(L,{month:'long'});
const prevYm = ym => { let y=+ym.slice(0,4), m=+ym.slice(5)-1; if(m<1){m=12;y--;} return `${y}-${String(m).padStart(2,'0')}`; };
const daysInMonth = ym => new Date(+ym.slice(0,4),+ym.slice(5),0).getDate();

// Acepta número o texto: "$40.000,00", "40.000", "40000.5"
function parseMonto(v){
  if(typeof v==='number') return isFinite(v)?v:null;
  if(v==null) return null;
  let s=String(v).replace(/[^\d,.\-]/g,'');
  if(!s) return null;
  if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
  const n=parseFloat(s); return isNaN(n)?null:n;
}
// Acepta "yyyy-mm-dd" o "dd/mm/yyyy"
function parseFecha(v){
  if(!v) return null; const s=String(v); let y,m,d,a;
  if((a=s.match(/^(\d{4})-(\d{2})-(\d{2})/))){y=+a[1];m=+a[2];d=+a[3];}
  else if((a=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))){d=+a[1];m=+a[2];y=+a[3];}
  else { const t=new Date(typeof v==='number'?v:s); if(isNaN(t)) return null; y=t.getFullYear();m=t.getMonth()+1;d=t.getDate(); }
  if(m<1||m>12||d<1||d>31) return null;
  const p=n=>String(n).padStart(2,'0');
  return {y,m,d,ym:`${y}-${p(m)}`,iso:`${y}-${p(m)}-${p(d)}`,label:`${p(d)}/${p(m)}/${y}`};
}
// Capa de normalización: único lugar que conoce las columnas de la planilla
function normalize(raw){
  return raw.map((r,i)=>{
    const f=parseFecha(r.fecha), a=parseMonto(r.monto);
    return {id:i,fecha:f,ym:f?.ym??null,amount:a??0,badAmount:a==null,
      cat:String(r.categoria||'').trim()||'Sin categoría',who:String(r.quien||'').trim()||'Sin asignar',
      detalle:cap(r.detalle),ciclo:r.ciclo||''};
  });
}
const sum = rows => rows.reduce((s,r)=>s+r.amount,0);
function groupSum(rows,key){
  const m=new Map();
  for(const r of rows){const o=m.get(r[key])||{name:r[key],total:0,count:0};o.total+=r.amount;o.count++;m.set(r[key],o);}
  return [...m.values()].sort((a,b)=>b.total-a.total);
}
function monthTotals(rows){
  const m=new Map();
  for(const r of rows) if(r.ym) m.set(r.ym,(m.get(r.ym)||0)+r.amount);
  return [...m.entries()].sort().map(([ym,total],i,arr)=>({ym,total,
    change: i>0 && arr[i-1][1]>0 ? (total-arr[i-1][1])/arr[i-1][1]*100 : null}));
}
// base = filas con filtros globales aplicados (todos los meses); period = 'all' | 'yyyy-mm'
function buildInsights(base,period){
  const rows=period==='all'?base:base.filter(r=>r.ym===period);
  const n=rows.length; if(!n) return ['No hay movimientos para este período y filtros.'];
  const label=period==='all'?'todo el período':monthLabel(period).toLowerCase();
  const total=sum(rows), out=[], cats=groupSum(rows,'cat'), avg=total/n;
  const share=c=>c.total/total*100;
  out.push(`${cats[0].name} representa el ${pct(share(cats[0]))} de tus gastos de ${label}.`);
  if(cats[1]) out.push(`${cats[1].name} fue la segunda categoría con mayor gasto (${pct(share(cats[1]))}).`);
  out.push(`Registraste ${n} movimientos en ${label}.`);
  if(n>5){const t5=[...rows].sort((a,b)=>b.amount-a.amount).slice(0,5);
    out.push(`El ${pct(sum(t5)/total*100)} de tus gastos se concentró en los 5 movimientos de mayor importe.`);}
  for(const c of cats) if(c.count>=8 && c.total/c.count<avg && share(c)>=15)
    out.push(`${c.name} acumula ${money(c.total)} en ${c.count} movimientos. Aunque el promedio por movimiento es bajo (${money(c.total/c.count)}), representa el ${pct(share(c))} del gasto.`);
  if(period==='all') return out;
  const prior=monthTotals(base).filter(x=>x.ym<period);
  const pv=base.filter(r=>r.ym===prevYm(period));
  if(pv.length){const pt=sum(pv),ch=(total-pt)/pt*100;
    out.push(`Tu gasto total ${ch>=0?'aumentó':'bajó'} ${pct(Math.abs(ch))} respecto de ${monthName(prevYm(period))}.`);}
  else out.push(`No hay datos de ${monthName(prevYm(period))} para comparar.`);
  if(prior.length<3){out.push('Todavía no hay histórico suficiente (se necesitan 3 meses previos) para detectar anomalías.');return out;}
  const last3=prior.slice(-3).map(x=>x.ym);
  for(const c of cats){
    const av=last3.reduce((s,ym)=>s+sum(base.filter(r=>r.ym===ym&&r.cat===c.name)),0)/3;
    if(av>0&&c.total>av*1.3) out.push(`El gasto en ${c.name} está ${pct((c.total/av-1)*100)} por encima del promedio de los últimos 3 meses.`);
  }
  if(total>Math.max(...prior.map(x=>x.total))) out.push('Este mes registraste el mayor gasto mensual desde que comenzaste a registrar datos.');
  const pr=base.filter(r=>r.ym&&r.ym<period);
  if(pr.length&&avg>sum(pr)/pr.length*1.15) out.push(`El gasto promedio por movimiento (${money(avg)}) aumentó respecto de los meses anteriores (${money(sum(pr)/pr.length)}).`);
  return out;
}

const cap=s=>{s=String(s||'').trim().toLowerCase();return s.charAt(0).toUpperCase()+s.slice(1);};
// Semáforo: compara tu gasto del mes contra el promedio de hasta 3 meses previos, al mismo día del mes
function pace(base,period,lastDay){
  const dim=daysInMonth(period), cur=sum(base.filter(r=>r.ym===period&&r.fecha.d<=lastDay));
  const projected=lastDay?cur/lastDay*dim:0;
  const pri=[...new Set(base.filter(r=>r.ym&&r.ym<period).map(r=>r.ym))].sort().slice(-3);
  if(!pri.length||!lastDay) return {level:'none',projected,cur};
  const ref=pri.reduce((s,m)=>s+sum(base.filter(r=>r.ym===m&&r.fecha.d<=lastDay)),0)/pri.length;
  if(!ref) return {level:'none',projected,cur};
  const ratio=cur/ref;
  return {level:ratio<=1?'green':ratio<=1.15?'yellow':'red',ratio,ref,projected,cur,n:pri.length};
}

// ===== ESTILOS =====
const CSS=`:root{--bg:#F3F5F7;--card:#fff;--ink:#14202B;--muted:#6B7885;--line:#E4E9ED;--acc:#0F6B63;--up:#B4452B}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 'Instrument Sans',system-ui,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:26px;margin:0;font-weight:600;letter-spacing:-.01em}h2{font-size:16px;margin:0 0 14px;font-weight:600}
h2 small{color:var(--muted);font-weight:400}.sub{margin-top:24px}
.top{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-bottom:16px}
.nav{display:flex;align-items:center;gap:10px}
button,select,input{font:inherit;color:inherit}
.nav button,.pager button{width:34px;height:34px;border:1px solid var(--line);background:var(--card);border-radius:8px;cursor:pointer}
button:disabled{opacity:.35;cursor:default}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.filters{display:flex;flex-wrap:wrap;gap:8px}
select,input{border:1px solid var(--line);background:var(--card);border-radius:8px;padding:7px 10px}
.note{background:#FFF6E0;border:1px solid #F0DDA8;border-radius:8px;padding:8px 12px;font-size:13px;margin:0 0 12px}
.err{color:var(--up)}.muted{color:var(--muted)}
.kpis{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:12px;margin-bottom:12px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px}
.kpi span{color:var(--muted);font-size:13px}.kpi strong{display:block;font-size:26px;font-weight:600;letter-spacing:-.02em;margin:2px 0}
.kpi.main strong{font-size:34px}.kpi em{font-style:normal;font-size:13px;color:var(--muted)}
.kpi em.up{color:var(--up)}.kpi em.down{color:var(--acc)}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px;margin-bottom:12px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}.grid2 .card{margin:0}
.ins{margin:0;padding-left:18px}.ins li{margin:6px 0}
.bar{display:block;width:100%;text-align:left;background:none;border:0;padding:6px 8px;margin:0 -8px;border-radius:8px;cursor:pointer}
.bar.static{cursor:default}.bar:not(.static):hover,.bar.on{background:#EEF4F3}
.bl{display:flex;justify-content:space-between;gap:8px;font-size:14px}.bl span{color:var(--muted);white-space:nowrap}
.track{display:block;height:8px;background:var(--line);border-radius:4px;margin-top:5px}.track i{display:block;height:100%;background:var(--acc);border-radius:4px}
.top5{list-style:none;margin:0;padding:0}.top5 li{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}
.top5 small{display:block;color:var(--muted);font-size:12px}
.chart{height:260px}.tip{background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:13px}
.th{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.th h2{margin:0}
.scroll{overflow-x:auto;margin-top:12px}table{width:100%;border-collapse:collapse;font-size:14px}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
th{color:var(--muted);font-weight:500}th button{background:none;border:0;padding:0;cursor:pointer;color:inherit;font-weight:500}
.r{text-align:right}.warn{color:var(--up)}
.pager{display:flex;justify-content:center;align-items:center;gap:12px;margin-top:12px;color:var(--muted)}
@media(max-width:760px){.kpis{grid-template-columns:1fr 1fr}.kpi.main{grid-column:1/-1}.grid2{grid-template-columns:1fr}h1{font-size:21px}}
.hero{display:flex;gap:16px;align-items:flex-start;border-left:6px solid var(--line)}
.hero h2{font-size:22px;margin:0 0 4px}.hero p{margin:0 0 6px}.hero small{color:var(--muted)}
.hero .dot{flex:none;width:44px;height:44px;border-radius:50%;background:var(--line);margin-top:2px}
.hero.green{border-left-color:#2E8B57}.hero.green .dot{background:#2E8B57}
.hero.yellow{border-left-color:#D9A404}.hero.yellow .dot{background:#D9A404}
.hero.red{border-left-color:#C0392B}.hero.red .dot{background:#C0392B}
.guide{margin-top:10px;font-size:13px;color:var(--muted)}.guide summary{cursor:pointer}
.hint{margin:-8px 0 12px;font-size:13px;color:var(--muted)}
.kpis{grid-template-columns:repeat(3,1fr)}.kpi.main{grid-column:auto}
.d{font-size:12px;margin-left:6px}.d.up{color:var(--up)}.d.down{color:#2E8B57}
@media(max-width:760px){.kpis{grid-template-columns:1fr 1fr}}
`;

// ===== PANTALLA =====
const PAGE=15, ACC='#0F6B63', MUTED='#9AA7B2';
const axisFmt=v=>v>=1e6?`${v/1e6}M`:`${v/1e3}k`;

function Dashboard(){
  const [raw,setRaw]=useState(null),[err,setErr]=useState('');
  const [sel,setSel]=useState(null),[cat,setCat]=useState(''),[who,setWho]=useState('');
  const [q,setQ]=useState(''),[sort,setSort]=useState({k:'date',dir:-1}),[page,setPage]=useState(0);

  useEffect(()=>{(async()=>{try{
    if(!API_URL){setRaw(SAMPLE);return;}
    const j=await (await fetch(API_URL)).json();
    if(j.error) throw new Error(j.error); setRaw(j.rows);
  }catch(e){setErr(e.message);}})();},[]);

  const rows=useMemo(()=>raw?normalize(raw):[],[raw]);
  const cats=useMemo(()=>[...new Set(rows.map(r=>r.cat))].sort(),[rows]);
  const whos=useMemo(()=>[...new Set(rows.map(r=>r.who))].sort(),[rows]);
  const months=useMemo(()=>[...new Set(rows.filter(r=>r.ym).map(r=>r.ym))].sort(),[rows]);
  const period=sel??months[months.length-1]??'all';
  const base=useMemo(()=>rows.filter(r=>(!cat||r.cat===cat)&&(!who||r.who===who)),[rows,cat,who]);
  const cur=useMemo(()=>period==='all'?base:base.filter(r=>r.ym===period),[base,period]);

  if(err) return <main className="wrap"><p className="err">No se pudieron cargar los datos: {err}. Revisá la URL de la API y que la Web App esté publicada para “Cualquier persona”.</p></main>;
  if(!raw) return <main className="wrap"><p className="muted">Cargando…</p></main>;

  const total=sum(cur), n=cur.length;
  const today=new Date(), todayYm=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const lastDay=period==='all'?0:(period===todayYm?today.getDate():daysInMonth(period));
  let days=lastDay;
  if(period==='all'){const ds=cur.filter(r=>r.fecha).map(r=>Date.parse(r.fecha.iso));
    days=ds.length?Math.round((Math.max(...ds)-Math.min(...ds))/864e5)+1:0;}
  const prevRows=period==='all'?[]:base.filter(r=>r.ym===prevYm(period));
  const prevTotal=sum(prevRows), hasPrev=prevRows.length>0;
  const diff=total-prevTotal, diffPct=hasPrev&&prevTotal>0?diff/prevTotal*100:null;
  const prevCmp=prevRows.filter(r=>r.fecha&&r.fecha.d<=lastDay), prevCmpTotal=sum(prevCmp);
  const diffC=total-prevCmpTotal, diffPctC=prevCmpTotal>0?diffC/prevCmpTotal*100:null;
  const isNow=period===todayYm, sem=period==='all'?null:pace(base,period,lastDay);
  const pc=Object.fromEntries(groupSum(prevCmp,'cat').map(c=>[c.name,c.total]));
  const byCat=groupSum(cur,'cat'), byWho=groupSum(cur,'who'), multi=whos.length>1;
  const mt=monthTotals(base);
  const top=[...cur].sort((a,b)=>b.amount-a.amount).slice(0,5);
  const avgDay=days?total/days:0;
  const SEM={green:'Vas bien',yellow:'Atención',red:'Gasto acelerado',none:'Sin referencia todavía'};
  const semMsg=!sem?'':sem.level==='none'?'Cuando haya al menos un mes anterior con datos, acá vas a ver si tu ritmo de gasto es normal.':
    `Llevás ${money(sem.cur)}${isNow?' este mes':''}: ${pct(Math.abs(sem.ratio-1)*100)} ${sem.ratio<=1?'menos':'más'} que tu promedio de los últimos ${sem.n} mes(es) ${isNow?'a esta altura del mes':'en el mes completo'} (${money(sem.ref)}).`;
  const bad=rows.filter(r=>!r.fecha||r.badAmount).length;

  let series=[];
  if(period!=='all'){
    const dim=daysInMonth(period); let a=0,p=0;
    for(let d=1;d<=dim;d++){
      a+=sum(cur.filter(r=>r.fecha?.d===d)); p+=sum(prevRows.filter(r=>r.fecha?.d===d));
      series.push({d,actual:d<=lastDay?a:null,prev:hasPrev?p:null,day:d<=lastDay?sum(cur.filter(r=>r.fecha?.d===d)):null});
    }
  }

  const dayRows=series.filter(x=>x.day!=null), maxDay=dayRows.reduce((m,x)=>x.day>(m?.day??-1)?x:m,null);
  const table=cur.filter(r=>!q||`${r.detalle} ${r.cat} ${r.who} ${r.ciclo}`.toLowerCase().includes(q.toLowerCase()))
    .sort((x,y)=>sort.dir*(sort.k==='amount'?x.amount-y.amount:(x.fecha?.iso||'').localeCompare(y.fecha?.iso||'')));
  const pages=Math.max(1,Math.ceil(table.length/PAGE)), pg=Math.min(page,pages-1);
  const idx=months.indexOf(period);
  const go=ym=>{setSel(ym);setPage(0);};
  const toggleSort=k=>setSort(s=>({k,dir:s.k===k?-s.dir:-1}));
  const arrow=k=>sort.k===k?(sort.dir>0?' ↑':' ↓'):'';

  return <main className="wrap">
    <header className="top">
      <div className="nav">
        <button disabled={period==='all'||idx<=0} onClick={()=>go(months[idx-1])} aria-label="Mes anterior">‹</button>
        <h1>{period==='all'?'Todos los meses':monthLabel(period)}</h1>
        <button disabled={period==='all'||idx>=months.length-1} onClick={()=>go(months[idx+1])} aria-label="Mes siguiente">›</button>
      </div>
      <div className="filters">
        <select value={period} onChange={e=>go(e.target.value)}>
          <option value="all">Todos</option>
          {[...months].reverse().map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <select value={cat} onChange={e=>{setCat(e.target.value);setPage(0);}}><option value="">Todas las categorías</option>{cats.map(c=><option key={c}>{c}</option>)}</select>
        {multi&&<select value={who} onChange={e=>{setWho(e.target.value);setPage(0);}}><option value="">Todas las personas</option>{whos.map(c=><option key={c}>{c}</option>)}</select>}
      </div>
    </header>
    {!API_URL&&<p className="note">Mostrando datos de ejemplo. Configurá VITE_API_URL para ver tu planilla.</p>}
    {bad>0&&<p className="note">{bad} registro(s) tienen fecha o monto inválido: figuran en la tabla (monto $0 si falta) y los de fecha inválida solo cuentan en “Todos”.</p>}

    {sem&&<section className={'card hero '+sem.level}><i className="dot"/><div><h2>{SEM[sem.level]}</h2><p>{semMsg}</p>
      {isNow&&<small>Si seguís a este ritmo, cerrás el mes en <b>{money(sem.projected)}</b>.</small>}
      <details className="guide"><summary>¿Cómo se calcula el semáforo?</summary>Compara lo que gastaste hasta hoy contra el promedio de tus últimos 3 meses a igual día. Verde: igual o menos. Amarillo: hasta 15% más. Rojo: más de 15% más. Mientras más meses cargues, más confiable es.</details></div></section>}

    <section className="kpis">
      <div className="kpi main"><span>Gasto total</span><strong>{money(total)}</strong>
        <em className={diffPctC==null?'':diffPctC>0?'up':'down'}>{period==='all'?'Acumulado de todos los meses':diffPctC!=null?`${diffPctC>0?'+':''}${pct(diffPctC)} vs ${monthName(prevYm(period))}${isNow?' a igual día':''}`:'Sin mes anterior para comparar'}</em></div>
      <div className="kpi"><span>Promedio diario</span><strong>{money(avgDay)}</strong><em>{n} movimientos en {days} días</em></div>
      <div className="kpi"><span>Proyección fin de mes</span><strong>{isNow&&sem?money(sem.projected):'—'}</strong><em>{isNow?'Si mantenés el ritmo':'Solo para el mes en curso'}</em></div>
      <div className="kpi"><span>Mes anterior</span><strong>{period!=='all'&&hasPrev?money(prevTotal):'—'}</strong><em>{period!=='all'&&hasPrev?(isNow?`A igual día: ${money(prevCmpTotal)}`:`${diff>=0?'+':'−'}${money(Math.abs(diff))} de diferencia`):'Sin datos'}</em></div>
      <div className="kpi"><span>Día más caro</span><strong>{maxDay?money(maxDay.day):'—'}</strong><em>{maxDay?`${maxDay.d} de ${monthName(period)}`:'Elegí un mes'}</em></div>
      <div className="kpi"><span>Categoría principal</span><strong style={{fontSize:20}}>{byCat[0]?.name||'—'}</strong><em>{byCat[0]?`${pct(total?byCat[0].total/total*100:0)} del gasto`:''}</em></div>
    </section>

    <section className="card"><h2>Qué está pasando</h2><p className="hint">Observaciones automáticas calculadas con tus propios datos.</p>
      <ul className="ins">{buildInsights(base,period).map((t,i)=><li key={i}>{t}</li>)}</ul></section>

    <div className="grid2">
      <section className="card"><h2>En qué se va la plata</h2><p className="hint">Tocá una categoría para filtrar todo el tablero. La flecha compara con {period==='all'?'el mes anterior':monthName(prevYm(period))}{isNow?' a igual día':''}.</p>
        {byCat.map(c=><button key={c.name} className={'bar'+(cat===c.name?' on':'')} onClick={()=>{setCat(cat===c.name?'':c.name);setPage(0);}}>
          <span className="bl"><b>{c.name}{pc[c.name]>0&&period!=='all'&&<em className={'d '+(c.total>pc[c.name]*1.15?'up':c.total<pc[c.name]*.85?'down':'')}>{c.total>pc[c.name]*1.15?'▲':c.total<pc[c.name]*.85?'▼':'='} {pct(Math.abs((c.total/pc[c.name]-1)*100))}</em>}</b><span>{money(c.total)} · {pct(total?c.total/total*100:0)}</span></span>
          <span className="track"><i style={{width:`${byCat[0].total?c.total/byCat[0].total*100:0}%`}}/></span></button>)}
        {!byCat.length&&<p className="muted">Sin datos.</p>}
      </section>
      <section className="card">{multi&&<><h2>Por persona</h2>
        {byWho.map(c=><div key={c.name} className="bar static">
          <span className="bl"><b>{c.name}</b><span>{money(c.total)} · {pct(total?c.total/total*100:0)}</span></span>
          <span className="track"><i style={{width:`${byWho[0].total?c.total/byWho[0].total*100:0}%`}}/></span></div>)}
        </>}
        <h2 className={multi?'sub':''}>Mayores gastos</h2>
        <ol className="top5">{top.map(r=><li key={r.id}><span>{r.detalle||'(sin detalle)'}<small>{r.fecha?.label||'Fecha inválida'} · {r.cat}{multi?` · ${r.who}`:''}</small></span><b>{money(r.amount)}</b></li>)}</ol>
      </section>
    </div>

    {period!=='all'&&<section className="card"><h2>Día a día</h2><p className="hint">Barras en rojo: días que gastaste más del doble de tu promedio diario ({money(avgDay)}).</p>
      <div className="chart" style={{height:200}}><ResponsiveContainer><BarChart data={series}>
        <CartesianGrid stroke="#E4E9ED" vertical={false}/><XAxis dataKey="d" tick={{fontSize:12}} stroke={MUTED}/>
        <YAxis tickFormatter={axisFmt} tick={{fontSize:12}} stroke={MUTED} width={44}/>
        <Tooltip formatter={v=>[money(v),'Gasto del día']} labelFormatter={d=>`Día ${d}`}/>
        <Bar dataKey="day" radius={[3,3,0,0]}>{series.map(x=><Cell key={x.d} fill={x.day>avgDay*2?'#C0392B':ACC}/>)}</Bar></BarChart></ResponsiveContainer></div></section>}

    {period!=='all'&&<section className="card"><h2>Gasto acumulado del mes</h2><p className="hint">Si tu línea verde queda por encima de la gris{hasPrev?` (${monthName(prevYm(period))})`:''}, vas gastando más rápido que el mes anterior.</p>
      <div className="chart"><ResponsiveContainer><ComposedChart data={series} margin={{left:0,right:8,top:8}}>
        <CartesianGrid stroke="#E4E9ED" vertical={false}/><XAxis dataKey="d" tick={{fontSize:12}} stroke={MUTED}/>
        <YAxis tickFormatter={axisFmt} tick={{fontSize:12}} stroke={MUTED} width={44}/>
        <Tooltip formatter={(v,n)=>[money(v),n==='actual'?'Este mes':'Mes anterior']} labelFormatter={d=>`Día ${d}`}/>
        <Line dataKey="prev" stroke={MUTED} strokeDasharray="4 4" dot={false} connectNulls/>
        <Area dataKey="actual" stroke={ACC} fill={ACC} fillOpacity={.12} strokeWidth={2}/></ComposedChart></ResponsiveContainer></div></section>}

    <section className="card"><h2>Mes a mes</h2><p className="hint">¿Estás gastando cada vez más? Pasá el dedo o el mouse por una barra para ver la variación.</p>
      {mt.length<2?<p className="muted">Se necesitan al menos 2 meses con datos para ver la tendencia.</p>:
      <div className="chart"><ResponsiveContainer><BarChart data={mt.map(m=>({...m,name:monthName(m.ym).slice(0,3)+' '+m.ym.slice(2,4)}))}>
        <CartesianGrid stroke="#E4E9ED" vertical={false}/><XAxis dataKey="name" tick={{fontSize:12}} stroke={MUTED}/>
        <YAxis tickFormatter={axisFmt} tick={{fontSize:12}} stroke={MUTED} width={44}/>
        <Tooltip content={({active,payload})=>active&&payload?.length?<div className="tip"><b>{monthLabel(payload[0].payload.ym)}</b><br/>{money(payload[0].value)}<br/>{payload[0].payload.change==null?'Sin mes previo':`${payload[0].payload.change>0?'+':''}${pct(payload[0].payload.change)} vs mes previo`}</div>:null}/>
        <Bar dataKey="total" radius={[3,3,0,0]}>{mt.map(m=><Cell key={m.ym} fill={m.ym===period?ACC:'#C3CCD3'}/>)}</Bar></BarChart></ResponsiveContainer></div>}
    </section>

    <section className="card"><div className="th"><h2>Movimientos <small>({table.length})</small></h2>
      <input placeholder="Buscar…" value={q} onChange={e=>{setQ(e.target.value);setPage(0);}}/></div>
      <div className="scroll"><table><thead><tr>
        <th><button onClick={()=>toggleSort('date')}>Fecha{arrow('date')}</button></th>
        <th>Detalle</th><th>Categoría</th>
        <th className="r"><button onClick={()=>toggleSort('amount')}>Monto{arrow('amount')}</button></th>
        {multi&&<th>Quien</th>}<th>Ciclo</th></tr></thead>
        <tbody>{table.slice(pg*PAGE,pg*PAGE+PAGE).map(r=><tr key={r.id}>
          <td>{r.fecha?.label||<span className="warn">inválida</span>}</td><td>{r.detalle}</td><td>{r.cat}</td>
          <td className="r">{r.badAmount?<span className="warn">sin monto</span>:money2(r.amount)}</td>{multi&&<td>{r.who}</td>}<td>{r.ciclo||'—'}</td></tr>)}</tbody></table></div>
      <div className="pager"><button disabled={pg===0} onClick={()=>setPage(pg-1)}>‹</button><span>{pg+1} / {pages}</span><button disabled={pg>=pages-1} onClick={()=>setPage(pg+1)}>›</button></div>
    </section>
  </main>;
}

export default function App(){return <><style>{CSS}</style><Dashboard/></>;}

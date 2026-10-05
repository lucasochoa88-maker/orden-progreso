import {useEffect,useMemo,useState} from 'react';
import {ComposedChart,Area,Line,BarChart,Bar,Cell,XAxis,YAxis,Tooltip,CartesianGrid,ResponsiveContainer} from 'recharts';
import {API_URL,SAMPLE} from './config.js';
import {normalize,money,money2,pct,monthLabel,monthName,prevYm,daysInMonth,groupSum,monthTotals,sum,buildInsights} from './lib.js';

const PAGE=15, ACC='#0F6B63', MUTED='#9AA7B2';
const axisFmt=v=>v>=1e6?`${v/1e6}M`:`${v/1e3}k`;

export default function App(){
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
  const byCat=groupSum(cur,'cat'), byWho=groupSum(cur,'who');
  const mt=monthTotals(base);
  const top=[...cur].sort((a,b)=>b.amount-a.amount).slice(0,5);
  const bad=rows.filter(r=>!r.fecha||r.badAmount).length;

  let series=[];
  if(period!=='all'){
    const dim=daysInMonth(period); let a=0,p=0;
    for(let d=1;d<=dim;d++){
      a+=sum(cur.filter(r=>r.fecha?.d===d)); p+=sum(prevRows.filter(r=>r.fecha?.d===d));
      series.push({d,actual:d<=lastDay?a:null,prev:hasPrev?p:null});
    }
  }

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
        <select value={who} onChange={e=>{setWho(e.target.value);setPage(0);}}><option value="">Todas las personas</option>{whos.map(c=><option key={c}>{c}</option>)}</select>
      </div>
    </header>
    {!API_URL&&<p className="note">Mostrando datos de ejemplo. Configurá VITE_API_URL para ver tu planilla.</p>}
    {bad>0&&<p className="note">{bad} registro(s) tienen fecha o monto inválido: figuran en la tabla (monto $0 si falta) y los de fecha inválida solo cuentan en “Todos”.</p>}

    <section className="kpis">
      <div className="kpi main"><span>Gasto total</span><strong>{money(total)}</strong>
        <em className={diffPct==null?'':diffPct>0?'up':'down'}>{period==='all'?'Acumulado de todos los meses':diffPct!=null?`${diffPct>0?'+':''}${pct(diffPct)} vs ${monthName(prevYm(period))}`:'Sin mes anterior para comparar'}</em></div>
      <div className="kpi"><span>Promedio diario</span><strong>{money(days?total/days:0)}</strong><em>{days} días</em></div>
      <div className="kpi"><span>Movimientos</span><strong>{n}</strong><em>{n?`${money(total/n)} promedio`:''}</em></div>
      <div className="kpi"><span>Mes anterior</span><strong>{period!=='all'&&hasPrev?money(prevTotal):'—'}</strong>
        <em>{period!=='all'&&hasPrev?`${diff>=0?'+':'−'}${money(Math.abs(diff))}`:'Sin datos'}</em></div>
    </section>

    <section className="card"><h2>Insights</h2>
      <ul className="ins">{buildInsights(base,period).map((t,i)=><li key={i}>{t}</li>)}</ul></section>

    <div className="grid2">
      <section className="card"><h2>Por categoría <small>(clic para filtrar)</small></h2>
        {byCat.map(c=><button key={c.name} className={'bar'+(cat===c.name?' on':'')} onClick={()=>{setCat(cat===c.name?'':c.name);setPage(0);}}>
          <span className="bl"><b>{c.name}</b><span>{money(c.total)} · {pct(total?c.total/total*100:0)}</span></span>
          <span className="track"><i style={{width:`${byCat[0].total?c.total/byCat[0].total*100:0}%`}}/></span></button>)}
        {!byCat.length&&<p className="muted">Sin datos.</p>}
      </section>
      <section className="card"><h2>Por persona</h2>
        {byWho.map(c=><div key={c.name} className="bar static">
          <span className="bl"><b>{c.name}</b><span>{money(c.total)} · {pct(total?c.total/total*100:0)}</span></span>
          <span className="track"><i style={{width:`${byWho[0].total?c.total/byWho[0].total*100:0}%`}}/></span></div>)}
        <h2 className="sub">Mayores gastos</h2>
        <ol className="top5">{top.map(r=><li key={r.id}><span>{r.detalle||'(sin detalle)'}<small>{r.fecha?.label||'Fecha inválida'} · {r.cat} · {r.who}</small></span><b>{money(r.amount)}</b></li>)}</ol>
      </section>
    </div>

    {period!=='all'&&<section className="card"><h2>Gasto acumulado del mes{hasPrev&&<small> · línea gris: {monthName(prevYm(period))}</small>}</h2>
      <div className="chart"><ResponsiveContainer><ComposedChart data={series} margin={{left:0,right:8,top:8}}>
        <CartesianGrid stroke="#E4E9ED" vertical={false}/><XAxis dataKey="d" tick={{fontSize:12}} stroke={MUTED}/>
        <YAxis tickFormatter={axisFmt} tick={{fontSize:12}} stroke={MUTED} width={44}/>
        <Tooltip formatter={(v,n)=>[money(v),n==='actual'?'Este mes':'Mes anterior']} labelFormatter={d=>`Día ${d}`}/>
        <Line dataKey="prev" stroke={MUTED} strokeDasharray="4 4" dot={false} connectNulls/>
        <Area dataKey="actual" stroke={ACC} fill={ACC} fillOpacity={.12} strokeWidth={2}/></ComposedChart></ResponsiveContainer></div></section>}

    <section className="card"><h2>Evolución mensual</h2>
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
        <th>Quien</th><th>Ciclo</th></tr></thead>
        <tbody>{table.slice(pg*PAGE,pg*PAGE+PAGE).map(r=><tr key={r.id}>
          <td>{r.fecha?.label||<span className="warn">inválida</span>}</td><td>{r.detalle}</td><td>{r.cat}</td>
          <td className="r">{r.badAmount?<span className="warn">sin monto</span>:money2(r.amount)}</td><td>{r.who}</td><td>{r.ciclo||'—'}</td></tr>)}</tbody></table></div>
      <div className="pager"><button disabled={pg===0} onClick={()=>setPage(pg-1)}>‹</button><span>{pg+1} / {pages}</span><button disabled={pg>=pages-1} onClick={()=>setPage(pg+1)}>›</button></div>
    </section>
  </main>;
}

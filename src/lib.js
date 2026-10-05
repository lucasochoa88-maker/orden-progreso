import {CURRENCY} from './config.js';
const L = CURRENCY.locale;
const f0 = new Intl.NumberFormat(L,{style:'currency',currency:CURRENCY.code,maximumFractionDigits:0});
const f2 = new Intl.NumberFormat(L,{style:'currency',currency:CURRENCY.code,minimumFractionDigits:2});
export const money = n => f0.format(n||0);
export const money2 = n => f2.format(n||0);
export const pct = n => n.toLocaleString(L,{maximumFractionDigits:1})+'%';
export const monthLabel = ym => { const [y,m]=ym.split('-'); const s=new Date(+y,+m-1,1).toLocaleDateString(L,{month:'long',year:'numeric'}); return s[0].toUpperCase()+s.slice(1); };
export const monthName = ym => new Date(+ym.slice(0,4),+ym.slice(5)-1,1).toLocaleDateString(L,{month:'long'});
export const prevYm = ym => { let y=+ym.slice(0,4), m=+ym.slice(5)-1; if(m<1){m=12;y--;} return `${y}-${String(m).padStart(2,'0')}`; };
export const daysInMonth = ym => new Date(+ym.slice(0,4),+ym.slice(5),0).getDate();

// Acepta número o texto: "$40.000,00", "40.000", "40000.5"
export function parseMonto(v){
  if(typeof v==='number') return isFinite(v)?v:null;
  if(v==null) return null;
  let s=String(v).replace(/[^\d,.\-]/g,'');
  if(!s) return null;
  if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
  const n=parseFloat(s); return isNaN(n)?null:n;
}
// Acepta "yyyy-mm-dd" o "dd/mm/yyyy"
export function parseFecha(v){
  if(!v) return null; const s=String(v); let y,m,d,a;
  if((a=s.match(/^(\d{4})-(\d{2})-(\d{2})/))){y=+a[1];m=+a[2];d=+a[3];}
  else if((a=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))){d=+a[1];m=+a[2];y=+a[3];}
  else return null;
  if(m<1||m>12||d<1||d>31) return null;
  const p=n=>String(n).padStart(2,'0');
  return {y,m,d,ym:`${y}-${p(m)}`,iso:`${y}-${p(m)}-${p(d)}`,label:`${p(d)}/${p(m)}/${y}`};
}
// Capa de normalización: único lugar que conoce las columnas de la planilla
export function normalize(raw){
  return raw.map((r,i)=>{
    const f=parseFecha(r.fecha), a=parseMonto(r.monto);
    return {id:i,fecha:f,ym:f?.ym??null,amount:a??0,badAmount:a==null,
      cat:String(r.categoria||'').trim()||'Sin categoría',who:String(r.quien||'').trim()||'Sin asignar',
      detalle:r.detalle||'',ciclo:r.ciclo||''};
  });
}
export const sum = rows => rows.reduce((s,r)=>s+r.amount,0);
export function groupSum(rows,key){
  const m=new Map();
  for(const r of rows){const o=m.get(r[key])||{name:r[key],total:0,count:0};o.total+=r.amount;o.count++;m.set(r[key],o);}
  return [...m.values()].sort((a,b)=>b.total-a.total);
}
export function monthTotals(rows){
  const m=new Map();
  for(const r of rows) if(r.ym) m.set(r.ym,(m.get(r.ym)||0)+r.amount);
  return [...m.entries()].sort().map(([ym,total],i,arr)=>({ym,total,
    change: i>0 && arr[i-1][1]>0 ? (total-arr[i-1][1])/arr[i-1][1]*100 : null}));
}
// base = filas con filtros globales aplicados (todos los meses); period = 'all' | 'yyyy-mm'
export function buildInsights(base,period){
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

// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [docs,  setDocs]  = useState([]);
  const [acts,  setActs]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/documentos/stats'),
      api.get('/documentos?limit=6&orden=created_at&dir=DESC'),
      api.get('/actividad'),
    ]).then(([s, d, a]) => {
      setStats(s.data); setDocs(d.data.docs || []); setActs(a.data.slice(0, 5));
    }).catch(() => toast.error('Error cargando datos')).finally(() => setLoading(false));
  }, []);

  const typeInfo = t => ({ excel:{bg:'rgba(29,122,69,.2)',c:'#4eca7e',l:'Excel'}, word:{bg:'rgba(26,92,192,.2)',c:'#5b9bf8',l:'Word'}, ppt:{bg:'rgba(199,64,26,.2)',c:'#ff8c5a',l:'PPT'} }[t] || {bg:'rgba(100,100,100,.2)',c:'#aaa',l:t});
  const actColor = { LOGIN:'#4f7cff', UPLOAD:'#00e5a0', DOWNLOAD:'#f5a623', DELETE:'#ff6b6b', CREATE_FOLDER:'#c084fc' };

  if (loading) return <div style={s.loading}>Cargando...</div>;

  const megaTotal = stats?.megaCuentas?.reduce((a,c)=>a+parseFloat(c.totalGB),0) || 60;
  const megaUsado = stats?.megaCuentas?.reduce((a,c)=>a+parseFloat(c.usadoGB),0) || 0;

  return (
    <div style={s.wrap}>
      <div style={s.topbar}>
        <div style={s.title}>Dashboard</div>
        <button style={s.btn} onClick={() => navigate('/subir')}>⬆ Subir Documentos</button>
      </div>
      <button 
          style={s.btn} 
          onClick={() => navigate('/admins')}
          >
          👤 Administradores
      </button>
      <div style={s.content}>

        {/* STATS */}
        <div style={s.statsGrid}>
          {[
            { l:'Total Documentos', v: stats?.totalDocs??0,     s:'en el sistema',          c:'#4f7cff', i:'📄' },
            { l:'Carpetas',         v: stats?.totalCarpetas??0,  s:'activas',                c:'#00e5a0', i:'📁' },
            { l:'Excel / Word / PPT', v:`${stats?.totalExcel??0} / ${stats?.totalWord??0} / ${stats?.totalPpt??0}`, s:'por tipo', c:'#4eca7e', i:'📊' },
            { l:'Almacenamiento MEGA', v:`${megaUsado.toFixed(1)}/${megaTotal}GB`, s:'4 cuentas activas', c:'#f5a623', i:'☁️' },
          ].map((x,i) => (
            <div key={i} style={{ ...s.card, borderTopColor: x.c }}>
              <div style={s.cardLabel}>{x.l}</div>
              <div style={{ ...s.cardValue, color: x.c }}>{x.v}</div>
              <div style={s.cardSub}>{x.s}</div>
              <div style={s.cardIcon}>{x.i}</div>
            </div>
          ))}
        </div>

        {/* MEGA STATUS */}
        {stats?.megaCuentas?.length > 0 && (
          <div style={s.megaPanel}>
            <div style={s.panelHeader}>
              <span style={s.panelTitle}>☁️ Estado de Cuentas MEGA</span>
              <span style={s.panelSub}>60 GB distribuidos en 4 cuentas</span>
            </div>
            <div style={s.megaGrid}>
              {stats.megaCuentas.map(c => (
                <div key={c.numero} style={s.megaCard}>
                  <div style={s.megaTop}>
                    <span style={s.megaNum}>Cuenta {c.numero}</span>
                    <span style={{ fontSize:11, color: c.porcentajeUso > 80 ? '#ff6b6b' : '#00e5a0' }}>
                      {c.porcentajeUso}%
                    </span>
                  </div>
                  <div style={s.megaEmail}>{c.email}</div>
                  <div style={s.megaBar}>
                    <div style={{
                      ...s.megaFill,
                      width: c.porcentajeUso + '%',
                      background: c.porcentajeUso > 80 ? '#ff6b6b' : c.porcentajeUso > 60 ? '#f5a623' : '#00e5a0'
                    }}/>
                  </div>
                  <div style={s.megaStats}>{c.usadoGB} GB usados / {c.disponibleGB} GB libres</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={s.panelsRow}>
          {/* RECIENTES */}
          <div style={s.panel}>
            <div style={s.panelHeader}>
              <span style={s.panelTitle}>Documentos Recientes</span>
              <span style={s.link} onClick={() => navigate('/documentos')}>Ver todos →</span>
            </div>
            <table style={s.table}>
              <thead><tr>{['Nombre','Tipo','Carpeta','Fecha'].map(h=><th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {docs.map(d => {
                  const t = typeInfo(d.tipo);
                  return <tr key={d.uuid}>
                    <td style={s.td}><span style={s.fname}>{d.nombre_display}</span></td>
                    <td style={s.td}><span style={{...s.badge,background:t.bg,color:t.c}}>{t.l}</span></td>
                    <td style={s.td}><span style={s.muted}>📁 {d.carpeta_nombre}</span></td>
                    <td style={{...s.td,...s.muted,fontSize:11}}>{d.fecha}</td>
                  </tr>;
                })}
                {!docs.length && <tr><td colSpan={4} style={{...s.td,textAlign:'center',color:'#6b7592',padding:28}}>Sin documentos aún</td></tr>}
              </tbody>
            </table>
          </div>

          {/* ACTIVIDAD */}
          <div style={s.panel}>
            <div style={s.panelHeader}><span style={s.panelTitle}>Actividad Reciente</span></div>
            {acts.map((a,i) => (
              <div key={i} style={s.actItem}>
                <div style={{...s.dot, background: actColor[a.accion]||'#6b7592'}}/>
                <div>
                  <div style={{fontSize:13,color:'#e8ecf4'}}>{a.descripcion}</div>
                  <div style={{fontSize:11,color:'#6b7592',marginTop:2}}>{a.fecha}</div>
                </div>
              </div>
            ))}
            {!acts.length && <p style={{padding:20,color:'#6b7592',fontSize:13}}>Sin actividad</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  wrap:    {display:'flex',flexDirection:'column',height:'100%',background:'#0a0c10'},
  topbar:  {background:'#111318',borderBottom:'1px solid #1e2330',padding:'0 28px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0},
  title:   {fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:700,color:'#e8ecf4'},
  btn:     {background:'linear-gradient(135deg,#4f7cff,#7b5fff)',border:'none',borderRadius:8,padding:'9px 18px',color:'#fff',fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,cursor:'pointer'},
  content: {flex:1,overflowY:'auto',padding:24},
  loading: {display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#6b7592'},
  statsGrid: {display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:20},
  card:    {background:'#111318',border:'1px solid #1e2330',borderTop:'3px solid',borderRadius:14,padding:'20px 22px',position:'relative',overflow:'hidden'},
  cardLabel: {fontSize:11,color:'#6b7592',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:6},
  cardValue: {fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:800,lineHeight:1},
  cardSub:   {fontSize:11,color:'#6b7592',marginTop:6},
  cardIcon:  {position:'absolute',right:16,top:'50%',transform:'translateY(-50%)',fontSize:36,opacity:.06},
  megaPanel: {background:'#111318',border:'1px solid #1e2330',borderRadius:14,overflow:'hidden',marginBottom:20},
  megaGrid:  {display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:0},
  megaCard:  {padding:'16px 20px',borderRight:'1px solid #1e2330'},
  megaTop:   {display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4},
  megaNum:   {fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,color:'#e8ecf4'},
  megaEmail: {fontSize:11,color:'#6b7592',marginBottom:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},
  megaBar:   {height:4,background:'#1e2330',borderRadius:2,overflow:'hidden',marginBottom:6},
  megaFill:  {height:'100%',borderRadius:2,transition:'width .5s'},
  megaStats: {fontSize:10,color:'#6b7592'},
  panelsRow: {display:'grid',gridTemplateColumns:'1fr 300px',gap:20},
  panel:     {background:'#111318',border:'1px solid #1e2330',borderRadius:14,overflow:'hidden'},
  panelHeader:{padding:'14px 20px',borderBottom:'1px solid #1e2330',display:'flex',alignItems:'center',justifyContent:'space-between'},
  panelTitle: {fontFamily:"'Syne',sans-serif",fontSize:14,fontWeight:700,color:'#e8ecf4'},
  panelSub:   {fontSize:11,color:'#6b7592'},
  link:       {fontSize:12,color:'#4f7cff',cursor:'pointer'},
  table:      {width:'100%',borderCollapse:'collapse'},
  th:         {fontSize:10,textTransform:'uppercase',letterSpacing:'.8px',color:'#6b7592',padding:'9px 20px',textAlign:'left',borderBottom:'1px solid #1e2330',background:'#181c24',fontWeight:500},
  td:         {padding:'10px 20px',fontSize:13,borderBottom:'1px solid #1e2330',color:'#e8ecf4'},
  fname:      {fontWeight:500,fontSize:13,maxWidth:260,display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},
  badge:      {display:'inline-block',padding:'2px 8px',borderRadius:5,fontSize:11,fontWeight:600},
  muted:      {color:'#6b7592',fontSize:12},
  actItem:    {display:'flex',gap:12,padding:'11px 20px',borderBottom:'1px solid #1e2330',alignItems:'flex-start'},
  dot:        {width:8,height:8,borderRadius:'50%',marginTop:5,flexShrink:0},
};

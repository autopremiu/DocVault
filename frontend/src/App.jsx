// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useState, useEffect } from 'react';
import api from './utils/api';
import toast from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import Subir from './pages/Subir';

// ─── LOGIN ───────────────────────────────────────────────────
function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email:'', password:'' });
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setLoading(true);
    try { await login(form.email, form.password); navigate('/'); }
    catch(err) { toast.error(err.response?.data?.error || 'Credenciales incorrectas'); }
    finally { setLoading(false); }
  };
  return (
    <div style={{minHeight:'100vh',background:'#0a0c10',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{position:'fixed',inset:0,background:'radial-gradient(ellipse 700px 600px at 20% 30%,rgba(79,124,255,.1) 0%,transparent 60%),radial-gradient(ellipse 500px 500px at 80% 70%,rgba(0,229,160,.07) 0%,transparent 60%)',pointerEvents:'none'}}/>
      <div style={{position:'relative',zIndex:1,background:'#111318',border:'1px solid #1e2330',borderRadius:20,padding:'48px 52px',width:420,boxShadow:'0 40px 80px rgba(0,0,0,.5)'}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,background:'linear-gradient(135deg,#4f7cff,#00e5a0)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',marginBottom:6}}>DocVault</div>
        <p style={{color:'#6b7592',fontSize:14,marginBottom:12}}>Sistema de Gestión Documental</p>
        <p style={{display:'inline-block',background:'rgba(79,124,255,.1)',border:'1px solid rgba(79,124,255,.3)',borderRadius:20,padding:'4px 12px',fontSize:12,color:'#4f7cff',marginBottom:28}}>🔒 Solo Administradores</p>
        <form onSubmit={submit}>
          {[{l:'Correo',t:'email',k:'email',p:'admin@empresa.com'},{l:'Contraseña',t:'password',k:'password',p:'••••••••'}].map(f=>(
            <div key={f.k}>
              <label style={{display:'block',fontSize:11,textTransform:'uppercase',letterSpacing:'.8px',color:'#6b7592',marginBottom:8,fontWeight:500}}>{f.l}</label>
              <input type={f.t} required placeholder={f.p} style={{width:'100%',background:'#181c24',border:'1px solid #1e2330',borderRadius:10,padding:'12px 16px',color:'#e8ecf4',fontFamily:"'DM Sans',sans-serif",fontSize:15,outline:'none',marginBottom:20,boxSizing:'border-box'}}
                value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}/>
            </div>
          ))}
          <button type="submit" disabled={loading} style={{width:'100%',background:'linear-gradient(135deg,#4f7cff,#7b5fff)',border:'none',borderRadius:10,padding:14,color:'#fff',fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:700,cursor:'pointer',opacity:loading?.7:1}}>
            {loading ? 'Verificando...' : 'Acceder al Sistema →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── DOCUMENTOS ──────────────────────────────────────────────
function Documentos() {
  const [docs,setDocs]=useState([]); const [total,setTotal]=useState(0); const [pages,setPages]=useState(1); const [page,setPage]=useState(1); const [loading,setLoading]=useState(true);
  const [filtros,setFiltros]=useState({tipo:'',buscar:'',carpeta_id:'',orden:'created_at',dir:'DESC'});
  const [carpetas,setCarpetas]=useState([]);
  useEffect(()=>{api.get('/carpetas').then(r=>setCarpetas(r.data)).catch(()=>{});},[]);
  const cargar = async(p=1) => {
    setLoading(true);
    const params={page:p,limit:40,...filtros};
    Object.keys(params).forEach(k=>!params[k]&&delete params[k]);
    try { const {data}=await api.get('/documentos',{params}); setDocs(data.docs||[]); setTotal(data.total||0); setPages(data.pages||1); setPage(p); }
    catch{toast.error('Error');}finally{setLoading(false);}
  };
  useEffect(()=>{cargar(1);},[filtros]);
  const dl = async(uuid,nombre) => {
    try { const r=await api.get(`/documentos/${uuid}/download`,{responseType:'blob'}); const url=URL.createObjectURL(r.data); const a=document.createElement('a');a.href=url;a.download=nombre;a.click();URL.revokeObjectURL(url); toast.success('Descargando...'); }
    catch{toast.error('Error al descargar');}
  };
  const del = async(uuid,nombre) => {
    if(!confirm(`¿Eliminar "${nombre}"?`))return;
    try{await api.delete(`/documentos/${uuid}`);toast.success('Eliminado');cargar(page);}
    catch(e){toast.error(e.response?.data?.error||'Error');}
  };
  const TI = t=>({excel:{bg:'rgba(29,122,69,.2)',c:'#4eca7e',l:'Excel'},word:{bg:'rgba(26,92,192,.2)',c:'#5b9bf8',l:'Word'},ppt:{bg:'rgba(199,64,26,.2)',c:'#ff8c5a',l:'PPT'}}[t]||{bg:'rgba(100,100,100,.2)',c:'#aaa',l:t});
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#0a0c10'}}>
      <div style={{background:'#111318',borderBottom:'1px solid #1e2330',padding:'0 28px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:700,color:'#e8ecf4'}}>Documentos <span style={{fontSize:13,fontWeight:400,color:'#6b7592'}}>({total})</span></div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:24}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:12}}>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {[{v:'',l:'Todos'},{v:'excel',l:'📗 Excel'},{v:'word',l:'📘 Word'},{v:'ppt',l:'📙 PPT'}].map(t=>(
              <button key={t.v} style={{padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:500,border:`1px solid ${filtros.tipo===t.v?'#4f7cff':'#1e2330'}`,background:filtros.tipo===t.v?'rgba(79,124,255,.1)':'#181c24',cursor:'pointer',color:filtros.tipo===t.v?'#4f7cff':'#6b7592'}}
                onClick={()=>setFiltros(p=>({...p,tipo:t.v}))}>{t.l}</button>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}>
            <input style={{background:'#181c24',border:'1px solid #1e2330',borderRadius:8,padding:'8px 14px',color:'#e8ecf4',fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:'none',width:220}} placeholder="🔍 Buscar..." value={filtros.buscar} onChange={e=>setFiltros(p=>({...p,buscar:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&cargar(1)}/>
            <select style={{background:'#181c24',border:'1px solid #1e2330',borderRadius:8,padding:'8px 12px',color:'#e8ecf4',fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:'none'}} value={filtros.carpeta_id} onChange={e=>setFiltros(p=>({...p,carpeta_id:e.target.value}))}>
              <option value="">Todas las carpetas</option>
              {carpetas.map(c=><option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
            </select>
          </div>
        </div>
        <div style={{background:'#111318',border:'1px solid #1e2330',borderRadius:14,overflow:'hidden'}}>
          {loading ? <div style={{padding:40,textAlign:'center',color:'#6b7592'}}>Cargando...</div> : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Nombre','Tipo','Carpeta','Tamaño','MEGA','Fecha','Acciones'].map(h=><th key={h} style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.8px',color:'#6b7592',padding:'9px 18px',textAlign:'left',borderBottom:'1px solid #1e2330',background:'#181c24',fontWeight:500}}>{h}</th>)}</tr></thead>
              <tbody>
                {docs.map(d=>{ const t=TI(d.tipo); return (
                  <tr key={d.uuid}>
                    <td style={{padding:'11px 18px',fontSize:13,borderBottom:'1px solid #1e2330',color:'#e8ecf4'}}><span style={{fontWeight:500,maxWidth:260,display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.nombre_display}</span></td>
                    <td style={{padding:'11px 18px',fontSize:13,borderBottom:'1px solid #1e2330'}}><span style={{display:'inline-block',padding:'2px 8px',borderRadius:5,fontSize:11,fontWeight:600,background:t.bg,color:t.c}}>{t.l}</span></td>
                    <td style={{padding:'11px 18px',fontSize:12,color:'#6b7592',borderBottom:'1px solid #1e2330'}}>📁 {d.carpeta_nombre}</td>
                    <td style={{padding:'11px 18px',fontSize:12,color:'#6b7592',borderBottom:'1px solid #1e2330'}}>{d.tamanio_display}</td>
                    <td style={{padding:'11px 18px',fontSize:11,color:'#00e5a0',borderBottom:'1px solid #1e2330'}}>☁️ C{d.mega_numero}</td>
                    <td style={{padding:'11px 18px',fontSize:11,color:'#6b7592',borderBottom:'1px solid #1e2330'}}>{d.fecha}</td>
                    <td style={{padding:'11px 18px',borderBottom:'1px solid #1e2330'}}>
                      <button style={{background:'none',border:'none',cursor:'pointer',fontSize:16,padding:'4px 6px',borderRadius:6,color:'#6b7592',marginRight:4}} onClick={()=>dl(d.uuid,d.nombre_display)} title="Descargar">⬇</button>
                      <button style={{background:'none',border:'none',cursor:'pointer',fontSize:16,padding:'4px 6px',borderRadius:6,color:'#ff6b6b'}} onClick={()=>del(d.uuid,d.nombre_display)} title="Eliminar">🗑</button>
                    </td>
                  </tr>
                );})}
                {!docs.length && <tr><td colSpan={7} style={{padding:40,textAlign:'center',color:'#6b7592'}}>Sin documentos</td></tr>}
              </tbody>
            </table>
          )}
        </div>
        {pages>1&&<div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:20,marginTop:20}}>
          <button style={{background:'#181c24',border:'1px solid #1e2330',borderRadius:8,padding:'8px 16px',color:'#e8ecf4',cursor:'pointer',fontSize:13}} disabled={page===1} onClick={()=>cargar(page-1)}>← Anterior</button>
          <span style={{color:'#6b7592',fontSize:13}}>Pág. {page} de {pages}</span>
          <button style={{background:'#181c24',border:'1px solid #1e2330',borderRadius:8,padding:'8px 16px',color:'#e8ecf4',cursor:'pointer',fontSize:13}} disabled={page===pages} onClick={()=>cargar(page+1)}>Siguiente →</button>
        </div>}
      </div>
    </div>
  );
}

// ─── CARPETAS ────────────────────────────────────────────────
function Carpetas() {
  const [carpetas,setCarpetas]=useState([]); const [modal,setModal]=useState(false); const [form,setForm]=useState({nombre:'',icono:'📁',departamento:''});
  const cargar = ()=>api.get('/carpetas').then(r=>setCarpetas(r.data));
  useEffect(()=>{cargar();},[]);
  const crear = async()=>{
    if(!form.nombre.trim())return toast.error('Nombre requerido');
    try{await api.post('/carpetas',form);toast.success('Carpeta creada');setModal(false);setForm({nombre:'',icono:'📁',departamento:''});cargar();}
    catch(e){toast.error(e.response?.data?.error||'Error');}
  };
  const ICONOS=['📁','💰','👥','🚀','⚖️','📢','🏢','💻','📦','📊'];
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#0a0c10'}}>
      <div style={{background:'#111318',borderBottom:'1px solid #1e2330',padding:'0 28px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:700,color:'#e8ecf4'}}>Carpetas</div>
        <button style={{background:'linear-gradient(135deg,#4f7cff,#7b5fff)',border:'none',borderRadius:8,padding:'9px 18px',color:'#fff',fontSize:13,cursor:'pointer'}} onClick={()=>setModal(true)}>＋ Nueva Carpeta</button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:24}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:16}}>
          {carpetas.map(c=>(
            <div key={c.id} style={{background:'#111318',border:'1px solid #1e2330',borderRadius:14,padding:20,cursor:'default',transition:'border-color .2s'}}
              onMouseEnter={e=>e.currentTarget.style.borderColor='#4f7cff'} onMouseLeave={e=>e.currentTarget.style.borderColor='#1e2330'}>
              <div style={{fontSize:36,marginBottom:10}}>{c.icono}</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:700,color:'#e8ecf4',marginBottom:4}}>{c.nombre}</div>
              {c.departamento&&<div style={{fontSize:11,color:'#6b7592',marginBottom:10}}>{c.departamento}</div>}
              <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
                <span style={{padding:'2px 7px',borderRadius:5,fontSize:10,fontWeight:600,background:'rgba(29,122,69,.2)',color:'#4eca7e'}}>{c.total_excel||0} xlsx</span>
                <span style={{padding:'2px 7px',borderRadius:5,fontSize:10,fontWeight:600,background:'rgba(26,92,192,.2)',color:'#5b9bf8'}}>{c.total_word||0} docx</span>
                <span style={{padding:'2px 7px',borderRadius:5,fontSize:10,fontWeight:600,background:'rgba(199,64,26,.2)',color:'#ff8c5a'}}>{c.total_ppt||0} pptx</span>
              </div>
              <div style={{fontSize:12,color:'#6b7592'}}>{c.total_docs||0} documentos</div>
            </div>
          ))}
        </div>
      </div>
      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setModal(false)}>
          <div style={{background:'#111318',border:'1px solid #1e2330',borderRadius:16,padding:32,width:440}} onClick={e=>e.stopPropagation()}>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:'#e8ecf4',marginBottom:20}}>Nueva Carpeta</h2>
            {[{l:'Nombre *',k:'nombre',p:'Ej: Contratos 2024'},{l:'Departamento',k:'departamento',p:'Ej: Finanzas, RRHH...'}].map(f=>(
              <div key={f.k}><label style={{display:'block',fontSize:11,textTransform:'uppercase',letterSpacing:'.7px',color:'#6b7592',marginBottom:6}}>{f.l}</label>
              <input style={{width:'100%',background:'#181c24',border:'1px solid #1e2330',borderRadius:8,padding:'10px 14px',color:'#e8ecf4',fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:'none',marginBottom:14,boxSizing:'border-box'}}
                placeholder={f.p} value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}/></div>
            ))}
            <div style={{marginBottom:16}}><label style={{display:'block',fontSize:11,textTransform:'uppercase',letterSpacing:'.7px',color:'#6b7592',marginBottom:8}}>Ícono</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {ICONOS.map(i=><button key={i} style={{width:36,height:36,borderRadius:8,border:`1px solid ${form.icono===i?'#4f7cff':'#1e2330'}`,background:form.icono===i?'rgba(79,124,255,.15)':'#181c24',cursor:'pointer',fontSize:18}} onClick={()=>setForm(p=>({...p,icono:i}))}>{i}</button>)}
              </div>
            </div>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <button style={{padding:'9px 18px',borderRadius:8,border:'1px solid #1e2330',background:'none',color:'#6b7592',cursor:'pointer',fontSize:13}} onClick={()=>setModal(false)}>Cancelar</button>
              <button style={{background:'linear-gradient(135deg,#4f7cff,#7b5fff)',border:'none',borderRadius:8,padding:'9px 18px',color:'#fff',fontSize:13,cursor:'pointer'}} onClick={crear}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ACTIVIDAD ───────────────────────────────────────────────
function Actividad() {
  const [acts,setActs]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{api.get('/actividad').then(r=>setActs(r.data)).catch(()=>{}).finally(()=>setLoading(false));});
  const AC={LOGIN:'#4f7cff',UPLOAD:'#00e5a0',DOWNLOAD:'#f5a623',DELETE:'#ff6b6b',CREATE_FOLDER:'#c084fc'};
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:'#0a0c10'}}>
      <div style={{background:'#111318',borderBottom:'1px solid #1e2330',padding:'0 28px',height:60,display:'flex',alignItems:'center',flexShrink:0}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:700,color:'#e8ecf4'}}>Registro de Actividad</div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:24}}>
        <div style={{background:'#111318',border:'1px solid #1e2330',borderRadius:14,overflow:'hidden'}}>
          {loading?<div style={{padding:40,textAlign:'center',color:'#6b7592'}}>Cargando...</div>:(
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Acción','Descripción','Admin','Fecha'].map(h=><th key={h} style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.8px',color:'#6b7592',padding:'9px 20px',textAlign:'left',borderBottom:'1px solid #1e2330',background:'#181c24',fontWeight:500}}>{h}</th>)}</tr></thead>
              <tbody>
                {acts.map((a,i)=>(
                  <tr key={i}>
                    <td style={{padding:'11px 20px',fontSize:13,borderBottom:'1px solid #1e2330'}}><span style={{padding:'3px 10px',borderRadius:5,fontSize:11,fontWeight:600,background:`${AC[a.accion]||'#6b7592'}22`,color:AC[a.accion]||'#6b7592'}}>{a.accion}</span></td>
                    <td style={{padding:'11px 20px',fontSize:13,borderBottom:'1px solid #1e2330',color:'#e8ecf4'}}>{a.descripcion}</td>
                    <td style={{padding:'11px 20px',fontSize:12,color:'#6b7592',borderBottom:'1px solid #1e2330'}}>{a.admin_nombre}</td>
                    <td style={{padding:'11px 20px',fontSize:11,color:'#6b7592',borderBottom:'1px solid #1e2330'}}>{a.fecha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LAYOUT ──────────────────────────────────────────────────
const NAV=[{to:'/',l:'Dashboard',i:'📊'},{to:'/carpetas',l:'Carpetas',i:'📁'},{to:'/documentos',l:'Documentos',i:'📄'},{to:'/subir',l:'Carga Masiva',i:'⬆️'},{to:'/actividad',l:'Actividad',i:'🕑'}];
function Layout() {
  const {admin,logout}=useAuth(); const navigate=useNavigate();
  return (
    <div style={{display:'flex',height:'100vh',background:'#0a0c10',fontFamily:"'DM Sans',sans-serif"}}>
      <aside style={{width:240,background:'#111318',borderRight:'1px solid #1e2330',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'22px 20px 16px',fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,background:'linear-gradient(135deg,#4f7cff,#00e5a0)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',borderBottom:'1px solid #1e2330'}}>DocVault</div>
        <div style={{padding:'12px 8px 8px'}}>
          <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'1px',color:'#6b7592',padding:'4px 12px 8px',fontWeight:500}}>Menú</div>
          {NAV.map(n=>(
            <NavLink key={n.to} to={n.to} end={n.to==='/'} style={({isActive})=>({display:'flex',alignItems:'center',gap:10,padding:'9px 12px',margin:'1px 0',borderRadius:8,cursor:'pointer',fontSize:14,color:isActive?'#4f7cff':'#6b7592',textDecoration:'none',background:isActive?'rgba(79,124,255,.15)':'transparent'})}>
              <span style={{width:22,textAlign:'center',fontSize:16}}>{n.i}</span><span>{n.l}</span>
            </NavLink>
          ))}
        </div>
        <div style={{marginTop:'auto',padding:'16px 12px',borderTop:'1px solid #1e2330'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'#181c24',borderRadius:10}}>
            <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,#4f7cff,#7b5fff)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',flexShrink:0}}>{admin?.nombre?.[0]||'A'}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:500,color:'#e8ecf4',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{admin?.nombre||'Admin'}</div>
              <div style={{fontSize:11,color:'#00e5a0'}}>● Super Admin</div>
            </div>
            <button style={{background:'none',border:'none',color:'#6b7592',cursor:'pointer',fontSize:18}} onClick={()=>{logout();navigate('/login')}} title="Cerrar sesión">↩</button>
          </div>
        </div>
      </aside>
      <main style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',color:'#e8ecf4'}}><Outlet/></main>
    </div>
  );
}

function Protected({children}) {
  const {admin,loading}=useAuth();
  if(loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0a0c10',color:'#6b7592',fontFamily:"'DM Sans',sans-serif"}}>Cargando...</div>;
  if(!admin) return <Navigate to="/login" replace/>;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="bottom-right" toastOptions={{style:{background:'#181c24',color:'#e8ecf4',border:'1px solid #1e2330',fontFamily:"'DM Sans',sans-serif",fontSize:13},success:{iconTheme:{primary:'#00e5a0',secondary:'#0a0c10'}},error:{iconTheme:{primary:'#ff6b6b',secondary:'#0a0c10'}}}}/>
        <Routes>
          <Route path="/login" element={<Login/>}/>
          <Route path="/" element={<Protected><Layout/></Protected>}>
            <Route index element={<Dashboard/>}/>
            <Route path="carpetas" element={<Carpetas/>}/>
            <Route path="documentos" element={<Documentos/>}/>
            <Route path="subir" element={<Subir/>}/>
            <Route path="actividad" element={<Actividad/>}/>
          </Route>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

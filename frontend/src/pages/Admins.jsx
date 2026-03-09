import { useState, useEffect } from "react";
import api from "../utils/api";
import toast from "react-hot-toast";

export default function Admins() {
  const [admins,   setAdmins]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [form,     setForm]     = useState({ nombre:'', email:'', password:'' });
  const [guardando,setGuardando]= useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const cargar = () => {
    setLoading(true);
    api.get('/admins')
      .then(r => setAdmins(r.data))
      .catch(() => toast.error('Error cargando administradores'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const crear = async () => {
    if (!form.nombre.trim() || !form.email.trim() || !form.password.trim())
      return toast.error('Todos los campos son requeridos');
    setGuardando(true);
    try {
      await api.post('/admins', form);
      toast.success('Administrador creado');
      setModal(false);
      setForm({ nombre:'', email:'', password:'' });
      cargar();
    } catch(e) {
      toast.error(e.response?.data?.error || 'Error al crear');
    } finally { setGuardando(false); }
  };

  const toggleEstado = async (admin) => {
    try {
      await api.put(`/admins/${admin.id}`, { activo: !admin.activo });
      toast.success(admin.activo ? 'Administrador desactivado' : 'Administrador activado');
      cargar();
    } catch { toast.error('Error al actualizar'); }
  };

  const eliminar = async (admin) => {
    try {
      await api.delete(`/admins/${admin.id}`);
      toast.success('Administrador eliminado');
      setConfirmDel(null);
      cargar();
    } catch(e) { toast.error(e.response?.data?.error || 'No se puede eliminar'); }
  };

  const avatarColor = (nombre) => {
    const colors = ['#4f7cff','#7b5fff','#00e5a0','#f5a623','#ff6b6b','#c084fc'];
    return colors[nombre?.charCodeAt(0) % colors.length] || '#4f7cff';
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#0a0c10' }}>

      {/* HEADER */}
      <div style={{ background:'#111318', borderBottom:'1px solid #1e2330', padding:'0 28px', height:60, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:'#e8ecf4' }}>
          Administradores
          <span style={{ fontSize:13, color:'#6b7592', fontWeight:400 }}> ({admins.length})</span>
        </div>
        <button
          style={{ background:'linear-gradient(135deg,#4f7cff,#7b5fff)', border:'none', borderRadius:8, padding:'9px 18px', color:'#fff', fontSize:13, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:500 }}
          onClick={() => setModal(true)}>
          ＋ Nuevo Administrador
        </button>
      </div>

      {/* BODY */}
      <div style={{ flex:1, overflowY:'auto', padding:28 }}>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:14, marginBottom:24 }}>
          {[
            { l:'Total', v: admins.length, c:'#4f7cff', bg:'rgba(79,124,255,.1)', i:'👤' },
            { l:'Activos', v: admins.filter(a=>a.activo).length, c:'#00e5a0', bg:'rgba(0,229,160,.1)', i:'✅' },
            { l:'Inactivos', v: admins.filter(a=>!a.activo).length, c:'#ff6b6b', bg:'rgba(255,107,107,.1)', i:'⛔' },
          ].map(s => (
            <div key={s.l} style={{ background:'#111318', border:'1px solid #1e2330', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:42, height:42, borderRadius:10, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{s.i}</div>
              <div>
                <div style={{ fontSize:22, fontWeight:700, color:s.c, fontFamily:"'Syne',sans-serif" }}>{s.v}</div>
                <div style={{ fontSize:11, color:'#6b7592', textTransform:'uppercase', letterSpacing:'.6px' }}>{s.l}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabla */}
        <div style={{ background:'#111318', border:'1px solid #1e2330', borderRadius:14, overflow:'hidden' }}>
          {loading ? (
            <div style={{ padding:48, textAlign:'center', color:'#6b7592', fontSize:14 }}>Cargando...</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Administrador','Email','Estado','Último acceso','Acciones'].map(h => (
                    <th key={h} style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.8px', color:'#6b7592', padding:'11px 20px', textAlign:'left', borderBottom:'1px solid #1e2330', background:'#181c24', fontWeight:500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {admins.map(a => (
                  <tr key={a.id}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(79,124,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>

                    {/* Nombre + avatar */}
                    <td style={{ padding:'13px 20px', borderBottom:'1px solid #1e2330' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:34, height:34, borderRadius:'50%', background:`linear-gradient(135deg,${avatarColor(a.nombre)},${avatarColor(a.nombre)}99)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>
                          {a.nombre?.[0]?.toUpperCase() || 'A'}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:'#e8ecf4' }}>{a.nombre}</div>
                          <div style={{ fontSize:11, color:'#6b7592' }}>ID #{a.id}</div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ padding:'13px 20px', fontSize:13, color:'#6b7592', borderBottom:'1px solid #1e2330' }}>{a.email}</td>

                    {/* Estado */}
                    <td style={{ padding:'13px 20px', borderBottom:'1px solid #1e2330' }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600,
                        background: a.activo ? 'rgba(0,229,160,.12)' : 'rgba(255,107,107,.12)',
                        color:       a.activo ? '#00e5a0'            : '#ff6b6b',
                        border:      `1px solid ${a.activo ? 'rgba(0,229,160,.2)' : 'rgba(255,107,107,.2)'}` }}>
                        <span style={{ width:6, height:6, borderRadius:'50%', background: a.activo ? '#00e5a0' : '#ff6b6b', display:'inline-block' }}/>
                        {a.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    {/* Último acceso */}
                    <td style={{ padding:'13px 20px', fontSize:12, color:'#6b7592', borderBottom:'1px solid #1e2330' }}>
                      {a.ultimo_acceso ? new Date(a.ultimo_acceso).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'}) : '—'}
                    </td>

                    {/* Acciones */}
                    <td style={{ padding:'13px 20px', borderBottom:'1px solid #1e2330' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button
                          title={a.activo ? 'Desactivar' : 'Activar'}
                          style={{ padding:'5px 12px', borderRadius:7, border:`1px solid ${a.activo?'rgba(255,107,107,.3)':'rgba(0,229,160,.3)'}`, background: a.activo?'rgba(255,107,107,.08)':'rgba(0,229,160,.08)', color: a.activo?'#ff6b6b':'#00e5a0', cursor:'pointer', fontSize:12, fontWeight:500 }}
                          onClick={() => toggleEstado(a)}>
                          {a.activo ? '⛔ Desactivar' : '✅ Activar'}
                        </button>
                        <button
                          title="Eliminar"
                          style={{ width:30, height:30, borderRadius:7, border:'1px solid rgba(255,107,107,.2)', background:'rgba(255,107,107,.06)', color:'#ff6b6b', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}
                          onClick={() => setConfirmDel(a)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!admins.length && (
                  <tr><td colSpan={5} style={{ padding:48, textAlign:'center', color:'#6b7592', fontSize:13 }}>No hay administradores</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL CREAR */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.78)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}
          onClick={() => setModal(false)}>
          <div style={{ background:'#111318', border:'1px solid #1e2330', borderRadius:16, padding:32, width:440, maxWidth:'94vw' }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:700, color:'#e8ecf4', marginBottom:6 }}>＋ Nuevo Administrador</h2>
            <p style={{ fontSize:13, color:'#6b7592', marginBottom:24 }}>El administrador podrá acceder al sistema con estas credenciales.</p>

            {[
              { l:'Nombre completo', k:'nombre', t:'text',     p:'Ej: Juan Pérez' },
              { l:'Email',           k:'email',  t:'email',    p:'Ej: juan@empresa.com' },
              { l:'Contraseña',      k:'password',t:'password',p:'Mínimo 8 caracteres' },
            ].map(f => (
              <div key={f.k} style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:11, textTransform:'uppercase', letterSpacing:'.7px', color:'#6b7592', marginBottom:6 }}>{f.l}</label>
                <input type={f.t}
                  style={{ width:'100%', background:'#181c24', border:'1px solid #1e2330', borderRadius:8, padding:'10px 14px', color:'#e8ecf4', fontFamily:"'DM Sans',sans-serif", fontSize:14, outline:'none', boxSizing:'border-box' }}
                  placeholder={f.p} value={form[f.k]}
                  onChange={e => setForm(p => ({...p, [f.k]: e.target.value}))}
                  onKeyDown={e => e.key==='Enter' && crear()}/>
              </div>
            ))}

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:24 }}>
              <button style={{ padding:'9px 18px', borderRadius:8, border:'1px solid #1e2330', background:'none', color:'#6b7592', cursor:'pointer', fontSize:13 }}
                onClick={() => { setModal(false); setForm({nombre:'',email:'',password:''}); }}>Cancelar</button>
              <button style={{ background:'linear-gradient(135deg,#4f7cff,#7b5fff)', border:'none', borderRadius:8, padding:'9px 20px', color:'#fff', fontSize:13, cursor:'pointer', fontWeight:600, opacity: guardando ? .7 : 1 }}
                onClick={crear} disabled={guardando}>
                {guardando ? 'Creando...' : 'Crear administrador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      {confirmDel && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.78)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}
          onClick={() => setConfirmDel(null)}>
          <div style={{ background:'#111318', border:'1px solid rgba(255,107,107,.3)', borderRadius:16, padding:32, width:380, maxWidth:'94vw', textAlign:'center' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:48, marginBottom:12 }}>🗑️</div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:'#e8ecf4', marginBottom:8 }}>¿Eliminar administrador?</div>
            <div style={{ fontSize:13, color:'#6b7592', marginBottom:24 }}>
              <strong style={{ color:'#e8ecf4' }}>{confirmDel.nombre}</strong> ({confirmDel.email})<br/>
              <span style={{ fontSize:12 }}>Esta acción no se puede deshacer.</span>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button style={{ padding:'9px 22px', borderRadius:8, border:'1px solid #1e2330', background:'none', color:'#6b7592', cursor:'pointer', fontSize:13 }}
                onClick={() => setConfirmDel(null)}>Cancelar</button>
              <button style={{ padding:'9px 22px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#ff4444,#cc2222)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}
                onClick={() => eliminar(confirmDel)}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
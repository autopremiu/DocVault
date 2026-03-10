// src/components/VisorDocumento.jsx
import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function VisorDocumento({ uuid, nombre, tipo, onClose }) {
  const [modo,       setModo]       = useState('ver');      // 'ver' | 'editar'
  const [estado,     setEstado]     = useState('loading');  // loading | ok | nolink | error | editando | guardando
  const [docInfo,    setDocInfo]    = useState(null);
  const [viewerUrl,  setViewerUrl]  = useState('');
  const [driveUrl,   setDriveUrl]   = useState('');
  const [driveFileId,setDriveFileId]= useState('');
  const [iframeKey,  setIframeKey]  = useState(0);
  const [esEditable, setEsEditable] = useState(false);

  const EDITABLES = ['xlsx','xls','xlsm','docx','doc','pptx','ppt'];
  const ext = docInfo?.extension || nombre?.split('.').pop()?.toLowerCase() || '';
  const puedeEditar = EDITABLES.includes(ext);

  // ── Cargar info del documento ──
  useEffect(() => {
    if (!uuid) return;
    setEstado('loading');
    api.get(`/documentos/${uuid}/info`)
      .then(r => {
        setDocInfo(r.data);
        if (!r.data.megaLink) { setEstado('nolink'); return; }
        const previewUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
          api.defaults.baseURL + '/documentos/' + uuid + '/preview'
        )}&embedded=true`;
        setViewerUrl(previewUrl);
        setEstado('ok');
      })
      .catch(() => setEstado('error'));
  }, [uuid]);

  // ── Abrir en Google Drive para editar ──
  const abrirEditor = async () => {
    setEstado('editando');
    const toastId = toast.loading('Preparando editor...');
    try {
      const { data } = await api.post(`/documentos/${uuid}/editar`);
      setDriveUrl(data.webViewLink);
      setDriveFileId(data.fileId);
      setEsEditable(data.esEditable);
      setModo('editar');
      setEstado('ok');
      // Abrir en pestaña nueva (Google bloquea sus editores en iframes)
      window.open(data.webViewLink, '_blank');
      toast.success('Editor abierto en nueva pestaña — cuando termines haz clic en "Guardar cambios"', { id: toastId, duration: 6000 });
    } catch(e) {
      setEstado('ok');
      toast.error(e.response?.data?.error || 'Error al abrir editor', { id: toastId });
    }
  };

  // ── Guardar cambios de vuelta a MEGA ──
  const [yaGuardando, setYaGuardando] = useState(false);

  const guardar = async () => {
    if (yaGuardando) return; // evitar doble clic
    setYaGuardando(true);
    setEstado('guardando');
    const toastId = toast.loading('Guardando cambios en MEGA...');
    try {
      await api.post(`/documentos/${uuid}/guardar-drive`);
      toast.success('✅ Documento guardado correctamente en MEGA', { id: toastId });
      setModo('ver');
      setDriveUrl('');
      setDriveFileId('');
      setEstado('ok');
    } catch(e) {
      setEstado('ok');
      toast.error(e.response?.data?.error || 'Error al guardar', { id: toastId });
    } finally {
      setYaGuardando(false);
    }
  };

  // ── Cancelar edición sin guardar ──
  const cancelarEdicion = async () => {
    if (!confirm('¿Descartar los cambios? El documento original no se modificará.')) return;
    try {
      await api.delete(`/documentos/${uuid}/cancelar-drive`);
    } catch {}
    setModo('ver');
    setDriveUrl('');
    setDriveFileId('');
    toast('Edición cancelada — sin cambios guardados', { icon: 'ℹ️' });
  };

  // ── Descargar ──
  const descargar = async () => {
    try {
      const r = await api.get(`/documentos/${uuid}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a'); a.href = url; a.download = nombre; a.click();
      URL.revokeObjectURL(url);
      toast.success('Descargando...');
    } catch { toast.error('Error al descargar'); }
  };

  const recargar = () => setIframeKey(k => k + 1);

  const tipoIcon = { excel: '📗', word: '📘', ppt: '📙', pdf: '📕' };
  const iframeUrl = modo === 'editar' ? driveUrl : viewerUrl;

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>

        {/* ── HEADER ── */}
        <div style={s.header}>
          <div style={s.hLeft}>
            <span style={{ fontSize: 20 }}>{tipoIcon[tipo] || '📄'}</span>
            <span style={s.hNombre}>{nombre}</span>
            {docInfo?.tamanioDisplay && <span style={s.hBadge}>{docInfo.tamanioDisplay}</span>}
            {modo === 'editar' && (
              <span style={{ ...s.hBadge, background: 'rgba(0,229,160,.1)', color: '#00e5a0', border: '1px solid rgba(0,229,160,.2)' }}>
                ✏️ Modo edición
              </span>
            )}
          </div>
          <div style={s.hRight}>
            {/* Tabs Ver / Editar */}
            <div style={s.tabs}>
              <button
                style={{ ...s.tab, ...(modo === 'ver' ? s.tabActive : {}) }}
                onClick={() => { if (modo === 'editar') cancelarEdicion(); else setModo('ver'); }}>
                👁 Ver
              </button>
              {puedeEditar && (
                <button
                  style={{ ...s.tab, ...(modo === 'editar' ? s.tabActive : {}) }}
                  onClick={() => { if (modo === 'ver' && estado === 'ok') abrirEditor(); }}>
                  ✏️ Editar
                </button>
              )}
            </div>

            {modo === 'ver' && <button style={s.iconBtn} onClick={recargar} title="Recargar">↻</button>}
            <button style={s.iconBtn} onClick={descargar} title="Descargar">⬇</button>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* ── BANNER EDICIÓN ── */}
        {modo === 'editar' && estado === 'ok' && (
          <div style={s.bannerEdit}>
            <span style={{ fontSize: 13, color: '#e8ecf4' }}>
              ✏️ Edita el documento en Google Docs — cuando termines haz clic en <strong>"Guardar cambios"</strong>
            </span>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button style={s.btnGuardar} onClick={guardar}>
                💾 Guardar cambios en MEGA
              </button>
              <button style={s.btnCancelar} onClick={cancelarEdicion}>
                ✕ Descartar
              </button>
            </div>
          </div>
        )}

        {/* ── BANNER VER ── */}
        {modo === 'ver' && estado === 'ok' && (
          <div style={s.banner}>
            <span style={s.bannerTxt}>👁 Google Docs Viewer</span>
            <span style={{ ...s.bannerTxt, marginLeft: 'auto', color: '#00e5a0' }}>
              ✓ Formato original <strong>.{ext}</strong> guardado en MEGA
            </span>
          </div>
        )}

        {/* ── BODY ── */}
        <div style={s.body}>

          {/* Cargando */}
          {(estado === 'loading' || estado === 'editando' || estado === 'guardando') && (
            <div style={s.center}>
              <div style={{ fontSize: 48, animation: 'spin 1.5s linear infinite', marginBottom: 16 }}>⚙️</div>
              <div style={s.cTitle}>
                {estado === 'loading'   ? 'Preparando visor...'       :
                 estado === 'editando'  ? 'Abriendo editor...'         :
                 estado === 'guardando' ? 'Guardando en MEGA...' : ''}
              </div>
              <div style={s.cSub}>
                {estado === 'editando'  ? 'Subiendo a Google Drive, un momento' :
                 estado === 'guardando' ? 'Descargando cambios y subiendo a MEGA' :
                 'Obteniendo información del documento'}
              </div>
              <div style={s.bar}><div style={s.barFill} /></div>
            </div>
          )}

          {/* Iframe solo en modo VER */}
          {estado === 'ok' && modo === 'ver' && viewerUrl && (
            <>
              <iframe
                key={iframeKey}
                src={viewerUrl}
                style={s.iframe}
                frameBorder="0"
                allowFullScreen
                title={nombre}
              />
              <div style={s.tip}>
                ¿No carga?{' '}
                <span style={s.link} onClick={recargar}>Reintentar</span>
                {' · '}
                <span style={s.link} onClick={() => window.open(viewerUrl, '_blank')}>Abrir en nueva pestaña</span>
                {' · '}
                <span style={s.link} onClick={descargar}>Descargar</span>
                {puedeEditar && (
                  <> {' · '}
                    <span style={{ ...s.link, color: '#00e5a0' }} onClick={abrirEditor}>✏️ Editar con Google Docs</span>
                  </>
                )}
              </div>
            </>
          )}

          {/* Pantalla de edición activa */}
          {estado === 'ok' && modo === 'editar' && (
            <div style={s.center}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>✏️</div>
              <div style={s.cTitle}>Editor abierto en nueva pestaña</div>
              <div style={s.cSub}>
                El documento se abrió en Google Docs en una nueva pestaña.<br/>
                Edita normalmente — Google guarda automáticamente.<br/>
                Cuando termines, vuelve aquí y haz clic en <strong style={{color:'#00e5a0'}}>"Guardar cambios en MEGA"</strong>.
              </div>
              <div style={{display:'flex', gap:12, marginTop:8}}>
                <button style={{...s.btnP, background:'linear-gradient(135deg,#00c87a,#00a362)'}} onClick={()=>window.open(driveUrl,'_blank')}>
                  ↗ Volver al editor
                </button>
                <button style={{...s.btnP}} onClick={guardar}>
                  💾 Guardar cambios en MEGA
                </button>
              </div>
            </div>
          )}

          {/* Sin link */}
          {estado === 'nolink' && (
            <div style={s.center}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🔗</div>
              <div style={s.cTitle}>Link de MEGA no disponible</div>
              <div style={s.cSub}>Este documento fue subido antes de que se generaran links públicos. Puedes descargarlo directamente.</div>
              <button style={s.btnP} onClick={descargar}>⬇ Descargar el archivo</button>
            </div>
          )}

          {/* Error */}
          {estado === 'error' && (
            <div style={s.center}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>⚠️</div>
              <div style={s.cTitle}>Error al cargar el documento</div>
              <div style={s.cSub}>No se pudo obtener la información del archivo.</div>
              <button style={s.btnP} onClick={descargar}>⬇ Descargar el archivo</button>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes spin    { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes loadbar { 0% { transform: translateX(-100%) } 100% { transform: translateX(400%) } }
      `}</style>
    </div>
  );
}

const s = {
  overlay:    { position:'fixed', inset:0, background:'rgba(0,0,0,.9)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' },
  modal:      { background:'#0d1017', border:'1px solid #1e2330', borderRadius:16, width:'96vw', maxWidth:1440, height:'94vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 40px 100px rgba(0,0,0,.9)' },
  header:     { padding:'0 14px', height:54, background:'#111318', borderBottom:'1px solid #1e2330', display:'flex', alignItems:'center', gap:10, flexShrink:0 },
  hLeft:      { display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 },
  hNombre:    { fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:700, color:'#e8ecf4', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  hBadge:     { fontSize:11, color:'#6b7592', background:'#181c24', padding:'2px 7px', borderRadius:5, border:'1px solid #1e2330', flexShrink:0 },
  hRight:     { display:'flex', gap:6, alignItems:'center', flexShrink:0 },
  tabs:       { display:'flex', background:'#181c24', border:'1px solid #1e2330', borderRadius:8, overflow:'hidden', marginRight:4 },
  tab:        { padding:'6px 14px', fontSize:12, fontWeight:500, color:'#6b7592', border:'none', background:'transparent', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" },
  tabActive:  { background:'rgba(79,124,255,.15)', color:'#4f7cff' },
  iconBtn:    { width:30, height:30, borderRadius:7, border:'1px solid #1e2330', background:'#181c24', color:'#6b7592', cursor:'pointer', fontSize:15, display:'flex', alignItems:'center', justifyContent:'center' },
  closeBtn:   { width:30, height:30, borderRadius:7, background:'rgba(255,107,107,.1)', border:'1px solid rgba(255,107,107,.3)', color:'#ff6b6b', cursor:'pointer', fontSize:15 },
  banner:     { padding:'6px 16px', background:'#181c24', borderBottom:'1px solid #1e2330', display:'flex', alignItems:'center', gap:16, flexShrink:0, flexWrap:'wrap' },
  bannerTxt:  { fontSize:12, color:'#6b7592' },
  bannerEdit: { padding:'10px 16px', background:'rgba(0,229,160,.06)', borderBottom:'1px solid rgba(0,229,160,.2)', display:'flex', alignItems:'center', gap:12, flexShrink:0, flexWrap:'wrap' },
  btnGuardar: { padding:'7px 18px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#00c87a,#00a362)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600, whiteSpace:'nowrap' },
  btnCancelar:{ padding:'7px 14px', borderRadius:8, border:'1px solid #1e2330', background:'none', color:'#6b7592', cursor:'pointer', fontSize:13 },
  body:       { flex:1, overflow:'hidden', display:'flex', flexDirection:'column' },
  iframe:     { flex:1, width:'100%', border:'none', background:'#fff' },
  tip:        { padding:'6px 16px', background:'#0a0c10', borderTop:'1px solid #1e2330', fontSize:11, color:'#6b7592', textAlign:'center', flexShrink:0 },
  link:       { color:'#4f7cff', cursor:'pointer' },
  center:     { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, padding:48, textAlign:'center' },
  cTitle:     { fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:'#e8ecf4', marginBottom:6 },
  cSub:       { fontSize:13, color:'#6b7592', maxWidth:460, lineHeight:1.7, marginBottom:20 },
  bar:        { width:200, height:3, background:'#1e2330', borderRadius:3, overflow:'hidden', marginTop:16 },
  barFill:    { height:'100%', width:'50%', background:'linear-gradient(90deg,#4f7cff,#00e5a0)', borderRadius:3, animation:'loadbar 1.2s ease-in-out infinite' },
  btnP:       { padding:'10px 28px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#4f7cff,#7b5fff)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 },
};
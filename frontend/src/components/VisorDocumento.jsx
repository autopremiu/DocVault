// src/components/VisorDocumento.jsx
import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function VisorDocumento({ uuid, nombre, tipo, onClose }) {
  const [estado,    setEstado]    = useState('loading');
  const [docInfo,   setDocInfo]   = useState(null);
  const [viewerUrl, setViewerUrl] = useState('');
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    if (!uuid) return;
    setEstado('loading');
    api.get(`/documentos/${uuid}/info`)
      .then(r => {
        setDocInfo(r.data);
        if (!r.data.megaLink) { setEstado('nolink'); return; }
        setViewerUrl(`https://docs.google.com/viewer?url=${encodeURIComponent(r.data.megaLink)}&embedded=true`);
        setEstado('ok');
      })
      .catch(() => setEstado('error'));
  }, [uuid]);

  const recargar = () => setIframeKey(k => k + 1);

  const descargar = async () => {
    try {
      const r = await api.get(`/documentos/${uuid}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Descargando archivo original...');
    } catch {
      toast.error('Error al descargar');
    }
  };

  const ext = docInfo?.extension || nombre?.split('.').pop()?.toLowerCase() || '';
  const tipoIcon = { excel: '📗', word: '📘', ppt: '📙', pdf: '📕' };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>

        {/* HEADER */}
        <div style={s.header}>
          <div style={s.hLeft}>
            <span style={{ fontSize: 20 }}>{tipoIcon[tipo] || '📄'}</span>
            <span style={s.hNombre}>{nombre}</span>
            {docInfo?.tamanioDisplay && (
              <span style={s.hBadge}>{docInfo.tamanioDisplay}</span>
            )}
          </div>
          <div style={s.hRight}>
            <button style={s.iconBtn} onClick={recargar} title="Recargar">↻</button>
            <button style={s.iconBtn} onClick={() => window.open(viewerUrl, '_blank')} title="Nueva pestaña">↗</button>
            <button style={s.iconBtn} onClick={descargar} title="Descargar original">⬇</button>
            <button style={s.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* BANNER */}
        {estado === 'ok' && (
          <div style={s.banner}>
            <span style={s.bannerTxt}>
              👁 Google Docs Viewer — sin cuenta requerida
            </span>
            <span style={{ ...s.bannerTxt, marginLeft: 'auto', color: '#00e5a0' }}>
              ✓ Guardado en MEGA como <strong>.{ext}</strong> — formato original intacto
            </span>
          </div>
        )}

        {/* BODY */}
        <div style={s.body}>

          {estado === 'loading' && (
            <div style={s.center}>
              <div style={{ fontSize: 48, animation: 'spin 1.5s linear infinite', marginBottom: 16 }}>⚙️</div>
              <div style={s.cTitle}>Preparando visor...</div>
              <div style={s.cSub}>Obteniendo información del documento</div>
              <div style={s.bar}><div style={s.barFill} /></div>
            </div>
          )}

          {estado === 'ok' && viewerUrl && (
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
                <span style={s.link} onClick={descargar}>Descargar archivo</span>
              </div>
            </>
          )}

          {estado === 'nolink' && (
            <div style={s.center}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🔗</div>
              <div style={s.cTitle}>Link de MEGA no disponible</div>
              <div style={s.cSub}>
                Este documento fue subido antes de que se generaran links públicos.
                Puedes descargarlo directamente.
              </div>
              <button style={s.btnP} onClick={descargar}>⬇ Descargar el archivo</button>
            </div>
          )}

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
        @keyframes spin    { from { transform: rotate(0deg)   } to { transform: rotate(360deg) } }
        @keyframes loadbar { 0%   { transform: translateX(-100%) } 100% { transform: translateX(400%) } }
      `}</style>
    </div>
  );
}

const s = {
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' },
  modal:    { background: '#0d1017', border: '1px solid #1e2330', borderRadius: 16, width: '96vw', maxWidth: 1440, height: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,.9)' },
  header:   { padding: '0 14px', height: 52, background: '#111318', borderBottom: '1px solid #1e2330', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  hLeft:    { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  hNombre:  { fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, color: '#e8ecf4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  hBadge:   { fontSize: 11, color: '#6b7592', background: '#181c24', padding: '2px 7px', borderRadius: 5, border: '1px solid #1e2330', flexShrink: 0 },
  hRight:   { display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 },
  iconBtn:  { width: 30, height: 30, borderRadius: 7, border: '1px solid #1e2330', background: '#181c24', color: '#6b7592', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { width: 30, height: 30, borderRadius: 7, background: 'rgba(255,107,107,.1)', border: '1px solid rgba(255,107,107,.3)', color: '#ff6b6b', cursor: 'pointer', fontSize: 15 },
  banner:   { padding: '6px 16px', background: '#181c24', borderBottom: '1px solid #1e2330', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, flexWrap: 'wrap' },
  bannerTxt:{ fontSize: 12, color: '#6b7592' },
  body:     { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  iframe:   { flex: 1, width: '100%', border: 'none', background: '#fff' },
  tip:      { padding: '6px 16px', background: '#0a0c10', borderTop: '1px solid #1e2330', fontSize: 11, color: '#6b7592', textAlign: 'center', flexShrink: 0 },
  link:     { color: '#4f7cff', cursor: 'pointer' },
  center:   { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 48, textAlign: 'center' },
  cTitle:   { fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: '#e8ecf4', marginBottom: 6 },
  cSub:     { fontSize: 13, color: '#6b7592', maxWidth: 460, lineHeight: 1.7, marginBottom: 20 },
  bar:      { width: 200, height: 3, background: '#1e2330', borderRadius: 3, overflow: 'hidden', marginTop: 16 },
  barFill:  { height: '100%', width: '50%', background: 'linear-gradient(90deg,#4f7cff,#00e5a0)', borderRadius: 3, animation: 'loadbar 1.2s ease-in-out infinite' },
  btnP:     { padding: '10px 28px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#4f7cff,#7b5fff)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};
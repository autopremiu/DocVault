// src/pages/Subir.jsx — con soporte de CARPETAS completas
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const ICONOS = { xlsx:'📗',xls:'📗',xlsm:'📗',docx:'📘',doc:'📘',pptx:'📙',ppt:'📙',pdf:'📕' };
const ALLOWED = ['xlsx','xls','xlsm','docx','doc','pptx','ppt','pdf'];

// Extraer TODOS los archivos de un DataTransfer, incluyendo subcarpetas
async function extractFilesFromDataTransfer(dataTransfer) {
  const files = [];

  async function traverseEntry(entry, path = '') {
    if (entry.isFile) {
      await new Promise(resolve => {
        entry.file(file => {
          // Guardar la ruta relativa de la carpeta en el archivo
          file._carpetaPath = path || null;
          files.push(file);
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      await new Promise(resolve => {
        reader.readEntries(async entries => {
          for (const e of entries) {
            await traverseEntry(e, path ? `${path}/${entry.name}` : entry.name);
          }
          resolve();
        });
      });
    }
  }

  const items = Array.from(dataTransfer.items);
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) await traverseEntry(entry);
    else if (item.kind === 'file') files.push(item.getAsFile());
  }
  return files;
}

export default function Subir() {
  const [carpetas,   setCarpetas]   = useState([]);
  const [carpetaId,  setCarpetaId]  = useState('');
  const [queue,      setQueue]      = useState([]);
  const [dragging,   setDragging]   = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [megaStatus, setMegaStatus] = useState([]);
  const [modo,       setModo]       = useState('archivos'); // 'archivos' | 'carpeta'
  // Stats de sesión
  const [sesion, setSesion] = useState({ subidos: 0, errores: 0, bytes: 0 });

  const inputArchivosRef = useRef();
  const inputCarpetaRef  = useRef();

  useEffect(() => {
    api.get('/carpetas').then(r => { setCarpetas(r.data); if(r.data.length) setCarpetaId(String(r.data[0].id)); });
    api.get('/mega/status').then(r => setMegaStatus(r.data)).catch(()=>{});
  }, []);

  const fmtSize = s => s < 1048576 ? (s/1024).toFixed(1)+' KB' : (s/1048576).toFixed(2)+' MB';

  // Procesar lista de archivos (File o FileList) y filtrar por extensión
  const processFiles = useCallback((rawFiles, carpetaPath = null) => {
    const valid = [];
    const skip  = [];
    Array.from(rawFiles).forEach(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      if (ALLOWED.includes(ext)) {
        valid.push({
          file:    f,
          id:      Math.random().toString(36).slice(2),
          nombre:  f.name,
          // Ruta de subcarpeta (si viene de arrastrar una carpeta)
          ruta:    f._carpetaPath || carpetaPath || null,
          ext,
          size:    fmtSize(f.size),
          rawSize: f.size,
          status:  'pending',
          progress: 0,
        });
      } else {
        skip.push(f.name);
      }
    });
    if (skip.length) toast(`⚠️ ${skip.length} archivo(s) omitido(s) (formato no soportado)`, { icon: '⚠️' });
    if (valid.length) {
      setQueue(q => [...q, ...valid]);
      toast.success(`${valid.length} archivo(s) agregado(s) a la cola`);
    }
  }, []);

  // Drop zone — soporta archivos Y carpetas enteras
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragging(false);
    const files = await extractFilesFromDataTransfer(e.dataTransfer);
    processFiles(files);
  }, [processFiles]);

  // Input normal (archivos individuales)
  const handleInputArchivos = (e) => processFiles(e.target.files);

  // Input carpeta completa (webkitdirectory)
  const handleInputCarpeta  = (e) => {
    const files = Array.from(e.target.files);
    // Preservar la ruta relativa dentro de la carpeta
    files.forEach(f => { f._carpetaPath = f.webkitRelativePath?.split('/').slice(0,-1).join('/') || null; });
    processFiles(files);
    e.target.value = ''; // reset para poder volver a seleccionar la misma carpeta
  };

  // Subir toda la cola pendiente
  const uploadAll = async () => {
    const pending = queue.filter(i => i.status === 'pending');
    if (!pending.length) return toast.error('Sin archivos pendientes en la cola');
    if (!carpetaId)      return toast.error('Selecciona una carpeta de destino');
    setUploading(true);

    let subidos = 0, errores = 0, bytes = 0;

    // Lotes de 3 (MEGA necesita tiempo por archivo)
    for (let i = 0; i < pending.length; i += 3) {
      const lote = pending.slice(i, i + 3);
      await Promise.all(lote.map(async item => {
        setQueue(q => q.map(x => x.id === item.id ? {...x, status:'uploading', progress:5} : x));
        const interval = setInterval(() => {
          setQueue(q => q.map(x => x.id === item.id && x.progress < 88 ? {...x, progress: x.progress + 12} : x));
        }, 900);
        try {
          const fd = new FormData();
          fd.append('archivos', item.file);
          fd.append('carpeta_id', carpetaId);
          // Enviar la ruta de subcarpeta si existe (informativo, para el nombre_display)
          if (item.ruta) fd.append('subcarpeta', item.ruta);
          await api.post('/documentos/upload', fd, { headers: {'Content-Type':'multipart/form-data'} });
          clearInterval(interval);
          setQueue(q => q.map(x => x.id === item.id ? {...x, status:'done', progress:100} : x));
          subidos++; bytes += item.rawSize;
        } catch (err) {
          clearInterval(interval);
          setQueue(q => q.map(x => x.id === item.id ? {...x, status:'error', progress:0, errorMsg: err.response?.data?.error || 'Error'} : x));
          errores++;
          console.error(`Error subiendo ${item.nombre}:`, err.message);
        }
      }));
    }

    setUploading(false);
    setSesion(p => ({ subidos: p.subidos+subidos, errores: p.errores+errores, bytes: p.bytes+bytes }));
    if (subidos > 0) toast.success(`✅ ${subidos} archivo(s) subidos a MEGA`);
    if (errores > 0) toast.error(`❌ ${errores} archivo(s) con error`);
    api.get('/mega/status').then(r => setMegaStatus(r.data)).catch(()=>{});
  };

  const totalMegaGB = megaStatus.reduce((a,c) => a + parseFloat(c.totalGB||0), 0);
  const usadoMegaGB = megaStatus.reduce((a,c) => a + parseFloat(c.usadoGB||0), 0);
  const pendingCount = queue.filter(i=>i.status==='pending').length;
  const doneCount    = queue.filter(i=>i.status==='done').length;
  const errorCount   = queue.filter(i=>i.status==='error').length;

  const statusIcon  = { pending:'⏳', uploading:'🔄', done:'✅', error:'❌' };
  const statusColor = { pending:'#6b7592', uploading:'#4f7cff', done:'#00e5a0', error:'#ff6b6b' };

  // Agrupar cola por carpeta/ruta para mostrar organizado
  const groups = queue.reduce((acc, item) => {
    const key = item.ruta || '📄 Archivos sueltos';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div style={s.wrap}>
      {/* TOPBAR */}
      <div style={s.topbar}>
        <div style={s.title}>Carga Masiva → MEGA</div>
        <div style={s.topRight}>
          {megaStatus.length > 0 && (
            <div style={s.megaInfo}>
              ☁️ <span style={{color:'#00e5a0'}}>{usadoMegaGB.toFixed(1)} GB</span>
              <span style={{color:'#6b7592'}}> / {totalMegaGB} GB</span>
            </div>
          )}
          <select style={s.select} value={carpetaId} onChange={e => setCarpetaId(e.target.value)}>
            <option value="">📁 Carpeta de destino...</option>
            {carpetas.map(c => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
          </select>
          {queue.length > 0 && (
            <button style={s.btnSecondary} onClick={() => setQueue([])} disabled={uploading}>
              🗑 Limpiar cola
            </button>
          )}
          <button
            style={{...s.btn, opacity: uploading||!pendingCount ? .6:1,
              background: uploading ? '#1e2330' : 'linear-gradient(135deg,#4f7cff,#7b5fff)'}}
            onClick={uploadAll}
            disabled={uploading || !pendingCount}
          >
            {uploading
              ? `⏳ Subiendo... (${doneCount+errorCount}/${queue.length})`
              : `⬆ Subir ${pendingCount} archivo${pendingCount!==1?'s':''}`}
          </button>
        </div>
      </div>

      <div style={s.content}>

        {/* MODO SELECTOR */}
        <div style={s.modoBar}>
          <button style={{...s.modoBtn, ...(modo==='archivos'?s.modoBtnActive:{})}} onClick={()=>setModo('archivos')}>
            📄 Seleccionar archivos
          </button>
          <button style={{...s.modoBtn, ...(modo==='carpeta'?s.modoBtnActive:{})}} onClick={()=>setModo('carpeta')}>
            📂 Seleccionar carpeta completa
          </button>
          <div style={s.modoDivider}/>
          <span style={s.modoHint}>
            {modo==='carpeta'
              ? '✓ Sube todos los archivos de una carpeta (y subcarpetas) de una sola vez'
              : '✓ Selecciona múltiples archivos individualmente'}
          </span>
        </div>

        {/* DROP ZONE */}
        <div
          style={{...s.drop, ...(dragging ? s.dropActive : {})}}
          onDragOver={e=>{e.preventDefault();setDragging(true)}}
          onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDragging(false)}}
          onDrop={handleDrop}
          onClick={() => modo==='carpeta' ? inputCarpetaRef.current.click() : inputArchivosRef.current.click()}
        >
          <div style={{fontSize:54,marginBottom:14}}>{dragging ? '📂' : modo==='carpeta' ? '📂' : '☁️'}</div>
          <div style={s.dropTitle}>
            {dragging
              ? 'Suelta aquí — carpetas y archivos aceptados'
              : modo==='carpeta'
                ? 'Haz clic para seleccionar una carpeta completa'
                : 'Arrastra archivos o carpetas aquí'}
          </div>
          <div style={s.dropSub}>
            {modo==='carpeta'
              ? 'Se cargarán TODOS los archivos compatibles dentro de la carpeta y sus subcarpetas'
              : 'Puedes arrastrar archivos sueltos O carpetas enteras directamente aquí'}
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:16,flexWrap:'wrap'}}>
            {['📗 Excel','📘 Word','📙 PowerPoint','📕 PDF'].map(f=>(
              <span key={f} style={s.fchip}>{f}</span>
            ))}
          </div>
          <div style={{marginTop:12,fontSize:12,color:'#4f7cff'}}>
            Hasta 200 MB por archivo · Sin límite de archivos por carga
          </div>

          {/* Inputs ocultos */}
          <input ref={inputArchivosRef} type="file" multiple
            accept=".xlsx,.xls,.xlsm,.docx,.doc,.pptx,.ppt,.pdf"
            style={{display:'none'}} onChange={handleInputArchivos}/>
          <input ref={inputCarpetaRef} type="file"
            webkitdirectory="true" directory="true" multiple
            style={{display:'none'}} onChange={handleInputCarpeta}/>
        </div>

        {/* BOTONES RÁPIDOS */}
        <div style={s.quickBtns}>
          <button style={s.quickBtn} onClick={()=>inputArchivosRef.current.click()}>
            📄 Agregar archivos
          </button>
          <button style={s.quickBtn} onClick={()=>inputCarpetaRef.current.click()}>
            📂 Agregar carpeta completa
          </button>
          {sesion.subidos > 0 && (
            <div style={s.sesionInfo}>
              ✅ Esta sesión: <strong style={{color:'#00e5a0'}}>{sesion.subidos}</strong> subidos ·{' '}
              {sesion.errores > 0 && <><strong style={{color:'#ff6b6b'}}>{sesion.errores}</strong> errores · </>}
              <strong style={{color:'#f5a623'}}>{fmtSize(sesion.bytes)}</strong> totales
            </div>
          )}
        </div>

        {/* ESTADO MEGA */}
        {megaStatus.length > 0 && (
          <div style={s.megaPanel}>
            <div style={s.megaPanelTitle}>☁️ Almacenamiento MEGA</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)'}}>
              {megaStatus.map(c => (
                <div key={c.numero} style={{padding:'14px 18px',borderRight:'1px solid #1e2330'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                    <span style={{fontSize:13,fontWeight:600,color:'#e8ecf4'}}>Cuenta {c.numero}</span>
                    <span style={{fontSize:11,color:c.porcentajeUso>80?'#ff6b6b':'#00e5a0'}}>{c.porcentajeUso}%</span>
                  </div>
                  <div style={{height:5,background:'#1e2330',borderRadius:3,overflow:'hidden',marginBottom:5}}>
                    <div style={{height:'100%',borderRadius:3,transition:'width .5s',width:c.porcentajeUso+'%',
                      background:c.porcentajeUso>80?'#ff6b6b':c.porcentajeUso>60?'#f5a623':'#00e5a0'}}/>
                  </div>
                  <div style={{fontSize:10,color:'#6b7592'}}>{c.usadoGB} / {c.totalGB} GB · {c.disponibleGB} GB libres</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COLA AGRUPADA POR CARPETA */}
        {queue.length > 0 && (
          <div>
            {/* Resumen */}
            <div style={s.queueHeader}>
              <div style={{display:'flex',alignItems:'center',gap:16}}>
                <span style={s.queueTitle}>Cola de subida ({queue.length} archivos)</span>
                <span style={{fontSize:12,color:'#00e5a0'}}>✅ {doneCount}</span>
                <span style={{fontSize:12,color:'#4f7cff'}}>🔄 {queue.filter(i=>i.status==='uploading').length}</span>
                <span style={{fontSize:12,color:'#6b7592'}}>⏳ {pendingCount}</span>
                {errorCount > 0 && <span style={{fontSize:12,color:'#ff6b6b'}}>❌ {errorCount}</span>}
              </div>
              <div style={{display:'flex',gap:8}}>
                {errorCount > 0 && (
                  <button style={s.btnSecondary} onClick={()=>setQueue(q=>q.filter(i=>i.status!=='error'))}>
                    Quitar errores
                  </button>
                )}
                {doneCount > 0 && (
                  <button style={s.btnSecondary} onClick={()=>setQueue(q=>q.filter(i=>i.status!=='done'))}>
                    Quitar completados
                  </button>
                )}
              </div>
            </div>

            {/* Grupos por carpeta */}
            {Object.entries(groups).map(([grupo, items]) => (
              <div key={grupo} style={s.group}>
                {/* Cabecera del grupo */}
                <div style={s.groupHeader}>
                  <span style={s.groupTitle}>
                    {grupo.startsWith('📄') ? grupo : `📂 ${grupo}`}
                  </span>
                  <span style={{fontSize:11,color:'#6b7592'}}>{items.length} archivo(s)</span>
                </div>
                {/* Archivos del grupo */}
                {items.map(item => (
                  <div key={item.id} style={{
                    ...s.qitem,
                    borderLeft: `3px solid ${statusColor[item.status]}`,
                    marginLeft: grupo.startsWith('📄') ? 0 : 12,
                  }}>
                    <span style={{fontSize:24,flexShrink:0}}>{ICONOS[item.ext]||'📄'}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,color:'#e8ecf4',marginBottom:5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {item.nombre}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{flex:1,height:3,background:'#1e2330',borderRadius:2,overflow:'hidden'}}>
                          <div style={{height:'100%',borderRadius:2,width:item.progress+'%',background:statusColor[item.status],transition:'width .3s'}}/>
                        </div>
                        <span style={{fontSize:11,color:'#6b7592',whiteSpace:'nowrap',minWidth:90,textAlign:'right'}}>
                          {item.size} · {item.progress}%
                        </span>
                      </div>
                      {item.errorMsg && (
                        <div style={{fontSize:11,color:'#ff6b6b',marginTop:3}}>⚠️ {item.errorMsg}</div>
                      )}
                    </div>
                    <span style={{fontSize:18,flexShrink:0}}>{statusIcon[item.status]}</span>
                    {item.status === 'pending' && (
                      <button style={{background:'none',border:'none',color:'#6b7592',cursor:'pointer',fontSize:14,padding:'2px 4px'}}
                        onClick={()=>setQueue(q=>q.filter(x=>x.id!==item.id))}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap:     {display:'flex',flexDirection:'column',height:'100%',background:'#0a0c10'},
  topbar:   {background:'#111318',borderBottom:'1px solid #1e2330',padding:'0 24px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,gap:12},
  title:    {fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:700,color:'#e8ecf4',flexShrink:0},
  topRight: {display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'},
  megaInfo: {fontSize:12,color:'#6b7592',padding:'6px 12px',background:'#181c24',borderRadius:8,border:'1px solid #1e2330',whiteSpace:'nowrap'},
  select:   {background:'#181c24',border:'1px solid #1e2330',borderRadius:8,padding:'8px 12px',color:'#e8ecf4',fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:'none'},
  btn:      {border:'none',borderRadius:8,padding:'9px 18px',color:'#fff',fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap',transition:'all .2s'},
  btnSecondary: {background:'#181c24',border:'1px solid #1e2330',borderRadius:8,padding:'7px 14px',color:'#6b7592',fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:'pointer'},
  content:  {flex:1,overflowY:'auto',padding:24},
  // Modo
  modoBar:  {display:'flex',alignItems:'center',gap:8,marginBottom:16,flexWrap:'wrap'},
  modoBtn:  {padding:'7px 16px',borderRadius:20,fontSize:13,border:'1px solid #1e2330',background:'#181c24',cursor:'pointer',color:'#6b7592',transition:'all .15s'},
  modoBtnActive: {borderColor:'#4f7cff',color:'#4f7cff',background:'rgba(79,124,255,.1)'},
  modoDivider: {width:1,height:20,background:'#1e2330',margin:'0 4px'},
  modoHint: {fontSize:12,color:'#00e5a0'},
  // Drop
  drop:       {border:'2px dashed #1e2330',borderRadius:16,padding:'48px 40px',textAlign:'center',cursor:'pointer',background:'#111318',transition:'all .2s',marginBottom:16},
  dropActive: {borderColor:'#4f7cff',background:'rgba(79,124,255,.06)',transform:'scale(1.005)'},
  dropTitle:  {fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:'#e8ecf4',marginBottom:8},
  dropSub:    {color:'#6b7592',fontSize:13},
  fchip:      {padding:'4px 14px',borderRadius:20,fontSize:12,fontWeight:600,background:'rgba(79,124,255,.1)',color:'#4f7cff',border:'1px solid rgba(79,124,255,.2)'},
  // Quick buttons
  quickBtns:  {display:'flex',gap:8,alignItems:'center',marginBottom:16,flexWrap:'wrap'},
  quickBtn:   {padding:'8px 16px',borderRadius:8,fontSize:13,border:'1px solid #1e2330',background:'#181c24',cursor:'pointer',color:'#e8ecf4',display:'flex',alignItems:'center',gap:6,transition:'border-color .15s'},
  sesionInfo: {fontSize:12,color:'#6b7592',marginLeft:'auto',padding:'6px 14px',background:'#181c24',borderRadius:8,border:'1px solid #1e2330'},
  // MEGA panel
  megaPanel:      {background:'#111318',border:'1px solid #1e2330',borderRadius:14,overflow:'hidden',marginBottom:16},
  megaPanelTitle: {padding:'12px 20px',borderBottom:'1px solid #1e2330',fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,color:'#e8ecf4'},
  // Queue
  queueHeader: {display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8},
  queueTitle:  {fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:700,color:'#e8ecf4'},
  group:       {marginBottom:16},
  groupHeader: {display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 14px',background:'#181c24',borderRadius:'8px 8px 0 0',border:'1px solid #1e2330',borderBottom:'none'},
  groupTitle:  {fontSize:13,fontWeight:600,color:'#e8ecf4'},
  qitem:       {background:'#111318',border:'1px solid #1e2330',borderTop:'none',padding:'12px 16px',display:'flex',alignItems:'center',gap:12,transition:'background .1s'},
};
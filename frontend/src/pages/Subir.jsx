// src/pages/Subir.jsx
import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const ICONOS = { xlsx:'📗',xls:'📗',xlsm:'📗',docx:'📘',doc:'📘',pptx:'📙',ppt:'📙',pdf:'📕' };
const ALLOWED = ['xlsx','xls','xlsm','docx','doc','pptx','ppt','pdf'];

export default function Subir() {
  const [carpetas, setCarpetas] = useState([]);
  const [carpetaId, setCarpetaId] = useState('');
  const [queue, setQueue] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [megaStatus, setMegaStatus] = useState([]);
  const inputRef = useRef();

  useEffect(() => {
    api.get('/carpetas').then(r => { setCarpetas(r.data); if(r.data.length) setCarpetaId(String(r.data[0].id)); });
    api.get('/mega/status').then(r => setMegaStatus(r.data)).catch(()=>{});
  }, []);

  const addFiles = (files) => {
    const valid = Array.from(files).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      if (!ALLOWED.includes(ext)) { toast.error(`Formato no soportado: ${f.name}`); return false; }
      return true;
    });
    setQueue(q => [...q, ...valid.map(f => ({
      file: f, id: Math.random().toString(36).slice(2),
      nombre: f.name, ext: f.name.split('.').pop().toLowerCase(),
      size: f.size < 1048576 ? (f.size/1024).toFixed(1)+' KB' : (f.size/1048576).toFixed(2)+' MB',
      status: 'pending', progress: 0,
    }))]);
  };

  const uploadAll = async () => {
    const pending = queue.filter(i => i.status === 'pending');
    if (!pending.length) return toast.error('Sin archivos pendientes');
    if (!carpetaId) return toast.error('Selecciona una carpeta');
    setUploading(true);

    // Subir en lotes de 5
    const lotes = [];
    for (let i = 0; i < pending.length; i += 5) lotes.push(pending.slice(i, i+5));

    for (const lote of lotes) {
      await Promise.all(lote.map(async item => {
        setQueue(q => q.map(i => i.id === item.id ? {...i, status:'uploading', progress:10} : i));
        try {
          const fd = new FormData();
          fd.append('archivos', item.file);
          fd.append('carpeta_id', carpetaId);
          // Simular progreso mientras sube a MEGA
          const interval = setInterval(() => {
            setQueue(q => q.map(i => i.id === item.id && i.progress < 85 ? {...i, progress: i.progress + 15} : i));
          }, 800);
          await api.post('/documentos/upload', fd, { headers: {'Content-Type':'multipart/form-data'} });
          clearInterval(interval);
          setQueue(q => q.map(i => i.id === item.id ? {...i, status:'done', progress:100} : i));
        } catch (err) {
          setQueue(q => q.map(i => i.id === item.id ? {...i, status:'error', progress:0} : i));
          toast.error(`Error: ${item.nombre}`);
        }
      }));
    }
    setUploading(false);
    toast.success(`✅ ${pending.length} archivo(s) subidos a MEGA`);
    // Actualizar estado MEGA
    api.get('/mega/status').then(r => setMegaStatus(r.data)).catch(()=>{});
  };

  const statusIcon  = { pending:'⏳', uploading:'🔄', done:'✅', error:'❌' };
  const statusColor = { pending:'#6b7592', uploading:'#4f7cff', done:'#00e5a0', error:'#ff6b6b' };
  const totalMegaGB = megaStatus.reduce((a,c) => a + parseFloat(c.totalGB||0), 0);
  const usadoMegaGB = megaStatus.reduce((a,c) => a + parseFloat(c.usadoGB||0), 0);

  return (
    <div style={s.wrap}>
      <div style={s.topbar}>
        <div style={s.title}>Carga Masiva → MEGA</div>
        <div style={s.topRight}>
          {megaStatus.length > 0 && (
            <div style={s.megaInfo}>
              ☁️ <span style={{color:'#00e5a0'}}>{usadoMegaGB.toFixed(1)} GB</span> / {totalMegaGB} GB usados
            </div>
          )}
          <select style={s.select} value={carpetaId} onChange={e => setCarpetaId(e.target.value)}>
            <option value="">Seleccionar carpeta...</option>
            {carpetas.map(c => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
          </select>
          <button style={{...s.btn, opacity: uploading ? .7 : 1}} onClick={uploadAll} disabled={uploading}>
            {uploading ? '⏳ Subiendo a MEGA...' : `⬆ Subir ${queue.filter(i=>i.status==='pending').length} archivo(s)`}
          </button>
        </div>
      </div>

      <div style={s.content}>
        {/* DROP ZONE */}
        <div style={{...s.drop, ...(dragging ? s.dropActive : {})}}
          onDragOver={e=>{e.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)}
          onDrop={e=>{e.preventDefault();setDragging(false);addFiles(e.dataTransfer.files)}}
          onClick={()=>inputRef.current.click()}>
          <div style={{fontSize:52,marginBottom:14}}>☁️</div>
          <div style={s.dropTitle}>Arrastra archivos o haz clic para seleccionar</div>
          <div style={s.dropSub}>Los archivos se subirán directamente a MEGA · Hasta 200 MB por archivo · 50 archivos por carga</div>
          <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:16,flexWrap:'wrap'}}>
            {['Excel .xlsx','Word .docx','PowerPoint .pptx','PDF'].map(f=>(
              <span key={f} style={s.fchip}>{f}</span>
            ))}
          </div>
          <input ref={inputRef} type="file" multiple accept=".xlsx,.xls,.xlsm,.docx,.doc,.pptx,.ppt,.pdf"
            style={{display:'none'}} onChange={e=>addFiles(e.target.files)}/>
        </div>

        {/* MEGA ACCOUNTS STATUS */}
        {megaStatus.length > 0 && (
          <div style={s.megaPanel}>
            <div style={{padding:'12px 20px',borderBottom:'1px solid #1e2330',fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:700,color:'#e8ecf4'}}>
              Estado de almacenamiento MEGA
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)'}}>
              {megaStatus.map(c => (
                <div key={c.numero} style={{padding:'14px 18px',borderRight:'1px solid #1e2330'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                    <span style={{fontSize:13,fontWeight:600,color:'#e8ecf4'}}>Cuenta {c.numero}</span>
                    <span style={{fontSize:11,color: c.porcentajeUso>80?'#ff6b6b':'#00e5a0'}}>{c.porcentajeUso}%</span>
                  </div>
                  <div style={{height:4,background:'#1e2330',borderRadius:2,overflow:'hidden',marginBottom:6}}>
                    <div style={{height:'100%',borderRadius:2,width:c.porcentajeUso+'%',background:c.porcentajeUso>80?'#ff6b6b':c.porcentajeUso>60?'#f5a623':'#00e5a0'}}/>
                  </div>
                  <div style={{fontSize:10,color:'#6b7592'}}>{c.disponibleGB} GB disponibles</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QUEUE */}
        {queue.length > 0 && (
          <div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <span style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,color:'#e8ecf4'}}>
                Cola ({queue.length} archivos)
              </span>
              <button style={{background:'none',border:'none',color:'#6b7592',cursor:'pointer',fontSize:13}} onClick={()=>setQueue([])}>
                Limpiar todo
              </button>
            </div>
            {queue.map(item => (
              <div key={item.id} style={s.qitem}>
                <span style={{fontSize:26}}>{ICONOS[item.ext]||'📄'}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,color:'#e8ecf4',marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.nombre}</div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{flex:1,height:4,background:'#1e2330',borderRadius:2,overflow:'hidden'}}>
                      <div style={{height:'100%',borderRadius:2,width:item.progress+'%',background:statusColor[item.status],transition:'width .3s'}}/>
                    </div>
                    <span style={{fontSize:11,color:'#6b7592',whiteSpace:'nowrap'}}>{item.size} — {item.progress}%</span>
                  </div>
                </div>
                <span style={{fontSize:20}}>{statusIcon[item.status]}</span>
                {item.status==='pending' && (
                  <button style={{background:'none',border:'none',color:'#6b7592',cursor:'pointer',fontSize:14}} onClick={()=>setQueue(q=>q.filter(i=>i.id!==item.id))}>✕</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap:   {display:'flex',flexDirection:'column',height:'100%',background:'#0a0c10'},
  topbar: {background:'#111318',borderBottom:'1px solid #1e2330',padding:'0 28px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0},
  title:  {fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:700,color:'#e8ecf4'},
  topRight: {display:'flex',gap:10,alignItems:'center'},
  megaInfo: {fontSize:12,color:'#6b7592',padding:'6px 12px',background:'#181c24',borderRadius:8,border:'1px solid #1e2330'},
  select: {background:'#181c24',border:'1px solid #1e2330',borderRadius:8,padding:'8px 12px',color:'#e8ecf4',fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:'none'},
  btn:    {background:'linear-gradient(135deg,#4f7cff,#7b5fff)',border:'none',borderRadius:8,padding:'9px 18px',color:'#fff',fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500,cursor:'pointer'},
  content:{flex:1,overflowY:'auto',padding:24},
  drop:   {border:'2px dashed #1e2330',borderRadius:16,padding:'52px 40px',textAlign:'center',cursor:'pointer',background:'#111318',transition:'all .2s',marginBottom:20},
  dropActive:{borderColor:'#4f7cff',background:'rgba(79,124,255,.05)'},
  dropTitle:{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:700,color:'#e8ecf4',marginBottom:8},
  dropSub: {color:'#6b7592',fontSize:13},
  fchip:  {padding:'4px 14px',borderRadius:20,fontSize:12,fontWeight:600,background:'rgba(79,124,255,.1)',color:'#4f7cff',border:'1px solid rgba(79,124,255,.2)'},
  megaPanel:{background:'#111318',border:'1px solid #1e2330',borderRadius:14,overflow:'hidden',marginBottom:20},
  qitem:  {background:'#111318',border:'1px solid #1e2330',borderRadius:10,padding:'14px 18px',display:'flex',alignItems:'center',gap:14,marginBottom:10},
};

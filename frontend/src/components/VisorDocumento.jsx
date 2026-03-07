// src/components/VisorDocumento.jsx
// Visor + Editor integrado para Excel, Word, PowerPoint y PDF
// Usa librerías CDN: xlsx.js, mammoth.js, pptx2html, pdf.js

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

// ─── UTILIDADES ────────────────────────────────────────────────
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ─── VISOR EXCEL ───────────────────────────────────────────────
function VisorExcel({ base64, nombre }) {
  const [sheets, setSheets]   = useState([]);
  const [active, setActive]   = useState(0);
  const [data,   setData]     = useState([]);
  const [editCell, setEditCell] = useState(null); // {row, col}
  const [editVal,  setEditVal]  = useState('');
  const [wb,     setWb]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [modified, setModified] = useState(false);

  useEffect(() => {
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js')
      .then(() => {
        const bin    = atob(base64);
        const bytes  = new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i));
        const wb     = window.XLSX.read(bytes, { type: 'array', cellStyles: true });
        setWb(wb);
        setSheets(wb.SheetNames);
        loadSheet(wb, wb.SheetNames[0]);
        setLoading(false);
      }).catch(() => { setLoading(false); toast.error('Error cargando Excel'); });
  }, [base64]);

  const loadSheet = (wb, sheetName) => {
    const ws   = wb.Sheets[sheetName];
    const json = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    setData(json);
  };

  const changeSheet = (i) => {
    setActive(i);
    loadSheet(wb, sheets[i]);
    setEditCell(null);
  };

  const startEdit = (row, col) => {
    setEditCell({ row, col });
    setEditVal(String(data[row]?.[col] ?? ''));
  };

  const commitEdit = () => {
    if (!editCell) return;
    const newData = data.map(r => [...r]);
    if (!newData[editCell.row]) newData[editCell.row] = [];
    newData[editCell.row][editCell.col] = editVal;
    setData(newData);
    setEditCell(null);
    setModified(true);
    // Actualizar workbook
    const ws   = wb.Sheets[sheets[active]];
    const ref  = window.XLSX.utils.encode_cell({ r: editCell.row, c: editCell.col });
    if (!ws[ref]) ws[ref] = {};
    ws[ref].v = editVal;
    ws[ref].t = isNaN(editVal) ? 's' : 'n';
  };

  const downloadModified = () => {
    const out  = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = nombre; a.click();
    URL.revokeObjectURL(url);
    toast.success('Excel descargado con cambios');
  };

  const filteredData = search
    ? data.filter(row => row.some(cell => String(cell).toLowerCase().includes(search.toLowerCase())))
    : data;

  const maxCols = Math.max(0, ...filteredData.map(r => r.length));

  if (loading) return <div style={vs.loading}>⏳ Cargando Excel...</div>;

  return (
    <div style={vs.excelWrap}>
      {/* Toolbar */}
      <div style={vs.toolbar}>
        <input style={vs.searchInput} placeholder="🔍 Buscar en la hoja..." value={search}
          onChange={e => setSearch(e.target.value)}/>
        {modified && (
          <button style={vs.btnGreen} onClick={downloadModified}>⬇ Descargar con cambios</button>
        )}
        <span style={vs.hint}>Doble clic en celda para editar</span>
      </div>

      {/* Pestañas de hojas */}
      {sheets.length > 1 && (
        <div style={vs.sheetTabs}>
          {sheets.map((s, i) => (
            <div key={s} style={{...vs.sheetTab, ...(i===active ? vs.sheetTabActive : {})}}
              onClick={() => changeSheet(i)}>
              📋 {s}
            </div>
          ))}
        </div>
      )}

      {/* Tabla */}
      <div style={vs.tableWrap}>
        <table style={vs.table}>
          <thead>
            <tr>
              <th style={vs.rowNumTh}>#</th>
              {Array.from({length: maxCols}, (_, i) => (
                <th key={i} style={vs.th}>
                  {String.fromCharCode(65 + i % 26)}
                  {i >= 26 ? String.fromCharCode(65 + Math.floor(i/26) - 1) : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, ri) => (
              <tr key={ri} style={ri===0 ? vs.headerRow : {}}>
                <td style={vs.rowNum}>{ri + 1}</td>
                {Array.from({length: maxCols}, (_, ci) => {
                  const val     = row[ci] ?? '';
                  const isEdit  = editCell?.row === ri && editCell?.col === ci;
                  const isHead  = ri === 0;
                  return (
                    <td key={ci}
                      style={{
                        ...vs.td,
                        ...(isHead ? vs.tdHead : {}),
                        ...(isEdit ? vs.tdEdit : {}),
                        background: isEdit ? 'rgba(79,124,255,0.15)' : isHead ? '#1e2a3a' : ri%2===0?'#111318':'#0f1117',
                      }}
                      onDoubleClick={() => startEdit(ri, ci)}>
                      {isEdit ? (
                        <input
                          autoFocus
                          style={vs.cellInput}
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={e => { if(e.key==='Enter') commitEdit(); if(e.key==='Escape') setEditCell(null); }}
                        />
                      ) : (
                        <span style={{color: typeof val==='number' ? '#7dd3fc' : isHead ? '#93c5fd' : '#e8ecf4'}}>
                          {val === '' ? '' : String(val)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={vs.statusBar}>
        {filteredData.length} filas × {maxCols} columnas
        {search && ` · Mostrando ${filteredData.length} resultado(s)`}
        {modified && <span style={{color:'#f5a623',marginLeft:12}}>⚠️ Hay cambios sin guardar</span>}
      </div>
    </div>
  );
}

// ─── VISOR WORD ────────────────────────────────────────────────
function VisorWord({ base64, nombre }) {
  const [html,     setHtml]     = useState('');
  const [text,     setText]     = useState('');
  const [modo,     setModo]     = useState('vista'); // 'vista' | 'editar' | 'texto'
  const [loading,  setLoading]  = useState(true);
  const [modified, setModified] = useState(false);
  const editorRef = useRef();

  useEffect(() => {
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js')
      .then(() => {
        const bin   = atob(base64);
        const bytes = new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i));
        return window.mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
      })
      .then(result => {
        setHtml(result.value);
        // Texto plano para modo texto
        const tmp = document.createElement('div');
        tmp.innerHTML = result.value;
        setText(tmp.textContent);
        setLoading(false);
      })
      .catch(() => { setLoading(false); toast.error('Error cargando Word'); });
  }, [base64]);

  const copyAll = () => {
    const content = modo==='editar' ? editorRef.current?.innerText : text;
    navigator.clipboard.writeText(content || text).then(() => toast.success('Contenido copiado'));
  };

  const downloadTxt = () => {
    const content = modo==='editar' ? editorRef.current?.innerText : text;
    const blob = new Blob([content || text], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = nombre.replace(/\.[^.]+$/,'.txt'); a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={vs.loading}>⏳ Cargando documento Word...</div>;

  return (
    <div style={vs.wordWrap}>
      <div style={vs.toolbar}>
        <div style={vs.modeTabs}>
          {[{k:'vista',l:'👁 Vista'},{k:'editar',l:'✏️ Editar'},{k:'texto',l:'📝 Texto plano'}].map(m=>(
            <button key={m.k} style={{...vs.modeTab,...(modo===m.k?vs.modeTabActive:{})}} onClick={()=>setModo(m.k)}>{m.l}</button>
          ))}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button style={vs.btnGhost} onClick={copyAll}>📋 Copiar todo</button>
          <button style={vs.btnGhost} onClick={downloadTxt}>⬇ Guardar .txt</button>
          {modified && <button style={vs.btnGreen} onClick={()=>toast.success('En producción: guardado en MEGA')}>💾 Guardar cambios</button>}
        </div>
      </div>

      <div style={vs.wordPage}>
        {modo === 'vista' && (
          <div style={vs.wordContent} dangerouslySetInnerHTML={{ __html: html }}/>
        )}
        {modo === 'editar' && (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            style={{...vs.wordContent, outline:'none', minHeight:400}}
            onInput={() => setModified(true)}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
        {modo === 'texto' && (
          <textarea
            style={vs.textArea}
            value={text}
            onChange={e => { setText(e.target.value); setModified(true); }}
          />
        )}
      </div>
    </div>
  );
}

// ─── VISOR PDF ─────────────────────────────────────────────────
function VisorPDF({ base64 }) {
  const canvasRef = useRef();
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);
  const [scale,   setScale]   = useState(1.2);
  const [loading, setLoading] = useState(true);
  const pdfRef = useRef();

  const renderPage = useCallback(async (pdf, pageNum, sc) => {
    const page    = await pdf.getPage(pageNum);
    const vp      = page.getViewport({ scale: sc });
    const canvas  = canvasRef.current;
    if (!canvas) return;
    canvas.height = vp.height;
    canvas.width  = vp.width;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  }, []);

  useEffect(() => {
    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'),
    ]).then(async () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const bin    = atob(base64);
      const bytes  = new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i));
      const pdf    = await window.pdfjsLib.getDocument({ data: bytes }).promise;
      pdfRef.current = pdf;
      setTotal(pdf.numPages);
      await renderPage(pdf, 1, scale);
      setLoading(false);
    }).catch(() => { setLoading(false); toast.error('Error cargando PDF'); });
  }, [base64]);

  useEffect(() => {
    if (pdfRef.current) renderPage(pdfRef.current, page, scale);
  }, [page, scale]);

  if (loading) return <div style={vs.loading}>⏳ Renderizando PDF...</div>;

  return (
    <div style={vs.pdfWrap}>
      <div style={vs.toolbar}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button style={vs.navBtn} onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>◀</button>
          <span style={{fontSize:13,color:'#e8ecf4'}}>Página <strong>{page}</strong> de <strong>{total}</strong></span>
          <button style={vs.navBtn} onClick={()=>setPage(p=>Math.min(total,p+1))} disabled={page===total}>▶</button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button style={vs.navBtn} onClick={()=>setScale(s=>Math.max(0.5,s-0.2))}>−</button>
          <span style={{fontSize:12,color:'#6b7592',minWidth:40,textAlign:'center'}}>{Math.round(scale*100)}%</span>
          <button style={vs.navBtn} onClick={()=>setScale(s=>Math.min(3,s+0.2))}>+</button>
        </div>
      </div>
      <div style={vs.pdfCanvas}>
        <canvas ref={canvasRef} style={{boxShadow:'0 8px 32px rgba(0,0,0,0.5)',borderRadius:4}}/>
      </div>
    </div>
  );
}

// ─── VISOR POWERPOINT ──────────────────────────────────────────
function VisorPPT({ base64, nombre }) {
  const [slides,  setSlides]  = useState([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [texto,   setTexto]   = useState([]);

  useEffect(() => {
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')
      .then(() => {
        const bin   = atob(base64);
        const bytes = new Uint8Array(bin.length).map((_, i) => bin.charCodeAt(i));
        return window.JSZip.loadAsync(bytes.buffer);
      })
      .then(async zip => {
        // Extraer texto de cada slide desde el XML de PPTX
        const slideFiles = Object.keys(zip.files)
          .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
          .sort((a, b) => {
            const na = parseInt(a.match(/\d+/)[0]);
            const nb = parseInt(b.match(/\d+/)[0]);
            return na - nb;
          });

        const slideTexts = await Promise.all(slideFiles.map(async (name, idx) => {
          const xml = await zip.files[name].async('string');
          // Extraer texto de nodos <a:t>
          const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
          const texts   = matches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
          // Extraer título (primera línea más larga o primer párrafo)
          const titulo  = texts.find(t => t.length > 2) || `Diapositiva ${idx + 1}`;
          return { index: idx + 1, titulo, textos: texts };
        }));

        setSlides(slideTexts);
        setTexto(slideTexts);
        setLoading(false);
      })
      .catch(() => { setLoading(false); toast.error('Error procesando PowerPoint'); });
  }, [base64]);

  const copySlide = () => {
    const s = slides[current];
    navigator.clipboard.writeText(s.textos.join('\n')).then(() => toast.success('Texto copiado'));
  };

  const copyAll = () => {
    const all = slides.map(s => `--- Diapositiva ${s.index} ---\n${s.textos.join('\n')}`).join('\n\n');
    navigator.clipboard.writeText(all).then(() => toast.success('Todo el contenido copiado'));
  };

  if (loading) return <div style={vs.loading}>⏳ Procesando PowerPoint...</div>;

  const slide = slides[current];

  return (
    <div style={vs.pptWrap}>
      <div style={vs.toolbar}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button style={vs.navBtn} onClick={()=>setCurrent(p=>Math.max(0,p-1))} disabled={current===0}>◀</button>
          <span style={{fontSize:13,color:'#e8ecf4'}}>
            Diapositiva <strong style={{color:'#f5a623'}}>{current+1}</strong> / {slides.length}
          </span>
          <button style={vs.navBtn} onClick={()=>setCurrent(p=>Math.min(slides.length-1,p+1))} disabled={current===slides.length-1}>▶</button>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button style={vs.btnGhost} onClick={copySlide}>📋 Copiar diapositiva</button>
          <button style={vs.btnGhost} onClick={copyAll}>📋 Copiar todo</button>
        </div>
      </div>

      <div style={vs.pptLayout}>
        {/* Panel lateral — miniaturas */}
        <div style={vs.pptSidebar}>
          {slides.map((s, i) => (
            <div key={i} style={{...vs.pptThumb, ...(i===current ? vs.pptThumbActive : {})}}
              onClick={() => setCurrent(i)}>
              <div style={vs.pptThumbNum}>{s.index}</div>
              <div style={vs.pptThumbTitle}>{s.titulo.slice(0, 40)}{s.titulo.length>40?'…':''}</div>
              <div style={vs.pptThumbCount}>{s.textos.length} líneas de texto</div>
            </div>
          ))}
        </div>

        {/* Vista principal de la diapositiva */}
        <div style={vs.pptMain}>
          <div style={vs.pptSlide}>
            <div style={vs.pptSlideNum}>Diapositiva {slide.index}</div>
            {slide.textos.length === 0 ? (
              <div style={{color:'#6b7592',fontSize:14,textAlign:'center',padding:40}}>
                Esta diapositiva no contiene texto extraíble<br/>
                <span style={{fontSize:12}}>(puede contener imágenes o gráficos)</span>
              </div>
            ) : (
              slide.textos.map((t, i) => (
                <div key={i} style={{
                  ...vs.pptText,
                  fontSize: i === 0 ? 22 : t.length < 50 ? 16 : 14,
                  fontWeight: i === 0 ? 700 : 400,
                  color: i === 0 ? '#e8ecf4' : '#b0bbd0',
                  fontFamily: i === 0 ? "'Syne', sans-serif" : "'DM Sans', sans-serif",
                  marginBottom: i === 0 ? 16 : 6,
                  borderLeft: i === 0 ? '3px solid #4f7cff' : 'none',
                  paddingLeft: i === 0 ? 12 : 0,
                }}>
                  {t}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────
export default function VisorDocumento({ uuid, nombre, tipo, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [docData, setDocData] = useState(null);

  useEffect(() => {
    if (!uuid) return;
    setLoading(true); setError(null); setDocData(null);
    api.get(`/documentos/${uuid}/preview`)
      .then(r => { setDocData(r.data); setLoading(false); })
      .catch(err => {
        const msg = err.response?.data?.error || 'Error al cargar el archivo';
        const big = err.response?.data?.tooBig;
        setError({ msg, big });
        setLoading(false);
      });
  }, [uuid]);

  const downloadFile = async () => {
    try {
      const r = await api.get(`/documentos/${uuid}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a'); a.href = url; a.download = nombre; a.click();
      URL.revokeObjectURL(url);
      toast.success('Descarga iniciada');
    } catch { toast.error('Error al descargar'); }
  };

  const tipoIcono = { excel:'📗', word:'📘', ppt:'📙', pdf:'📕' };

  return (
    <div style={vs.overlay} onClick={onClose}>
      <div style={vs.modal} onClick={e => e.stopPropagation()}>

        {/* HEADER */}
        <div style={vs.modalHeader}>
          <div style={vs.modalTitle}>
            <span style={{fontSize:20}}>{tipoIcono[tipo] || '📄'}</span>
            <span style={{fontFamily:"'Syne',sans-serif",fontSize:15,fontWeight:700,maxWidth:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {nombre}
            </span>
            {docData && (
              <span style={{fontSize:11,color:'#6b7592',background:'#181c24',padding:'2px 8px',borderRadius:5,border:'1px solid #1e2330'}}>
                {(docData.tamanio/1048576).toFixed(2)} MB
              </span>
            )}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button style={vs.btnGhost} onClick={downloadFile}>⬇ Descargar original</button>
            <button style={vs.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* CONTENIDO */}
        <div style={vs.modalBody}>
          {loading && (
            <div style={vs.loading}>
              <div style={{fontSize:40,marginBottom:16,animation:'spin 1s linear infinite'}}>⏳</div>
              <div>Cargando desde MEGA...</div>
              <div style={{fontSize:12,color:'#6b7592',marginTop:8}}>Esto puede tardar unos segundos</div>
            </div>
          )}

          {error && (
            <div style={vs.errorBox}>
              <div style={{fontSize:48,marginBottom:16}}>{error.big ? '📦' : '⚠️'}</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:700,marginBottom:8}}>
                {error.big ? 'Archivo demasiado grande para previsualizar' : 'No se pudo previsualizar'}
              </div>
              <div style={{color:'#6b7592',fontSize:14,marginBottom:24}}>{error.msg}</div>
              <button style={vs.btnPrimary} onClick={downloadFile}>⬇ Descargar el archivo</button>
            </div>
          )}

          {!loading && !error && docData && (
            <>
              {(docData.tipo==='excel') && <VisorExcel base64={docData.base64} nombre={docData.nombre}/>}
              {(docData.tipo==='word')  && <VisorWord  base64={docData.base64} nombre={docData.nombre}/>}
              {(docData.tipo==='pdf')   && <VisorPDF   base64={docData.base64}/>}
              {(docData.tipo==='ppt')   && <VisorPPT   base64={docData.base64} nombre={docData.nombre}/>}
              {!['excel','word','pdf','ppt'].includes(docData.tipo) && (
                <div style={vs.errorBox}>
                  <div style={{fontSize:40,marginBottom:12}}>🔍</div>
                  <div style={{marginBottom:16,color:'#6b7592'}}>Tipo de archivo no soportado para previsualización</div>
                  <button style={vs.btnPrimary} onClick={downloadFile}>⬇ Descargar</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .dv-word-content h1,.dv-word-content h2,.dv-word-content h3{color:#93c5fd;margin:16px 0 8px}
        .dv-word-content p{margin:0 0 10px;color:#d1d9e8;line-height:1.7}
        .dv-word-content table{border-collapse:collapse;width:100%;margin:12px 0}
        .dv-word-content td,.dv-word-content th{border:1px solid #1e2330;padding:6px 10px;color:#d1d9e8}
        .dv-word-content strong{color:#e8ecf4}
        .dv-word-content ul,.dv-word-content ol{padding-left:24px;color:#d1d9e8}
      `}</style>
    </div>
  );
}

// ─── ESTILOS ───────────────────────────────────────────────────
const vs = {
  overlay:   {position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(4px)'},
  modal:     {background:'#0f1117',border:'1px solid #1e2330',borderRadius:16,width:'92vw',maxWidth:1200,height:'90vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 40px 80px rgba(0,0,0,0.8)'},
  modalHeader:{padding:'0 20px',height:56,background:'#111318',borderBottom:'1px solid #1e2330',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,gap:12},
  modalTitle: {display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0},
  modalBody:  {flex:1,overflow:'hidden',display:'flex',flexDirection:'column'},
  closeBtn:   {width:32,height:32,borderRadius:8,background:'rgba(255,107,107,0.1)',border:'1px solid rgba(255,107,107,0.3)',color:'#ff6b6b',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center'},
  loading:    {flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#6b7592',fontSize:15,gap:4},
  errorBox:   {flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'#e8ecf4',textAlign:'center',padding:40},
  // Toolbar común
  toolbar:    {padding:'8px 16px',background:'#181c24',borderBottom:'1px solid #1e2330',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexShrink:0,flexWrap:'wrap'},
  searchInput:{background:'#0f1117',border:'1px solid #1e2330',borderRadius:7,padding:'6px 12px',color:'#e8ecf4',fontFamily:"'DM Sans',sans-serif",fontSize:12,outline:'none',width:200},
  hint:       {fontSize:11,color:'#6b7592'},
  modeTabs:   {display:'flex',gap:4},
  modeTab:    {padding:'5px 12px',borderRadius:6,border:'1px solid #1e2330',background:'none',cursor:'pointer',color:'#6b7592',fontSize:12},
  modeTabActive:{background:'rgba(79,124,255,0.15)',borderColor:'#4f7cff',color:'#4f7cff'},
  navBtn:     {width:28,height:28,borderRadius:6,background:'#1e2330',border:'none',color:'#e8ecf4',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'},
  btnGhost:   {padding:'5px 12px',borderRadius:7,border:'1px solid #1e2330',background:'none',color:'#6b7592',cursor:'pointer',fontSize:12,transition:'all .15s'},
  btnGreen:   {padding:'5px 12px',borderRadius:7,border:'1px solid rgba(0,229,160,0.3)',background:'rgba(0,229,160,0.1)',color:'#00e5a0',cursor:'pointer',fontSize:12},
  btnPrimary: {padding:'10px 24px',borderRadius:9,border:'none',background:'linear-gradient(135deg,#4f7cff,#7b5fff)',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600},
  // Excel
  excelWrap:  {display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'},
  sheetTabs:  {display:'flex',gap:0,background:'#181c24',borderBottom:'1px solid #1e2330',padding:'0 16px',flexShrink:0},
  sheetTab:   {padding:'8px 16px',fontSize:12,cursor:'pointer',color:'#6b7592',borderBottom:'2px solid transparent',transition:'all .15s'},
  sheetTabActive:{color:'#4f7cff',borderBottomColor:'#4f7cff'},
  tableWrap:  {flex:1,overflow:'auto'},
  table:      {borderCollapse:'collapse',fontSize:12,fontFamily:"'DM Sans',sans-serif"},
  th:         {padding:'6px 12px',background:'#1e2a3a',color:'#93c5fd',fontWeight:600,borderBottom:'1px solid #1e2330',borderRight:'1px solid #1e2330',position:'sticky',top:0,zIndex:1,whiteSpace:'nowrap',minWidth:80,textAlign:'center'},
  rowNumTh:   {padding:'6px 8px',background:'#181c24',color:'#6b7592',fontWeight:400,borderBottom:'1px solid #1e2330',borderRight:'1px solid #1e2330',position:'sticky',top:0,left:0,zIndex:2,minWidth:36,textAlign:'center'},
  rowNum:     {padding:'5px 8px',background:'#181c24',color:'#6b7592',borderRight:'1px solid #1e2330',borderBottom:'1px solid #1e2330',textAlign:'center',fontSize:11,position:'sticky',left:0},
  td:         {padding:'5px 12px',borderRight:'1px solid #1e2330',borderBottom:'1px solid #1e2330',whiteSpace:'nowrap',maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',cursor:'default',transition:'background .1s'},
  tdHead:     {fontWeight:600},
  tdEdit:     {padding:0},
  headerRow:  {},
  cellInput:  {width:'100%',background:'#1a2540',border:'none',outline:'none',color:'#e8ecf4',fontFamily:"'DM Sans',sans-serif",fontSize:12,padding:'5px 12px'},
  statusBar:  {padding:'5px 16px',background:'#181c24',borderTop:'1px solid #1e2330',fontSize:11,color:'#6b7592',flexShrink:0},
  // Word
  wordWrap:   {display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'},
  wordPage:   {flex:1,overflow:'auto',background:'#0a0c10',display:'flex',justifyContent:'center',padding:'32px 24px'},
  wordContent:{background:'#13181f',borderRadius:8,padding:'48px 56px',maxWidth:800,width:'100%',lineHeight:1.8,className:'dv-word-content'},
  textArea:   {width:'100%',flex:1,background:'#111318',border:'none',outline:'none',color:'#d1d9e8',fontFamily:"'DM Sans',sans-serif",fontSize:14,lineHeight:1.8,resize:'none',padding:'32px',borderRadius:0},
  // PDF
  pdfWrap:    {display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'},
  pdfCanvas:  {flex:1,overflow:'auto',display:'flex',justifyContent:'center',alignItems:'flex-start',padding:24,background:'#0a0c10'},
  // PPT
  pptWrap:    {display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'},
  pptLayout:  {flex:1,display:'flex',overflow:'hidden'},
  pptSidebar: {width:200,background:'#0f1117',borderRight:'1px solid #1e2330',overflowY:'auto',flexShrink:0},
  pptThumb:   {padding:'12px 14px',borderBottom:'1px solid #1e2330',cursor:'pointer',transition:'background .15s'},
  pptThumbActive:{background:'rgba(79,124,255,0.12)',borderLeft:'3px solid #4f7cff'},
  pptThumbNum:{fontSize:10,color:'#6b7592',marginBottom:4,textTransform:'uppercase',letterSpacing:1},
  pptThumbTitle:{fontSize:12,color:'#e8ecf4',fontWeight:500,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},
  pptThumbCount:{fontSize:10,color:'#6b7592'},
  pptMain:    {flex:1,overflow:'auto',padding:32,background:'#0a0c10'},
  pptSlide:   {background:'#13181f',borderRadius:12,padding:'40px 48px',maxWidth:800,border:'1px solid #1e2330',boxShadow:'0 8px 32px rgba(0,0,0,0.4)'},
  pptSlideNum:{fontSize:10,color:'#6b7592',textTransform:'uppercase',letterSpacing:1,marginBottom:24},
  pptText:    {marginBottom:8,lineHeight:1.5},
};
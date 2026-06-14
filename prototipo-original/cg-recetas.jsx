/* ============================================================
   RECETAS — núcleo del sistema (Tablero configurador + Tabla)
   ============================================================ */
const Cr = window.CG.color;
const Fr = window.CG.font;
const Rdata = window.CG.recetas;
const catTone = window.CG.catColors;

const catColor = (cat) => catTone[cat] || "hsl(215 16% 47%)";
const uid = (()=>{ let i=1000; return ()=> ++i; })();

// Estado inicial profundo desde los datos
function seedStyles() {
  return Rdata.styles.map(s => ({
    ...s, id: uid(),
    rows: s.rows.map(r => ({
      ...r, id: uid(),
      kids: (r.kids||[]).map(k => ({ ...k, id: uid() })),
    })),
  }));
}

function RecetasScreen({ ai }) {
  const [view, setView] = useState("board");   // board | table
  const [styles, setStyles] = useState(seedStyles);
  const [help, setHelp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [focus, setFocus] = useState(null);
  const [pq, setPq] = useState("");
  const [drag, setDrag] = useState(null);       // {name,cat}
  const [dropT, setDropT] = useState(null);     // drop target key
  const [aiBar, setAiBar] = useState(true);     // banner de autoconfig de iA
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [selProd, setSelProd] = useState(null); // producto abierto en tarjeta de config
  const [meta, setMeta] = useState({});         // { [name]: { proveedor, deleted } }
  const saveTimer = useRef(null);

  // “Autoguardado” simulado
  const touch = () => {
    setSaving(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(()=>setSaving(false), 650);
  };
  const mutate = (fn) => { setStyles(prev => { const next = structuredCloneSafe(prev); fn(next); return next; }); touch(); };

  // Helpers de edición
  const findRow = (root, sid, rid) => {
    const s = root.find(x=>x.id===sid); if(!s) return null;
    for (const r of s.rows){ if(r.id===rid) return {s, r, parentRows:s.rows};
      const k = (r.kids||[]).find(x=>x.id===rid); if(k) return {s, r:k, parentRows:r.kids, refW:(r.kids&&r.parentRefName)}; }
    return null;
  };

  const setPct = (sid, rid, pct, isKid, parentId) => mutate(root=>{
    const s = root.find(x=>x.id===sid);
    const arr = isKid ? s.rows.find(r=>r.id===parentId).kids : s.rows;
    const row = arr.find(r=>r.id===rid); if(row) row.pct = pct;
  });
  const setPieces = (sid, rid, pz, isKid, parentId) => mutate(root=>{
    const s = root.find(x=>x.id===sid);
    const arr = isKid ? s.rows.find(r=>r.id===parentId).kids : s.rows;
    const row = arr.find(r=>r.id===rid); if(row) row.pz = Math.max(0, pz);
  });
  const toggleVariant = (sid, rid, isKid, parentId) => mutate(root=>{
    const s = root.find(x=>x.id===sid);
    const arr = isKid ? s.rows.find(r=>r.id===parentId).kids : s.rows;
    const row = arr.find(r=>r.id===rid); if(row) row.variant = !row.variant;
  });
  const setRefW = (sid, kg) => mutate(root=>{ const s=root.find(x=>x.id===sid); if(s) s.canalW = kg; });
  const addRow = (sid, name, cat) => mutate(root=>{
    const s = root.find(x=>x.id===sid); if(!s) return;
    if (s.rows.some(r=>r.n===name)) return;
    s.rows.push({ id:uid(), n:name, cat:cat||"Otros", pz:1, pct:0, kids:[] });
  });
  // Buscar una fila a cualquier profundidad
  const findDeep = (rows, rid) => { for(const r of rows){ if(r.id===rid) return r; if(r.kids){ const f=findDeep(r.kids,rid); if(f) return f; } } return null; };
  const addKid = (sid, parentId, name, cat) => mutate(root=>{
    const s = root.find(x=>x.id===sid); if(!s) return;
    const p = findDeep(s.rows, parentId); if(!p) return;
    p.kids = p.kids||[];
    if (p.kids.some(k=>k.n===name)) return;
    p.kids.push({ id:uid(), n:name, cat:cat||"Otros", pz:1, pct:0 });
  });

  // Convertir cualquier pieza (hijo o suelta) en PADRE: le habilita su propio despiece
  const convertToParent = (sid, rid) => {
    mutate(root=>{ const s=root.find(x=>x.id===sid); if(!s) return; const r=findDeep(s.rows, rid); if(r && !r.kids) r.kids=[]; });
    setExpanded(st=>({ ...st, ["r"+rid]:true }));
  };
  // Borrar un producto de todas las recetas
  const removeProduct = (name) => {
    mutate(root=>{ root.forEach(s=>{ s.rows = s.rows.filter(r=>r.n!==name);
      s.rows.forEach(r=>{ if(r.kids) r.kids = r.kids.filter(k=>k.n!==name); }); }); });
    setMeta(m=>({ ...m, [name]:{ ...(m[name]||{}), deleted:true } })); setSelProd(null);
  };
  // Marcar producto como de proveedor (no depende del despiece de un canal)
  const setProveedor = (name, on) => setMeta(m=>({ ...m, [name]:{ ...(m[name]||{}), proveedor:on } }));
  // Peso del canal estimado (promedio de la compra del día)
  const estCanalW = (s) => s.kind==="completo" ? 106.4 : 53.2;
  const setRefWAvg = (sid) => mutate(root=>{ const s=root.find(x=>x.id===sid); if(s) s.canalW = estCanalW(s); });
  // Usos de un producto (en qué canales está, con qué % y kg)
  const usagesOf = (name) => {
    const out = [];
    styles.forEach(s=>{
      s.rows.forEach(r=>{
        if(r.n===name) out.push({ sid:s.id, type:s.type, accent:s.accent, canalW:s.canalW, row:r, isKid:false, parentId:null });
        (r.kids||[]).forEach(k=>{ if(k.n===name) out.push({ sid:s.id, type:s.type, accent:s.accent, canalW:(r.pct/100*s.canalW), row:k, isKid:true, parentId:r.id, parentName:r.n }); });
      });
    });
    return out;
  };

  const sumPct = (rows) => rows.filter(r=>!r.variant).reduce((s,r)=>s+(+r.pct||0),0);

  /* ---------- Selector de producto (Combobox) ---------- */
  const allProducts = useMemo(()=>{
    const all = [];
    for (const [cat, items] of Object.entries(Rdata.palette)) {
      for (const name of items) {
        if (!(meta[name] && meta[name].deleted)) all.push({ name, cat });
      }
    }
    return all.sort((a,b)=>a.name.localeCompare(b.name));
  }, [meta]);

  const ProductSelector = ({ onSelect, label="Seleccionar producto" }) => {
    const [q, setQ] = useState("");
    const [open, setOpen] = useState(false);
    const filtered = allProducts.filter(p=>
      !q || p.name.toLowerCase().includes(q.toLowerCase())
    );
    return (
      <div style={{ position:"relative", display:"inline-block", minWidth:160 }}>
        <button onClick={()=>setOpen(o=>!o)} style={{
          display:"inline-flex", alignItems:"center", gap:6, cursor:"pointer",
          border:`1px solid ${Cr.line}`, background:Cr.paper, borderRadius:9, padding:"8px 11px",
          font:`700 11.5px/1 ${Fr.ui}`, color:Cr.ink }}
          title="Seleccionar de productos existentes">
          <Icon name="plus" size={14} color={Cr.red} /> {label}
          <Icon name="chevron-down" size={13} color={Cr.inkFaint} style={{ marginLeft:"auto" }} />
        </button>
        {open && (
          <>
            <div onClick={()=>setOpen(false)} style={{ position:"fixed", inset:0, zIndex:40 }} />
            <div style={{
              position:"absolute", top:"100%", left:0, right:0, zIndex:41, marginTop:6,
              background:Cr.paper, border:`1px solid ${Cr.line}`, borderRadius:10,
              boxShadow:Cr.shadow, overflow:"hidden", maxHeight:"240px", display:"flex", flexDirection:"column" }}>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar..."
                autoFocus style={{
                  padding:"10px 12px", border:`1px solid ${Cr.lineSoft}`, borderBottom:q?`1px solid ${Cr.line}`:
                  "none", background:Cr.paper2, outline:"none", font:`500 12px/1 ${Fr.ui}`, color:Cr.ink }} />
              <div style={{ overflowY:"auto", flex:1 }}>
                {filtered.length > 0 ? filtered.map((p,i)=>(
                  <button key={i} onClick={()=>{ onSelect(p.name, p.cat); setOpen(false); setQ(""); }}
                    style={{
                      width:"100%", textAlign:"left", padding:"10px 12px", border:"none",
                      background:"transparent", cursor:"pointer", display:"flex", alignItems:"center",
                      gap:8, font:`600 12.5px/1 ${Fr.ui}`, color:Cr.ink, borderBottom:`1px solid ${Cr.lineSoft}` }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:catColor(p.cat), flexShrink:0 }} />
                    {p.name}
                  </button>
                )) : (
                  <div style={{ padding:"12px", textAlign:"center", font:`500 11px/1 ${Fr.ui}`, color:Cr.inkFaint }}>Sin resultados</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  /* ---------- Uso de cada producto (de dónde sale) ---------- */
  const SHORT = { AMERICANO:"AMERICANO", NACIONAL_LOMO:"N·LOMO", NACIONAL_ESPILOMO:"N·ESPILOMO", POLINESIO:"POLINESIO" };
  const usage = useMemo(()=>{
    const canalUses = {}, parentUses = {}, weight = {};
    styles.forEach(s=>{
      s.rows.forEach(r=>{
        (canalUses[r.n] = canalUses[r.n]||[]);
        if(!canalUses[r.n].some(u=>u.type===s.type)) canalUses[r.n].push({ type:s.type, ttype:SHORT[s.type]||s.type, accent:s.accent });
        const w = (r.pct/100)*s.canalW;
        if(w > (weight[r.n]||0)) weight[r.n] = w;
        (r.kids||[]).forEach(k=>{
          (parentUses[k.n] = parentUses[k.n]||[]);
          if(!parentUses[k.n].includes(r.n)) parentUses[k.n].push(r.n);
          const wk = (k.pct/100)*w;
          if(wk > (weight[k.n]||0)) weight[k.n] = wk;
        });
      });
    });
    return { canalUses, parentUses, weight };
  }, [styles]);

  /* ---------- Paleta ---------- */
  const palette = useMemo(()=>{
    const q = pq.trim().toLowerCase();
    const out = [];
    for (const [cat, items] of Object.entries(Rdata.palette)) {
      const f = items.filter(n => !(meta[n] && meta[n].deleted) && (!q || n.toLowerCase().includes(q)));
      if (f.length) out.push([cat, f]);
    }
    return out;
  }, [pq, meta]);

  const Chip = ({ name, cat }) => {
    const canalUses = usage.canalUses[name] || [];
    const parentUses = usage.parentUses[name] || [];
    const w = usage.weight[name];
    const prov = meta[name] && meta[name].proveedor;
    const orphan = !canalUses.length && !parentUses.length && !prov;
    return (
      <div draggable
        onDragStart={(e)=>{ setDrag({name,cat}); e.dataTransfer.effectAllowed="copy"; e.dataTransfer.setData("text/plain", name); }}
        onDragEnd={()=>{ setDrag(null); setDropT(null); }}
        onClick={()=>setSelProd(name)}
        title="Clic para configurar · arrastra a un estilo"
        className="cg-chip-drag"
        style={{ display:"flex", flexDirection:"column", gap:6, cursor:"pointer",
          background:Cr.paper, border:`1px solid ${prov?Cr.green:(canalUses.length?Cr.line:Cr.lineSoft)}`, borderRadius:10, padding:"9px 10px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ width:9, height:9, borderRadius:"50%", background:catColor(cat), flexShrink:0 }} />
          <span style={{ font:`700 12.5px/1.15 ${Fr.ui}`, color:Cr.ink, flex:1, minWidth:0,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</span>
          {w>0 && <span style={{ font:`600 11px/1 ${Fr.mono}`, color:Cr.inkFaint, flexShrink:0 }}>{w.toFixed(w<10?2:1)}kg</span>}
          <Icon name="settings-2" size={12} color={Cr.inkFaint} />
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          {prov && <span title="Producto de proveedor" style={{ display:"inline-flex", alignItems:"center", gap:3,
            font:`800 8.5px/1 ${Fr.ui}`, letterSpacing:"0.04em", color:Cr.green, border:`1px solid ${Cr.green}`, padding:"3px 5px", borderRadius:5 }}>
            <Icon name="truck" size={9} color={Cr.green} />PROVEEDOR</span>}
          {canalUses.map(u=>(
            <span key={u.type} title={`Sale del canal ${u.type}`} style={{ font:`800 8.5px/1 ${Fr.ui}`, letterSpacing:"0.04em",
              color:u.accent, border:`1px solid ${u.accent}`, padding:"3px 5px", borderRadius:5 }}>{u.ttype}</span>
          ))}
          {parentUses.map(p=>(
            <span key={p} title={`Sale del despiece de ${p}`} style={{ display:"inline-flex", alignItems:"center", gap:3,
              font:`700 8.5px/1 ${Fr.ui}`, color:Cr.inkSoft, background:Cr.paper2, padding:"3px 6px", borderRadius:5 }}>
              <Icon name="git-branch" size={9} color={Cr.inkSoft} />{p}</span>
          ))}
          {orphan && <span title="Aún no está en ninguna receta" style={{ font:`700 8.5px/1 ${Fr.ui}`, color:Cr.amber,
            background:Cr.amberWash, padding:"3px 6px", borderRadius:5 }}>sin ubicar</span>}
        </div>
      </div>
    );
  };

  /* ---------- Fila editable ---------- */
  const Row = ({ row, sid, refW, isKid, parentId, depth }) => {
    const kg = refW>0 ? (row.pct/100)*refW : 0;
    const hasKids = (row.kids&&row.kids.length>0);
    const canRamify = Array.isArray(row.kids);
    const ekey = `r${row.id}`;
    const isOpen = !!expanded[ekey] && canRamify;
    return (
      <div>
        <div className="cg-recipe-row" style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 6px",
          background: row.variant ? Cr.amberWash : "transparent", borderRadius:9 }}>
          <Icon name="grip-vertical" size={14} color={Cr.inkFaint} style={{ flexShrink:0, opacity:0.5 }} />
          <button onClick={()=>{ if(canRamify) setExpanded(st=>({...st,[ekey]:!st[ekey]})); else convertToParent(sid,row.id); }}
            title={canRamify?"Ver/editar su despiece":"Convertir en padre · habilitar su despiece"}
            style={{ width:22, height:22, flexShrink:0, border:"none", background:"transparent", cursor:"pointer", display:"grid", placeItems:"center" }}>
            <Icon name={isOpen?"chevron-down":(canRamify?"chevron-right":"git-branch-plus")} size={15} color={canRamify?Cr.ink:Cr.inkFaint} />
          </button>
          <span style={{ width:10, height:10, borderRadius:"50%", background:catColor(row.cat), flexShrink:0 }} title={row.cat} />
          <span style={{ flex:1, minWidth:54, font:`700 14px/1.2 ${Fr.ui}`, color:Cr.ink, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.n}</span>
          {hasKids && <span title="sub-piezas" style={{ display:"inline-flex", alignItems:"center", gap:3, flexShrink:0, font:`700 10.5px/1 ${Fr.ui}`, color:Cr.blue }}><Icon name="git-branch" size={11} color={Cr.blue} />{row.kids.length}</span>}
          {isKid && (
          <button onClick={()=>toggleVariant(sid,row.id,isKid,parentId)} title="Despiece suma al peso del padre · Variante es alternativa (no suma)"
            style={{ flexShrink:0, font:`800 9px/1 ${Fr.ui}`, letterSpacing:"0.04em", textTransform:"uppercase",
              padding:"5px 8px", borderRadius:7, cursor:"pointer", border:"none",
              color: row.variant?Cr.amber:Cr.inkSoft, background: row.variant?Cr.amberWash:Cr.paper2 }}>
            {row.variant ? "Variante" : "Despiece"}
          </button>
          )}
          {/* Stepper piezas */}
          <div style={{ display:"flex", alignItems:"center", border:`1px solid ${Cr.line}`, borderRadius:8, flexShrink:0, overflow:"hidden" }}>
            <button onClick={()=>setPieces(sid,row.id,row.pz-1,isKid,parentId)} className="cg-step" style={stepBtn}>−</button>
            <span style={{ minWidth:26, textAlign:"center", font:`700 13px/1 ${Fr.mono}`, color:Cr.ink }}>{row.pz}</span>
            <button onClick={()=>setPieces(sid,row.id,row.pz+1,isKid,parentId)} className="cg-step" style={stepBtn}>+</button>
          </div>
          {/* kg editable */}
          <div style={{ display:"flex", alignItems:"center", gap:3, flexShrink:0 }}>
            <input type="number" step="0.01" disabled={refW<=0}
              defaultValue={kg>0?kg.toFixed(2):""} placeholder="kg" key={`${row.id}:${kg.toFixed(2)}`}
              onBlur={(e)=>{ const n=parseFloat(e.target.value)||0; if(refW>0) setPct(sid,row.id, (n/refW)*100, isKid, parentId); }}
              onKeyDown={(e)=>{ if(e.key==="Enter") e.target.blur(); }}
              title={refW<=0?"Define primero el peso de referencia del padre":"Peso real; el % se calcula solo"}
              style={{ width:64, textAlign:"right", font:`600 12.5px/1 ${Fr.mono}`, color:Cr.ink, background:Cr.paper2,
                border:`1px solid ${Cr.line}`, borderRadius:7, padding:"6px 7px", outline:"none", opacity:refW<=0?0.5:1 }} />
            <span style={{ font:`500 10px/1 ${Fr.ui}`, color:Cr.inkFaint }}>kg</span>
          </div>
          {/* % */}
          <span style={{ width:52, textAlign:"right", flexShrink:0, font:`700 13px/1 ${Fr.mono}`,
            color: row.variant?Cr.amber:Cr.red }}>{(+row.pct||0).toFixed(1)}%</span>
        </div>
        {/* Ramificación (nivel 2) */}
        {isOpen && (
          <div onDragOver={(e)=>{ if(drag){ e.preventDefault(); e.stopPropagation(); setDropT(`k${row.id}`);} }}
            onDragLeave={()=>setDropT(t=>t===`k${row.id}`?null:t)}
            onDrop={(e)=>{ if(drag){ e.preventDefault(); e.stopPropagation(); addKid(sid,row.id,drag.name,drag.cat); setDrag(null); setDropT(null);} }}
            style={{ margin:"4px 0 10px 26px", padding:"10px 12px", borderRadius:12,
              border:`1px solid ${Cr.line}`, borderLeft:`3px solid ${Cr.blue}`, background:Cr.paper2,
              boxShadow: dropT===`k${row.id}` ? `0 0 0 2px ${Cr.blue}` : "none" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6, flexWrap:"wrap", gap:8 }}>
              <span style={{ font:`700 11px/1 ${Fr.ui}`, color:Cr.inkSoft }}>
                Despiece de {row.n} {row.kids.length===0 && <span style={{ color:Cr.blue, fontWeight:600 }}>· ahora es padre, arrastra o agrega piezas</span>}
                {drag && <span style={{ color:Cr.blue, fontWeight:400 }}> · suelta para agregar sub-pieza</span>}
              </span>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <ProductSelector label="Pieza" onSelect={(name,cat)=>addKid(sid,row.id,name,cat)} />
                <RefW label="pesa" kg={refW>0?(row.pct/100*refW):0} disabled hint="El peso de esta pieza se toma de su % en el padre" />
              </div>
            </div>
            {row.kids.map(k => <Row key={k.id} row={k} sid={sid} refW={refW>0?(row.pct/100*refW):0} isKid parentId={row.id} depth={(depth||0)+1} />)}
            <SumBadge rows={row.kids} refW={refW>0?(row.pct/100*refW):0} level="Nivel 2" />
          </div>
        )}
      </div>
    );
  };

  const RefW = ({ label, kg, onCommit, disabled, hint, onEstimate, estimate }) => (
    <label title={hint} style={{ display:"inline-flex", alignItems:"center", gap:5, font:`600 11px/1 ${Fr.ui}`, color:Cr.inkSoft }}>
      {label}
      <input type="number" step="0.01" disabled={disabled} defaultValue={kg>0?(Math.round(kg*100)/100):""} placeholder="0"
        key={kg} onBlur={onCommit?(e)=>onCommit(parseFloat(e.target.value)||0):undefined}
        onKeyDown={(e)=>{ if(e.key==="Enter") e.target.blur(); }}
        style={{ width:58, textAlign:"center", font:`700 12px/1 ${Fr.mono}`, color:Cr.ink, background:Cr.paper2,
          border:`1px solid ${Cr.line}`, borderRadius:7, padding:"6px 6px", outline:"none", opacity:disabled?0.55:1 }} />
      kg
      {onEstimate && (
        <button onClick={(e)=>{ e.preventDefault(); onEstimate(); }} title={`Usar promedio estimado de iA (${estimate} kg)`}
          style={{ display:"inline-flex", alignItems:"center", gap:4, marginLeft:2, cursor:"pointer", border:`1px solid ${Cr.line}`,
            background:Cr.paper2, borderRadius:7, padding:"5px 8px", font:`700 10px/1 ${Fr.ui}`, color:Cr.ink }}>
          <Icon name="sparkles" size={11} color={Cr.redSoft} /> Promedio
        </button>
      )}
    </label>
  );

  const SumBadge = ({ rows, refW, level }) => {
    const pct = sumPct(rows);
    const kgSum = refW>0 ? (pct/100)*refW : 0;
    const over = pct > 100.5;
    const merma = Math.max(0, 100-pct);
    return (
      <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:9, marginTop:8,
        padding:"7px 11px", borderRadius:9, font:`700 11.5px/1 ${Fr.ui}`,
        color: over?Cr.red:Cr.blue, background: over?Cr.redWash:Cr.blueWash }}>
        {level && <span style={{ font:`800 9px/1 ${Fr.ui}`, letterSpacing:"0.06em", textTransform:"uppercase",
          color:Cr.inkSoft, background:Cr.paper, padding:"3px 6px", borderRadius:5 }}>{level}</span>}
        <span>Σ {pct.toFixed(1)}%</span>
        {refW>0 && <span style={{ fontWeight:500, color:Cr.inkSoft }}>{kgSum.toFixed(2)} / {refW.toFixed(2)} kg</span>}
        <span style={{ fontWeight:700, marginLeft:"auto", display:"flex", alignItems:"center", gap:5 }}>
          {over ? <><Icon name="alert-triangle" size={13} color={Cr.red} /> excede el peso</>
                : <>merma {merma.toFixed(1)}%</>}
        </span>
      </div>
    );
  };

  /* ---------- Tarjeta de estilo ---------- */
  const StyleCard = ({ s, focused }) => {
    const dk = `s${s.id}`;
    return (
      <div onDragOver={(e)=>{ if(drag){ e.preventDefault(); setDropT(dk);} }}
        onDragLeave={()=>setDropT(t=>t===dk?null:t)}
        onDrop={(e)=>{ if(drag){ e.preventDefault(); addRow(s.id, drag.name, drag.cat); setDrag(null); setDropT(null);} }}
        style={{ background:Cr.paper, border:`1px solid ${dropT===dk?s.accent:Cr.line}`, borderRadius:16, overflow:"hidden",
          boxShadow: dropT===dk?`0 0 0 2px ${s.accent}`:"0 8px 24px -18px rgba(33,28,25,0.35)" }}>
        <div style={{ height:4, background:s.accent }} />
        <div style={{ padding:"14px 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, flexWrap:"wrap", marginBottom:12 }}>
            <div style={{ minWidth:0 }}>
              <div style={{ font:`700 15px/1.2 ${Fr.ui}`, color:Cr.ink, marginBottom:6 }}>{s.parent}</div>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                <span style={{ font:`800 9.5px/1 ${Fr.ui}`, letterSpacing:"0.06em", color:s.accent,
                  border:`1px solid ${s.accent}`, padding:"4px 6px", borderRadius:5 }}>{s.type}</span>
                {s.draft && <span style={{ font:`800 9px/1 ${Fr.ui}`, letterSpacing:"0.05em", textTransform:"uppercase",
                  color:Cr.amber, background:Cr.amberWash, padding:"4px 7px", borderRadius:999 }}>Borrador</span>}
                <span style={{ font:`700 9.5px/1 ${Fr.ui}`, letterSpacing:"0.03em",
                  color: s.kind==="completo"?Cr.blue:Cr.amber, background: s.kind==="completo"?Cr.blueWash:Cr.amberWash,
                  padding:"4px 7px", borderRadius:999 }}
                  title={s.kind==="completo"?"Canal completo: el cerdo entero. Los % son sobre el peso total.":"Media canal: un solo lado. Los % son sobre ese medio canal."}>
                  {s.kind==="completo" ? "🐷 Canal completo" : "½ Media canal"}
                </span>
                <span style={{ font:`500 11px/1 ${Fr.ui}`, color:Cr.inkFaint }}>{s.rows.length} piezas</span>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap" }}>
              <RefW label="Peso del canal" kg={s.canalW} onCommit={(n)=>setRefW(s.id,n)} hint="Peso de referencia del canal; base para calcular kg y %"
                onEstimate={()=>setRefWAvg(s.id)} estimate={estCanalW(s)} />
              <button onClick={()=>setFocus(focused?null:s.type)} title={focused?"Volver al tablero":"Enfocar este estilo"}
                style={{ width:32, height:32, borderRadius:8, border:`1px solid ${Cr.line}`, background:Cr.paper2,
                  cursor:"pointer", display:"grid", placeItems:"center" }}>
                <Icon name={focused?"minimize-2":"maximize-2"} size={15} color={Cr.inkSoft} />
              </button>
            </div>
          </div>
          <div>
            {s.rows.map(r => <Row key={r.id} row={r} sid={s.id} refW={s.canalW} depth={0} />)}
          </div>
          {drag && (
            <div style={{ marginTop:8, padding:"10px", borderRadius:9, textAlign:"center",
              border:`2px dashed ${s.accent}`, font:`700 11.5px/1 ${Fr.ui}`, color:Cr.inkSoft }}>
              Suelta aquí para agregar <b style={{color:Cr.ink}}>{drag.name}</b> a {s.type}
            </div>
          )}
          {!drag && (
            <div style={{ marginTop:8, display:"flex", justifyContent:"center" }}>
              <ProductSelector label="Agregar pieza · o arrastra desde la paleta" onSelect={(name,cat)=>addRow(s.id,name,cat)} />
            </div>
          )}
          <SumBadge rows={s.rows} refW={s.canalW} level="Nivel 1" />
        </div>
      </div>
    );
  };

  /* ---------- Tarjeta de configuración de un producto ---------- */
  const ProductCard = ({ name }) => {
    const uses = usagesOf(name);
    const cat = (Object.entries(Rdata.palette).find(([c,items])=>items.includes(name))||["Otros"])[0];
    const prov = meta[name] && meta[name].proveedor;
    const stylesWithout = styles.filter(s=> !s.rows.some(r=>r.n===name));
    const [addTo, setAddTo] = useState("");
    return (
      <div onClick={()=>setSelProd(null)} style={{ position:"fixed", inset:0, zIndex:120,
        background:"rgba(33,28,25,0.45)", display:"grid", placeItems:"center", padding:18 }}>
        <div onClick={e=>e.stopPropagation()} style={{ width:"min(540px,96vw)", maxHeight:"88vh", overflowY:"auto",
          background:Cr.paper, borderRadius:18, border:`1px solid ${Cr.line}`, boxShadow:Cr.shadow }}>
          {/* header */}
          <div style={{ position:"sticky", top:0, background:Cr.paper, padding:"16px 18px", borderBottom:`1px solid ${Cr.line}`,
            display:"flex", alignItems:"center", gap:11, zIndex:2 }}>
            <span style={{ width:13, height:13, borderRadius:"50%", background:catColor(cat), flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ font:`700 17px/1.1 ${Fr.ui}`, color:Cr.ink }}>{name}</div>
              <div style={{ font:`600 11.5px/1 ${Fr.ui}`, color:Cr.inkSoft, marginTop:3 }}>
                {cat} · {prov ? "producto de proveedor" : uses.length ? `en ${uses.length} canal(es)` : "sin ubicar"}</div>
            </div>
            <button onClick={()=>setSelProd(null)} style={{ background:"transparent", border:"none", cursor:"pointer", lineHeight:0 }}>
              <Icon name="x" size={20} color={Cr.inkSoft} /></button>
          </div>

          <div style={{ padding:"16px 18px" }}>
            {prov && (
              <div style={{ display:"flex", gap:9, alignItems:"center", padding:"11px 13px", borderRadius:11,
                background:Cr.greenWash, marginBottom:16 }}>
                <Icon name="truck" size={16} color={Cr.green} />
                <span style={{ font:`600 12.5px/1.4 ${Fr.ui}`, color:Cr.ink80 }}>
                  Este producto <b>no depende del despiece</b> de un canal: entra por compra a proveedor.</span>
              </div>
            )}

            {/* Canales donde está */}
            <Overline style={{ marginBottom:10 }}>Sale de estos canales</Overline>
            {uses.length===0 && (
              <div style={{ font:`500 13px/1.5 ${Fr.ui}`, color:Cr.inkSoft, padding:"10px 0 14px" }}>
                Todavía no está en ninguna receta. Agrégalo a un canal abajo o márcalo como producto de proveedor.</div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:16 }}>
              {uses.map((u,i)=>{
                const kg = u.canalW>0 ? (u.row.pct/100)*u.canalW : 0;
                return (
                  <div key={i} style={{ border:`1px solid ${Cr.line}`, borderRadius:12, padding:"11px 13px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9, flexWrap:"wrap" }}>
                      <span style={{ font:`800 9.5px/1 ${Fr.ui}`, letterSpacing:"0.05em", color:u.accent,
                        border:`1px solid ${u.accent}`, padding:"4px 6px", borderRadius:5 }}>{u.type}</span>
                      {u.isKid && <span style={{ display:"inline-flex", alignItems:"center", gap:3, font:`700 9.5px/1 ${Fr.ui}`,
                        color:Cr.inkSoft, background:Cr.paper2, padding:"4px 6px", borderRadius:5 }}>
                        <Icon name="git-branch" size={9} color={Cr.inkSoft} /> de {u.parentName}</span>}
                      <span style={{ marginLeft:"auto", font:`700 13px/1 ${Fr.mono}`, color:u.row.variant?Cr.amber:Cr.red }}>{(+u.row.pct||0).toFixed(1)}%</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                      <span style={{ font:`600 11.5px/1 ${Fr.ui}`, color:Cr.inkSoft }}>Piezas</span>
                      <div style={{ display:"flex", alignItems:"center", border:`1px solid ${Cr.line}`, borderRadius:8, overflow:"hidden" }}>
                        <button onClick={()=>setPieces(u.sid,u.row.id,u.row.pz-1,u.isKid,u.parentId)} style={stepBtn}>−</button>
                        <span style={{ minWidth:26, textAlign:"center", font:`700 13px/1 ${Fr.mono}`, color:Cr.ink }}>{u.row.pz}</span>
                        <button onClick={()=>setPieces(u.sid,u.row.id,u.row.pz+1,u.isKid,u.parentId)} style={stepBtn}>+</button>
                      </div>
                      <span style={{ font:`600 11.5px/1 ${Fr.ui}`, color:Cr.inkSoft }}>Peso</span>
                      <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                        <input type="number" step="0.01" defaultValue={kg>0?kg.toFixed(2):""} placeholder="kg" key={kg.toFixed(2)}
                          onBlur={(e)=>{ const n=parseFloat(e.target.value)||0; if(u.canalW>0) setPct(u.sid,u.row.id,(n/u.canalW)*100,u.isKid,u.parentId); }}
                          onKeyDown={(e)=>{ if(e.key==="Enter") e.target.blur(); }}
                          style={{ width:70, textAlign:"right", font:`600 12.5px/1 ${Fr.mono}`, color:Cr.ink, background:Cr.paper2,
                            border:`1px solid ${Cr.line}`, borderRadius:7, padding:"7px 8px", outline:"none" }} />
                        <span style={{ font:`500 10px/1 ${Fr.ui}`, color:Cr.inkFaint }}>kg</span>
                      </div>
                      {!u.isKid && (
                        <button onClick={()=>convertToParent(u.sid,u.row.id)}
                          title="Convertir en padre: habilitar su propio despiece"
                          style={{ marginLeft:"auto", display:"inline-flex", alignItems:"center", gap:5, cursor:"pointer",
                            border:`1px solid ${Cr.line}`, background:Cr.paper2, borderRadius:8, padding:"7px 10px",
                            font:`700 10.5px/1 ${Fr.ui}`, color:Cr.ink }}>
                          <Icon name="git-branch-plus" size={12} color={Cr.blue} /> Convertir en padre</button>
                      )}
                      {u.row.kids && u.row.kids.length > 0 && (
                        <button style={{ marginLeft:"auto", display:"inline-flex", alignItems:"center", gap:5, cursor:"pointer",
                          border:`1px solid ${Cr.blue}`, background:Cr.blueWash, borderRadius:8, padding:"7px 10px",
                          font:`700 10.5px/1 ${Fr.ui}`, color:Cr.blue }}>
                          <Icon name="git-branch" size={12} color={Cr.blue} /> {u.row.kids.length} hijo(s)</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Canales que comparten la pieza */}
            {uses.length>1 && (
              <div style={{ marginBottom:16 }}>
                <Overline style={{ marginBottom:8 }}>Canales que comparten esta pieza</Overline>
                <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                  {uses.map((u,i)=>(
                    <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:6, font:`700 11px/1 ${Fr.ui}`,
                      color:Cr.ink, background:Cr.paper2, border:`1px solid ${Cr.line}`, padding:"7px 10px", borderRadius:999 }}>
                      <span style={{ width:8, height:8, borderRadius:"50%", background:u.accent }} />{u.type}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Agregar hijo (si es padre) */}
            {uses.some(u=>u.row.kids && u.row.kids.length>0) && (
              <div style={{ marginBottom:18 }}>
                <Overline style={{ marginBottom:10 }}>Agregar sub-pieza a {name}</Overline>
                <ProductSelector label="Seleccionar sub-pieza" onSelect={(pname,pcat)=>{ 
                  uses.forEach(u=>{ if(u.row.kids) addKid(u.sid, u.row.id, pname, pcat); }); 
                }} />
              </div>
            )}

            {/* Agregar a un canal */}
            {stylesWithout.length>0 && (
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:18, flexWrap:"wrap" }}>
                <div style={{ position:"relative", flex:"1 1 200px" }}>
                  <select value={addTo} onChange={e=>setAddTo(e.target.value)} style={{ width:"100%", appearance:"none",
                    border:`1px solid ${Cr.line}`, borderRadius:10, padding:"11px 34px 11px 12px", background:Cr.paper2,
                    font:`600 13px/1 ${Fr.ui}`, color:Cr.ink, cursor:"pointer", outline:"none" }}>
                    <option value="">Agregar a un canal…</option>
                    {stylesWithout.map(s=> <option key={s.id} value={s.id}>{s.type}</option>)}
                  </select>
                  <Icon name="chevron-down" size={15} color={Cr.inkFaint} style={{ position:"absolute", right:11, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
                </div>
                <Btn kind="dark" size="sm" icon="plus" onClick={()=>{ if(addTo){ addRow(+addTo, name, cat); setAddTo(""); } }}>Agregar</Btn>
              </div>
            )}

            {/* Acciones del producto */}
            <div style={{ borderTop:`1px solid ${Cr.line}`, paddingTop:14, display:"flex", gap:9, flexWrap:"wrap" }}>
              <button onClick={()=>setProveedor(name, !prov)} style={{ display:"inline-flex", alignItems:"center", gap:7,
                cursor:"pointer", font:`700 12.5px/1 ${Fr.ui}`, padding:"10px 13px", borderRadius:10,
                color: prov?Cr.green:Cr.ink, background: prov?Cr.greenWash:Cr.paper2, border:`1px solid ${prov?Cr.green:Cr.line}` }}>
                <Icon name="truck" size={14} color={prov?Cr.green:Cr.inkSoft} /> {prov?"Es producto de proveedor":"Marcar como proveedor"}
              </button>
              <button onClick={()=>removeProduct(name)} style={{ marginLeft:"auto", display:"inline-flex", alignItems:"center", gap:7,
                cursor:"pointer", font:`700 12.5px/1 ${Fr.ui}`, padding:"10px 13px", borderRadius:10,
                color:Cr.red, background:"transparent", border:`1px solid ${Cr.red}55` }}>
                <Icon name="trash-2" size={14} color={Cr.red} /> Borrar producto
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const focused = focus ? styles.find(s=>s.type===focus) : null;
  const totalRecipes = styles.reduce((n,s)=>n+s.rows.length+s.rows.reduce((m,r)=>m+(r.kids?.length||0),0),0);

  return (
    <div>
      <ScreenHead title="Recetas" desc="El núcleo del sistema: define cómo cada canal se transforma en piezas. De aquí salen el rendimiento, el inventario y los precios sugeridos."
        right={
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ display:"inline-flex", alignItems:"center", gap:7, font:`700 12px/1 ${Fr.ui}`,
              color: saving?Cr.amber:Cr.green, background: saving?Cr.amberWash:Cr.greenWash, padding:"8px 12px", borderRadius:999 }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background: saving?Cr.amber:Cr.green }} />
              {saving ? "Guardando…" : "Guardado"}
            </span>
            <Btn kind="outline" size="sm" icon="upload">Importar configurador</Btn>
          </div>
        } />
      <Slot id="recetas" ai={ai} />

      {/* Autoconfiguración de iAntonella: estima pesos desde % (con OK del usuario) */}
      <div style={{ marginBottom:14 }}>
        {aiDone ? (
          <AiLearned onUndo={()=>{ setAiDone(false); setAiBar(true); }}>
            estimé los pesos del CANAL AMERICANO desde sus % guardados. Revísalos y ajústa lo que haga falta antes de guardar.
          </AiLearned>
        ) : aiBar ? (
          <AiSuggestBar tone="sugerencia" title="Estimar pesos desde los %" busy={aiBusy}
            text="Detecto pesos sin capturar. Puedo estimarlos usando los % medidos y el peso del canal (105 kg). Tú confirmas antes de guardar y aprendo de tus ajustes para la próxima vez."
            primary="Aplicar estimación" onPrimary={()=>{ setAiBusy(true); setTimeout(()=>{ setAiBusy(false); setAiDone(true); setAiBar(false); }, 800); }}
            secondary="Ahora no" onSecondary={()=>setAiBar(false)} onDismiss={()=>setAiBar(false)} />
        ) : null}
      </div>

      {/* Barra: vista + ayuda */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ display:"inline-flex", borderRadius:11, border:`1px solid ${Cr.line}`, overflow:"hidden" }}>
          {[["board","Tablero","layout-grid"],["table","Tabla","table"]].map(([id,lab,ic])=>{
            const on=view===id;
            return <button key={id} onClick={()=>setView(id)} style={{ display:"flex", alignItems:"center", gap:7,
              font:`700 13px/1 ${Fr.ui}`, padding:"10px 15px", cursor:"pointer", border:"none",
              color:on?Cr.chromeFg:Cr.inkSoft, background:on?Cr.chrome:Cr.paper }}>
              <Icon name={ic} size={15} color={on?Cr.chromeFg:Cr.inkSoft} /> {lab}</button>;
          })}
        </div>
        <button onClick={()=>setHelp(h=>!h)} style={{ display:"inline-flex", alignItems:"center", gap:7,
          font:`700 12px/1 ${Fr.ui}`, color:Cr.inkSoft, background:"transparent", border:`1px solid ${Cr.line}`,
          padding:"9px 13px", borderRadius:999, cursor:"pointer" }}>
          <Icon name="info" size={14} color={Cr.inkSoft} /> {help?"Ocultar ayuda":"¿Qué es esto?"}
        </button>
      </div>

      {help && (
        <Card pad={18} style={{ marginBottom:14, background:Cr.blueWash, borderColor:"transparent" }}>
          <div style={{ display:"flex", gap:13, alignItems:"flex-start" }}>
            <Icon name="lightbulb" size={20} color={Cr.blue} />
            <div style={{ font:`400 13.5px/1.6 ${Fr.ui}`, color:Cr.ink80, textWrap:"pretty" }}>
              Una <b>receta</b> dice qué piezas salen de un canal y en qué proporción. Escribe los <b>kg reales</b> de cada pieza y el <b>%</b> se calcula respecto al peso del canal.
              <b> Despiece</b> suma al peso del padre; <b>Variante</b> es una alternativa que no suma (ej. JAMÓN vs JAMÓN S/HUESO).
              Usa <b>▸</b> para ramificar una pieza en su propio despiece, y arrastra productos desde la paleta. Todo se guarda solo.
            </div>
          </div>
        </Card>
      )}

      {view==="board" ? (
        <div style={{ display:"grid", gridTemplateColumns:"232px 1fr", gap:16, alignItems:"start" }} className="cg-recetas-grid">
          {/* Paleta */}
          <aside className="cg-palette" style={{ position:"sticky", top:0 }}>
            <Card pad={0} style={{ overflow:"hidden" }}>
              <div style={{ padding:"13px 13px 11px", borderBottom:`1px solid ${Cr.line}` }}>
                <div style={{ font:`700 13px/1 ${Fr.ui}`, color:Cr.ink, marginBottom:3 }}>Productos</div>
                <div style={{ font:`500 10.5px/1.3 ${Fr.ui}`, color:Cr.inkFaint, marginBottom:9 }}>Arrastra a un estilo o a una ramificación.</div>
                <div style={{ display:"flex", alignItems:"center", gap:7, border:`1px solid ${Cr.line}`, borderRadius:9, padding:"7px 9px", background:Cr.paper2 }}>
                  <Icon name="search" size={14} color={Cr.inkFaint} />
                  <input value={pq} onChange={e=>setPq(e.target.value)} placeholder="Buscar pieza…"
                    style={{ flex:1, border:"none", background:"transparent", outline:"none", font:`500 12.5px/1 ${Fr.ui}`, color:Cr.ink, minWidth:0 }} />
                </div>
              </div>
              <div style={{ maxHeight:"62vh", overflowY:"auto", padding:11, display:"flex", flexDirection:"column", gap:13 }}>
                {palette.map(([cat,items])=>(
                  <div key={cat}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7 }}>
                      <span style={{ width:8, height:8, borderRadius:"50%", background:catColor(cat) }} />
                      <span style={{ font:`800 10px/1 ${Fr.ui}`, letterSpacing:"0.06em", textTransform:"uppercase", color:Cr.inkSoft }}>{cat}</span>
                      <span style={{ font:`500 10px/1 ${Fr.ui}`, color:Cr.inkFaint }}>{items.length}</span>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {items.map(n => <Chip key={n} name={n} cat={cat} />)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </aside>

          {/* Tablero */}
          <div style={{ minWidth:0 }}>
            {focused ? (
              <div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>
                  {styles.map(s=>{
                    const on=s.type===focus;
                    return <button key={s.id} onClick={()=>setFocus(s.type)} style={{ display:"flex", alignItems:"center", gap:7,
                      font:`700 12px/1 ${Fr.ui}`, padding:"8px 13px", borderRadius:999, cursor:"pointer",
                      border:`1px solid ${on?"transparent":Cr.line}`, color:on?Cr.chromeFg:Cr.inkSoft, background:on?Cr.chrome:Cr.paper }}>
                      <span style={{ width:8, height:8, borderRadius:"50%", background:s.accent }} /> {s.type}</button>;
                  })}
                </div>
                <StyleCard s={focused} focused />
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(456px,1fr))", gap:16 }}>
                {styles.map(s => <StyleCard key={s.id} s={s} focused={false} />)}
              </div>
            )}
          </div>
        </div>
      ) : (
        <RecetasTable styles={styles} />
      )}

      {/* Tarjeta de configuración del producto */}
      {selProd && <ProductCard name={selProd} />}
    </div>
  );
}

const stepBtn = { width:26, height:28, border:"none", background:"transparent", cursor:"pointer",
  font:`700 15px/1 ${Fr.ui}`, color:Cr.ink };

/* Clon profundo seguro */
function structuredCloneSafe(o){ return JSON.parse(JSON.stringify(o)); }

/* ---------- Vista de tabla ---------- */
function RecetasTable({ styles }) {
  const rows = [];
  styles.forEach(s=>{
    s.rows.forEach(r=>{
      rows.push({ parent:s.parent, child:r.n, type:s.type, pz:r.pz, pct:r.pct, variant:r.variant, cat:r.cat });
      (r.kids||[]).forEach(k=> rows.push({ parent:r.n, child:k.n, type:"BASE", pz:k.pz, pct:k.pct, variant:k.variant, cat:k.cat, sub:true }));
    });
  });
  return (
    <Card pad={0} style={{ overflow:"hidden" }}>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:720 }}>
          <thead>
            <tr style={{ background:Cr.paper2 }}>
              {["Padre","Hijo","Estilo","Piezas","% peso est.","Tipo","Activa"].map((h,i)=>(
                <th key={i} style={{ textAlign:i<2?"left":i>=3&&i<=4?"right":"left", font:`700 11px/1 ${Fr.ui}`,
                  letterSpacing:"0.05em", textTransform:"uppercase", color:Cr.inkFaint, padding:"13px 14px" }}>{h}</th>))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} style={{ borderTop:`1px solid ${Cr.lineSoft}`, background: r.variant?Cr.amberWash:"transparent" }}>
                <td style={{ padding:"12px 14px", font:`500 13px/1.2 ${Fr.ui}`, color:Cr.inkSoft }}>
                  {r.sub && <span style={{ color:Cr.blue, marginRight:5 }}>↳</span>}{r.parent}</td>
                <td style={{ padding:"12px 14px", font:`700 13px/1.2 ${Fr.ui}`, color:Cr.ink }}>
                  <span style={{ display:"inline-flex", alignItems:"center", gap:7 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:catColor(r.cat) }} />{r.child}</span></td>
                <td style={{ padding:"12px 14px", font:`600 12px/1 ${Fr.mono}`, color:Cr.inkSoft }}>{r.type}</td>
                <td style={{ padding:"12px 14px", textAlign:"right", font:`600 13px/1 ${Fr.mono}`, color:Cr.ink80 }}>{r.pz}</td>
                <td style={{ padding:"12px 14px", textAlign:"right", font:`700 13px/1 ${Fr.mono}`, color: r.variant?Cr.amber:Cr.red }}>{(+r.pct).toFixed(1)}%</td>
                <td style={{ padding:"12px 14px" }}>
                  <Badge tone={r.variant?"amber":"blue"}>{r.variant?"Variante":"Despiece"}</Badge></td>
                <td style={{ padding:"12px 14px" }}>
                  <span style={{ display:"inline-flex", alignItems:"center", gap:6, font:`600 13px/1 ${Fr.ui}`, color:Cr.green }}>
                    <Icon name="check-circle-2" size={15} color={Cr.green} /> Sí</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

window.RecetasScreen = RecetasScreen;

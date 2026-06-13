/* ============================================================
   iAntonella — KIT DE COLABORACIÓN (lenguaje de diseño transversal)
   Componentes para que iA trabaje DENTRO de cualquier módulo:
   · AiField        — campo con valor propuesto por iA (autoconfig, con OK)
   · AiSuggestBar   — banner de acción propuesta a nivel pantalla/sección
   · AiConfirmCard  — confirmación de acción protegida (antes de ejecutar)
   · AiLearned      — píldora "aprendí esto"
   · AiPresenceBar  — presencia de iA activa en varios módulos a la vez
   · AiTag          — marca pequeña "iA" reutilizable
   ============================================================ */
const Ck = window.CG.color;
const Fk = window.CG.font;

/* Marca compacta "iA" (chispa) */
function AiTag({ size = 12, label = "iA", color }) {
  const c = color || Ck.red;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, font:`800 ${size-1}px/1 ${Fk.ui}`,
      letterSpacing:"0.04em", color:c }}>
      <Icon name="sparkles" size={size} color={c} strokeWidth={2.4} /> {label}
    </span>
  );
}
window.AiTag = AiTag;

/* ---------- AiField ----------
   Campo numérico que iA puede pre-rellenar. Estados:
   · vacío + iA tiene propuesta  → muestra valor fantasma + ✓ aceptar
   · aceptado / escrito a mano   → valor firme
   El usuario SIEMPRE confirma (filosofía "con OK del usuario"). */
function AiField({ suggestion, unit = "kg", value, onCommit, placeholder = "0", width = 92, hint }) {
  const [val, setVal] = useState(value ?? "");
  const [accepted, setAccepted] = useState(value != null && value !== "");
  const hasSug = suggestion != null && !accepted && (val === "" || val == null);
  const accept = () => { setVal(String(suggestion)); setAccepted(true); onCommit && onCommit(+suggestion, "ia"); };
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:6 }} title={hint}>
      <div style={{ position:"relative", width }}>
        <input value={val} placeholder={hasSug ? "" : placeholder} inputMode="decimal"
          onChange={(e)=>{ setVal(e.target.value); setAccepted(false); }}
          onBlur={(e)=>{ const n=parseFloat(e.target.value); if(!isNaN(n)){ setAccepted(true); onCommit && onCommit(n,"user"); } }}
          onKeyDown={(e)=>{ if(e.key==="Enter") e.target.blur(); }}
          style={{ width:"100%", textAlign:"right", font:`700 13.5px/1 ${Fk.mono}`,
            color: accepted?Ck.ink:Ck.ink, background:Ck.paper2, padding:"9px 30px 9px 10px",
            border:`1.5px solid ${accepted?Ck.green:(hasSug?Ck.redSoft:Ck.line)}`, borderRadius:9, outline:"none" }} />
        {hasSug && (
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)",
            font:`700 13.5px/1 ${Fk.mono}`, color:Ck.redSoft, pointerEvents:"none", opacity:0.85 }}>{suggestion}</span>
        )}
        <span style={{ position:"absolute", right:9, top:"50%", transform:"translateY(-50%)",
          font:`500 10px/1 ${Fk.ui}`, color:Ck.inkFaint, pointerEvents:"none" }}>{unit}</span>
      </div>
      {hasSug ? (
        <button onClick={accept} title={`iA propone ${suggestion} ${unit} · clic para aceptar`} style={{ width:30, height:30,
          borderRadius:8, border:"none", cursor:"pointer", background:Ck.ink, display:"grid", placeItems:"center", flexShrink:0 }}>
          <Icon name="sparkles" size={15} color={Ck.redSoft} />
        </button>
      ) : accepted ? (
        <span style={{ width:30, height:30, display:"grid", placeItems:"center", flexShrink:0 }}>
          <Icon name="check" size={16} color={Ck.green} />
        </span>
      ) : <span style={{ width:30, flexShrink:0 }} />}
    </div>
  );
}
window.AiField = AiField;

/* ---------- AiSuggestBar ----------
   Acción propuesta por iA a nivel de sección. Variantes por tono. */
function AiSuggestBar({ tone = "sugerencia", title, text, primary, onPrimary, secondary, onSecondary, onDismiss, busy }) {
  const map = {
    ok:{ c:Ck.green, w:Ck.greenWash }, sugerencia:{ c:Ck.red, w:Ck.redWash },
    aviso:{ c:Ck.amber, w:Ck.amberWash }, alerta:{ c:Ck.red, w:Ck.redWash }, info:{ c:Ck.blue, w:Ck.blueWash },
  }[tone] || { c:Ck.red, w:Ck.redWash };
  return (
    <div style={{ display:"flex", gap:13, alignItems:"flex-start", padding:"13px 15px", borderRadius:13,
      background:Ck.paper, border:`1px solid ${Ck.line}`, borderLeft:`3px solid ${map.c}` }}>
      <AntonellaAvatar size={34} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
          <AiTag /> <span style={{ font:`800 13px/1.2 ${Fk.ui}`, color:Ck.ink }}>{title}</span>
        </div>
        <p style={{ margin:"0 0 10px", font:`400 13px/1.5 ${Fk.ui}`, color:Ck.ink80, textWrap:"pretty" }}>{text}</p>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {primary && (
            <button onClick={onPrimary} disabled={busy} style={{ display:"inline-flex", alignItems:"center", gap:7,
              font:`700 12.5px/1 ${Fk.ui}`, color:Ck.cream, background:Ck.ink, border:"none", padding:"9px 14px",
              borderRadius:999, cursor:"pointer", opacity:busy?0.6:1 }}>
              <Icon name={busy?"loader":"sparkles"} size={14} color={Ck.redSoft} /> {busy?"Aplicando…":primary}
            </button>
          )}
          {secondary && (
            <button onClick={onSecondary} style={{ font:`700 12.5px/1 ${Fk.ui}`, color:Ck.ink, background:"transparent",
              border:`1px solid ${Ck.line}`, padding:"9px 14px", borderRadius:999, cursor:"pointer" }}>{secondary}</button>
          )}
        </div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} style={{ background:"transparent", border:"none", cursor:"pointer", color:Ck.inkFaint, lineHeight:0, padding:3 }}>
          <Icon name="x" size={16} color={Ck.inkFaint} />
        </button>
      )}
    </div>
  );
}
window.AiSuggestBar = AiSuggestBar;

/* ---------- AiConfirmCard ----------
   Confirmación de acción protegida (iA va a MODIFICAR datos). */
function AiConfirmCard({ title = "Acción protegida", rows = [], onConfirm, onCancel, confirmLabel = "Confirmar" }) {
  return (
    <div style={{ borderRadius:14, border:`1px solid ${Ck.amber}`, background:Ck.amberWash, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", gap:9, padding:"12px 15px", borderBottom:`1px solid ${Ck.amber}33` }}>
        <Icon name="lock" size={16} color={Ck.amber} />
        <span style={{ font:`800 13px/1 ${Fk.ui}`, color:Ck.amber, letterSpacing:"0.02em" }}>{title}</span>
      </div>
      <div style={{ padding:"12px 15px" }}>
        {rows.map((r,i)=>(
          <div key={i} style={{ display:"flex", justifyContent:"space-between", gap:12, padding:"5px 0",
            borderBottom:i<rows.length-1?`1px solid ${Ck.amber}22`:"none" }}>
            <span style={{ font:`500 12.5px/1 ${Fk.ui}`, color:Ck.ink80 }}>{r[0]}</span>
            <span style={{ font:`700 12.5px/1 ${Fk.mono}`, color:Ck.ink }}>{r[1]}</span>
          </div>
        ))}
        <div style={{ display:"flex", gap:9, marginTop:13 }}>
          <button onClick={onConfirm} style={{ flex:1, font:`700 13px/1 ${Fk.ui}`, color:"#fff", background:Ck.green,
            border:"none", padding:"11px", borderRadius:10, cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:7 }}>
            <Icon name="check" size={15} color="#fff" /> {confirmLabel}
          </button>
          <button onClick={onCancel} style={{ font:`700 13px/1 ${Fk.ui}`, color:Ck.ink, background:"transparent",
            border:`1px solid ${Ck.amber}`, padding:"11px 16px", borderRadius:10, cursor:"pointer" }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
window.AiConfirmCard = AiConfirmCard;

/* ---------- AiLearned ----------
   Píldora discreta: iA aprendió/registró algo del comportamiento del usuario. */
function AiLearned({ children, onUndo }) {
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:9, padding:"8px 12px", borderRadius:999,
      background:Ck.blueWash, border:`1px solid ${Ck.blue}22` }}>
      <Icon name="brain" size={14} color={Ck.blue} />
      <span style={{ font:`600 12px/1.3 ${Fk.ui}`, color:Ck.ink80 }}>
        <b style={{ color:Ck.blue }}>iA aprendió:</b> {children}</span>
      {onUndo && <button onClick={onUndo} style={{ font:`700 11px/1 ${Fk.ui}`, color:Ck.blue, background:"transparent",
        border:"none", cursor:"pointer", textDecoration:"underline" }}>deshacer</button>}
    </div>
  );
}
window.AiLearned = AiLearned;

/* ---------- AiPresenceBar ----------
   iA presente en varios módulos a la vez (vigilancia transversal). */
function AiPresenceBar({ items = [], onOpen }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 15px", borderRadius:13,
      background:`radial-gradient(140% 180% at 0% 0%, ${Ck.chrome2}, ${Ck.chrome})`, border:`1px solid ${Ck.line}` }}>
      <AntonellaAvatar size={36} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ font:`800 12.5px/1 ${Fk.ui}`, color:Ck.cream, marginBottom:8 }}>iAntonella vigilando {items.length} módulos</div>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
          {items.map((it,i)=>(
            <button key={i} onClick={()=>onOpen&&onOpen(it.id)} style={{ display:"inline-flex", alignItems:"center", gap:6,
              font:`700 11px/1 ${Fk.ui}`, color:Ck.cream, background:"rgba(241,231,214,0.08)",
              border:`1px solid ${it.tone==="alerta"?Ck.redSoft:it.tone==="aviso"?Ck.amber:"rgba(241,231,214,0.18)"}`,
              padding:"6px 9px", borderRadius:999, cursor:"pointer" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", flexShrink:0,
                background: it.tone==="alerta"?Ck.redSoft:it.tone==="aviso"?Ck.amber:it.tone==="ok"?Ck.green:Ck.tan }} />
              {it.label}{it.count ? <span style={{ opacity:0.7 }}>· {it.count}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
window.AiPresenceBar = AiPresenceBar;

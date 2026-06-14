/* ============================================================
   iAntonella — presencia inline + chat global
   ============================================================ */
const Cn = window.CG.color;
const Fn = window.CG.font;

const TONE = {
  ok:        { dot: Cn.green, tag:"Todo en orden",  tagBg: Cn.greenWash, tagFg: Cn.green },
  sugerencia:{ dot: Cn.tan,   tag:"Sugerencia",     tagBg: Cn.tanWash,   tagFg: Cn.ink80 },
  aviso:     { dot: Cn.amber, tag:"Aviso",          tagBg: Cn.amberWash, tagFg: Cn.amber },
  alerta:    { dot: Cn.red,   tag:"Alerta",         tagBg: Cn.redWash,   tagFg: Cn.red },
};

/* Slot inline de Antonella dentro de un módulo */
function AntonellaSlot({ data, onChip, onOpen, onNav }) {
  const [open, setOpen] = useState(true);
  if (!data) return null;
  const t = TONE[data.tone] || TONE.sugerencia;
  const runAction = (a) => {
    if (typeof a === "object" && a.go) { onNav ? onNav(a.go) : (window.__cgGo && window.__cgGo(a.go)); return; }
    const label = typeof a === "object" ? (a.ask || a.label) : a;
    onChip && onChip(label);
  };
  return (
    <div style={{ position:"relative", borderRadius:18, marginBottom:18,
      background:`linear-gradient(180deg, ${Cn.paper} 0%, ${Cn.paper2} 100%)`,
      border:`1px solid ${Cn.line}`, overflow:"hidden" }}>
      {/* filo superior con color de tono (sutil, no banda lateral) */}
      <div style={{ height:3, background:t.dot, opacity:0.85 }} />
      <div style={{ display:"flex", gap:14, padding:"15px 16px 16px", alignItems:"flex-start" }}>
        <AntonellaAvatar size={40} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:5 }}>
            <span style={{ font:`800 13px/1 ${Fn.ui}`, color:Cn.ink, letterSpacing:"0.01em" }}>iAntonella</span>
            <span style={{ width:3, height:3, borderRadius:"50%", background:Cn.inkFaint }} />
            <span style={{ font:`600 12px/1 ${Fn.ui}`, color:Cn.inkSoft }}>{data.titulo}</span>
            <span style={{ font:`700 10px/1 ${Fn.ui}`, letterSpacing:"0.06em", textTransform:"uppercase",
              color:t.tagFg, background:t.tagBg, padding:"4px 7px", borderRadius:999 }}>{t.tag}</span>
          </div>
          {open && (
            <>
              <p style={{ margin:"0 0 12px", font:`400 14px/1.55 ${Fn.ui}`, color:Cn.ink80, textWrap:"pretty" }}>
                {data.texto}
              </p>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {(data.acciones||[]).map((a,i)=>{
                  const label = typeof a === "object" ? a.label : a;
                  const ic = typeof a === "object" ? a.icon : null;
                  return (
                  <button key={i} onClick={()=>runAction(a)} className="cg-chip" style={{
                    font:`700 12.5px/1 ${Fn.ui}`, color: i===0?Cn.chromeFg:Cn.ink,
                    background: i===0?Cn.chrome:"transparent",
                    border:`1px solid ${i===0?Cn.chrome:Cn.line}`, padding:"8px 12px",
                    borderRadius:999, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6 }}>
                    {(ic || i===0) && <Icon name={ic || "sparkles"} size={13} color={i===0?Cn.redSoft:Cn.inkSoft} />}
                    {label}
                  </button>
                  );
                })}
                <button onClick={()=>onOpen&&onOpen()} className="cg-chip" style={{
                  font:`700 12.5px/1 ${Fn.ui}`, color:Cn.inkSoft, background:"transparent",
                  border:"1px solid transparent", padding:"8px 10px", borderRadius:999, cursor:"pointer",
                  display:"inline-flex", alignItems:"center", gap:6, marginLeft:"auto" }}>
                  Preguntar más <Icon name="arrow-right" size={14} color={Cn.inkSoft} />
                </button>
              </div>
            </>
          )}
        </div>
        <button onClick={()=>setOpen(o=>!o)} title={open?"Ocultar":"Mostrar"} style={{
          background:"transparent", border:"none", cursor:"pointer", color:Cn.inkFaint, lineHeight:0, padding:4 }}>
          <Icon name={open?"chevron-up":"chevron-down"} size={18} color={Cn.inkFaint} />
        </button>
      </div>
    </div>
  );
}
window.AntonellaSlot = AntonellaSlot;

/* Burbuja de mensaje — con timestamp, acciones opcionales */
function Bubble({ from, text, actions, timestamp }) {
  const mine = from === "me";
  const ts = timestamp || new Date().toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit" });
  return (
    <div style={{ display:"flex", justifyContent: mine?"flex-end":"flex-start", marginBottom:12, flexDirection: mine?"row-reverse":"row", gap:8, alignItems:"flex-end" }}>
      {!mine && <div style={{ marginTop:2, flexShrink:0 }}><AntonellaAvatar size={28} /></div>}
      <div style={{ maxWidth:"80%", display:"flex", flexDirection:"column", gap:5 }}>
        <div style={{ font:`400 14px/1.5 ${Fn.ui}`, textWrap:"pretty",
          color: mine?Cn.chromeFg:Cn.ink80,
          background: mine?Cn.chrome:Cn.paper2,
          border: mine?"none":`1px solid ${Cn.line}`,
          padding:"10px 13px",
          borderRadius: mine?"14px 14px 4px 14px":"14px 14px 14px 4px" }}>
          {text}
        </div>
        <span style={{ font:`500 10px/1 ${Fn.mono}`, color:Cn.inkFaint, paddingX: mine?13:0, textAlign: mine?"right":"left" }}>{ts}</span>
        {actions && actions.length>0 && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", paddingX: mine?0:37 }}>
            {actions.map((a,i)=>(
              <button key={i} onClick={a.onClick} style={{ font:`700 11px/1 ${Fn.ui}`,
                color:Cn.ink, background:Cn.paper, border:`1px solid ${Cn.line}`, padding:"6px 10px",
                borderRadius:8, cursor:"pointer", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:4 }}>
                {a.icon && <Icon name={a.icon} size={12} color={Cn.inkSoft} />}{a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* Dock global: launcher flotante + drawer de chat "centro de mando" (controlado) */
function AntonellaDock({ moduleId, pending, open, setOpen, seed, onSeedConsumed }) {
  const chat = window.CG.chat;
  const chips = chat.chips[moduleId] || chat.chips.default;
  const [msgs, setMsgs] = useState([{ from:"ai", text: chat.greeting }]);
  const [text, setText] = useState("");
  const [ctx, setCtx] = useState(null);           // pestaña de contexto abierta (mini-dashboard)
  const bodyRef = useRef(null);

  useEffect(()=>{ if(bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [msgs, open]);

  // Cuando un chip del slot inyecta una pregunta
  useEffect(()=>{
    if(seed){ send(seed); onSeedConsumed && onSeedConsumed(); }
    // eslint-disable-next-line
  }, [seed]);

  const reply = (q) => {
    const key = q.trim().toLowerCase();
    const r = chat.replies[key] || chat.replies.default;
    setTimeout(()=> setMsgs(m=>[...m, { from:"ai", text:r }]), 380);
  };
  const send = (q) => {
    const v = (q ?? text).trim(); if(!v) return;
    setMsgs(m=>[...m, { from:"me", text:v }]); setText(""); reply(v);
  };

  const ctxData = ctx ? chat.context[ctx] : null;
  const toneColor = { ok:Cn.green, alerta:Cn.red, aviso:Cn.amber, sugerencia:Cn.tan,
    ink:Cn.ink, green:Cn.green, red:Cn.red, amber:Cn.amber, blue:Cn.blue };

  return (
    <>
      {/* Launcher */}
      <button onClick={()=>setOpen(o=>!o)} aria-label="Abrir iAntonella" style={{
        position:"fixed", right:22, bottom:22, zIndex:80, cursor:"pointer",
        display:"flex", alignItems:"center", gap:11, padding: open?"0":"8px 16px 8px 8px",
        height:58, borderRadius:999, border:`1px solid ${Cn.chrome}`,
        background:Cn.chrome,
        boxShadow:"0 14px 34px -12px rgba(0,0,0,0.5)" }}>
        <div style={{ position:"relative" }}>
          <AntonellaAvatar size={42} />
          {pending && !open && <span style={{ position:"absolute", top:-1, right:-1, width:12, height:12,
            borderRadius:"50%", background:Cn.redSoft, border:`2px solid ${Cn.chrome}` }} />}
        </div>
        {!open && <span style={{ font:`800 14px/1 ${Fn.ui}`, color:Cn.chromeFg, paddingRight:4 }}>iAntonella</span>}
      </button>

      {/* Drawer */}
      <div style={{ position:"fixed", top:0, right:0, bottom:0, width:"min(440px, 96vw)", zIndex:90,
        transform: open?"translateX(0)":"translateX(106%)", transition:"transform .34s cubic-bezier(.22,1,.36,1)",
        background:Cn.bg, borderLeft:`1px solid ${Cn.line}`, boxShadow:"-30px 0 60px -30px rgba(33,28,25,0.5)",
        display:"flex", flexDirection:"column" }}>
        {/* header */}
        <div style={{ background:Cn.chrome, color:Cn.chromeFg, padding:"15px 16px", display:"flex",
          alignItems:"center", gap:12, flexShrink:0 }}>
          <AntonellaAvatar size={42} />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ font:`800 16px/1.1 ${Fn.ui}` }}>iAntonella</div>
            <div style={{ font:`500 12px/1.3 ${Fn.ui}`, color:"rgba(241,231,214,0.7)", display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:Cn.green }} />
              El cerebro del sistema · en línea
            </div>
          </div>
          <button onClick={()=>setOpen(false)} style={{ background:"transparent", border:"none", cursor:"pointer", color:Cn.chromeFg, lineHeight:0 }}>
            <Icon name="x" size={22} color={Cn.chromeFg} />
          </button>
        </div>

        {/* tira de cards de notificación */}
        <div style={{ display:"flex", gap:9, overflowX:"auto", padding:"12px 14px 4px", flexShrink:0,
          background:`linear-gradient(180deg, ${Cn.chrome} 0%, ${Cn.bg} 100%)` }} className="cg-cards-strip">
          {chat.cards.map((c,i)=>{
            const col = toneColor[c.tone] || Cn.tan;
            return (
              <div key={i} style={{ flexShrink:0, width:150, background:Cn.paper, borderLeft:`1px solid ${Cn.line}`,
                borderRight:`1px solid ${Cn.line}`, borderBottom:`1px solid ${Cn.line}`, borderTop:`2px solid ${col}`,
                borderRadius:11, padding:"10px 11px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:7 }}>
                  <Icon name={c.icon} size={13} color={col} />
                  <span style={{ font:`700 9.5px/1 ${Fn.ui}`, letterSpacing:"0.05em", textTransform:"uppercase", color:Cn.inkFaint }}>{c.label}</span>
                </div>
                <div style={{ font:`400 19px/1 ${Fn.display}`, color:Cn.ink }}>{c.value}</div>
                <div style={{ font:`500 10px/1.3 ${Fn.ui}`, color:Cn.inkSoft, marginTop:4 }}>{c.sub}</div>
              </div>
            );
          })}
        </div>

        {/* pestañas de contexto (mini-dashboards) */}
        <div style={{ display:"flex", gap:7, overflowX:"auto", padding:"10px 14px", flexShrink:0 }}>
          {Object.entries(chat.context).map(([k,v])=>{
            const on = ctx===k;
            return (
              <button key={k} onClick={()=>setCtx(on?null:k)} style={{ flexShrink:0, display:"inline-flex",
                alignItems:"center", gap:6, font:`700 12px/1 ${Fn.ui}`, padding:"8px 12px", borderRadius:999,
                cursor:"pointer", border:`1px solid ${on?"transparent":Cn.line}`,
                color:on?Cn.chromeFg:Cn.inkSoft, background:on?Cn.chrome:Cn.paper }}>
                <Icon name={v.icon} size={13} color={on?Cn.chromeFg:Cn.inkSoft} /> {v.label}
                <Icon name={on?"chevron-up":"chevron-down"} size={13} color={on?Cn.chromeFg:Cn.inkFaint} />
              </button>
            );
          })}
        </div>

        {/* mini-dashboard desplegable */}
        {ctxData && (
          <div className="cg-ctx-in" style={{ margin:"0 14px 8px", padding:"13px 14px", borderRadius:14,
            background:Cn.paper, border:`1px solid ${Cn.line}`, flexShrink:0 }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:9, marginBottom:12 }}>
              {ctxData.stats.map((s,i)=>(
                <div key={i} style={{ textAlign:"left" }}>
                  <div style={{ font:`400 18px/1 ${Fn.display}`, color:toneColor[s.tone]||Cn.ink }}>{s.value}</div>
                  <div style={{ font:`600 9px/1.2 ${Fn.ui}`, letterSpacing:"0.03em", textTransform:"uppercase", color:Cn.inkFaint, marginTop:5 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* Carrusel de últimos pedidos (solo en contexto Pedidos) */}
            {ctx==="pedidos" && (
              <div style={{ overflowX:"auto", display:"flex", gap:9, marginBottom:12, paddingBottom:4 }}>
                {window.CG.ops.pedidos.map(p=>{
                  const map = { "Pagada":[Cn.green,"Pagado"], "Lista para cobro":[Cn.blue,"Listo"],
                    "Procesando pago":[Cn.blue,"Cobrando"], "Por pesar":[Cn.amber,"Por pesar"],
                    "Parcial":[Cn.amber,"Parcial"], "Cancelada":[Cn.red,"Cancelado"] };
                  const [col,lab] = map[p.estado]||[Cn.inkFaint,p.estado];
                  const toWeigh = p.estado==="Por pesar"||p.estado==="Parcial";
                  return (
                    <button key={p.id} onClick={()=>{ setCtx(null); setOpen(false); window.__cgGo && window.__cgGo(toWeigh?"bascula":"pedidos"); }}
                      style={{ flexShrink:0, width:132, textAlign:"left", cursor:"pointer", background:Cn.paper2,
                        border:`1px solid ${Cn.line}`, borderLeft:`3px solid ${col}`, borderRadius:10, padding:"9px 10px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                        <span style={{ font:`700 12px/1 ${Fn.mono}`, color:Cn.ink }}>#{p.id}</span>
                        <span style={{ font:`500 9.5px/1 ${Fn.ui}`, color:Cn.inkFaint }}>{p.items} pz</span>
                      </div>
                      <div style={{ font:`700 11px/1.2 ${Fn.ui}`, color:Cn.ink80, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:7 }}>{p.cliente}</div>
                      <span style={{ font:`800 8px/1 ${Fn.ui}`, letterSpacing:"0.04em", textTransform:"uppercase", color:col,
                        border:`1px solid ${col}`, padding:"3px 6px", borderRadius:5 }}>{lab}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"11px 12px", borderRadius:11,
              background:Cn.tanWash }}>
              <AntonellaAvatar size={28} />
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:"0 0 9px", font:`400 12.5px/1.5 ${Fn.ui}`, color:Cn.ink80, textWrap:"pretty" }}>{ctxData.tip}</p>
                <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                  {ctxData.actions.map((a,i)=>{
                    const label = typeof a==="object"?a.label:a;
                    const ic = typeof a==="object"?a.icon:(i===0?"sparkles":null);
                    const run = ()=>{ if(typeof a==="object" && a.go){ setCtx(null); setOpen(false); window.__cgGo && window.__cgGo(a.go); }
                      else { setCtx(null); send(typeof a==="object"?(a.ask||a.label):a); } };
                    return (
                    <button key={i} onClick={run} style={{ font:`700 11.5px/1 ${Fn.ui}`,
                      color: i===0?Cn.chromeFg:Cn.ink, background:i===0?Cn.chrome:"transparent",
                      border:`1px solid ${i===0?Cn.chrome:Cn.line}`, padding:"7px 11px", borderRadius:999, cursor:"pointer",
                      display:"inline-flex", alignItems:"center", gap:5 }}>
                      {ic && <Icon name={ic} size={12} color={i===0?Cn.redSoft:Cn.inkSoft} />}{label}
                    </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* body de chat */}
        <div ref={bodyRef} style={{ flex:1, minHeight:80, overflowY:"auto", padding:"8px 16px 6px",
          borderTop:`1px solid ${Cn.lineSoft}` }}>
          {msgs.map((m,i)=><Bubble key={i} from={m.from==="me"?"me":"ai"} text={m.text} />)}
        </div>
        {/* chips */}
        <div style={{ display:"flex", gap:8, overflowX:"auto", padding:"4px 16px 12px", flexShrink:0 }}>
          {chips.map((c,i)=>(
            <button key={i} onClick={()=>send(c)} style={{ flexShrink:0, font:`700 12.5px/1 ${Fn.ui}`,
              color:Cn.ink, background:Cn.paper, border:`1px solid ${Cn.line}`, padding:"9px 12px",
              borderRadius:999, cursor:"pointer", whiteSpace:"nowrap" }}>{c}</button>
          ))}
        </div>
        {/* input */}
        <div style={{ padding:"0 14px 16px", display:"flex", gap:9, alignItems:"center", flexShrink:0 }}>
          <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
            placeholder="Pregunta o da una instrucción…" style={{ flex:1, font:`400 14px/1 ${Fn.ui}`,
            color:Cn.ink, background:Cn.paper, border:`1px solid ${Cn.line}`, borderRadius:12,
            padding:"13px 14px", outline:"none" }} />
          <button onClick={()=>send()} style={{ width:46, height:46, borderRadius:12, flexShrink:0,
            background:Cn.red, border:"none", cursor:"pointer", display:"grid", placeItems:"center" }}>
            <Icon name="arrow-up" size={20} color="#fff" />
          </button>
        </div>
      </div>
      {open && <div onClick={()=>setOpen(false)} style={{ position:"fixed", inset:0, zIndex:85,
        background:"rgba(33,28,25,0.32)" }} />}
    </>
  );
}
window.AntonellaDock = AntonellaDock;

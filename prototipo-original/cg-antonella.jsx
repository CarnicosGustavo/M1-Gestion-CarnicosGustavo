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
function AntonellaSlot({ data, onChip, onOpen }) {
  const [open, setOpen] = useState(true);
  if (!data) return null;
  const t = TONE[data.tone] || TONE.sugerencia;
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
                {(data.acciones||[]).map((a,i)=>(
                  <button key={i} onClick={()=>onChip&&onChip(a)} className="cg-chip" style={{
                    font:`700 12.5px/1 ${Fn.ui}`, color: i===0?Cn.chromeFg:Cn.ink,
                    background: i===0?Cn.chrome:"transparent",
                    border:`1px solid ${i===0?Cn.chrome:Cn.line}`, padding:"8px 12px",
                    borderRadius:999, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:6 }}>
                    {i===0 && <Icon name="sparkles" size={13} color={Cn.redSoft} />}
                    {a}
                  </button>
                ))}
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

/* Burbuja de mensaje */
function Bubble({ from, text }) {
  const mine = from === "me";
  return (
    <div style={{ display:"flex", justifyContent: mine?"flex-end":"flex-start", marginBottom:12 }}>
      {!mine && <div style={{ marginRight:9, marginTop:2 }}><AntonellaAvatar size={28} /></div>}
      <div style={{ maxWidth:"80%", font:`400 14px/1.5 ${Fn.ui}`, textWrap:"pretty",
        color: mine?Cn.chromeFg:Cn.ink80,
        background: mine?Cn.chrome:Cn.paper2,
        border: mine?"none":`1px solid ${Cn.line}`,
        padding:"10px 13px",
        borderRadius: mine?"14px 14px 4px 14px":"14px 14px 14px 4px" }}>
        {text}
      </div>
    </div>
  );
}

/* Dock global: launcher flotante + drawer de chat (controlado) */
function AntonellaDock({ moduleId, pending, open, setOpen, seed, onSeedConsumed }) {
  const chat = window.CG.chat;
  const chips = chat.chips[moduleId] || chat.chips.default;
  const [msgs, setMsgs] = useState([{ from:"ai", text: chat.greeting }]);
  const [text, setText] = useState("");
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
      <div style={{ position:"fixed", top:0, right:0, bottom:0, width:"min(420px, 92vw)", zIndex:90,
        transform: open?"translateX(0)":"translateX(106%)", transition:"transform .32s cubic-bezier(.22,1,.36,1)",
        background:Cn.bg, borderLeft:`1px solid ${Cn.line}`, boxShadow:"-30px 0 60px -30px rgba(33,28,25,0.5)",
        display:"flex", flexDirection:"column" }}>
        {/* header */}
        <div style={{ background:Cn.chrome, color:Cn.chromeFg, padding:"16px 16px", display:"flex",
          alignItems:"center", gap:12 }}>
          <AntonellaAvatar size={44} />
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
        {/* body */}
        <div ref={bodyRef} style={{ flex:1, overflowY:"auto", padding:"16px 16px 6px" }}>
          <div style={{ textAlign:"center", margin:"4px 0 16px" }}>
            <span style={{ font:`600 11px/1 ${Fn.ui}`, color:Cn.inkFaint, letterSpacing:"0.04em" }}>
              Conoce inventario · despiece · pesaje · pedidos · cobranza
            </span>
          </div>
          {msgs.map((m,i)=><Bubble key={i} from={m.from==="me"?"me":"ai"} text={m.text} />)}
        </div>
        {/* chips */}
        <div style={{ display:"flex", gap:8, overflowX:"auto", padding:"4px 16px 12px" }}>
          {chips.map((c,i)=>(
            <button key={i} onClick={()=>send(c)} style={{ flexShrink:0, font:`700 12.5px/1 ${Fn.ui}`,
              color:Cn.ink, background:Cn.paper, border:`1px solid ${Cn.line}`, padding:"9px 12px",
              borderRadius:999, cursor:"pointer", whiteSpace:"nowrap" }}>{c}</button>
          ))}
        </div>
        {/* input */}
        <div style={{ padding:"0 14px 16px", display:"flex", gap:9, alignItems:"center" }}>
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

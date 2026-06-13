/* ============================================================
   Shell de la app + temas + ensamblado — Cárnicos Gustavo
   ============================================================ */
const Ca = window.CG.color;   // objeto vivo (se muta al cambiar tema)
const Fa = window.CG.font;
const MODS = window.CG.modules;

/* -------- Rail lateral -------- */
function Rail({ current, go }) {
  const op = MODS.filter(m=>m.group==="op");
  const [cfgOpen, setCfgOpen] = useState(false);
  const cfgActive = window.CG.configItems.some(i=>i.id===current) || current==="config";

  const Item = (m)=> {
    const on = current===m.id;
    return (
      <button key={m.id} onClick={()=>go(m.id)} title={m.label} className="cg-rail-item" style={{
        position:"relative", width:46, height:46, borderRadius:13, cursor:"pointer",
        display:"grid", placeItems:"center", border:"none",
        background: on?Ca.railActive:"transparent",
        color: on?Ca.railFg:Ca.railFgDim }}>
        <Icon name={m.icon} size={21} color={on?Ca.railFg:Ca.railFgDim} />
        <span className="cg-rail-label">{m.label}</span>
      </button>
    );
  };

  const onGear = ()=>{
    if (window.innerWidth < 880) { go("config"); return; }
    setCfgOpen(o=>!o);
  };

  return (
    <nav className="cg-rail" style={{ background:Ca.railBg, display:"flex", flexDirection:"column",
      alignItems:"center", gap:7, padding:"14px 9px", flexShrink:0 }}>
      <div onClick={()=>go("panel")} style={{ cursor:"pointer", marginBottom:6 }}><PigBadge size={42} /></div>
      {op.map(Item)}
      <div style={{ width:24, height:1, background:Ca.railFgDim, opacity:0.3, margin:"5px 0" }} />
      {/* Engrane de Configuración con submenú */}
      <div style={{ position:"relative" }}>
        <button onClick={onGear} title="Configuración" className="cg-rail-item" style={{
          position:"relative", width:46, height:46, borderRadius:13, cursor:"pointer",
          display:"grid", placeItems:"center", border:"none",
          background: cfgActive?Ca.railActive:"transparent", color: cfgActive?Ca.railFg:Ca.railFgDim }}>
          <Icon name="settings" size={21} color={cfgActive?Ca.railFg:Ca.railFgDim} />
          <span className="cg-rail-label">Configuración</span>
        </button>
        {cfgOpen && (
          <>
            <div onClick={()=>setCfgOpen(false)} style={{ position:"fixed", inset:0, zIndex:40 }} />
            <div className="cg-pop" style={{ position:"absolute", left:"100%", bottom:0, marginLeft:12, zIndex:41,
              width:208, background:Ca.paper, border:`1px solid ${Ca.line}`, borderRadius:14,
              boxShadow:Ca.shadow, padding:7 }}>
              <div style={{ font:`700 10px/1 ${Fa.ui}`, letterSpacing:"0.1em", textTransform:"uppercase",
                color:Ca.inkFaint, padding:"8px 10px 6px" }}>Configuración</div>
              {window.CG.configItems.map(it=>{
                const on=current===it.id;
                return (
                  <button key={it.id} onClick={()=>{ go(it.id); setCfgOpen(false); }} style={{ width:"100%",
                    display:"flex", alignItems:"center", gap:11, padding:"10px 10px", borderRadius:9, cursor:"pointer",
                    border:"none", background: on?Ca.paper2:"transparent", color:Ca.ink, textAlign:"left",
                    font:`${on?700:600} 13.5px/1 ${Fa.ui}` }}
                    onMouseEnter={e=>e.currentTarget.style.background=Ca.paper2}
                    onMouseLeave={e=>e.currentTarget.style.background=on?Ca.paper2:"transparent"}>
                    <Icon name={it.icon} size={17} color={on?Ca.red:Ca.inkSoft} />
                    {it.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </nav>
  );
}

/* -------- Control de tema (paleta + claro/oscuro) -------- */
function ThemeControl({ palette, mode, setTheme }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      <button onClick={()=>setOpen(o=>!o)} title="Apariencia" className="cg-btn" style={{
        width:38, height:38, borderRadius:"50%", border:`1px solid ${Ca.line}`, background:Ca.paper2,
        cursor:"pointer", display:"grid", placeItems:"center" }}>
        <Icon name="palette" size={18} color={Ca.inkSoft} />
      </button>
      {open && (
        <>
          <div onClick={()=>setOpen(false)} style={{ position:"fixed", inset:0, zIndex:40 }} />
          <div style={{ position:"absolute", right:0, top:"calc(100% + 10px)", zIndex:41, width:230,
            background:Ca.paper, border:`1px solid ${Ca.line}`, borderRadius:14, boxShadow:Ca.shadow, padding:14 }}>
            <div style={{ font:`700 10px/1 ${Fa.ui}`, letterSpacing:"0.1em", textTransform:"uppercase",
              color:Ca.inkFaint, marginBottom:10 }}>Paleta</div>
            <div style={{ display:"flex", gap:9, marginBottom:16 }}>
              {window.CG.palettes.map(p=>{
                const on=palette===p.id;
                return (
                  <button key={p.id} onClick={()=>setTheme(p.id, mode)} style={{ flex:1, cursor:"pointer",
                    border:`2px solid ${on?Ca.red:Ca.line}`, borderRadius:12, padding:"9px 8px", background:Ca.paper2 }}>
                    <div style={{ display:"flex", gap:3, justifyContent:"center", marginBottom:7 }}>
                      {p.swatch.map((s,i)=><span key={i} style={{ width:15, height:15, borderRadius:"50%",
                        background:s, border:`1px solid ${Ca.line}` }} />)}
                    </div>
                    <div style={{ font:`700 12px/1 ${Fa.ui}`, color:on?Ca.red:Ca.ink }}>{p.name}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ font:`700 10px/1 ${Fa.ui}`, letterSpacing:"0.1em", textTransform:"uppercase",
              color:Ca.inkFaint, marginBottom:10 }}>Modo</div>
            <div style={{ display:"flex", gap:7 }}>
              {[["light","Claro","sun"],["dark","Oscuro","moon"]].map(([id,lab,ic])=>{
                const on=mode===id;
                return (
                  <button key={id} onClick={()=>setTheme(palette, id)} style={{ flex:1, cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:7, padding:"10px 8px",
                    borderRadius:10, font:`700 13px/1 ${Fa.ui}`,
                    color: on?Ca.railFg:Ca.ink, background: on?Ca.railBg:Ca.paper2,
                    border:`1px solid ${on?Ca.railBg:Ca.line}` }}>
                    <Icon name={ic} size={15} color={on?Ca.railFg:Ca.inkSoft} /> {lab}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TopBar({ current, theme }) {
  return (
    <header className="cg-top" style={{ height:60, flexShrink:0, background:Ca.paper,
      borderBottom:`1px solid ${Ca.line}`, display:"grid", gridTemplateColumns:"1fr auto 1fr",
      alignItems:"center", padding:"0 18px", position:"relative", zIndex:30 }}>
      <div style={{ font:`400 20px/1 ${Fa.display}`, color:Ca.ink, letterSpacing:"0.02em" }}>{window.CG.labelOf(current)}</div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", lineHeight:1 }}>
        <div style={{ font:`600 9px/1 ${Fa.ui}`, letterSpacing:"0.32em", color:Ca.red, marginBottom:3 }}>CÁRNICOS</div>
        <div style={{ font:`400 17px/1 ${Fa.display}`, color:Ca.ink, letterSpacing:"0.04em" }}>GUSTAVO</div>
      </div>
      <div style={{ justifySelf:"end", display:"flex", alignItems:"center", gap:10 }}>
        <ThemeControl palette={theme.palette} mode={theme.mode} setTheme={theme.set} />
        <div style={{ width:38, height:38, borderRadius:"50%", border:`1px solid ${Ca.line}`, background:Ca.paper2,
          display:"grid", placeItems:"center" }}>
          <Icon name="user" size={19} color={Ca.inkSoft} />
        </div>
      </div>
    </header>
  );
}

/* -------- Pantalla de bloqueo (privacidad) — PIN 0000 -------- */
function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const tap = (k) => {
    setErr(false);
    if (k === "←") { setPin(p => p.slice(0, -1)); return; }
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        if (next === "0000") onUnlock();
        else { setErr(true); setPin(""); }
      }, 120);
    }
  };
  useEffect(() => {
    const onKey = (e) => {
      if (/^[0-9]$/.test(e.key)) tap(e.key);
      else if (e.key === "Backspace") tap("←");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div style={{ position:"fixed", inset:0, zIndex:300, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", gap:18, padding:"20px", overflow:"auto",
      background:`radial-gradient(120% 90% at 50% 0%, ${Ca.chrome2||Ca.chrome} 0%, ${Ca.chrome} 70%)` }}>
      {/* logo */}
      <div style={{ width:104, height:104, borderRadius:"50%", overflow:"hidden", background:Ca.cream, flexShrink:0,
        boxShadow:"0 24px 60px -20px rgba(0,0,0,0.6)", backgroundImage:"url(assets/logo-principal.png)",
        backgroundSize:"86%", backgroundRepeat:"no-repeat", backgroundPosition:"center" }} />
      <div style={{ textAlign:"center" }}>
        <div style={{ font:`400 24px/1.1 ${Fa.display}`, color:Ca.cream, letterSpacing:"0.02em", whiteSpace:"nowrap" }}>CÁRNICOS GUSTAVO</div>
        <div style={{ font:`500 12.5px/1 ${Fa.ui}`, color:"rgba(241,231,214,0.55)", marginTop:8 }}>Ingresa tu PIN para entrar</div>
      </div>
      {/* dots */}
      <div className={err?"cg-shake":""} style={{ display:"flex", gap:14 }}>
        {[0,1,2,3].map(i=>(
          <span key={i} style={{ width:14, height:14, borderRadius:"50%",
            background: i<pin.length ? (err?Ca.red:Ca.cream) : "transparent",
            border:`2px solid ${err?Ca.red:"rgba(241,231,214,0.4)"}`, transition:"background .15s" }} />
        ))}
      </div>
      {/* keypad */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 66px)", gap:12, flexShrink:0 }}>
        {["1","2","3","4","5","6","7","8","9","",  "0","←"].map((k,i)=> k==="" ?
          <span key={i} /> :
          <button key={i} onClick={()=>tap(k)} className="cg-lock-key" style={{ height:66, borderRadius:"50%",
            border:`1px solid rgba(241,231,214,0.18)`, background:"rgba(241,231,214,0.06)", color:Ca.cream,
            font:`400 24px/1 ${k==="←"?Fa.ui:Fa.display}`, cursor:"pointer", display:"grid", placeItems:"center" }}>
            {k==="←" ? "⌫" : k}
          </button>
        )}
      </div>
      <div style={{ font:`500 11px/1 ${Fa.ui}`, color:"rgba(241,231,214,0.4)", flexShrink:0 }}>PIN de demostración: 0000</div>
    </div>
  );
}

function App() {
  const [locked, setLocked] = useState(() => sessionStorage.getItem("cg_unlocked") !== "1");
  const [current, setCurrent] = useState("panel");
  const [chatOpen, setChatOpen] = useState(false);
  const [seed, setSeed] = useState(null);
  const [palette, setPalette] = useState("warm");
  const [mode, setMode] = useState("light");

  // Cargar tema guardado
  useEffect(()=>{
    const p = localStorage.getItem("cg_palette") || "warm";
    const m = localStorage.getItem("cg_mode") || "light";
    window.CG.applyTheme(p, m); setPalette(p); setMode(m);
    document.body.style.background = window.CG.color.bg;
  }, []);

  const setTheme = (p, m)=>{
    window.CG.applyTheme(p, m);
    localStorage.setItem("cg_palette", p); localStorage.setItem("cg_mode", m);
    document.body.style.background = window.CG.color.bg;
    setPalette(p); setMode(m);
  };

  const ai = {
    chip: (t)=>{ setSeed(t); setChatOpen(true); },
    open: ()=> setChatOpen(true),
  };
  const go = (id)=>{ setCurrent(id); const main=document.querySelector(".cg-main"); if(main) main.scrollTop=0; };
  useEffect(()=>{ window.__cgGo = go; }, []);

  const screens = {
    panel:    <PanelScreen ai={ai} />,
    compra:   <CompraScreen ai={ai} />,
    pedidos:  <PedidosScreen ai={ai} />,
    despiece: <DespieceScreen ai={ai} />,
    bascula:  <BasculaScreen ai={ai} />,
    cobro:    <CobroScreen ai={ai} />,
    rendimiento: <RendimientoScreen ai={ai} />,
    cobranza: <CobranzaScreen ai={ai} />,
    clientes: <ClientesScreen ai={ai} />,
    pos:      <PosScreen ai={ai} />,
    recetas:  <RecetasScreen ai={ai} />,
    productos:<ProductosScreen ai={ai} />,
    precios:  <PreciosScreen ai={ai} />,
    cold:     <ColdInventoryScreen ai={ai} />,
    caja:     <CajaScreen ai={ai} />,
    config:   <ConfigScreen ai={ai} go={go} />,
    settings: <ConfigScreen ai={ai} go={go} />,
  };
  const content = screens[current] || <PlaceholderScreen id={current} ai={ai} />;
  const theme = { palette, mode, set:setTheme };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:Ca.bg }}>
      {locked && <LockScreen onUnlock={()=>{ sessionStorage.setItem("cg_unlocked","1"); setLocked(false); }} />}
      <div style={{ filter: locked ? "blur(14px)" : "none", transition:"filter .4s ease",
        display:"flex", flexDirection:"column", height:"100%", pointerEvents: locked?"none":"auto" }}>
        <TopBar current={current} theme={theme} />
        <div className="cg-body-row" style={{ display:"flex", flex:1, minHeight:0 }}>
          <Rail current={current} go={go} />
          <main className="cg-main" style={{ flex:1, overflowY:"auto", padding:"22px clamp(16px,3vw,32px) 90px" }}>
            <div style={{ maxWidth:1180, margin:"0 auto" }}>{content}</div>
          </main>
        </div>
        <AntonellaDock moduleId={current} pending={true} open={chatOpen} setOpen={setChatOpen}
          seed={seed} onSeedConsumed={()=>setSeed(null)} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

/* ============================================================
   SISTEMA DE DISEÑO — librería completa de componentes
   ============================================================ */
const Cd = window.CG.color;
const Fd = window.CG.font;

/* utilidades de sección */
function DsSection({ id, title, desc, children, cols = "1fr" }) {
  return (
    <section id={id} style={{ marginBottom:34, scrollMarginTop:14 }}>
      <div style={{ marginBottom:14 }}>
        <h2 style={{ margin:0, font:`400 22px/1 ${Fd.display}`, color:Cd.ink, letterSpacing:"0.01em" }}>{title}</h2>
        {desc && <p style={{ margin:"6px 0 0", font:`400 13.5px/1.5 ${Fd.ui}`, color:Cd.inkSoft, maxWidth:620 }}>{desc}</p>}
      </div>
      {children}
    </section>
  );
}

/* Menú lateral fijo del sistema de diseño */
const DS_NAV = [
  ["portada","Portada","home"],
  ["colores","Colores","palette"],
  ["tipografia","Tipografía","type"],
  ["botones","Botones","square-mouse-pointer"],
  ["campos","Campos","text-cursor-input"],
  ["selectores","Selectores","list"],
  ["fechas","Fechas y toggles","calendar"],
  ["estados","Estados","tags"],
  ["tablas","Tablas y avisos","table"],
  ["kit","Kit iAntonella","sparkles"],
  ["logos","Logos y personajes","shapes"],
];
function DsNav({ active, onGo }) {
  return (
    <nav className="cg-ds-nav" style={{ position:"sticky", top:0, alignSelf:"start" }}>
      <Card pad={8}>
        {DS_NAV.map(([id,label,icon])=>{
          const on = active===id;
          return (
            <button key={id} onClick={()=>onGo(id)} style={{ width:"100%", display:"flex", alignItems:"center", gap:10,
              padding:"9px 11px", borderRadius:9, cursor:"pointer", border:"none", textAlign:"left", marginBottom:2,
              background: on?Cd.red:"transparent", color: on?"#fff":Cd.ink80,
              font:`${on?700:600} 12.5px/1.1 ${Fd.ui}` }}
              onMouseEnter={e=>{ if(!on) e.currentTarget.style.background=Cd.paper2; }}
              onMouseLeave={e=>{ if(!on) e.currentTarget.style.background="transparent"; }}>
              <Icon name={icon} size={16} color={on?"#fff":Cd.inkSoft} /> {label}
            </button>
          );
        })}
      </Card>
    </nav>
  );
}

/* Tarjeta de logo (fondo controlado para que se vea en claro y oscuro) */
function LogoTile({ src, label, bg, h = 120, span }) {
  return (
    <div style={{ gridColumn: span?`span ${span}`:"auto", borderRadius:14, overflow:"hidden", border:`1px solid ${Cd.line}` }}>
      <div style={{ height:h, background:bg, display:"grid", placeItems:"center", padding:18 }}>
        <img src={src} alt={label} style={{ maxHeight:"100%", maxWidth:"100%", objectFit:"contain" }} />
      </div>
      <div style={{ padding:"10px 12px", background:Cd.paper, font:`600 12px/1.3 ${Fd.ui}`, color:Cd.ink80 }}>{label}</div>
    </div>
  );
}

/* Tarjeta de personaje */
function CharacterTile({ src, name, role, accent }) {
  return (
    <div style={{ borderRadius:14, border:`1px solid ${Cd.line}`, background:Cd.paper, padding:16, textAlign:"center" }}>
      <div style={{ width:96, height:96, borderRadius:"50%", margin:"0 auto 12px", overflow:"hidden",
        backgroundImage:`url(${src})`, backgroundSize:"cover", backgroundPosition:"center",
        boxShadow:`0 0 0 3px ${accent}22` }} />
      <div style={{ font:`700 15px/1.1 ${Fd.ui}`, color:Cd.ink }}>{name}</div>
      <div style={{ font:`600 11.5px/1.3 ${Fd.ui}`, color:accent, marginTop:4, letterSpacing:"0.02em" }}>{role}</div>
    </div>
  );
}
function DsBlock({ label, children, style }) {
  return (
    <Card pad={18} style={style}>
      {label && <Overline style={{ marginBottom:14 }}>{label}</Overline>}
      {children}
    </Card>
  );
}
const dsRow = { display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" };

/* ---- controles que faltaban en el kit ---- */
function Switch({ on:onProp = false, label }) {
  const [on, setOn] = useState(onProp);
  return (
    <label style={{ display:"inline-flex", alignItems:"center", gap:10, cursor:"pointer" }}>
      <span onClick={()=>setOn(o=>!o)} style={{ width:42, height:24, borderRadius:999, flexShrink:0,
        background:on?Cd.green:Cd.tan, position:"relative", transition:"background .18s ease" }}>
        <span style={{ position:"absolute", top:2, left:on?20:2, width:20, height:20, borderRadius:"50%",
          background:"#fff", transition:"left .18s ease", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" }} />
      </span>
      {label && <span style={{ font:`600 13px/1 ${Fd.ui}`, color:Cd.ink }}>{label}</span>}
    </label>
  );
}
function Check({ label, on:onProp = false }) {
  const [on, setOn] = useState(onProp);
  return (
    <label onClick={()=>setOn(o=>!o)} style={{ display:"inline-flex", alignItems:"center", gap:9, cursor:"pointer" }}>
      <span style={{ width:20, height:20, borderRadius:6, flexShrink:0, display:"grid", placeItems:"center",
        background:on?Cd.red:Cd.paper2, border:`1.5px solid ${on?Cd.red:Cd.line}` }}>
        {on && <Icon name="check" size={14} color="#fff" />}
      </span>
      <span style={{ font:`600 13px/1 ${Fd.ui}`, color:Cd.ink }}>{label}</span>
    </label>
  );
}
function Radio({ options, value:v0 }) {
  const [v, setV] = useState(v0 ?? options[0]);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
      {options.map(o=>(
        <label key={o} onClick={()=>setV(o)} style={{ display:"inline-flex", alignItems:"center", gap:9, cursor:"pointer" }}>
          <span style={{ width:20, height:20, borderRadius:"50%", flexShrink:0, display:"grid", placeItems:"center",
            background:Cd.paper2, border:`1.5px solid ${v===o?Cd.red:Cd.line}` }}>
            {v===o && <span style={{ width:10, height:10, borderRadius:"50%", background:Cd.red }} />}
          </span>
          <span style={{ font:`600 13px/1 ${Fd.ui}`, color:Cd.ink }}>{o}</span>
        </label>
      ))}
    </div>
  );
}
function Segmented({ options, value:v0 }) {
  const [v, setV] = useState(v0 ?? options[0]);
  return (
    <div style={{ display:"inline-flex", borderRadius:10, border:`1px solid ${Cd.line}`, overflow:"hidden" }}>
      {options.map(o=>{
        const on=v===o;
        return <button key={o} onClick={()=>setV(o)} style={{ font:`700 12.5px/1 ${Fd.ui}`, padding:"10px 14px",
          cursor:"pointer", border:"none", color:on?Cd.chromeFg:Cd.inkSoft, background:on?Cd.chrome:Cd.paper }}>{o}</button>;
      })}
    </div>
  );
}
function Stepper2({ v0 = 1 }) {
  const [v,setV]=useState(v0);
  return (
    <div style={{ display:"inline-flex", alignItems:"center", border:`1px solid ${Cd.line}`, borderRadius:10, overflow:"hidden" }}>
      <button onClick={()=>setV(x=>Math.max(0,x-1))} style={{ width:34, height:38, border:"none", background:Cd.paper2, cursor:"pointer", font:`700 17px/1 ${Fd.ui}`, color:Cd.ink }}>−</button>
      <span style={{ minWidth:34, textAlign:"center", font:`700 14px/1 ${Fd.mono}`, color:Cd.ink }}>{v}</span>
      <button onClick={()=>setV(x=>x+1)} style={{ width:34, height:38, border:"none", background:Cd.paper2, cursor:"pointer", font:`700 17px/1 ${Fd.ui}`, color:Cd.ink }}>+</button>
    </div>
  );
}
function FieldInput({ icon, placeholder, value, suffix, type, w }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:9, border:`1px solid ${Cd.line}`, borderRadius:10,
      padding:"11px 13px", background:Cd.paper2, width:w||"auto", minWidth:0 }}>
      {icon && <Icon name={icon} size={16} color={Cd.inkFaint} />}
      <input defaultValue={value} placeholder={placeholder} type={type||"text"}
        style={{ flex:1, border:"none", background:"transparent", outline:"none", font:`500 14px/1 ${Fd.ui}`, color:Cd.ink, minWidth:0 }} />
      {suffix && <span style={{ font:`500 12px/1 ${Fd.ui}`, color:Cd.inkFaint }}>{suffix}</span>}
    </div>
  );
}

/* ---- mini date picker (popover de calendario) ---- */
function DateField() {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(12);
  const days = Array.from({length:30},(_,i)=>i+1);
  return (
    <div style={{ position:"relative", display:"inline-block" }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ display:"inline-flex", alignItems:"center", gap:9,
        border:`1px solid ${Cd.line}`, borderRadius:10, padding:"11px 13px", background:Cd.paper2, cursor:"pointer",
        font:`600 14px/1 ${Fd.mono}`, color:Cd.ink }}>
        <Icon name="calendar" size={16} color={Cd.inkSoft} /> {String(sel).padStart(2,"0")}/06/2026
        <Icon name="chevron-down" size={15} color={Cd.inkFaint} />
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:20, background:Cd.paper,
          border:`1px solid ${Cd.line}`, borderRadius:13, padding:14, boxShadow:Cd.shadow, width:248 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <Icon name="chevron-left" size={16} color={Cd.inkSoft} />
            <span style={{ font:`700 13px/1 ${Fd.ui}`, color:Cd.ink }}>Junio 2026</span>
            <Icon name="chevron-right" size={16} color={Cd.inkSoft} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
            {["L","M","M","J","V","S","D"].map((d,i)=><div key={i} style={{ textAlign:"center", font:`700 10px/1 ${Fd.ui}`, color:Cd.inkFaint, padding:"4px 0" }}>{d}</div>)}
            {days.map(d=>{
              const on=d===sel;
              return <button key={d} onClick={()=>{setSel(d);setOpen(false);}} style={{ aspectRatio:"1", border:"none", borderRadius:7,
                cursor:"pointer", font:`600 12px/1 ${Fd.mono}`, color:on?"#fff":Cd.ink80, background:on?Cd.red:"transparent" }}>{d}</button>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* estados de pedido (de la guía) */
const ESTADOS = [
  ["Pagada","green"],["Lista para cobro","blue"],["Procesando pago","blue"],
  ["Por pesar","amber"],["Parcial","amber"],["Cancelada","red"],["Pendiente","amber"],["Producción","blue"],
];

function DesignSystemScreen({ ai }) {
  const [showDialog, setShowDialog] = useState(false);
  const [toast, setToast] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [applied, setApplied] = useState(false);
  const [active, setActive] = useState("portada");

  const scroller = () => {
    const main = document.querySelector(".cg-main");
    return (main && main.offsetParent !== null) ? main : (document.scrollingElement || document.documentElement);
  };
  const goTo = (id) => {
    const el = document.getElementById(id); if(!el) return;
    const c = scroller();
    const target = el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - 12;
    setActive(id);
    // tween manual (el smooth nativo no es confiable en este entorno)
    const start = c.scrollTop, dist = target - start, t0 = performance.now(), dur = 420;
    const ease = (p)=> 1 - Math.pow(1-p, 3);
    const step = (now)=>{ const p = Math.min(1,(now-t0)/dur); c.scrollTop = start + dist*ease(p); if(p<1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  useEffect(()=>{
    const main = document.querySelector(".cg-main");
    const target = main || window;
    const onScroll = () => {
      let cur = DS_NAV[0][0];
      for (const [id] of DS_NAV) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top < 130) cur = id; }
      setActive(cur);
    };
    target.addEventListener("scroll", onScroll, { passive:true });
    onScroll();
    return ()=> target.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div>
      {/* PORTADA con logo grande */}
      <div id="portada" style={{ scrollMarginTop:14, marginBottom:24 }}>
        <div style={{ borderRadius:20, overflow:"hidden", border:`1px solid ${Cd.line}`, background:"#F1E7D6",
          display:"grid", placeItems:"center", padding:"40px 24px 34px" }}>
          <img src="assets/logo-principal.png" alt="Cárnicos Gustavo"
            style={{ height:200, maxWidth:"86%", objectFit:"contain" }} />
        </div>
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:16, flexWrap:"wrap", marginTop:18 }}>
          <div>
            <h1 style={{ margin:0, font:`400 34px/1 ${Fd.display}`, color:Cd.ink, letterSpacing:"0.01em" }}>Sistema de Diseño</h1>
            <p style={{ margin:"8px 0 0", font:`400 14px/1.5 ${Fd.ui}`, color:Cd.inkSoft, maxWidth:600 }}>
              La caja de herramientas de Cárnicos Gustavo: cada botón, selector, campo, patrón y personaje listo para reusar en cualquier módulo. Lo que ves aquí ya está construido.</p>
          </div>
          <Badge tone="green" icon="check-circle-2">Librería lista</Badge>
        </div>
      </div>

      {/* LAYOUT: menú lateral fijo + contenido */}
      <div className="cg-ds-grid" style={{ display:"grid", gridTemplateColumns:"196px 1fr", gap:22, alignItems:"start" }}>
        <DsNav active={active} onGo={goTo} />
        <div style={{ minWidth:0 }}>

      {/* COLORES */}
      <DsSection id="colores" title="Colores" desc="Marca (negro cálido + rojo ladrillo + crema) y paleta semántica de estado tomada de la guía.">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12 }}>
          {[["Tinta",Cd.ink],["Rojo marca",Cd.red],["Crema",Cd.cream],["Kraft",Cd.tan],
            ["Verde · OK",Cd.green],["Ámbar · pendiente",Cd.amber],["Azul · proceso",Cd.blue],["Rojo · saldo",Cd.red]].map(([n,c],i)=>(
            <div key={i} style={{ borderRadius:12, overflow:"hidden", border:`1px solid ${Cd.line}` }}>
              <div style={{ height:54, background:c }} />
              <div style={{ padding:"9px 11px", background:Cd.paper }}>
                <div style={{ font:`700 12px/1 ${Fd.ui}`, color:Cd.ink }}>{n}</div>
                <div style={{ font:`500 10.5px/1 ${Fd.mono}`, color:Cd.inkFaint, marginTop:3 }}>{c}</div>
              </div>
            </div>
          ))}
        </div>
      </DsSection>

      {/* TIPOGRAFÍA */}
      <DsSection id="tipografia" title="Tipografía" desc="Anton para titulares y números grandes, Archivo para interfaz, JetBrains Mono para pesos y precios.">
        <DsBlock>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><span style={{ font:`400 38px/1 ${Fd.display}`, color:Cd.ink }}>GUSTAVO 105 kg</span><div style={dsTag}>Anton · display</div></div>
            <div><span style={{ font:`700 20px/1.2 ${Fd.ui}`, color:Cd.ink }}>Texto de interfaz en negrita</span><div style={dsTag}>Archivo 700</div></div>
            <div><span style={{ font:`400 16px/1.4 ${Fd.ui}`, color:Cd.ink80 }}>Texto corrido para descripciones y ayuda.</span><div style={dsTag}>Archivo 400</div></div>
            <div><span style={{ font:`600 18px/1 ${Fd.mono}`, color:Cd.ink }}>$ 1,284.50 · 24.9% · 26.10 kg</span><div style={dsTag}>JetBrains Mono · cifras</div></div>
          </div>
        </DsBlock>
      </DsSection>

      {/* BOTONES */}
      <DsSection id="botones" title="Botones" desc="5 variantes × 4 tamaños, con o sin ícono. Mínimo 44px de alto para uso táctil.">
        <DsBlock label="Variantes">
          <div style={dsRow}>
            <Btn kind="primary" icon="plus">Primario</Btn>
            <Btn kind="dark" icon="save">Oscuro</Btn>
            <Btn kind="green" icon="check">Confirmar</Btn>
            <Btn kind="outline" icon="upload">Contorno</Btn>
            <Btn kind="ghost" icon="rotate-ccw">Fantasma</Btn>
            <Btn kind="outline" icon="trash-2" style={{ color:Cd.red, borderColor:Cd.red+"55" }}>Eliminar</Btn>
          </div>
        </DsBlock>
        <div style={{ height:12 }} />
        <DsBlock label="Tamaños · sm / md / lg / xl">
          <div style={dsRow}>
            <Btn kind="primary" size="sm" icon="scissors">sm</Btn>
            <Btn kind="primary" size="md" icon="scissors">md</Btn>
            <Btn kind="primary" size="lg" icon="scissors">lg</Btn>
            <Btn kind="primary" size="xl" icon="scissors">xl</Btn>
            <button style={{ width:46, height:46, borderRadius:10, border:`1px solid ${Cd.line}`, background:Cd.paper2, cursor:"pointer", display:"grid", placeItems:"center" }}><Icon name="printer" size={19} color={Cd.inkSoft} /></button>
          </div>
        </DsBlock>
      </DsSection>

      {/* CAMPOS */}
      <DsSection id="campos" title="Campos de captura" desc="Texto, búsqueda, número con unidad, precio, peso y stepper. Foco verde = válido.">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))", gap:12 }}>
          <DsBlock label="Texto"><FieldInput placeholder="Nombre del negocio" /></DsBlock>
          <DsBlock label="Búsqueda"><FieldInput icon="search" placeholder="Buscar pieza…" /></DsBlock>
          <DsBlock label="Peso (kg)"><FieldInput placeholder="0.000" suffix="kg" /></DsBlock>
          <DsBlock label="Precio"><FieldInput icon="dollar-sign" placeholder="0.00" suffix="/kg" /></DsBlock>
          <DsBlock label="Stepper de piezas"><Stepper2 v0={2} /></DsBlock>
          <DsBlock label="Área de notas">
            <textarea placeholder="Notas del pedido…" rows={2} style={{ width:"100%", resize:"vertical", border:`1px solid ${Cd.line}`,
              borderRadius:10, padding:"10px 12px", background:Cd.paper2, outline:"none", font:`500 13px/1.4 ${Fd.ui}`, color:Cd.ink }} />
          </DsBlock>
        </div>
      </DsSection>

      {/* SELECTORES */}
      <DsSection id="selectores" title="Selectores" desc="Select nativo, combobox con búsqueda, segmentado y chips de filtro.">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))", gap:12 }}>
          <DsBlock label="Select">
            <div style={{ position:"relative" }}>
              <select style={{ width:"100%", appearance:"none", border:`1px solid ${Cd.line}`, borderRadius:10,
                padding:"12px 36px 12px 13px", background:Cd.paper2, font:`600 14px/1 ${Fd.ui}`, color:Cd.ink, cursor:"pointer", outline:"none" }}>
                <option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option>
              </select>
              <Icon name="chevron-down" size={16} color={Cd.inkFaint} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
            </div>
          </DsBlock>
          <DsBlock label="Combobox (cliente)">
            <div style={{ display:"flex", alignItems:"center", gap:9, border:`1px solid ${Cd.line}`, borderRadius:10, padding:"11px 13px", background:Cd.paper2 }}>
              <Icon name="user" size={16} color={Cd.inkSoft} />
              <span style={{ flex:1, font:`700 14px/1 ${Fd.ui}`, color:Cd.ink }}>Carnicería Marenco</span>
              <Icon name="chevrons-up-down" size={15} color={Cd.inkFaint} />
            </div>
          </DsBlock>
          <DsBlock label="Segmentado"><Segmented options={["Tablero","Tabla","Mapa"]} /></DsBlock>
          <DsBlock label="Chips de filtro">
            <div style={dsRow}>
              <Badge tone="ink">Todos</Badge><Badge tone="ghost">Padre</Badge><Badge tone="ghost">Hijo</Badge><Badge tone="ghost">Sin stock</Badge>
            </div>
          </DsBlock>
        </div>
      </DsSection>

      {/* FECHAS + SWITCHES */}
      <div id="fechas" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:22, scrollMarginTop:14 }}>
        <DsSection title="Fechas" desc="Campo de fecha con calendario y accesos rápidos.">
          <DsBlock>
            <div style={{ display:"flex", flexDirection:"column", gap:12, alignItems:"flex-start" }}>
              <DateField />
              <div style={dsRow}><Btn kind="outline" size="sm" icon="rotate-ccw">Hoy</Btn><Btn kind="ghost" size="sm">Días guardados</Btn></div>
            </div>
          </DsBlock>
        </DsSection>
        <DsSection title="Switches, checks y radios">
          <DsBlock>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={dsRow}><Switch onProp={true} label="Activa" /><Switch label="A granel" /></div>
              <div style={dsRow}><Check on={true} label="Factura (NFC-e)" /><Check label="¿Es pieza padre?" /></div>
              <Radio options={["Contado","Crédito"]} />
            </div>
          </DsBlock>
        </DsSection>
      </div>

      {/* ESTADOS */}
      <DsSection id="estados" title="Estados y etiquetas" desc="Lenguaje de estado del pedido y puntos de categoría de pieza, consistentes en todos los módulos.">
        <DsBlock label="Estados de pedido">
          <div style={dsRow}>{ESTADOS.map(([n,t])=><Badge key={n} tone={t}>{n}</Badge>)}</div>
        </DsBlock>
        <div style={{ height:12 }} />
        <DsBlock label="Categorías de pieza (color de origen)">
          <div style={dsRow}>
            {Object.entries(window.CG.catColors).map(([cat,c])=>(
              <span key={cat} style={{ display:"inline-flex", alignItems:"center", gap:7, font:`700 12px/1 ${Fd.ui}`, color:Cd.ink80 }}>
                <span style={{ width:11, height:11, borderRadius:"50%", background:c }} />{cat}</span>
            ))}
          </div>
        </DsBlock>
      </DsSection>

      {/* TABLAS / DIÁLOGO / TOAST */}
      <DsSection id="tablas" title="Tablas, diálogos y avisos">
        <DsBlock label="Fila de tabla">
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>{["Producto","Piezas","Kg","Subtotal"].map((h,i)=>(
              <th key={i} style={{ textAlign:i?"right":"left", font:`700 11px/1 ${Fd.ui}`, letterSpacing:"0.05em", textTransform:"uppercase", color:Cd.inkFaint, padding:"0 8px 10px" }}>{h}</th>))}</tr></thead>
            <tbody>{[["LOMO AMERICANO","2","16.54","$1,290.12"],["PIERNA","2","26.10","$1,827.00"]].map((r,i)=>(
              <tr key={i} style={{ borderTop:`1px solid ${Cd.lineSoft}` }}>
                <td style={{ padding:"11px 8px", font:`700 13px/1 ${Fd.ui}`, color:Cd.ink }}>{r[0]}</td>
                {r.slice(1).map((c,j)=><td key={j} style={{ padding:"11px 8px", textAlign:"right", font:`600 13px/1 ${Fd.mono}`, color:Cd.ink80 }}>{c}</td>)}
              </tr>))}</tbody>
          </table>
        </DsBlock>
        <div style={{ height:12 }} />
        <div style={dsRow}>
          <Btn kind="outline" icon="layout-panel-top" onClick={()=>setShowDialog(true)}>Ver diálogo</Btn>
          <Btn kind="outline" icon="bell" onClick={()=>{ setToast(true); setTimeout(()=>setToast(false),2600); }}>Lanzar toast</Btn>
          <div style={{ display:"flex", gap:7 }}>
            {[0,1,2].map(i=><div key={i} style={{ width:90, height:14, borderRadius:7, background:Cd.paper2 }} />)}
            <span style={{ font:`500 12px/1.3 ${Fd.ui}`, color:Cd.inkFaint, alignSelf:"center" }}>skeleton de carga</span>
          </div>
        </div>
      </DsSection>

      {/* KIT iANTONELLA */}
      <DsSection id="kit" title="Kit de iAntonella" desc="El lenguaje con el que la IA trabaja DENTRO de cada módulo: propone valores, sugiere acciones, confirma lo delicado, aprende y vigila varios módulos a la vez. Siempre con tu OK.">
        <DsBlock label="Presencia transversal (multi-módulo)">
          <AiPresenceBar onOpen={()=>ai.open()} items={[
            { id:"compra", label:"Compra", tone:"aviso", count:"merma" },
            { id:"despiece", label:"Despiece", tone:"alerta" },
            { id:"bascula", label:"Báscula", tone:"ok" },
            { id:"cobro", label:"Cobro", tone:"aviso", count:"$0/kg" },
            { id:"recetas", label:"Recetas", tone:"alerta" },
          ]} />
        </DsBlock>
        <div style={{ height:12 }} />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:12 }}>
          <DsBlock label="Valor propuesto en un campo (autoconfig)">
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                <span style={{ font:`700 13px/1 ${Fd.ui}`, color:Cd.ink }}>LOMO AMERICANO <span style={{ color:Cd.inkFaint, fontWeight:500 }}>· 15.8%</span></span>
                <AiField suggestion={16.54} unit="kg" hint="iA estima 16.54 kg desde el % guardado" />
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                <span style={{ font:`700 13px/1 ${Fd.ui}`, color:Cd.ink }}>PIERNA <span style={{ color:Cd.inkFaint, fontWeight:500 }}>· 24.9%</span></span>
                <AiField value={26.10} unit="kg" />
              </div>
              <span style={{ font:`500 11.5px/1.4 ${Fd.ui}`, color:Cd.inkFaint }}>El número tenue es la propuesta de iA · la palomita es un valor ya confirmado.</span>
            </div>
          </DsBlock>
          <DsBlock label="Aprendizaje">
            <div style={{ display:"flex", flexDirection:"column", gap:10, alignItems:"flex-start" }}>
              <AiLearned onUndo={()=>{}}>el CUERO de Marenco se pesa en Tambo Azul (tara 2.5 kg).</AiLearned>
              <AiLearned>el americano rinde 15.8% de lomo este mes (subió 0.4 pts).</AiLearned>
            </div>
          </DsBlock>
        </div>
        <div style={{ height:12 }} />
        <DsBlock label="Acción propuesta a nivel sección">
          {applied
            ? <AiLearned>apliqué la estimación a 14 piezas. Revisa y guarda cuando quieras.</AiLearned>
            : <AiSuggestBar tone="sugerencia" title="Estimar pesos desde los %"
                text="Puedo rellenar los 14 pesos del CANAL AMERICANO usando los porcentajes guardados y el peso del canal (105 kg). Tú confirmas antes de guardar."
                primary="Aplicar estimación" onPrimary={()=>setApplied(true)}
                secondary="Ahora no" onSecondary={()=>{}} onDismiss={()=>{}} />}
        </DsBlock>
        <div style={{ height:12 }} />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:12 }}>
          <DsBlock label="Confirmación de acción protegida">
            {confirm
              ? <AiLearned>despiece ejecutado. Stock actualizado.</AiLearned>
              : <AiConfirmCard title="¡Acción protegida!" confirmLabel="Despiezar"
                  rows={[["Acción","Despiezar canal"],["Tipo","CANAL AMERICANO"],["Cantidad","2 canales"],["Genera","+4 pierna, +4 lomo…"]]}
                  onConfirm={()=>setConfirm(true)} onCancel={()=>{}} />}
          </DsBlock>
          <DsBlock label="Burbuja de chat + chip">
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ display:"flex", gap:9 }}>
                <AntonellaAvatar size={28} />
                <div style={{ font:`400 13.5px/1.5 ${Fd.ui}`, color:Cd.ink80, background:Cd.paper2, border:`1px solid ${Cd.line}`, padding:"10px 13px", borderRadius:"14px 14px 14px 4px" }}>
                  Hoy no te conviene despiezar americanos: 0 pedidos los demandan.</div>
              </div>
              <div style={dsRow}>
                <span style={{ font:`700 12.5px/1 ${Fd.ui}`, color:Cd.cream, background:Cd.ink, padding:"8px 12px", borderRadius:999, display:"inline-flex", gap:6, alignItems:"center" }}><Icon name="sparkles" size={13} color={Cd.redSoft} />Despiezar solo lo pedido</span>
                <span style={{ font:`700 12.5px/1 ${Fd.ui}`, color:Cd.ink, border:`1px solid ${Cd.line}`, padding:"8px 12px", borderRadius:999 }}>Ver pedidos</span>
              </div>
            </div>
          </DsBlock>
        </div>
      </DsSection>

      {/* LOGOS Y PERSONAJES */}
      <DsSection id="logos" title="Logos y personajes" desc="El logo de marca en sus versiones, y los personajes del universo Cárnicos Gustavo. iAntonella es la inteligencia del sistema; Christopher, el agente de atención.">
        <DsBlock label="Logotipo de marca">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12 }}>
            <LogoTile src="assets/logo-principal.png" label="Principal · apilado (sobre claro)" bg="#F1E7D6" h={150} />
            <LogoTile src="assets/logo-christopher-horizontal.png" label="Horizontal · sobre oscuro" bg="#211C19" h={150} />
            <LogoTile src="assets/pig-head.png" label="Isotipo · insignia del rail" bg="#211C19" h={150} />
          </div>
        </DsBlock>
        <div style={{ height:12 }} />
        <DsBlock label="Personajes">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12 }}>
            <CharacterTile src="assets/iantonella-rojo.png" name="iAntonella" role="Inteligencia del sistema" accent={Cd.red} />
            <CharacterTile src="assets/gustavo-icono.png" name="Gustavo" role="Marca / fundador" accent={Cd.ink} />
            <CharacterTile src="assets/logo-christopher-apilado.png" name="Christopher" role="Agente de atención" accent={Cd.red} />
          </div>
          <div style={{ height:12 }} />
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", padding:"12px 14px",
            borderRadius:12, background:Cd.blueWash, border:`1px solid ${Cd.blue}22` }}>
            <Icon name="info" size={16} color={Cd.blue} />
            <span style={{ font:`500 12.5px/1.4 ${Fd.ui}`, color:Cd.ink80 }}>
              El ícono de iAntonella (cerdita con monóculo) es su avatar en todo el sistema: slots, chat y launcher. Tiene versión sobre rojo y sobre claro.</span>
          </div>
        </DsBlock>
      </DsSection>

        </div>{/* /columna de contenido */}
      </div>{/* /layout 2 columnas */}

      {/* DIALOG OVERLAY */}
      {showDialog && (
        <div onClick={()=>setShowDialog(false)} style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(33,28,25,0.45)", display:"grid", placeItems:"center", padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:"min(420px,94vw)", background:Cd.paper, borderRadius:16, border:`1px solid ${Cd.line}`, boxShadow:Cd.shadow, overflow:"hidden" }}>
            <div style={{ padding:"16px 18px", borderBottom:`1px solid ${Cd.line}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ font:`700 16px/1 ${Fd.ui}`, color:Cd.ink }}>Editar pedido</span>
              <button onClick={()=>setShowDialog(false)} style={{ background:"transparent", border:"none", cursor:"pointer", lineHeight:0 }}><Icon name="x" size={20} color={Cd.inkSoft} /></button>
            </div>
            <div style={{ padding:18, display:"flex", flexDirection:"column", gap:12 }}>
              <FieldInput icon="user" value="Carnicería Marenco" />
              <FieldInput icon="dollar-sign" placeholder="Total" suffix="MXN" />
              <div style={{ display:"flex", gap:9, justifyContent:"flex-end", marginTop:4 }}>
                <Btn kind="ghost" onClick={()=>setShowDialog(false)}>Cancelar</Btn>
                <Btn kind="dark" icon="save" onClick={()=>setShowDialog(false)}>Actualizar</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* TOAST */}
      <div style={{ position:"fixed", bottom:22, left:"50%", transform:`translateX(-50%) translateY(${toast?0:24}px)`,
        opacity:toast?1:0, transition:"all .3s ease", zIndex:210, pointerEvents:"none" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, background:Cd.chrome, color:Cd.cream,
          padding:"13px 18px", borderRadius:12, boxShadow:Cd.shadow, font:`600 13.5px/1 ${Fd.ui}` }}>
          <Icon name="check-circle-2" size={18} color={Cd.green} /> Compra del día guardada
        </div>
      </div>
    </div>
  );
}
const dsTag = { font:`600 10.5px/1 ${Fd.ui}`, color:"#9A9087", marginTop:5, letterSpacing:"0.04em" };

window.DesignSystemScreen = DesignSystemScreen;

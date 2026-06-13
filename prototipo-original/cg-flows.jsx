/* ============================================================
   Flujos operativos reutilizables — Modales
   · NuevoPedidoModal — crear pedido (cliente + artículos + total)
   · PesajeModal      — pesar un producto (peso, tara, registrar)
   ============================================================ */
const Cf = window.CG.color;
const Ff = window.CG.font;
const mnyF = (v) => (window.money ? window.money(v) : "$" + (v||0).toLocaleString("es-MX", { minimumFractionDigits:2, maximumFractionDigits:2 }));

/* ---------------- NUEVO PEDIDO ---------------- */
function NuevoPedidoModal({ open, onClose, onCreate }) {
  const clientes = window.CG.ops.clientes;
  const catalogo = window.CG.ops.pos.catalogo;
  const [cliente, setCliente] = useState("");
  const [lista, setLista] = useState(window.CG.ops.pos.listas[0]);
  const [items, setItems] = useState([]);
  const [pick, setPick] = useState("");

  useEffect(()=>{ if(open){ setCliente(""); setItems([]); setPick(""); setLista(window.CG.ops.pos.listas[0]); } }, [open]);

  const addItem = (name) => {
    const p = catalogo.find(c=>c.n===name); if(!p) return;
    setItems(arr => arr.some(x=>x.n===name) ? arr : [...arr, { n:p.n, precio:p.precio, pz:1, disp:p.disp, cat:p.cat }]);
    setPick("");
  };
  const setPz = (n, d) => setItems(arr => arr.map(x => x.n===n ? { ...x, pz: Math.max(1, x.pz + d) } : x));
  const removeItem = (n) => setItems(arr => arr.filter(x=>x.n!==n));
  const total = items.reduce((s,x)=> s + x.precio * x.pz * 8, 0); // estimado simple
  const needWeigh = items.some(x=>x.disp==="pesaje" || x.disp==="despiece");

  const dispBadge = (d) => {
    const map = { stock:["green","En stock"], despiece:["blue","Por despiece"], pesaje:["amber","Requiere pesaje"], faltante:["red","Faltante"] };
    const [tone,lab] = map[d]||["ghost",d];
    return <Badge tone={tone}>{lab}</Badge>;
  };

  return (
    <Modal open={open} onClose={onClose} icon="receipt-text" title="Nuevo pedido" width={620}
      subtitle="Selecciona el cliente, agrega artículos y crea el pedido. iAntonella validará stock y pesaje."
      footer={
        <>
          <Btn kind="outline" onClick={onClose}>Cancelar</Btn>
          <Btn kind="primary" icon="check" onClick={()=>{ onCreate && onCreate({ cliente, lista, items, total }); onClose(); }}
            style={{ opacity: cliente && items.length ? 1 : 0.5, pointerEvents: cliente && items.length ? "auto" : "none" }}>
            Crear pedido
          </Btn>
        </>
      }>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
        <FormField label="Cliente">
          <div style={{ position:"relative" }}>
            <select value={cliente} onChange={e=>setCliente(e.target.value)} style={selStyle}>
              <option value="">Seleccionar cliente…</option>
              {clientes.map(c=> <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
            </select>
            <Icon name="chevron-down" size={15} color={Cf.inkFaint} style={caret} />
          </div>
        </FormField>
        <FormField label="Lista de precios">
          <div style={{ position:"relative" }}>
            <select value={lista} onChange={e=>setLista(e.target.value)} style={selStyle}>
              {window.CG.ops.pos.listas.map(l=> <option key={l} value={l}>{l}</option>)}
            </select>
            <Icon name="chevron-down" size={15} color={Cf.inkFaint} style={caret} />
          </div>
        </FormField>
      </div>

      <FormField label="Agregar artículo">
        <div style={{ position:"relative" }}>
          <select value={pick} onChange={e=>addItem(e.target.value)} style={selStyle}>
            <option value="">Buscar producto del catálogo…</option>
            {catalogo.map(c=> <option key={c.n} value={c.n}>{c.n} · {mnyF(c.precio)}/kg</option>)}
          </select>
          <Icon name="plus" size={15} color={Cf.red} style={caret} />
        </div>
      </FormField>

      <div style={{ marginTop:14, border:`1px solid ${Cf.line}`, borderRadius:12, overflow:"hidden" }}>
        {items.length===0 ? (
          <div style={{ padding:"26px 16px", textAlign:"center", font:`500 13px/1.5 ${Ff.ui}`, color:Cf.inkFaint }}>
            <Icon name="package-open" size={26} color={Cf.inkFaint} /><br/>Sin artículos todavía. Agrega del catálogo arriba.
          </div>
        ) : items.map((x,i)=>(
          <div key={x.n} style={{ display:"flex", alignItems:"center", gap:11, padding:"11px 13px",
            borderTop: i>0?`1px solid ${Cf.lineSoft}`:"none" }}>
            <span style={{ width:9, height:9, borderRadius:"50%", background:(window.CG.catColors[x.cat]||Cf.inkFaint), flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ font:`700 13.5px/1.1 ${Ff.ui}`, color:Cf.ink }}>{x.n}</div>
              <div style={{ font:`500 11px/1 ${Ff.mono}`, color:Cf.inkFaint, marginTop:4 }}>{mnyF(x.precio)}/kg</div>
            </div>
            {dispBadge(x.disp)}
            <div style={{ display:"flex", alignItems:"center", border:`1px solid ${Cf.line}`, borderRadius:8, overflow:"hidden" }}>
              <button onClick={()=>setPz(x.n,-1)} style={stepF}>−</button>
              <span style={{ minWidth:30, textAlign:"center", font:`700 13px/1 ${Ff.mono}`, color:Cf.ink }}>{x.pz}</span>
              <button onClick={()=>setPz(x.n,1)} style={stepF}>+</button>
            </div>
            <button onClick={()=>removeItem(x.n)} title="Quitar" style={{ background:"transparent", border:"none", cursor:"pointer", lineHeight:0 }}>
              <Icon name="x" size={16} color={Cf.inkFaint} />
            </button>
          </div>
        ))}
      </div>

      {needWeigh && items.length>0 && (
        <div style={{ display:"flex", gap:10, alignItems:"center", marginTop:13, padding:"11px 13px",
          borderRadius:11, background:Cf.amberWash }}>
          <Icon name="scale" size={17} color={Cf.amber} />
          <span style={{ flex:1, font:`600 12.5px/1.4 ${Ff.ui}`, color:Cf.ink80 }}>
            Este pedido incluye piezas que requieren <b>pesaje</b> antes de cobrar. iAntonella lo enviará a la cola de báscula.
          </span>
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16,
        padding:"13px 15px", borderRadius:12, background:Cf.paper2 }}>
        <span style={{ font:`600 12px/1 ${Ff.ui}`, letterSpacing:"0.04em", textTransform:"uppercase", color:Cf.inkSoft }}>Total estimado</span>
        <Stat value={mnyF(total)} size={26} />
      </div>
    </Modal>
  );
}
window.NuevoPedidoModal = NuevoPedidoModal;

/* ---------------- PESAJE DE PRODUCTO ---------------- */
const TARAS = [
  { n:"Sin recipiente", kg:0 },
  { n:"Tambo Azul", kg:1.2 },
  { n:"Caja gris", kg:0.8 },
  { n:"Charola acero", kg:0.45 },
];
function PesajeModal({ open, onClose, producto, onRegister }) {
  const [peso, setPeso] = useState("");
  const [tara, setTara] = useState(TARAS[0]);
  useEffect(()=>{ if(open){ setPeso(""); setTara(TARAS[0]); } }, [open, producto]);
  const neto = Math.max(0, (parseFloat(peso)||0) - tara.kg);
  const p = producto || { n:"PIERNA", pedido:"#358", precio:70 };

  const keypad = ["7","8","9","4","5","6","1","2","3",".","0","←"];
  const tap = (k) => {
    setPeso(v => k==="←" ? v.slice(0,-1) : (k==="." && v.includes(".")) ? v : (v.length<6 ? v + k : v));
  };

  return (
    <Modal open={open} onClose={onClose} icon="scale" title={`Pesar · ${p.n}`} width={560}
      subtitle={`Pedido ${p.pedido||"—"} · captura el peso bruto y selecciona el recipiente (tara).`}
      footer={
        <>
          <Btn kind="outline" onClick={onClose}>Cancelar</Btn>
          <Btn kind="green" icon="check-circle-2" onClick={()=>{ onRegister && onRegister({ producto:p, peso:neto }); onClose(); }}
            style={{ opacity: neto>0?1:0.5, pointerEvents: neto>0?"auto":"none" }}>
            Registrar {neto>0?`${neto.toFixed(2)} kg`:""}
          </Btn>
        </>
      }>
      {/* lectura grande */}
      <div style={{ textAlign:"center", padding:"18px 0 14px", borderRadius:16, background:Cf.chrome, marginBottom:16 }}>
        <div style={{ font:`600 11px/1 ${Ff.ui}`, letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(241,231,214,0.55)", marginBottom:6 }}>Peso neto</div>
        <div style={{ font:`400 64px/1 ${Ff.display}`, color:Cf.cream, letterSpacing:"0.01em" }}>
          {neto.toFixed(2)}<span style={{ font:`600 22px/1 ${Ff.ui}`, color:"rgba(241,231,214,0.6)", marginLeft:8 }}>kg</span>
        </div>
        <div style={{ font:`500 12px/1 ${Ff.mono}`, color:"rgba(241,231,214,0.5)", marginTop:8 }}>
          bruto {(parseFloat(peso)||0).toFixed(2)} − tara {tara.kg.toFixed(2)}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.1fr 1fr", gap:16 }}>
        {/* teclado */}
        <div>
          <FormField label="Peso bruto (báscula)">
            <TextInput value={peso} onChange={e=>setPeso(e.target.value.replace(/[^0-9.]/g,""))} placeholder="0.00"
              right={<span style={{ font:`600 12px/1 ${Ff.ui}`, color:Cf.inkFaint }}>kg</span>} />
          </FormField>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:11 }}>
            {keypad.map(k=>(
              <button key={k} onClick={()=>tap(k)} style={{ padding:"14px 0", borderRadius:10, cursor:"pointer",
                border:`1px solid ${Cf.line}`, background: k==="←"?Cf.paper2:Cf.paper, font:`700 20px/1 ${Ff.mono}`, color:Cf.ink }}>
                {k}
              </button>
            ))}
          </div>
        </div>
        {/* tara + info */}
        <div>
          <FormField label="Recipiente (tara)">
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {TARAS.map(t=>{
                const on = tara.n===t.n;
                return (
                  <button key={t.n} onClick={()=>setTara(t)} style={{ display:"flex", alignItems:"center", gap:9,
                    padding:"11px 12px", borderRadius:10, cursor:"pointer", textAlign:"left",
                    border:`1px solid ${on?Cf.red:Cf.line}`, background:on?Cf.redWash:Cf.paper }}>
                    <span style={{ width:16, height:16, borderRadius:"50%", flexShrink:0, display:"grid", placeItems:"center",
                      border:`2px solid ${on?Cf.red:Cf.line}` }}>
                      {on && <span style={{ width:8, height:8, borderRadius:"50%", background:Cf.red }} />}
                    </span>
                    <span style={{ flex:1, font:`700 13px/1 ${Ff.ui}`, color:Cf.ink }}>{t.n}</span>
                    <span style={{ font:`600 12px/1 ${Ff.mono}`, color:Cf.inkSoft }}>{t.kg.toFixed(2)} kg</span>
                  </button>
                );
              })}
            </div>
          </FormField>
          <div style={{ marginTop:13, padding:"11px 12px", borderRadius:11, background:Cf.tanWash, display:"flex", gap:9 }}>
            <AntonellaAvatar size={26} />
            <span style={{ font:`500 11.5px/1.45 ${Ff.ui}`, color:Cf.ink80 }}>
              Recuerda la tara del <b>{p.n==="PIERNA"?"Tambo Azul (1.2 kg)":"recipiente"}</b>. Si registras varias piezas, las sumo al pedido automáticamente.
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
window.PesajeModal = PesajeModal;

/* ---------------- NUEVO CLIENTE ---------------- */
function NuevoClienteModal({ open, onClose, onCreate }) {
  const [f, setF] = useState({ nombre:"", contacto:"", tel:"", lista:"Mayoreo contado", tipo:"contado", limite:"", dir:"", notas:"" });
  useEffect(()=>{ if(open) setF({ nombre:"", contacto:"", tel:"", lista:"Mayoreo contado", tipo:"contado", limite:"", dir:"", notas:"" }); }, [open]);
  const set = (k,v)=> setF(o=>({ ...o, [k]:v }));
  const valid = f.nombre.trim().length > 1;

  return (
    <Modal open={open} onClose={onClose} icon="user-plus" title="Agregar cliente" width={620}
      subtitle="Da de alta una carnicería o negocio. iAntonella usará estos datos para precios, crédito y recordatorios."
      footer={
        <>
          <Btn kind="outline" onClick={onClose}>Cancelar</Btn>
          <Btn kind="primary" icon="check" onClick={()=>{ onCreate && onCreate(f); onClose(); }}
            style={{ opacity: valid?1:0.5, pointerEvents: valid?"auto":"none" }}>Guardar cliente</Btn>
        </>
      }>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
        <FormField label="Nombre del negocio">
          <TextInput value={f.nombre} onChange={e=>set("nombre",e.target.value)} placeholder="Carnicería…" />
        </FormField>
        <FormField label="Contacto">
          <TextInput value={f.contacto} onChange={e=>set("contacto",e.target.value)} placeholder="Nombre de la persona" />
        </FormField>
        <FormField label="Teléfono / WhatsApp">
          <TextInput value={f.tel} onChange={e=>set("tel",e.target.value.replace(/[^0-9 ]/g,""))} placeholder="55 0000 0000" />
        </FormField>
        <FormField label="Lista de precios">
          <div style={{ position:"relative" }}>
            <select value={f.lista} onChange={e=>set("lista",e.target.value)} style={selStyle}>
              {window.CG.ops.pos.listas.map(l=> <option key={l} value={l}>{l}</option>)}
            </select>
            <Icon name="chevron-down" size={15} color={Cf.inkFaint} style={caret} />
          </div>
        </FormField>
      </div>

      <FormField label="Tipo de venta">
        <div style={{ display:"flex", gap:8 }}>
          {[["contado","Contado","wallet"],["credito","Crédito","hand-coins"]].map(([id,lab,ic])=>{
            const on = f.tipo===id;
            return (
              <button key={id} onClick={()=>set("tipo",id)} style={{ flex:1, display:"inline-flex", alignItems:"center", justifyContent:"center",
                gap:8, padding:"12px", borderRadius:10, cursor:"pointer", font:`700 13px/1 ${Ff.ui}`,
                border:`1px solid ${on?Cf.red:Cf.line}`, background:on?Cf.redWash:Cf.paper, color:on?Cf.red:Cf.ink }}>
                <Icon name={ic} size={15} color={on?Cf.red:Cf.inkSoft} /> {lab}
              </button>
            );
          })}
        </div>
      </FormField>

      {f.tipo==="credito" && (
        <div style={{ marginTop:14 }}>
          <FormField label="Límite de crédito" hint="iAntonella avisará al acercarse al límite o vencer un saldo.">
            <TextInput value={f.limite} onChange={e=>set("limite",e.target.value.replace(/[^0-9]/g,""))} placeholder="0"
              right={<span style={{ font:`600 12px/1 ${Ff.ui}`, color:Cf.inkFaint }}>MXN</span>} />
          </FormField>
        </div>
      )}

      <div style={{ marginTop:14 }}>
        <FormField label="Dirección (opcional)">
          <TextInput value={f.dir} onChange={e=>set("dir",e.target.value)} placeholder="Calle, colonia, ciudad" />
        </FormField>
      </div>

      <div style={{ display:"flex", gap:10, alignItems:"center", marginTop:14, padding:"11px 13px", borderRadius:11, background:Cf.tanWash }}>
        <AntonellaAvatar size={26} />
        <span style={{ flex:1, font:`500 12px/1.45 ${Ff.ui}`, color:Cf.ink80 }}>
          Al guardar, copio los precios de la lista <b>{f.lista}</b>. Si el cliente es nuevo en una pieza sin precio, te lo marco antes de su primer pedido.
        </span>
      </div>
    </Modal>
  );
}
window.NuevoClienteModal = NuevoClienteModal;

const selStyle = { width:"100%", appearance:"none", WebkitAppearance:"none", font:`600 13.5px/1 ${Ff.ui}`,
  color:Cf.ink, background:Cf.paper, border:`1px solid ${Cf.line}`, borderRadius:10, padding:"12px 36px 12px 13px", cursor:"pointer", outline:"none" };
const caret = { position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" };
const stepF = { width:30, height:32, border:"none", background:"transparent", cursor:"pointer", font:`700 17px/1 ${Ff.ui}`, color:Cf.ink };

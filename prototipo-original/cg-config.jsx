/* ============================================================
   CONFIGURACIÓN — submódulos
   ============================================================ */
const Cc = window.CG.color;
const Fc = window.CG.font;
const CFG = window.CG.config;
const m$ = (n)=> "$"+Number(n).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});

/* ---------- HUB de Configuración ---------- */
function ConfigScreen({ ai, go }) {
  return (
    <div>
      <ScreenHead title="Configuración" desc="Catálogo, recetas, precios y parámetros del sistema. Cada acceso abre su módulo." />
      <Slot id="caja" ai={ai} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:13, marginBottom:18 }}>
        {window.CG.configItems.filter(i=>i.id!=="settings").map(it=>(
          <button key={it.id} onClick={()=>go(it.id)} className="cg-btn" style={{ textAlign:"left", cursor:"pointer",
            background:Cc.paper, border:`1px solid ${Cc.line}`, borderRadius:14, padding:"18px 18px",
            display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:46, height:46, borderRadius:12, background:Cc.redWash, display:"grid", placeItems:"center", flexShrink:0 }}>
              <Icon name={it.icon} size={22} color={Cc.red} />
            </div>
            <div>
              <div style={{ font:`700 15px/1.1 ${Fc.ui}`, color:Cc.ink }}>{it.label}</div>
              <div style={{ font:`500 12px/1.3 ${Fc.ui}`, color:Cc.inkSoft, marginTop:3 }}>{CONFIG_DESC[it.id]}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Zonas peligrosas (de la pantalla real) */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))", gap:13 }}>
        <DangerCard tone="red" icon="rotate-ccw" title="Reset de Inventario"
          desc="Pone en cero el stock de todos los productos y registra auditoría (RESET). Requiere contraseña de administrador."
          cta="Resetear inventario" />
        <DangerCard tone="amber" icon="users" title="Reset de Clientes y Pedidos"
          desc="Borra clientes, pedidos, cobranza y precios por cliente. Genera respaldo en la base de datos antes de borrar."
          cta="Resetear clientes y pedidos" />
      </div>
    </div>
  );
}
const CONFIG_DESC = {
  productos:"Catálogo, tipos y stock", recetas:"Despiece y rendimiento", precios:"Listas por cliente",
  cold:"Fresco vs. frío", caja:"Ingresos y egresos", payment:"Formas de cobro",
};
function DangerCard({ tone, icon, title, desc, cta }) {
  const fg = tone==="red"?Cc.red:Cc.amber, bg = tone==="red"?Cc.redWash:Cc.amberWash;
  return (
    <div style={{ borderRadius:16, padding:18, background:bg, border:`1px solid ${fg}33` }}>
      <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:8 }}>
        <Icon name={icon} size={18} color={fg} />
        <h3 style={{ margin:0, font:`700 15px/1 ${Fc.ui}`, color:fg }}>{title}</h3>
      </div>
      <p style={{ margin:"0 0 14px", font:`400 12.5px/1.5 ${Fc.ui}`, color:Cc.ink80, textWrap:"pretty" }}>{desc}</p>
      <div style={{ display:"flex", gap:9, marginBottom:12, flexWrap:"wrap" }}>
        <input type="password" placeholder="Contraseña admin" style={inputCfg} />
        <input placeholder='Escribe "RESET"' style={inputCfg} />
      </div>
      <button style={{ font:`700 13px/1 ${Fc.ui}`, color:"#fff", background:fg, border:"none",
        padding:"11px 16px", borderRadius:10, cursor:"pointer", opacity:0.55 }}>{cta}</button>
    </div>
  );
}
const inputCfg = { flex:1, minWidth:120, font:`500 13px/1 ${Fc.ui}`, padding:"11px 12px",
  borderRadius:9, border:`1px solid ${Cc.line}`, background:Cc.paper, outline:"none", color:Cc.ink };

/* ---------- PRODUCTOS ---------- */
function ProductosScreen({ ai }) {
  const [tab, setTab] = useState("Todos");
  const tipos = ["Todos","Canal de Cerdo","Pierna de Cerdo","Espilomo"];
  return (
    <div>
      <ScreenHead title="Productos" desc="Catálogo completo: piezas padre (se despiezan) e hijas (se venden). El % de rendimiento viene de las recetas."
        right={<><Btn kind="dark" icon="plus">Agregar producto</Btn><Btn kind="outline" icon="upload">Importar precios (CSV)</Btn></>} />
      <Slot id="productos" ai={ai} />
      <Card pad={0} style={{ overflow:"hidden" }}>
        <div style={{ padding:"14px 16px", borderBottom:`1px solid ${Cc.line}`, display:"flex", gap:9, flexWrap:"wrap", alignItems:"center" }}>
          {tipos.map(t=>{
            const on=tab===t;
            return <button key={t} onClick={()=>setTab(t)} style={{ font:`700 12.5px/1 ${Fc.ui}`, padding:"9px 13px",
              borderRadius:9, cursor:"pointer", border:`1px solid ${on?"transparent":Cc.line}`,
              color:on?Cc.chromeFg:Cc.inkSoft, background:on?Cc.chrome:Cc.paper }}>{t}</button>;
          })}
          <div style={{ flex:1 }} />
          <div style={{ display:"flex", alignItems:"center", gap:7, border:`1px solid ${Cc.line}`, borderRadius:9, padding:"9px 12px", background:Cc.paper2, minWidth:200 }}>
            <Icon name="search" size={15} color={Cc.inkFaint} />
            <input placeholder="Buscar productos…" style={{ flex:1, border:"none", background:"transparent", outline:"none", font:`500 13px/1 ${Fc.ui}`, color:Cc.ink, minWidth:0 }} />
          </div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:680 }}>
            <thead>
              <tr style={{ background:Cc.paper2 }}>
                {["Producto","Tipo","% Rend.","Precio","Stock",""].map((h,i)=>(
                  <th key={i} style={{ textAlign:i===0||i===1?"left":i===5?"center":"right", font:`700 11px/1 ${Fc.ui}`,
                    letterSpacing:"0.05em", textTransform:"uppercase", color:Cc.inkFaint, padding:"12px 16px" }}>{h}</th>))}
              </tr>
            </thead>
            <tbody>
              {CFG.productos.map((p,i)=>(
                <tr key={i} style={{ borderTop:`1px solid ${Cc.lineSoft}` }}>
                  <td style={{ padding:"13px 16px", font:`700 13.5px/1 ${Fc.ui}`, color:Cc.ink }}>{p.n}</td>
                  <td style={{ padding:"13px 16px" }}><Badge tone={p.tipo==="Padre"?"blue":"ghost"}>{p.tipo}</Badge></td>
                  <td style={{ padding:"13px 16px", textAlign:"right", font:`600 13px/1 ${Fc.mono}`, color: p.rend==null?Cc.inkFaint:Cc.red }}>{p.rend==null?"–":p.rend.toFixed(1)+"%"}</td>
                  <td style={{ padding:"13px 16px", textAlign:"right", font:`600 13px/1 ${Fc.mono}`, color: p.precio>0?Cc.ink:Cc.inkFaint }}>{m$(p.precio)}</td>
                  <td style={{ padding:"13px 16px", textAlign:"right", font:`600 13px/1 ${Fc.mono}`, color: p.stock>0?Cc.green:Cc.inkFaint }}>{p.stock}</td>
                  <td style={{ padding:"13px 16px" }}>
                    <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
                      <IconBtn icon="file-pen" color={Cc.inkSoft} />
                      <IconBtn icon="trash-2" color={Cc.red} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
function IconBtn({ icon, color }) {
  return <button style={{ width:32, height:32, borderRadius:8, border:`1px solid ${Cc.line}`, background:Cc.paper,
    cursor:"pointer", display:"grid", placeItems:"center" }}><Icon name={icon} size={15} color={color} /></button>;
}

/* ---------- PRECIOS ---------- */
function PreciosScreen({ ai }) {
  const p = CFG.precios;
  return (
    <div>
      <ScreenHead title="Precios por Cliente" desc="Cada cliente guarda su propia lista de precios. Se usa al generar su pedido y ticket."
        right={<Btn kind="dark" icon="save">Guardar precios</Btn>} />
      <Slot id="precios" ai={ai} />
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }} className="cg-two-col">
          <div>
            <Overline style={{ marginBottom:8 }}>Cliente</Overline>
            <div style={{ display:"flex", alignItems:"center", gap:9, border:`1px solid ${Cc.line}`, borderRadius:11, padding:"13px 14px", background:Cc.paper2 }}>
              <Icon name="user" size={16} color={Cc.inkSoft} />
              <span style={{ flex:1, font:`700 14px/1 ${Fc.ui}`, color:Cc.ink }}>{p.cliente}</span>
              <Icon name="chevron-down" size={16} color={Cc.inkFaint} />
            </div>
          </div>
          <div>
            <Overline style={{ marginBottom:8 }}>Buscar producto</Overline>
            <div style={{ display:"flex", alignItems:"center", gap:9, border:`1px solid ${Cc.line}`, borderRadius:11, padding:"13px 14px", background:Cc.paper2 }}>
              <Icon name="search" size={16} color={Cc.inkFaint} />
              <input placeholder="Ej. PIERNA, LOMO…" style={{ flex:1, border:"none", background:"transparent", outline:"none", font:`500 14px/1 ${Fc.ui}`, color:Cc.ink, minWidth:0 }} />
            </div>
          </div>
        </div>
      </Card>
      <Card pad={0} style={{ overflow:"hidden" }}>
        <div style={{ padding:"14px 16px", borderBottom:`1px solid ${Cc.line}` }}>
          <h3 style={{ margin:0, font:`700 15px/1 ${Fc.ui}`, color:Cc.ink }}>Lista de precios</h3>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:520 }}>
            <thead><tr style={{ background:Cc.paper2 }}>
              {["Producto","Precio / Kg","Precio / Pieza"].map((h,i)=>(
                <th key={i} style={{ textAlign:i===0?"left":"right", font:`700 11px/1 ${Fc.ui}`, letterSpacing:"0.05em",
                  textTransform:"uppercase", color:Cc.inkFaint, padding:"12px 16px" }}>{h}</th>))}</tr></thead>
            <tbody>
              {p.lista.map((r,i)=>(
                <tr key={i} style={{ borderTop:`1px solid ${Cc.lineSoft}` }}>
                  <td style={{ padding:"12px 16px" }}>
                    <span style={{ font:`700 13.5px/1 ${Fc.ui}`, color:Cc.ink }}>{r.n}</span>
                    <span style={{ font:`500 11px/1 ${Fc.ui}`, color:Cc.inkFaint, marginLeft:8 }}>{r.cat}</span></td>
                  <td style={{ padding:"12px 16px", textAlign:"right" }}>
                    <input defaultValue={r.kg.toFixed(2)} inputMode="decimal" style={priceInput(r.kg>0)} /></td>
                  <td style={{ padding:"12px 16px", textAlign:"right" }}>
                    <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:96, height:38,
                      borderRadius:9, border:`1px dashed ${Cc.line}`, color:Cc.inkFaint, font:`500 14px/1 ${Fc.mono}` }}>—</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
function priceInput(active) {
  return { width:96, height:38, textAlign:"right", font:`600 14px/1 ${Fc.mono}`,
    color: active?Cc.ink:Cc.inkFaint, background:Cc.paper2, border:`1px solid ${active?Cc.green:Cc.line}`,
    borderRadius:9, padding:"0 12px", outline:"none" };
}

/* ---------- INVENTARIO FRÍO ---------- */
function ColdScreen({ ai }) {
  return (
    <div>
      <ScreenHead title="Inventario Frío" desc="Solo el inventario fresco se vende. Lo que no se vende se envía a frío; para vender de frío, primero descongélalo a fresco." />
      <Slot id="cold" ai={ai} />
      <Card pad={0} style={{ overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:640 }}>
            <thead><tr style={{ background:Cc.paper2 }}>
              {["Producto","Fresco (kg / pz)","Frío (kg / pz)","Acciones"].map((h,i)=>(
                <th key={i} style={{ textAlign:i===0?"left":i===3?"center":"right", font:`700 11px/1 ${Fc.ui}`,
                  letterSpacing:"0.05em", textTransform:"uppercase", color:Cc.inkFaint, padding:"12px 16px" }}>{h}</th>))}</tr></thead>
            <tbody>
              {CFG.cold.map((r,i)=>(
                <tr key={i} style={{ borderTop:`1px solid ${Cc.lineSoft}` }}>
                  <td style={{ padding:"13px 16px", font:`700 13.5px/1 ${Fc.ui}`, color:Cc.ink }}>{r.n}</td>
                  <td style={{ padding:"13px 16px", textAlign:"right", font:`600 13px/1 ${Fc.mono}`, color: r.fresco[0]>0||r.fresco[1]>0?Cc.green:Cc.ink80 }}>
                    {r.fresco[0].toFixed(2)} / {r.fresco[1]}</td>
                  <td style={{ padding:"13px 16px", textAlign:"right", font:`600 13px/1 ${Fc.mono}`, color:Cc.blue }}>
                    {r.frio[0].toFixed(2)} / {r.frio[1]}</td>
                  <td style={{ padding:"13px 16px" }}>
                    <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
                      <SmallAct icon="snowflake" label="A frío" color={Cc.blue} bg={Cc.blueWash} />
                      <SmallAct icon="flame" label="A fresco" color={Cc.red} bg={Cc.redWash} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
function SmallAct({ icon, label, color, bg }) {
  return <button style={{ display:"inline-flex", alignItems:"center", gap:6, font:`700 12px/1 ${Fc.ui}`,
    color, background:bg, border:"none", padding:"9px 12px", borderRadius:9, cursor:"pointer", minHeight:40 }}>
    <Icon name={icon} size={14} color={color} /> {label}</button>;
}

/* ---------- CAJA ---------- */
function CajaScreen({ ai }) {
  return (
    <div>
      <ScreenHead title="Caja" desc="Transacciones de caja: ingresos y egresos. Alimentan el margen del Panel en tiempo real." />
      <Slot id="caja" ai={ai} />
      <Card>
        <h3 style={{ margin:"0 0 4px", font:`700 16px/1 ${Fc.ui}`, color:Cc.ink }}>Transacciones de caja</h3>
        <p style={{ margin:"0 0 18px", font:`400 13px/1 ${Fc.ui}`, color:Cc.inkSoft }}>Administra tus transacciones de caja.</p>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["Descripción","Categoría","Tipo","Fecha","Importe","Estado"].map((h,i)=>(
            <th key={i} style={{ textAlign:i>=3?"right":"left", font:`700 11px/1 ${Fc.ui}`, letterSpacing:"0.05em",
              textTransform:"uppercase", color:Cc.inkFaint, padding:"0 8px 12px" }}>{h}</th>))}</tr></thead>
        </table>
        <div style={{ textAlign:"center", padding:"32px 0", font:`500 14px/1 ${Fc.ui}`, color:Cc.inkFaint,
          borderTop:`1px solid ${Cc.lineSoft}`, borderBottom:`1px solid ${Cc.lineSoft}`, margin:"0 0 16px" }}>
          Aún no hay transacciones.</div>
        <div style={{ display:"flex", gap:9, flexWrap:"wrap", alignItems:"center" }}>
          <input placeholder="Descripción" style={{ ...inputCfg, flex:"2 1 160px" }} />
          <input placeholder="Categoría" style={{ ...inputCfg, flex:"1 1 120px" }} />
          <select style={{ ...inputCfg, flex:"0 1 130px" }}><option>Ingreso</option><option>Egreso</option></select>
          <input placeholder="$ 0.00" style={{ ...inputCfg, flex:"1 1 120px" }} />
          <Btn kind="dark" icon="plus">Agregar</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ---------- MÉTODOS DE PAGO ---------- */
function PaymentScreen({ ai }) {
  return (
    <div>
      <ScreenHead title="Métodos de pago" desc="Formas de cobro disponibles al cerrar un pedido."
        right={<Btn kind="dark" icon="plus">Agregar método</Btn>} />
      <Slot id="caja" ai={ai} />
      <Card>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
          <Icon name="credit-card" size={18} color={Cc.inkSoft} />
          <span style={{ font:`700 14px/1 ${Fc.ui}`, color:Cc.ink }}>{CFG.payment.length} método(s)</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
          {CFG.payment.map((p,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"15px 4px", borderTop:i>0?`1px solid ${Cc.lineSoft}`:"none" }}>
              <span style={{ font:`700 14px/1 ${Fc.ui}`, color:Cc.ink }}>{p}</span>
              <div style={{ display:"flex", gap:8 }}>
                <IconBtn icon="file-pen" color={Cc.inkSoft} />
                <IconBtn icon="trash-2" color={Cc.red} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

window.ConfigScreen = ConfigScreen;
window.ProductosScreen = ProductosScreen;
window.PreciosScreen = PreciosScreen;
window.ColdScreen = ColdScreen;
window.CajaScreen = CajaScreen;
window.PaymentScreen = PaymentScreen;

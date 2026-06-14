/* ============================================================
   Pantallas operativas (D) — Rendimiento · POS
   ============================================================ */
const Cy = window.CG.color;
const Fy = window.CG.font;
const OPSd = window.CG.ops;
const mnyD  = window.money;

/* disponibilidad de pieza → estilo */
const DISP = {
  stock:    { tone:"green", icon:"check-circle-2", label:"En stock" },
  despiece: { tone:"blue",  icon:"scissors",       label:"Por despiece" },
  pesaje:   { tone:"amber", icon:"scale",          label:"Por pesar" },
  faltante: { tone:"red",   icon:"alert-triangle", label:"Faltante" },
};

/* ---------------- RENDIMIENTO ---------------- */
function RendimientoScreen({ ai }) {
  const r = OPSd.rendimiento;
  // estado de pesos reales (algunos sin capturar → iA puede estimar)
  const [reales, setReales] = useState(()=> r.piezas.map(p=>p.real));
  const setReal = (i,v)=> setReales(arr=>{ const n=[...arr]; n[i]=v; return n; });

  const totEst = r.piezas.reduce((s,p)=>s+p.est,0);
  const totReal = reales.reduce((s,v)=>s+(+v||0),0);
  const rend = totEst>0 ? (totReal/totEst*100) : 0;
  const dif = totReal - totEst;

  return (
    <div>
      <ScreenHead title="Rendimiento de Despiece" desc="Captura el peso real de cada pieza y compáralo con el estimado para medir el rendimiento del día y calibrar recetas."
        right={<><Btn kind="outline" icon="sparkles">Proyectar piezas</Btn><Btn kind="dark" icon="save">Guardar hoja</Btn></>} />
      <Slot id="rendimiento" ai={ai} />

      <div style={{ display:"grid", gridTemplateColumns:"260px 1fr", gap:14, alignItems:"start" }} className="cg-two-col">
        {/* Cabecera + rendimiento */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Card pad={18} style={{ background:Cy.blueWash, borderColor:"transparent" }}>
            <Overline color={Cy.blue} style={{ marginBottom:8 }}>Rendimiento del día</Overline>
            <Stat value={rend.toFixed(1)} suffix="%" color={Cy.blue} size={40} />
            <div style={{ font:`500 12px/1.4 ${Fy.ui}`, color:Cy.inkSoft, marginTop:8 }}>
              Estimado {r.rendEst}% · {totReal>0?`real ${rend.toFixed(1)}%`:"captura pesos reales"}
            </div>
          </Card>
          <Card pad={16}>
            <Overline style={{ marginBottom:12 }}>Cabecera de la hoja</Overline>
            <Field label="Proveedor" value={r.proveedor} />
            <Field label="Medias canal" value={r.canales} mono />
            <Field label="Kg comprado" value={r.kgComprado.toLocaleString("es-MX")} mono last />
          </Card>
          <AiSuggestBar tone="sugerencia" title="Calibrar recetas con el día"
            text={`Con estos pesos reales el americano rinde ${rend.toFixed(1)}%. Puedo recalibrar los % de las recetas para afinar las próximas estimaciones.`}
            primary="Calibrar recetas" onPrimary={()=>{}} secondary="Ahora no" onSecondary={()=>{}} />
        </div>

        {/* Tabla de piezas */}
        <Card pad={0} style={{ overflow:"hidden" }}>
          <div style={{ padding:"15px 16px", borderBottom:`1px solid ${Cy.line}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
            <h3 style={{ margin:0, font:`700 15px/1 ${Fy.ui}`, color:Cy.ink }}>Pesaje de piezas</h3>
            <span style={{ font:`500 12px/1 ${Fy.ui}`, color:Cy.inkSoft }}>Peso real vs. estimado · iA rellena lo que falte</span>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:560 }}>
              <thead><tr style={{ background:Cy.paper2 }}>
                <th style={rTh("left")}>Concepto</th><th style={rTh("right")}>Pz</th>
                <th style={rTh("right")}>Peso est.</th><th style={rTh("right")}>Peso real</th><th style={rTh("right")}>Dif.</th>
              </tr></thead>
              <tbody>
                {r.piezas.map((p,i)=>{
                  const real = +reales[i]||0;
                  const d = real>0 ? real - p.est : null;
                  return (
                    <tr key={i} style={{ borderTop:`1px solid ${Cy.lineSoft}`, background: real>0?Cy.greenWash+"55":"transparent" }}>
                      <td style={{ padding:"11px 14px", font:`700 13px/1 ${Fy.ui}`, color:Cy.ink }}>{p.n}</td>
                      <td style={{ padding:"11px 14px", textAlign:"right", font:`500 12.5px/1 ${Fy.mono}`, color:Cy.inkSoft }}>{p.pz}</td>
                      <td style={{ padding:"11px 14px", textAlign:"right", font:`600 12.5px/1 ${Fy.mono}`, color:Cy.blue }}>{p.est.toFixed(1)}</td>
                      <td style={{ padding:"8px 14px", textAlign:"right" }}>
                        <AiField suggestion={real>0?undefined:p.est} value={real>0?real:undefined} unit="kg" width={104}
                          onCommit={(n)=>setReal(i,n)} hint={real>0?undefined:`iA estima ${p.est.toFixed(1)} kg desde la receta`} />
                      </td>
                      <td style={{ padding:"11px 14px", textAlign:"right", font:`700 12.5px/1 ${Fy.mono}`,
                        color: d==null?Cy.inkFaint : d<0?Cy.red:Cy.green }}>{d==null?"—":(d>0?"+":"")+d.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop:`2px solid ${Cy.line}`, background:Cy.paper2 }}>
                  <td style={{ padding:"13px 14px", font:`800 13px/1 ${Fy.ui}`, color:Cy.ink }}>Totales</td>
                  <td style={{ padding:"13px 14px", textAlign:"right", font:`700 12.5px/1 ${Fy.mono}`, color:Cy.inkSoft }}>{r.piezas.reduce((s,p)=>s+p.pz,0)}</td>
                  <td style={{ padding:"13px 14px", textAlign:"right", font:`700 13px/1 ${Fy.mono}`, color:Cy.blue }}>{totEst.toFixed(1)}</td>
                  <td style={{ padding:"13px 14px", textAlign:"right", font:`800 13px/1 ${Fy.mono}`, color:Cy.ink }}>{totReal.toFixed(1)}</td>
                  <td style={{ padding:"13px 14px", textAlign:"right", font:`800 13px/1 ${Fy.mono}`, color: dif<0?Cy.red:Cy.green }}>{(dif>0?"+":"")+dif.toFixed(1)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
const rTh = (a)=>({ textAlign:a, font:`700 11px/1 ${Fy.ui}`, letterSpacing:"0.05em", textTransform:"uppercase", color:Cy.inkFaint, padding:"12px 14px" });
function Field({ label, value, mono, last }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0",
      borderBottom: last?"none":`1px solid ${Cy.lineSoft}` }}>
      <span style={{ font:`600 12.5px/1 ${Fy.ui}`, color:Cy.inkSoft }}>{label}</span>
      <span style={{ font:`700 13.5px/1 ${mono?Fy.mono:Fy.ui}`, color:Cy.ink }}>{value}</span>
    </div>
  );
}

/* ---------------- POS ---------------- */
function PosScreen({ ai }) {
  const p = OPSd.pos;
  const [cart, setCart] = useState(()=> p.carrito.map(x=>({ ...x })));
  const setQty = (i, d)=> setCart(c=>{ const n=[...c]; n[i]={...n[i], pz: Math.max(0, n[i].pz+d)}; return n; });
  const del = (i)=> setCart(c=> c.filter((_,j)=>j!==i));
  const sub = (it)=> it.kg>0 ? it.kg*it.precio : it.pz*it.precio;
  const total = cart.reduce((s,it)=>s+sub(it),0);
  const needWeigh = cart.some(it=>it.disp==="pesaje" && it.kg===0);
  const faltan = cart.filter(it=>it.disp==="faltante").length;
  const despiece = cart.filter(it=>it.disp==="despiece").length;

  return (
    <div>
      <ScreenHead title="Punto de venta" desc="Captura el pedido del cliente. iAntonella clasifica cada pieza en stock, vía despiece o por pesar al agregarla." />
      <Slot id="pos" ai={ai} />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:14, alignItems:"start" }} className="cg-two-col">
        {/* Izquierda: venta + catálogo */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Card>
            <Overline style={{ marginBottom:12 }}>Detalles de la venta</Overline>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10 }}>
              <PosSelect icon="user" label="Carnicería Marenco" />
              <PosSelect icon="wallet" label="Efectivo" />
              <PosSelect icon="tag" label="Mayoreo contado" />
            </div>
          </Card>
          <Card pad={0} style={{ overflow:"hidden" }}>
            <div style={{ padding:"14px 16px", borderBottom:`1px solid ${Cy.line}`, display:"flex", alignItems:"center", gap:9 }}>
              <Icon name="package-search" size={18} color={Cy.ink} />
              <span style={{ font:`700 15px/1 ${Fy.ui}`, color:Cy.ink }}>Productos</span>
              <span style={{ marginLeft:"auto", font:`500 12px/1 ${Fy.ui}`, color:Cy.inkSoft }}>toca para agregar</span>
            </div>
            <div style={{ padding:12, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:10 }}>
              {p.catalogo.map((it,i)=>{
                const d=DISP[it.disp];
                return (
                  <button key={i} className="cg-btn" style={{ textAlign:"left", cursor:"pointer", background:Cy.paper2,
                    border:`1px solid ${Cy.line}`, borderRadius:12, padding:"12px 13px", minHeight:88 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                      <span style={{ font:`700 13.5px/1.15 ${Fy.ui}`, color:Cy.ink }}>{it.n}</span>
                      <Icon name="plus" size={16} color={Cy.red} />
                    </div>
                    <div style={{ font:`700 15px/1 ${Fy.mono}`, color:Cy.ink, marginTop:8 }}>{mnyD(it.precio)}<span style={{ font:`500 11px/1 ${Fy.ui}`, color:Cy.inkFaint }}>/kg</span></div>
                    <div style={{ marginTop:9 }}><Badge tone={d.tone} icon={d.icon}>{d.label}</Badge></div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Derecha: carrito */}
        <Card pad={0} style={{ overflow:"hidden", position:"sticky", top:0 }}>
          <div style={{ padding:"15px 16px", borderBottom:`1px solid ${Cy.line}`, background:Cy.paper2,
            display:"flex", alignItems:"center", gap:9 }}>
            <Icon name="shopping-cart" size={18} color={Cy.ink} />
            <span style={{ font:`700 15px/1 ${Fy.ui}`, color:Cy.ink }}>Carrito</span>
            <span style={{ marginLeft:"auto", font:`600 12px/1 ${Fy.ui}`, color:Cy.inkSoft }}>{cart.length} líneas</span>
          </div>
          <div style={{ padding:12, display:"flex", flexDirection:"column", gap:9, maxHeight:"46vh", overflowY:"auto" }}>
            {cart.map((it,i)=>{
              const d=DISP[it.disp];
              return (
                <div key={i} style={{ border:`1px solid ${Cy.line}`, borderRadius:12, padding:"11px 12px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:9 }}>
                    <span style={{ font:`700 13.5px/1.1 ${Fy.ui}`, color:Cy.ink }}>{it.n}</span>
                    <button onClick={()=>del(i)} style={{ border:"none", background:"transparent", cursor:"pointer", lineHeight:0 }}><Icon name="trash-2" size={15} color={Cy.red} /></button>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
                    <Badge tone={d.tone} icon={d.icon}>{d.label}</Badge>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ display:"flex", alignItems:"center", border:`1px solid ${Cy.line}`, borderRadius:9, overflow:"hidden" }}>
                        <button onClick={()=>setQty(i,-1)} style={posStep}>−</button>
                        <span style={{ minWidth:26, textAlign:"center", font:`700 13px/1 ${Fy.mono}`, color:Cy.ink }}>{it.pz}</span>
                        <button onClick={()=>setQty(i,1)} style={posStep}>+</button>
                      </div>
                      <span style={{ font:`700 13.5px/1 ${Fy.mono}`, color:Cy.ink, minWidth:64, textAlign:"right" }}>
                        {it.disp==="pesaje" && it.kg===0 ? "~pesar" : mnyD(sub(it))}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* avisos de iAntonella */}
          {(despiece>0 || faltan>0) && (
            <div style={{ padding:"0 12px 8px", display:"flex", flexDirection:"column", gap:6 }}>
              {despiece>0 && <PosNote tone="blue" icon="scissors">{despiece} pieza(s) requieren despiece de canal.</PosNote>}
              {faltan>0 && <PosNote tone="red" icon="alert-triangle">{faltan} pieza(s) sin stock — se quedarán pendientes de compra.</PosNote>}
            </div>
          )}
          <div style={{ padding:"14px 16px", borderTop:`1px solid ${Cy.line}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <Overline>Total estimado</Overline>
              <div style={{ font:`400 28px/1 ${Fy.display}`, color:Cy.ink }}>{mnyD(total)}</div>
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:9, marginBottom:12, cursor:"pointer" }}>
              <span style={{ width:20, height:20, borderRadius:6, border:`1.5px solid ${Cy.line}`, background:Cy.paper2, display:"grid", placeItems:"center" }} />
              <span style={{ font:`600 13px/1 ${Fy.ui}`, color:Cy.ink80 }}>Factura (NFC-e)</span>
            </label>
            <Btn kind={needWeigh?"dark":"green"} size="lg" block icon={needWeigh?"scale":"check"}>
              {needWeigh ? "Crear pedido · requiere pesaje" : "Crear pedido"}
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
const posStep = { width:30, height:34, border:"none", background:Cy.paper2, cursor:"pointer", font:`700 16px/1 ${Fy.ui}`, color:Cy.ink };
function PosSelect({ icon, label }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:9, border:`1px solid ${Cy.line}`, borderRadius:10,
      padding:"12px 13px", background:Cy.paper2, cursor:"pointer" }}>
      <Icon name={icon} size={16} color={Cy.inkSoft} />
      <span style={{ flex:1, font:`700 13.5px/1 ${Fy.ui}`, color:Cy.ink, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{label}</span>
      <Icon name="chevrons-up-down" size={15} color={Cy.inkFaint} />
    </div>
  );
}
function PosNote({ tone, icon, children }) {
  const c = tone==="red"?Cy.red:Cy.blue, bg = tone==="red"?Cy.redWash:Cy.blueWash;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 11px", borderRadius:9, background:bg }}>
      <Icon name={icon} size={14} color={c} />
      <span style={{ font:`600 11.5px/1.3 ${Fy.ui}`, color:Cy.ink80 }}>{children}</span>
    </div>
  );
}

window.RendimientoScreen = RendimientoScreen;
window.PosScreen = PosScreen;

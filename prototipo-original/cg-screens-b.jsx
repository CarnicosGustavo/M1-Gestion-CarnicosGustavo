/* ============================================================
   Pantallas reskin (B) — Despiece, Báscula, Cobro, otros
   ============================================================ */
const Cb = window.CG.color;
const Fb = window.CG.font;
const Db = window.CG.data;
const Ab = window.CG.antonella;
const SlotB = window.Slot || (({id,ai})=> <AntonellaSlot data={(window.CG.antonella[id]||window.CG.antonella.default).slot} onChip={(t)=>ai.chip(t)} onOpen={()=>ai.open()} />);

/* ---------------- DESPIECE ---------------- */
function DespieceScreen({ ai }) {
  const d = Db.despiece;
  const [sel, setSel] = useState("ame");
  const [n, setN] = useState(1);
  const canal = d.canales.find(x=>x.id===sel);
  return (
    <div>
      <ScreenHead title="Despiece" desc="Los canales vienen de la Compra del día. Elige un tipo y despiézalo según lo que se pidió."
        right={<><Btn kind="dark" icon="scissors">Despiezar</Btn><Btn kind="outline" icon="git-branch">Recetas</Btn></>} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12, marginBottom:16 }}>
        {d.canales.map(cn=>{
          const on = cn.id===sel;
          return (
            <button key={cn.id} onClick={()=>setSel(cn.id)} style={{ textAlign:"left", cursor:"pointer",
              background:Cb.paper, borderRadius:14, padding:0, overflow:"hidden",
              border:`2px solid ${on?Cb[cn.tono]:Cb.line}`, boxShadow: on?`0 10px 24px -16px ${Cb[cn.tono]}`:"none" }}>
              <div style={{ height:4, background:Cb[cn.tono] }} />
              <div style={{ padding:"14px 16px" }}>
                <div style={{ font:`700 14px/1.2 ${Fb.ui}`, color:Cb.ink, marginBottom:8 }}>{cn.nombre}</div>
                <div style={{ display:"flex", alignItems:"baseline", gap:7 }}>
                  <span style={{ font:`400 30px/1 ${Fb.display}`, color:Cb[cn.tono] }}>{cn.disp}</span>
                  <span style={{ font:`600 12px/1 ${Fb.ui}`, color:Cb.inkSoft }}>disponibles</span>
                </div>
                <div style={{ font:`500 12px/1 ${Fb.mono}`, color:Cb.inkFaint, marginTop:6 }}>{cn.kg} kg c/u</div>
              </div>
            </button>
          );
        })}
      </div>
      <Slot id="despiece" ai={ai} />
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:16 }}>
          <div>
            <h3 style={{ margin:0, font:`700 16px/1 ${Fb.ui}`, color:Cb.ink }}>{canal.nombre} — qué obtienes y qué se pidió</h3>
            <p style={{ margin:"6px 0 0", font:`400 12.5px/1 ${Fb.ui}`, color:Cb.inkSoft }}>Capacidad con {canal.disp} canales · Pedidas = demanda viva.</p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <Overline>Canales a despiezar</Overline>
            <div style={{ display:"flex", alignItems:"center", gap:4, border:`1px solid ${Cb.line}`, borderRadius:10, padding:3 }}>
              <Step icon="minus" onClick={()=>setN(v=>Math.max(1,v-1))} />
              <span style={{ width:34, textAlign:"center", font:`700 16px/1 ${Fb.mono}`, color:Cb.ink }}>{n}</span>
              <Step icon="plus" onClick={()=>setN(v=>v+1)} />
            </div>
            <Btn kind="primary" icon="scissors">Despiezar {n}</Btn>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:11 }}>
          {d.piezas.map((pz,i)=>(
            <div key={i} style={{ border:`1px solid ${pz.hijo?Cb.red:Cb.line}`, borderRadius:12, padding:"13px 14px",
              background: pz.hijo?Cb.redWash:Cb.paper2 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ font:`700 13.5px/1.2 ${Fb.ui}`, color:Cb.ink, textTransform:"uppercase", letterSpacing:"0.02em" }}>{pz.n}</div>
                {pz.hijo && <Icon name="git-branch" size={14} color={Cb.red} />}
              </div>
              <div style={{ font:`500 11.5px/1 ${Fb.mono}`, color:Cb.inkSoft, marginTop:7 }}>{pz.pz} pz/canal · {pz.pct}%</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:11 }}>
                <span style={{ font:`600 11px/1 ${Fb.ui}`, color: pz.ped>0?Cb.red:Cb.inkFaint }}>
                  {pz.ped>0?`${pz.ped} pedidas`:"sin pedidos"}
                </span>
                <Badge tone={pz.ped>0?"red":"ghost"}>+{pz.pz*n} pz</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
function Step({ icon, onClick }) {
  return <button onClick={onClick} style={{ width:30, height:30, borderRadius:8, border:"none",
    background:Cb.paper2, cursor:"pointer", display:"grid", placeItems:"center" }}>
    <Icon name={icon} size={15} color={Cb.ink} /></button>;
}

/* ---------------- BÁSCULA ---------------- */
function BasculaScreen({ ai }) {
  const b = Db.bascula;
  const [rec, setRec] = useState("ninguno");
  const [bruto, setBruto] = useState("");
  const recDef = b.recipientes.find(r=>r.id===rec);
  const tara = recDef.tara ?? 0;
  const g = parseFloat(bruto)||0;
  const neto = Math.max(0, g - tara);
  return (
    <div>
      <ScreenHead title="Báscula" desc="Estación de pesaje. Pensada para tablet y dedos: número gigante, recipientes con un toque, Enter registra."
        right={<Btn kind="outline" icon="scale">Agregar pesaje a producto</Btn>} />
      <Slot id="bascula" ai={ai} />
      <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:14, alignItems:"start" }} className="cg-two-col">
        {/* cola */}
        <Card pad={0} style={{ overflow:"hidden" }}>
          <div style={{ padding:"15px 16px", borderBottom:`1px solid ${Cb.line}`, background:Cb.paper2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:9 }}>
              <Icon name="scale" size={18} color={Cb.ink} />
              <span style={{ font:`700 15px/1 ${Fb.ui}`, color:Cb.ink }}>Estación de pesaje</span>
            </div>
            <div style={{ font:`500 12px/1 ${Fb.ui}`, color:Cb.inkSoft, marginTop:5 }}>1 pedido pendiente</div>
          </div>
          <div style={{ padding:12, background:Cb.chrome, margin:0 }}>
            <div style={{ borderRadius:12, background:"rgba(241,231,214,0.08)", border:`1px solid rgba(241,231,214,0.16)`, padding:"14px 15px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ font:`700 14px/1 ${Fb.ui}`, color:Cb.chromeFg }}>#{b.pedido.id} · {b.pedido.cliente}</span>
                <Icon name="chevron-right" size={18} color={Cb.tan} />
              </div>
              <div style={{ font:`500 12px/1 ${Fb.ui}`, color:"rgba(241,231,214,0.6)", marginTop:5 }}>1 artículo pendiente</div>
            </div>
          </div>
        </Card>
        {/* captura */}
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", borderBottom:`1px solid ${Cb.line}`, paddingBottom:14, marginBottom:18 }}>
            <div>
              <div style={{ font:`700 16px/1 ${Fb.ui}`, color:Cb.ink }}>{b.pedido.cliente}</div>
              <div style={{ font:`500 12px/1 ${Fb.ui}`, color:Cb.inkSoft, marginTop:4 }}>Pedido #{b.pedido.id}</div>
            </div>
            <div style={{ display:"flex", gap:14, alignItems:"center" }}>
              <Btn kind="outline" size="sm" icon="pencil">Editar pedido</Btn>
              <div style={{ textAlign:"right" }}>
                <Overline>Total</Overline>
                <div style={{ font:`400 22px/1 ${Fb.display}`, color:Cb.ink, marginTop:3 }}>{money(b.pedido.total)}</div>
              </div>
            </div>
          </div>
          <div style={{ textAlign:"center", marginBottom:18 }}>
            <Overline color={Cb.red} style={{ marginBottom:6 }}>Artículo {b.item.idx} de {b.item.total}</Overline>
            <div style={{ font:`400 46px/0.95 ${Fb.display}`, color:Cb.ink, letterSpacing:"0.01em" }}>
              <span style={{ color:Cb.inkSoft, fontSize:30 }}>{1}&nbsp;</span>{b.item.nombre}
            </div>
            <div style={{ font:`500 13px/1 ${Fb.ui}`, color:Cb.inkSoft, marginTop:6 }}>{b.item.cat}</div>
          </div>
          {/* recipientes */}
          <Overline style={{ marginBottom:9 }}>Recipiente · resto la tara solo</Overline>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:18 }}>
            {b.recipientes.map(r=>{
              const on=r.id===rec;
              return <button key={r.id} onClick={()=>{setRec(r.id); if(r.id!=="otro")setBruto(bruto);}}
                style={{ cursor:"pointer", font:`700 14px/1 ${Fb.ui}`, padding:"13px 16px", borderRadius:12,
                  minHeight:48, color:on?Cb.chromeFg:Cb.ink, background:on?Cb.chrome:Cb.paper2,
                  border:`1px solid ${on?Cb.chrome:Cb.line}` }}>
                {r.label}{r.tara!=null&&r.tara>0 && <span style={{ opacity:0.6, marginLeft:5, fontFamily:Fb.mono, fontSize:12 }}>{r.tara.toFixed(3)} kg</span>}
              </button>;
            })}
          </div>
          {/* peso bruto gigante */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
            <Overline>Peso bruto (kg)</Overline>
            <div style={{ display:"flex", gap:7 }}>
              <MiniTag label="CAPTURAR" onClick={()=>{ if(g>0){ setRec("otro"); } }} />
              <MiniTag label="TARE" onClick={()=>setBruto("")} dark />
            </div>
          </div>
          <div style={{ position:"relative", marginBottom:16 }}>
            <input value={bruto} onChange={e=>setBruto(e.target.value)} inputMode="decimal" placeholder="0.000"
              style={{ width:"100%", height:104, textAlign:"center", font:`400 56px/1 ${Fb.mono}`, fontWeight:700,
                color:Cb.ink, background:Cb.paper2, border:`2px solid ${neto>0?Cb.green:Cb.line}`, borderRadius:18, outline:"none" }} />
            <span style={{ position:"absolute", right:24, top:"50%", transform:"translateY(-50%)",
              font:`400 30px/1 ${Fb.display}`, color:Cb.inkFaint, pointerEvents:"none" }}>kg</span>
          </div>
          {(rec!=="ninguno"||g>0) && (
            <div style={{ background:Cb.paper2, border:`1px solid ${Cb.line}`, borderRadius:14, padding:"13px 16px", marginBottom:16 }}>
              <Row k="Peso bruto" v={`${g.toFixed(3)} kg`} />
              {tara>0 && <Row k={`(–) Tara (${recDef.label})`} v={`–${tara.toFixed(3)} kg`} />}
              <div style={{ borderTop:`1px solid ${Cb.line}`, marginTop:8, paddingTop:8 }}>
                <Row k="= Peso neto" v={`${neto.toFixed(3)} kg`} big vColor={neto>0?Cb.green:Cb.inkFaint} />
              </div>
            </div>
          )}
          <div style={{ display:"flex", gap:11 }}>
            <Btn kind="outline" size="lg" style={{ flex:1, minHeight:62 }} icon="chevron-left">Anterior</Btn>
            <Btn kind="primary" size="lg" style={{ flex:3, minHeight:62, fontSize:18 }} icon="scale">
              Registrar {neto>0?`${neto.toFixed(3)} kg`:"peso"}
            </Btn>
            <Btn kind="outline" size="lg" style={{ flex:1, minHeight:62 }} icon="chevron-right">Siguiente</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
function MiniTag({ label, onClick, dark }) {
  return <button onClick={onClick} style={{ font:`800 11px/1 ${Fb.ui}`, letterSpacing:"0.08em",
    padding:"7px 11px", borderRadius:9, cursor:"pointer", color: dark?Cb.ink:Cb.blue,
    background: dark?Cb.paper2:Cb.blueWash, border:`1px solid ${dark?Cb.line:"transparent"}` }}>{label}</button>;
}
function Row({ k, v, big, vColor }) {
  return <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"3px 0" }}>
    <span style={{ font:`${big?700:500} ${big?15:13}px/1 ${Fb.ui}`, color:big?Cb.ink:Cb.inkSoft }}>{k}</span>
    <span style={{ font:`700 ${big?16:13}px/1 ${Fb.mono}`, color: vColor||Cb.inkSoft }}>{v}</span>
  </div>;
}

/* ---------------- COBRO ---------------- */
function CobroScreen({ ai }) {
  const c = Db.cobro;
  const [modo, setModo] = useState("contado");
  const [precio, setPrecio] = useState(0);
  const linea = c.pedido.lineas[0];
  const total = linea.kg * precio;
  return (
    <div>
      <ScreenHead title="Cobro" desc="Cola de cobro: pedidos ya pesados, listos para cobrar de contado o a crédito." />
      <Slot id="cobro" ai={ai} />
      <div style={{ display:"grid", gridTemplateColumns:"320px 1fr", gap:14, alignItems:"start" }} className="cg-two-col">
        <Card pad={0} style={{ overflow:"hidden" }}>
          <div style={{ padding:"15px 16px", borderBottom:`1px solid ${Cb.line}`, background:Cb.paper2,
            display:"flex", alignItems:"center", gap:9 }}>
            <Icon name="banknote" size={18} color={Cb.ink} />
            <div>
              <div style={{ font:`700 15px/1 ${Fb.ui}`, color:Cb.ink }}>Cola de cobro</div>
              <div style={{ font:`500 12px/1 ${Fb.ui}`, color:Cb.inkSoft, marginTop:4 }}>1 pedido pesado</div>
            </div>
          </div>
          <div style={{ padding:12 }}>
            <div style={{ borderRadius:12, border:`1px solid ${Cb.chrome}`, background:Cb.chrome, padding:"14px 15px" }}>
              <div style={{ font:`700 14px/1 ${Fb.ui}`, color:Cb.chromeFg }}>#{c.pedido.id} · {c.pedido.cliente}</div>
              <div style={{ font:`500 12px/1 ${Fb.ui}`, color:"rgba(241,231,214,0.6)", marginTop:5 }}>{c.cola[0].items} producto</div>
            </div>
          </div>
        </Card>
        <Card>
          <div style={{ borderBottom:`1px solid ${Cb.line}`, paddingBottom:14, marginBottom:16 }}>
            <div style={{ font:`700 18px/1 ${Fb.ui}`, color:Cb.ink }}>{c.pedido.cliente}</div>
            <div style={{ font:`500 12px/1 ${Fb.ui}`, color:Cb.inkSoft, marginTop:4 }}>Pedido #{c.pedido.id}</div>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:18 }}>
            <thead><tr>{["Producto","Kg","Precio / Kg","Subtotal"].map((h,i)=>(
              <th key={i} style={{ textAlign:i===0?"left":"right", font:`600 11px/1 ${Fb.ui}`, letterSpacing:"0.05em",
                textTransform:"uppercase", color:Cb.inkFaint, padding:"0 4px 12px" }}>{h}</th>))}</tr></thead>
            <tbody>
              <tr style={{ borderTop:`1px solid ${Cb.lineSoft}` }}>
                <td style={{ padding:"14px 4px", font:`700 14px/1 ${Fb.ui}`, color:Cb.ink }}>{linea.producto}</td>
                <td style={{ padding:"14px 4px", textAlign:"right", font:`500 14px/1 ${Fb.mono}`, color:Cb.ink80 }}>{linea.kg.toFixed(3)}</td>
                <td style={{ padding:"14px 4px", textAlign:"right" }}>
                  <input value={precio||""} onChange={e=>setPrecio(parseFloat(e.target.value)||0)} placeholder="0.00" inputMode="decimal"
                    style={{ width:110, textAlign:"right", font:`600 15px/1 ${Fb.mono}`, color:Cb.ink, padding:"10px 12px",
                      borderRadius:10, border:`1px solid ${precio>0?Cb.green:Cb.line}`, background:Cb.paper2, outline:"none" }} />
                </td>
                <td style={{ padding:"14px 4px", textAlign:"right", font:`700 15px/1 ${Fb.mono}`, color:Cb.ink }}>{money(total)}</td>
              </tr>
            </tbody>
          </table>
          <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:18 }}>
            <div style={{ background:Cb.paper2, borderRadius:14, padding:"14px 22px", textAlign:"right", minWidth:180 }}>
              <Overline>Total</Overline>
              <div style={{ font:`400 34px/1 ${Fb.display}`, color: total>0?Cb.ink:Cb.inkFaint, marginTop:4 }}>{money(total)}</div>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11, marginBottom:11 }}>
            {[["contado","Contado","green"],["credito","Crédito","outline"]].map(([id,lab])=>{
              const on=modo===id;
              return <button key={id} onClick={()=>setModo(id)} style={{ cursor:"pointer", minHeight:54,
                font:`700 15px/1 ${Fb.ui}`, borderRadius:12,
                color: on?(id==="contado"?Cb.green:Cb.red):Cb.inkSoft,
                background: on?(id==="contado"?Cb.greenWash:Cb.redWash):Cb.paper2,
                border:`1.5px solid ${on?(id==="contado"?Cb.green:Cb.red):Cb.line}` }}>{lab}</button>;
            })}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:9, border:`1px solid ${Cb.line}`, borderRadius:11,
            padding:"13px 14px", marginBottom:14, background:Cb.paper2 }}>
            <Icon name="wallet" size={16} color={Cb.inkSoft} />
            <span style={{ font:`600 14px/1 ${Fb.ui}`, color:Cb.ink }}>Efectivo</span>
            <Icon name="chevron-down" size={16} color={Cb.inkFaint} style={{ marginLeft:"auto" }} />
          </div>
          <Btn kind={total>0?"green":"outline"} size="xl" block icon="receipt-text"
            style={ total>0?{}:{ background:Cb.paper2, color:Cb.inkFaint, cursor:"not-allowed" } }>
            Cobrar {money(total)}
          </Btn>
          <p style={{ textAlign:"center", margin:"12px 0 0", font:`400 12px/1.4 ${Fb.ui}`, color:Cb.inkSoft }}>
            Al cobrar se guardan estos precios para el próximo pedido del cliente.
          </p>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- CONFIGURACIÓN (landing) ---------------- */
function ConfigScreen({ ai, go }) {
  const items = window.CG.configItems.filter(i=>i.id!=="config");
  const [pw1,setPw1]=useState(""); const [c1,setC1]=useState("");
  const [pw2,setPw2]=useState(""); const [c2,setC2]=useState("");
  return (
    <div>
      <ScreenHead title="Configuración" desc="Catálogo, recetas, precios y parámetros del sistema. Todo lo de fondo vive aquí." />
      <Slot id="config" ai={ai} />
      <Card style={{ marginBottom:14 }}>
        <Overline style={{ marginBottom:4 }}>Configuración del sistema</Overline>
        <div style={{ font:`500 13px/1.4 ${Fb.ui}`, color:Cb.inkSoft, marginBottom:16 }}>Gestiona todos los parámetros desde aquí.</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:11 }}>
          {items.map(it=>(
            <button key={it.id} onClick={()=>go&&go(it.id)} className="cg-chip" style={{ textAlign:"left",
              cursor:"pointer", display:"flex", alignItems:"center", gap:12, padding:"15px 16px",
              borderRadius:13, border:`1px solid ${Cb.line}`, background:Cb.paper2 }}>
              <span style={{ width:40, height:40, borderRadius:11, background:Cb.paper, border:`1px solid ${Cb.line}`,
                display:"grid", placeItems:"center", flexShrink:0 }}>
                <Icon name={it.icon} size={19} color={Cb.red} />
              </span>
              <span style={{ font:`700 14px/1.2 ${Fb.ui}`, color:Cb.ink }}>{it.label}</span>
              <Icon name="chevron-right" size={16} color={Cb.inkFaint} style={{ marginLeft:"auto" }} />
            </button>
          ))}
        </div>
      </Card>
      {/* Zona de riesgo */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:14 }}>
        <DangerCard tone={Cb.red} title="Reset de inventario"
          desc="Pone en cero el stock de todos los productos y registra auditoría (RESET). Requiere contraseña de administrador."
          pw={pw1} setPw={setPw1} conf={c1} setConf={setC1} cta="Resetear inventario" />
        <DangerCard tone={Cb.amber} title="Reset de clientes y pedidos"
          desc="Borra clientes, pedidos, cobranza y precios por cliente. Genera respaldo con fecha antes de borrar."
          pw={pw2} setPw={setPw2} conf={c2} setConf={setC2} cta="Resetear clientes y pedidos" />
      </div>
    </div>
  );
}
function DangerCard({ tone, title, desc, pw, setPw, conf, setConf, cta }) {
  const armed = conf.trim().toUpperCase()==="RESET" && pw.length>0;
  return (
    <Card style={{ borderColor:tone, background: tone===Cb.red?Cb.redWash:Cb.amberWash }}>
      <div style={{ font:`700 15px/1 ${Fb.ui}`, color:tone, marginBottom:7 }}>{title}</div>
      <p style={{ margin:"0 0 14px", font:`400 12.5px/1.5 ${Fb.ui}`, color:Cb.ink80, textWrap:"pretty" }}>{desc}</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        <div>
          <Overline style={{ marginBottom:6 }}>Contraseña admin</Overline>
          <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••"
            style={inputStyle} />
        </div>
        <div>
          <Overline style={{ marginBottom:6 }}>Confirmación</Overline>
          <input value={conf} onChange={e=>setConf(e.target.value)} placeholder='Escribe "RESET"' style={inputStyle} />
        </div>
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end" }}>
        <Btn kind="primary" size="sm" style={{ background: armed?tone:Cb.inkFaint, border:"1px solid transparent",
          cursor: armed?"pointer":"not-allowed", opacity: armed?1:0.7 }}>{cta}</Btn>
      </div>
    </Card>
  );
}
const inputStyle = { width:"100%", font:`500 14px/1 ${Fb.mono}`, padding:"11px 12px", borderRadius:10,
  border:`1px solid ${Cb.line}`, background:Cb.paper, color:Cb.ink, outline:"none" };

/* ---------------- PLACEHOLDER (otros módulos) ---------------- */
function PlaceholderScreen({ id, ai }) {
  const label = window.CG.labelOf(id);
  return (
    <div>
      <ScreenHead title={label} desc="Esta pantalla conserva su lógica actual. Aquí la rediseñamos con la marca y con iAntonella cuando lleguemos a ella." />
      <Slot id={id} ai={ai} />
      <Card style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"64px 24px", textAlign:"center" }}>
        <PigBadge size={64} />
        <div style={{ font:`400 22px/1.1 ${Fb.display}`, color:Cb.ink, marginTop:18 }}>{label}</div>
        <p style={{ font:`400 14px/1.5 ${Fb.ui}`, color:Cb.inkSoft, maxWidth:420, marginTop:8, textWrap:"pretty" }}>
          Siguiente en la fila de rediseño. Mantendremos la estructura que ya conoces, aplicando el sistema de marca y el espacio de iAntonella.
        </p>
      </Card>
    </div>
  );
}

window.DespieceScreen = DespieceScreen;
window.BasculaScreen = BasculaScreen;
window.CobroScreen = CobroScreen;
window.ConfigScreen = ConfigScreen;
window.PlaceholderScreen = PlaceholderScreen;

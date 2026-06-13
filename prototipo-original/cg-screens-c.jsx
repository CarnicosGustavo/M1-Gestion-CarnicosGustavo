/* ============================================================
   Pantallas operativas (C) — Pedidos · Clientes · Cobranza ·
   Rendimiento · POS — nuevo diseño, fiel a la Guía UI/UX
   ============================================================ */
const Cx = window.CG.color;
const Fx = window.CG.font;
const OPS = window.CG.ops;
const mny  = window.money;
const mnyk = window.moneyk;
const SlotC = window.Slot;

/* Estado de pedido → tono (mapa de la guía) */
const ESTADO_TONE = {
  "Pagada":"green", "Lista para cobro":"blue", "Procesando pago":"blue",
  "Por pesar":"amber", "Parcial":"amber", "Cancelada":"red",
  "Pendiente":"amber", "Producción":"blue",
};

/* Barra de búsqueda + filtros reutilizable */
function SearchFilter({ placeholder, filters, value, onFilter, right }) {
  return (
    <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center", marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:9, border:`1px solid ${Cx.line}`, borderRadius:11,
        padding:"11px 14px", background:Cx.paper, flex:"1 1 240px", minWidth:0 }}>
        <Icon name="search" size={16} color={Cx.inkFaint} />
        <input placeholder={placeholder} style={{ flex:1, border:"none", background:"transparent", outline:"none",
          font:`500 14px/1 ${Fx.ui}`, color:Cx.ink, minWidth:0 }} />
      </div>
      {filters && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {filters.map(f=>{
            const on=value===f;
            return <button key={f} onClick={()=>onFilter&&onFilter(f)} style={{ font:`700 12.5px/1 ${Fx.ui}`,
              padding:"10px 13px", borderRadius:9, cursor:"pointer", border:`1px solid ${on?"transparent":Cx.line}`,
              color:on?Cx.chromeFg:Cx.inkSoft, background:on?Cx.chrome:Cx.paper }}>{f}</button>;
          })}
        </div>
      )}
      {right && <div style={{ marginLeft:"auto" }}>{right}</div>}
    </div>
  );
}

/* Botón de ícono para acciones de fila */
function RowAct({ icon, color, title }) {
  return <button title={title} style={{ width:34, height:34, borderRadius:8, border:`1px solid ${Cx.line}`,
    background:Cx.paper, cursor:"pointer", display:"grid", placeItems:"center" }}>
    <Icon name={icon} size={15} color={color||Cx.inkSoft} /></button>;
}
const thBase = (align)=>({ textAlign:align, font:`700 11px/1 ${Fx.ui}`, letterSpacing:"0.05em",
  textTransform:"uppercase", color:Cx.inkFaint, padding:"12px 14px" });

/* ---------------- PEDIDOS ---------------- */
function PedidosScreen({ ai }) {
  const [filtro, setFiltro] = useState("Todos");
  const [nuevoPedido, setNuevoPedido] = useState(false);
  const [pesaje, setPesaje] = useState(null);     // {n, pedido, precio} o null
  const [extra, setExtra] = useState([]);          // pedidos creados en sesión
  const base = OPS.pedidos;
  const all = [...extra, ...base];
  const data = all.filter(p=> filtro==="Todos" || p.estado===filtro);

  const rowMenu = (p) => [
    { label:"Ver detalle", icon:"eye", onClick:()=>ai.chip(`Abrir pedido #${p.id}`) },
    { label:"Editar pedido", icon:"file-pen", onClick:()=>ai.chip(`Editar pedido #${p.id}`) },
    ...(p.estado==="Por pesar" || p.estado==="Parcial"
      ? [{ label:"Ir a Pesaje", icon:"scale", onClick:()=>setPesaje({ n:"PIERNA", pedido:`#${p.id}`, precio:70 }) }] : []),
    ...(p.estado==="Lista para cobro"
      ? [{ label:"Ir a Pesaje", icon:"scale", onClick:()=>setPesaje({ n:"PIERNA", pedido:`#${p.id}`, precio:70 }) }] : []),
    { sep:true },
    { label:"Imprimir ticket", icon:"printer", onClick:()=>ai.chip(`Imprimir ticket #${p.id}`) },
    { label:"Duplicar", icon:"copy", onClick:()=>ai.chip(`Duplicar pedido #${p.id}`) },
    { label:"Enviar por WhatsApp", icon:"message-circle", onClick:()=>ai.chip(`Enviar #${p.id} por WhatsApp`) },
    { sep:true },
    ...(p.estado!=="Cancelada" ? [{ label:"Cancelar pedido", icon:"ban", onClick:()=>ai.chip(`Cancelar #${p.id}`) }] : []),
    { label:"Eliminar", icon:"trash-2", danger:true, onClick:()=>ai.chip(`Eliminar #${p.id}`) },
  ];

  return (
    <div>
      <ScreenHead title="Pedidos" desc="Listado central de pedidos del día. Crea, edita, pesa, imprime tickets y entra al detalle."
        right={
          <SplitButton kind="primary" icon="plus" onClick={()=>setNuevoPedido(true)}
            items={[
              { label:"Pedido mostrador", icon:"store", onClick:()=>setNuevoPedido(true) },
              { label:"Pedido a crédito", icon:"hand-coins", onClick:()=>setNuevoPedido(true) },
              { sep:true },
              { label:"Pesar producto", icon:"scale", onClick:()=>setPesaje({ n:"PIERNA", pedido:"libre", precio:70 }) },
              { label:"Importar pedidos (CSV)", icon:"upload", onClick:()=>ai.chip("Importar pedidos") },
            ]}>
            Nuevo pedido
          </SplitButton>
        } />
      <SlotC id="pedidos" ai={ai} />
      <Card pad={0} style={{ overflow:"hidden" }}>
        <div style={{ padding:16, borderBottom:`1px solid ${Cx.line}` }}>
          <SearchFilter placeholder="Buscar pedido o cliente…" value={filtro} onFilter={setFiltro}
            filters={["Todos","Pagada","Por pesar","Lista para cobro","Cancelada"]}
            right={
              <Menu align="right" items={[
                { label:"Exportar CSV", icon:"download", onClick:()=>ai.chip("Exportar pedidos CSV") },
                { label:"Imprimir lista", icon:"printer", onClick:()=>ai.chip("Imprimir lista de pedidos") },
                { label:"Ordenar por total", icon:"arrow-down-wide-narrow", onClick:()=>{} },
                { label:"Ordenar por fecha", icon:"calendar", onClick:()=>{} },
              ]} trigger={<Btn kind="outline" size="sm" icon="sliders-horizontal">Vista</Btn>} />
            } />
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:680 }}>
            <thead><tr style={{ background:Cx.paper2 }}>
              <th style={thBase("left")}>Pedido</th><th style={thBase("left")}>Cliente</th>
              <th style={thBase("right")}>Total</th><th style={thBase("left")}>Estado</th>
              <th style={thBase("left")}>Fecha</th><th style={thBase("center")}>Acciones</th>
            </tr></thead>
            <tbody>
              {data.map(p=>(
                <tr key={p.id} style={{ borderTop:`1px solid ${Cx.lineSoft}` }}>
                  <td style={{ padding:"13px 14px", font:`700 13.5px/1 ${Fx.mono}`, color:Cx.ink }}>#{p.id}</td>
                  <td style={{ padding:"13px 14px", font:`700 13.5px/1 ${Fx.ui}`, color:Cx.ink }}>{p.cliente}
                    <span style={{ font:`500 11.5px/1 ${Fx.ui}`, color:Cx.inkFaint, marginLeft:8 }}>{p.items} art.</span></td>
                  <td style={{ padding:"13px 14px", textAlign:"right", font:`700 13.5px/1 ${Fx.mono}`,
                    color: p.total>0?Cx.ink:Cx.inkFaint }}>{p.total>0?mny(p.total):"—"}</td>
                  <td style={{ padding:"13px 14px" }}><Badge tone={ESTADO_TONE[p.estado]}>{p.estado}</Badge></td>
                  <td style={{ padding:"13px 14px", font:`500 13px/1 ${Fx.mono}`, color:Cx.inkSoft }}>{p.fecha}</td>
                  <td style={{ padding:"13px 14px" }}>
                    <div style={{ display:"flex", gap:7, justifyContent:"center", alignItems:"center" }}>
                      <RowAct icon="eye" title="Ver detalle" />
                      {(p.estado==="Por pesar"||p.estado==="Parcial") &&
                        <button title="Pesar" onClick={()=>setPesaje({ n:"PIERNA", pedido:`#${p.id}`, precio:70 })}
                          style={{ width:34, height:34, borderRadius:8, border:`1px solid ${Cx.amber}`, background:Cx.amberWash,
                            cursor:"pointer", display:"grid", placeItems:"center" }}>
                          <Icon name="scale" size={15} color={Cx.amber} /></button>}
                      <Kebab items={rowMenu(p)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <NuevoPedidoModal open={nuevoPedido} onClose={()=>setNuevoPedido(false)}
        onCreate={(o)=>{ const id = 360 + extra.length;
          setExtra(arr => [{ id, cliente:o.cliente, total:o.total, items:o.items.length,
            estado: o.items.some(x=>x.disp==="pesaje"||x.disp==="despiece")?"Por pesar":"Lista para cobro", fecha:"12/06" }, ...arr]); }} />
      <PesajeModal open={!!pesaje} producto={pesaje} onClose={()=>setPesaje(null)}
        onRegister={()=>{}} />
    </div>
  );
}

/* ---------------- CLIENTES ---------------- */
function ClientesScreen({ ai }) {
  const [filtro, setFiltro] = useState("Todos");
  const [nuevo, setNuevo] = useState(false);
  const [extra, setExtra] = useState([]);
  const all = [...extra, ...OPS.clientes];
  const data = all.filter(c=> filtro==="Todos" || c.estado===filtro);
  return (
    <div>
      <ScreenHead title="Clientes" desc="Lista maestra de carnicerías y negocios. Busca, da de alta y entra a la ficha 360°."
        right={<Btn kind="primary" icon="user-plus" onClick={()=>setNuevo(true)}>Agregar cliente</Btn>} />
      <SlotC id="clientes" ai={ai} />
      <Card pad={0} style={{ overflow:"hidden" }}>
        <div style={{ padding:16, borderBottom:`1px solid ${Cx.line}` }}>
          <SearchFilter placeholder="Buscar cliente…" value={filtro} onFilter={setFiltro}
            filters={["Todos","Activo","Inactivo"]} right={<Btn kind="outline" size="sm" icon="download">CSV</Btn>} />
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:640 }}>
            <thead><tr style={{ background:Cx.paper2 }}>
              <th style={thBase("left")}>Negocio</th><th style={thBase("left")}>Teléfono</th>
              <th style={thBase("right")}>Saldo</th><th style={thBase("left")}>Estado</th>
              <th style={thBase("center")}>Acciones</th>
            </tr></thead>
            <tbody>
              {data.map(c=>(
                <tr key={c.id} style={{ borderTop:`1px solid ${Cx.lineSoft}` }}>
                  <td style={{ padding:"13px 14px" }}>
                    <div style={{ font:`700 13.5px/1.1 ${Fx.ui}`, color:Cx.ink }}>{c.nombre}</div>
                    <div style={{ font:`500 11px/1 ${Fx.ui}`, color:Cx.inkFaint, marginTop:4 }}>{c.pedidos} pedidos · {mnyk(c.gastado)}</div>
                  </td>
                  <td style={{ padding:"13px 14px", font:`500 13px/1 ${Fx.mono}`, color: c.tel?Cx.ink80:Cx.inkFaint }}>{c.tel||"—"}</td>
                  <td style={{ padding:"13px 14px", textAlign:"right", font:`700 13px/1 ${Fx.mono}`,
                    color: c.saldo>0?Cx.red:Cx.inkFaint }}>{c.saldo>0?mny(c.saldo):"$0.00"}</td>
                  <td style={{ padding:"13px 14px" }}><Badge tone={c.estado==="Activo"?"green":"ghost"}>{c.estado}</Badge></td>
                  <td style={{ padding:"13px 14px" }}>
                    <div style={{ display:"flex", gap:7, justifyContent:"center", alignItems:"center" }}>
                      {c.tel && <RowAct icon="message-circle" color={Cx.green} title="WhatsApp" />}
                      <Kebab items={[
                        { label:"Ver ficha 360°", icon:"id-card", onClick:()=>ai.chip(`Ficha de ${c.nombre}`) },
                        { label:"Nuevo pedido", icon:"plus", onClick:()=>ai.chip(`Nuevo pedido para ${c.nombre}`) },
                        { label:"Editar cliente", icon:"file-pen", onClick:()=>ai.chip(`Editar ${c.nombre}`) },
                        ...(c.tel ? [{ label:"WhatsApp", icon:"message-circle", onClick:()=>ai.chip(`WhatsApp a ${c.nombre}`) }] : []),
                        { label:"Estado de cuenta", icon:"file-text", onClick:()=>ai.chip(`Estado de cuenta ${c.nombre}`) },
                        { sep:true },
                        { label:"Eliminar", icon:"trash-2", danger:true, onClick:()=>ai.chip(`Eliminar ${c.nombre}`) },
                      ]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <NuevoClienteModal open={nuevo} onClose={()=>setNuevo(false)}
        onCreate={(c)=>{ const id = 100 + extra.length;
          setExtra(arr => [{ id, nombre:c.nombre, tel:c.tel, saldo:0, estado:"Activo", pedidos:0, gastado:0 }, ...arr]); }} />
    </div>
  );
}

/* ---------------- COBRANZA ---------------- */
function CobranzaScreen({ ai }) {
  const data = OPS.cobranza.filter(c=>c.saldo>0);
  const total = data.reduce((s,c)=>s+c.saldo,0);
  const antig = (d)=> d<=30?["green",d+" días"] : d<=60?["amber",d+" días"] : ["red",d+" días"];
  return (
    <div>
      <ScreenHead title="Cobranza" desc="Cuentas por cobrar: pedidos a crédito y tickets viejos. Registra abonos y manda recordatorios."
        right={<Btn kind="outline" icon="plus">Capturar ticket viejo</Btn>} />
      <SlotC id="cobranza" ai={ai} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14, marginBottom:16 }}>
        <Card pad={18} style={{ background:Cx.redWash, borderColor:"transparent" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <Overline color={Cx.red}>Total por cobrar</Overline><Icon name="hand-coins" size={18} color={Cx.red} />
          </div>
          <Stat value={mnyk(total)} color={Cx.red} size={32} />
          <div style={{ font:`500 12px/1 ${Fx.ui}`, color:Cx.red, marginTop:8 }}>{data.length} clientes con saldo</div>
        </Card>
        <Card pad={18}>
          <Overline style={{ marginBottom:10 }}>Vencido +60 días</Overline>
          <Stat value={mnyk(data.filter(c=>c.dias>60).reduce((s,c)=>s+c.saldo,0))} color={Cx.ink} size={32} />
          <div style={{ font:`500 12px/1 ${Fx.ui}`, color:Cx.inkSoft, marginTop:8 }}>Prioriza estos recordatorios</div>
        </Card>
      </div>
      <Card pad={0} style={{ overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:700 }}>
            <thead><tr style={{ background:Cx.paper2 }}>
              <th style={thBase("left")}>Cliente</th><th style={thBase("right")}>Cargos</th>
              <th style={thBase("right")}>Abonos</th><th style={thBase("right")}>Saldo</th>
              <th style={thBase("left")}>Antigüedad</th><th style={thBase("center")}>Acciones</th>
            </tr></thead>
            <tbody>
              {data.map((c,i)=>{
                const [tone,lab]=antig(c.dias);
                return (
                  <tr key={i} style={{ borderTop:`1px solid ${Cx.lineSoft}` }}>
                    <td style={{ padding:"13px 14px", font:`700 13.5px/1 ${Fx.ui}`, color:Cx.ink }}>{c.cliente}</td>
                    <td style={{ padding:"13px 14px", textAlign:"right", font:`500 13px/1 ${Fx.mono}`, color:Cx.ink80 }}>{mny(c.cargos)}</td>
                    <td style={{ padding:"13px 14px", textAlign:"right", font:`500 13px/1 ${Fx.mono}`, color:Cx.green }}>{mny(c.abonos)}</td>
                    <td style={{ padding:"13px 14px", textAlign:"right", font:`700 13.5px/1 ${Fx.mono}`, color:Cx.red }}>{mny(c.saldo)}</td>
                    <td style={{ padding:"13px 14px" }}><Badge tone={tone}>{lab}</Badge></td>
                    <td style={{ padding:"13px 14px" }}>
                      <div style={{ display:"flex", gap:7, justifyContent:"center", alignItems:"center" }}>
                        <Btn kind="green" size="sm" icon="banknote">Abonar</Btn>
                        <Kebab items={[
                          { label:"Registrar abono", icon:"banknote", onClick:()=>ai.chip(`Abono de ${c.cliente}`) },
                          { label:"Estado de cuenta", icon:"file-text", onClick:()=>ai.chip(`Estado de cuenta ${c.cliente}`) },
                          { label:"Recordatorio WhatsApp", icon:"message-circle", onClick:()=>ai.chip(`Recordar a ${c.cliente}`) },
                          { label:"Ver pedidos a crédito", icon:"receipt-text", onClick:()=>ai.chip(`Pedidos a crédito de ${c.cliente}`) },
                        ]} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

window.PedidosScreen = PedidosScreen;
window.ClientesScreen = ClientesScreen;
window.CobranzaScreen = CobranzaScreen;

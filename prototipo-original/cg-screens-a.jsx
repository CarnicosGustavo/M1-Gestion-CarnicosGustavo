/* ============================================================
   Pantallas reskin — Cárnicos Gustavo
   ============================================================ */
const Cs = window.CG.color;
const Fs = window.CG.font;
const D  = window.CG.data;
const A  = window.CG.antonella;

const money = (n) => "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyk = (n) => "$" + n.toLocaleString("es-MX");

/* helper: slot de Antonella conectado a la App */
function Slot({ id, ai }) {
  const d = (A[id] || A.default).slot;
  return <AntonellaSlot data={d} onChip={(t)=>ai.chip(t)} onOpen={()=>ai.open()} onNav={(m)=>window.__cgGo&&window.__cgGo(m)} />;
}

/* ---------------- PANEL ---------------- */
function PanelScreen({ ai }) {
  const p = D.panel;
  const [hide, setHide] = useState(false);
  const m = (v)=> hide ? "•  •  •" : moneyk(v);
  const totalCat = p.ingresosCat.reduce((s,x)=>s+x.v,0);
  // donut conic
  let acc = 0;
  const stops = p.ingresosCat.map(x=>{ const a=acc; acc+=x.v/totalCat*100; return `${Cs[x.c]} ${a}% ${acc}%`; }).join(",");
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:22, flexWrap:"wrap",
        background:Cs.cream, border:`1px solid ${Cs.line}`, borderRadius:20,
        padding:"16px 24px", marginBottom:18, boxShadow:Cs.shadow }}>
        <img src="assets/logo-principal.png" alt="Cárnicos Gustavo"
          style={{ height:132, width:"auto", display:"block", flexShrink:0 }} />
        <div style={{ flex:1, minWidth:220 }}>
          <div style={{ font:`700 11px/1 ${Fs.ui}`, letterSpacing:"0.22em", textTransform:"uppercase",
            color:"#9E3326", marginBottom:9 }}>Centro de Distribución</div>
          <h1 style={{ margin:0, font:`400 34px/0.95 ${Fs.display}`, color:"#211C19", letterSpacing:"0.01em" }}>
            Buen día, Gustavo
          </h1>
          <p style={{ margin:"10px 0 0", font:`400 14px/1.5 ${Fs.ui}`, color:"#6B625A", textWrap:"pretty" }}>
            Hoy: 80 canales en piso · 1 pedido en cola de cobro · 2 cuentas por cobrar vencen hoy.
            <span style={{ color:"#9A9087" }}>  ·  {D.panel ? "Jueves 12 de junio, 2026" : ""}</span>
          </p>
        </div>
        <Btn kind="outline" icon={hide?"eye":"eye-off"} onClick={()=>setHide(h=>!h)}
          style={{ background:"#FBF7EF", color:"#211C19", border:"1px solid rgba(33,28,25,0.14)" }}>
          {hide?"Mostrar montos":"Ocultar montos"}
        </Btn>
      </div>
      <Slot id="panel" ai={ai} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:14, marginBottom:14 }}>
        {[["Ingresos totales","trending-up",p.ingresos,Cs.ink,"Ventas completadas"],
          ["Gastos totales","wallet",p.gastos,Cs.ink,"Egresos completados"],
          ["Ganancia neta","badge-dollar-sign",p.ganancia,Cs.green,`Margen ${p.margen}%`]].map(([t,ic,v,col,sub],i)=>(
          <Card key={i} pad={18}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <Overline>{t}</Overline>
              <Icon name={ic} size={18} color={i===2?Cs.green:Cs.inkFaint} />
            </div>
            <Stat value={hide?"• • •":moneyk(v)} color={col} size={32} />
            <div style={{ font:`500 12px/1 ${Fs.ui}`, color:Cs.inkSoft, marginTop:8 }}>{sub}</div>
          </Card>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:14 }}>
        <Card>
          <Overline style={{ marginBottom:4 }}>Ingresos por categoría</Overline>
          <div style={{ font:`500 12px/1 ${Fs.ui}`, color:Cs.inkSoft, marginBottom:16 }}>Distribución de ventas</div>
          <div style={{ display:"flex", gap:22, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ width:150, height:150, borderRadius:"50%", flexShrink:0,
              background:`conic-gradient(${stops})`, position:"relative" }}>
              <div style={{ position:"absolute", inset:34, borderRadius:"50%", background:Cs.paper,
                display:"grid", placeItems:"center", textAlign:"center" }}>
                <div>
                  <div style={{ font:`400 20px/1 ${Fs.display}`, color:Cs.ink }}>{hide?"•••":moneyk(totalCat)}</div>
                  <div style={{ font:`600 10px/1 ${Fs.ui}`, color:Cs.inkSoft, marginTop:3, letterSpacing:"0.06em" }}>TOTAL</div>
                </div>
              </div>
            </div>
            <div style={{ flex:1, minWidth:140 }}>
              {p.ingresosCat.map((x,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 0",
                  borderBottom:i<p.ingresosCat.length-1?`1px solid ${Cs.lineSoft}`:"none" }}>
                  <span style={{ width:10, height:10, borderRadius:3, background:Cs[x.c] }} />
                  <span style={{ flex:1, font:`600 13px/1 ${Fs.ui}`, color:Cs.ink80 }}>{x.n}</span>
                  <span style={{ font:`500 13px/1 ${Fs.mono}`, color:Cs.inkSoft }}>{hide?"•••":moneyk(x.v)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <Overline style={{ marginBottom:4 }}>Flujo de caja</Overline>
          <div style={{ font:`500 12px/1 ${Fs.ui}`, color:Cs.inkSoft, marginBottom:18 }}>Volumen diario · últimas 12 jornadas</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:7, height:150 }}>
            {p.flujo.map((v,i)=>(
              <div key={i} style={{ flex:1, height:`${v}%`, borderRadius:"5px 5px 0 0",
                background: i===p.flujo.length-1?Cs.red:Cs.tan, opacity:i===p.flujo.length-1?1:0.55,
                transition:"height .5s ease" }} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- COMPRA DEL DÍA ---------------- */
function CompraScreen({ ai }) {
  const c = D.compra;
  const chips = [
    ["Americanos", c.americanos, Cs.red, Cs.redWash],
    ["Nacionales", c.nacionales, Cs.green, Cs.greenWash],
    ["Canales (total)", c.canales, Cs.ink, "transparent"],
    ["Kg en pie", c.kgPie.toLocaleString("es-MX"), Cs.ink, "transparent"],
    ["Kg / canal", c.kgCanal, Cs.ink, "transparent"],
  ];
  return (
    <div>
      <ScreenHead title="Compra del día" desc="El día empieza aquí: registra la compra en pie por proveedor. Es la base del rendimiento."
        right={<Btn kind="dark" icon="save">Guardar compra del día</Btn>} />
      <Card pad={16} style={{ marginBottom:14, display:"flex", gap:12, flexWrap:"wrap", alignItems:"flex-end" }}>
        <div>
          <Overline style={{ marginBottom:7 }}>Día de operación</Overline>
          <div style={{ display:"inline-flex", alignItems:"center", gap:9, border:`1px solid ${Cs.line}`,
            borderRadius:11, padding:"11px 14px", font:`600 14px/1 ${Fs.mono}`, color:Cs.ink, background:Cs.paper2 }}>
            <Icon name="calendar" size={16} color={Cs.inkSoft} /> {c.fecha}
          </div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:9 }}>
          <Btn kind="outline" icon="rotate-ccw">Hoy</Btn>
          <Btn kind="ghost">Empezar de ceros</Btn>
        </div>
      </Card>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:16 }}>
        {chips.map(([t,v,col,bg],i)=>(
          <Card key={i} pad={16} style={{ background: bg==="transparent"?Cs.paper:bg, borderColor: bg==="transparent"?Cs.line:"transparent" }}>
            <div style={{ font:`600 12px/1.2 ${Fs.ui}`, color: bg==="transparent"?Cs.inkSoft:col, marginBottom:9,
              display:"flex", alignItems:"center", gap:6 }}>
              {i<2 && <Icon name="piggy-bank" size={14} color={col} />}{t}
            </div>
            <Stat value={v} color={col} size={30} />
          </Card>
        ))}
      </div>
      <Slot id="compra" ai={ai} />
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h3 style={{ margin:0, font:`700 16px/1 ${Fs.ui}`, color:Cs.ink }}>Compra en pie por proveedor</h3>
          <Btn kind="outline" size="sm" icon="plus">Agregar proveedor</Btn>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:640 }}>
            <thead>
              <tr>{["Proveedor","Americanos","Nacionales","Canales","Kg en pie","$ / kg","Kg/canal"].map((h,i)=>(
                <th key={i} style={{ textAlign:i===0?"left":"right", font:`600 11px/1 ${Fs.ui}`, letterSpacing:"0.06em",
                  textTransform:"uppercase", color:Cs.inkFaint, padding:"0 12px 12px" }}>{h}</th>))}</tr>
            </thead>
            <tbody>
              {c.proveedores.map((p,i)=>(
                <tr key={i} style={{ borderTop:`1px solid ${Cs.lineSoft}` }}>
                  <td style={{ padding:"14px 12px", font:`700 14px/1 ${Fs.ui}`, color:Cs.ink }}>{p.nombre}</td>
                  <Cell v={p.americanos} accent={p.americanos>0?Cs.red:null} />
                  <Cell v={p.nacionales} accent={p.nacionales>0?Cs.green:null} />
                  <Cell v={p.canales} bold />
                  <Cell v={p.kgPie.toLocaleString("es-MX")} />
                  <Cell v={p.precioKg.toFixed(1)} />
                  <td style={{ textAlign:"right", padding:"14px 12px", font:`500 14px/1 ${Fs.mono}`, color:Cs.inkSoft }}>{p.kgCanal.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin:"14px 4px 0", font:`400 12.5px/1.5 ${Fs.ui}`, color:Cs.inkSoft, textWrap:"pretty" }}>
          1 americano = 1 canal completo · 1 nacional = 1 lado Lomo + 1 lado Espilomo. El total de kg alimenta el Rendimiento.
        </p>
      </Card>
    </div>
  );
}
function Cell({ v, accent, bold }) {
  return <td style={{ textAlign:"right", padding:"14px 12px",
    font:`${bold?700:500} 14px/1 ${Fs.mono}`, color: accent || (bold?Cs.ink:Cs.ink80) }}>{v}</td>;
}

window.money = money;
window.moneyk = moneyk;
window.Slot = Slot;
window.PanelScreen = PanelScreen;
window.CompraScreen = CompraScreen;

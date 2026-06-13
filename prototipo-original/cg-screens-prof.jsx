/* ============================================================
   Flujos adicionales — Perfil, Clientes, Cobranza
   ============================================================ */
const Cf = window.CG.color;
const Ff = window.CG.font;
const mnyF = (v) => (window.money ? window.money(v) : "$" + (v||0).toLocaleString("es-MX", { minimumFractionDigits:2, maximumFractionDigits:2 }));

/* -------- MODAL ABONAR -------- */
function AbonarModal({ open, onClose, cliente, onAbono }) {
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [nota, setNota] = useState("");
  useEffect(()=>{ if(open){ setMonto(""); setMetodo("efectivo"); setNota(""); } }, [open, cliente]);
  const valid = parseFloat(monto) > 0;
  return (
    <Modal open={open} onClose={onClose} icon="banknote" title="Registrar abono" width={520}
      subtitle={`Cliente: ${cliente?.nombre || "—"} · Saldo actual: ${mnyF(cliente?.saldo || 0)}`}
      footer={
        <>
          <Btn kind="outline" onClick={onClose}>Cancelar</Btn>
          <Btn kind="green" icon="check" onClick={()=>{ onAbono && onAbono({ monto: parseFloat(monto), metodo, nota }); onClose(); }}
            style={{ opacity: valid?1:0.5, pointerEvents: valid?"auto":"none" }}>
            Registrar abono
          </Btn>
        </>
      }>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
        <FormField label="Monto">
          <TextInput value={monto} onChange={e=>setMonto(e.target.value)} placeholder="0.00" type="number"
            right={<span style={{ font:`600 12px/1 ${Ff.ui}`, color:Cf.inkFaint }}>$</span>} />
        </FormField>
        <FormField label="Método">
          <div style={{ position:"relative" }}>
            <select value={metodo} onChange={e=>setMetodo(e.target.value)} style={selStyle}>
              <option value="efectivo">Efectivo</option>
              <option value="cheque">Cheque</option>
              <option value="transferencia">Transferencia</option>
              <option value="otro">Otro</option>
            </select>
            <Icon name="chevron-down" size={15} color={Cf.inkFaint} style={caret} />
          </div>
        </FormField>
      </div>
      <FormField label="Nota (opcional)">
        <textarea value={nota} onChange={e=>setNota(e.target.value)} placeholder="Ej: Referencia de transferencia, número de cheque..."
          style={{ width:"100%", font:`500 13px/1.5 ${Ff.ui}`, color:Cf.ink, background:Cf.paper,
            border:`1px solid ${Cf.line}`, borderRadius:10, padding:"11px 13px", outline:"none", minHeight:80, resize:"vertical" }} />
      </FormField>
      <div style={{ marginTop:14, padding:"11px 13px", borderRadius:11, background:Cf.paper2 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ font:`600 12px/1 ${Ff.ui}`, color:Cf.inkSoft }}>Nuevo saldo</span>
          <span style={{ font:`700 18px/1 ${Ff.display}`, color:Cf.red }}>
            {mnyF((cliente?.saldo || 0) - (parseFloat(monto) || 0))}
          </span>
        </div>
      </div>
    </Modal>
  );
}
window.AbonarModal = AbonarModal;

/* -------- MODAL EDITAR CLIENTE -------- */
function EditarClienteModal({ open, onClose, cliente, onSave }) {
  const [nombre, setNombre] = useState("");
  const [tel, setTel] = useState("");
  const [dir, setDir] = useState("");
  useEffect(()=>{
    if(open && cliente){ setNombre(cliente.nombre||""); setTel(cliente.tel||""); setDir(cliente.direccion||""); }
  }, [open, cliente]);
  const valid = nombre.trim().length > 0;
  return (
    <Modal open={open} onClose={onClose} icon="file-pen" title="Editar cliente" width={520}
      footer={
        <>
          <Btn kind="outline" onClick={onClose}>Cancelar</Btn>
          <Btn kind="primary" icon="save" onClick={()=>{ onSave && onSave({ nombre, tel, dir }); onClose(); }}
            style={{ opacity: valid?1:0.5, pointerEvents: valid?"auto":"none" }}>
            Guardar cambios
          </Btn>
        </>
      }>
      <FormField label="Nombre del cliente">
        <TextInput value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Ej: Carnicería El Sol" />
      </FormField>
      <FormField label="Teléfono">
        <TextInput value={tel} onChange={e=>setTel(e.target.value)} placeholder="+56 9 1234 5678" />
      </FormField>
      <FormField label="Dirección">
        <textarea value={dir} onChange={e=>setDir(e.target.value)} placeholder="Calle, número, ciudad..."
          style={{ width:"100%", font:`500 13px/1.5 ${Ff.ui}`, color:Cf.ink, background:Cf.paper,
            border:`1px solid ${Cf.line}`, borderRadius:10, padding:"11px 13px", outline:"none", minHeight:70, resize:"vertical" }} />
      </FormField>
    </Modal>
  );
}
window.EditarClienteModal = EditarClienteModal;

/* -------- PANTALLA PERFIL -------- */
function ProfileScreen({ ai }) {
  const user = { nombre:"Gustavo Balderas", rol:"Administrador", email:"gustavo@carnicosgustavo.com", 
    empresa:"Cárnicos Gustavo", desdeHace:"3 años" };
  const [newPass, setNewPass] = useState("");
  const [darkMode, setDarkMode] = useState(localStorage.getItem("cg_mode")==="dark");
  
  return (
    <div>
      <ScreenHead title="Perfil" desc="Tu cuenta, preferencias y configuración de la plataforma." />
      <SlotC id="profile" ai={ai} />
      
      <div style={{ maxWidth:680, margin:"0 auto" }}>
        {/* Tarjeta de usuario */}
        <Card style={{ marginBottom:16, display:"flex", gap:16 }}>
          <div style={{ width:80, height:80, borderRadius:16, background:Cf.redWash, display:"grid", placeItems:"center", flexShrink:0 }}>
            <Icon name="user-circle" size={48} color={Cf.red} />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ font:`700 18px/1.2 ${Ff.ui}`, color:Cf.ink }}>{user.nombre}</div>
            <div style={{ font:`500 13px/1.3 ${Ff.ui}`, color:Cf.inkSoft, marginTop:4 }}>
              {user.rol} · {user.empresa}
            </div>
            <div style={{ font:`500 12px/1.3 ${Ff.mono}`, color:Cf.inkFaint, marginTop:7 }}>
              {user.email}
            </div>
            <div style={{ display:"flex", gap:10, marginTop:12 }}>
              <Btn kind="outline" size="sm" icon="mail">Cambiar email</Btn>
              <Btn kind="outline" size="sm" icon="key">Nueva contraseña</Btn>
            </div>
          </div>
        </Card>

        {/* Preferencias */}
        <Card style={{ marginBottom:16 }}>
          <Label>Preferencias de la plataforma</Label>
          <div style={{ marginTop:14, display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <div>
              <div style={{ font:`600 12px/1 ${Ff.ui}`, color:Cf.inkSoft, marginBottom:8 }}>Tema</div>
              <div style={{ display:"flex", gap:7 }}>
                <button onClick={()=>{ setDarkMode(false); localStorage.setItem("cg_mode","light"); }} 
                  style={{ flex:1, padding:"10px 12px", borderRadius:10, border:`2px solid ${!darkMode?Cf.red:Cf.line}`,
                    background:!darkMode?Cf.redWash:Cf.paper, cursor:"pointer", font:`700 12px/1 ${Ff.ui}`, color:Cf.ink }}>
                  ☀️ Claro
                </button>
                <button onClick={()=>{ setDarkMode(true); localStorage.setItem("cg_mode","dark"); }}
                  style={{ flex:1, padding:"10px 12px", borderRadius:10, border:`2px solid ${darkMode?Cf.red:Cf.line}`,
                    background:darkMode?Cf.redWash:Cf.paper, cursor:"pointer", font:`700 12px/1 ${Ff.ui}`, color:Cf.ink }}>
                  🌙 Oscuro
                </button>
              </div>
            </div>
            <div>
              <div style={{ font:`600 12px/1 ${Ff.ui}`, color:Cf.inkSoft, marginBottom:8 }}>Notificaciones</div>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
                <input type="checkbox" defaultChecked style={{ width:18, height:18, cursor:"pointer" }} />
                <span style={{ font:`500 13px/1 ${Ff.ui}`, color:Cf.ink }}>Alertas operativas</span>
              </label>
            </div>
          </div>
        </Card>

        {/* Información */}
        <Card style={{ marginBottom:16 }}>
          <Label>Información de la cuenta</Label>
          <div style={{ marginTop:14, display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <div style={{ font:`600 11px/1 ${Ff.ui}`, color:Cf.inkFaint, textTransform:"uppercase", marginBottom:6 }}>Empresa</div>
              <div style={{ font:`500 13px/1 ${Ff.ui}`, color:Cf.ink }}>{user.empresa}</div>
            </div>
            <div>
              <div style={{ font:`600 11px/1 ${Ff.ui}`, color:Cf.inkFaint, textTransform:"uppercase", marginBottom:6 }}>Miembro desde</div>
              <div style={{ font:`500 13px/1 ${Ff.ui}`, color:Cf.ink }}>{user.desdeHace}</div>
            </div>
            <div>
              <div style={{ font:`600 11px/1 ${Ff.ui}`, color:Cf.inkFaint, textTransform:"uppercase", marginBottom:6 }}>Plan</div>
              <div style={{ font:`500 13px/1 ${Ff.ui}`, color:Cf.green }}>Pro · $50/mes</div>
            </div>
            <div>
              <div style={{ font:`600 11px/1 ${Ff.ui}`, color:Cf.inkFaint, textTransform:"uppercase", marginBottom:6 }}>Estado</div>
              <div style={{ font:`500 13px/1 ${Ff.ui}`, color:Cf.green, display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:Cf.green }} />
                Activo
              </div>
            </div>
          </div>
        </Card>

        {/* Peligro */}
        <Card style={{ background:Cf.redWash, border:`1px solid ${Cf.red}` }}>
          <Label>Zona de peligro</Label>
          <div style={{ marginTop:12, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <Btn kind="outline" icon="log-out">Cerrar sesión</Btn>
            <Btn kind="outline" icon="trash-2" style={{ color:Cf.red }}>Eliminar cuenta</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}
window.ProfileScreen = ProfileScreen;

const selStyle = { width:"100%", appearance:"none", WebkitAppearance:"none", font:`600 13.5px/1 ${Ff.ui}`,
  color:Cf.ink, background:Cf.paper, border:`1px solid ${Cf.line}`, borderRadius:10, padding:"12px 36px 12px 13px", cursor:"pointer", outline:"none" };
const caret = { position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" };

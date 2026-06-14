/* ============================================================
   Cárnicos Gustavo — Primitivos de UI
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;
const C = window.CG.color;
const F = window.CG.font;

/* Ícono Lucide (re-renderiza tras montar) */
function Icon({ name, size = 20, color = "currentColor", strokeWidth = 2, style }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = "";
      const el = document.createElement("i");
      el.setAttribute("data-lucide", name);
      ref.current.appendChild(el);
      window.lucide.createIcons({
        attrs: { width: size, height: size, stroke: color, "stroke-width": strokeWidth },
        nameAttr: "data-lucide",
      });
    }
  }, [name, size, color, strokeWidth]);
  return <span ref={ref} style={{ display: "inline-flex", lineHeight: 0, ...style }} />;
}
window.Icon = Icon;

/* Tarjeta base */
function Card({ children, style, pad = 20, onClick, className }) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: C.paper,
        border: `1px solid ${C.line}`,
        borderRadius: 16,
        padding: pad,
        boxShadow: C.shadow,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
window.Card = Card;

/* Etiqueta de sección (overline) */
function Overline({ children, color = C.inkFaint, style }) {
  return (
    <div style={{ font: `600 11px/1.4 ${F.ui}`, letterSpacing: "0.14em",
      textTransform: "uppercase", color, ...style }}>{children}</div>
  );
}
window.Overline = Overline;

/* Badge de estado */
const BADGE = {
  red:    [C.red, C.redWash], tan:[C.ink80, C.tanWash], green:[C.green, C.greenWash],
  amber:  [C.amber, C.amberWash], blue:[C.blue, C.blueWash], ink:[C.cream, C.ink],
  ghost:  [C.inkSoft, C.paper2],
};
function Badge({ children, tone = "ghost", icon, style }) {
  const [fg, bg] = BADGE[tone] || BADGE.ghost;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6,
      font:`700 11px/1 ${F.ui}`, letterSpacing:"0.04em", textTransform:"uppercase",
      color:fg, background:bg, padding:"5px 9px", borderRadius:999, ...style }}>
      {icon && <Icon name={icon} size={13} color={fg} />}
      {children}
    </span>
  );
}
window.Badge = Badge;

/* Botón */
function Btn({ children, kind = "primary", icon, size = "md", style, onClick, block }) {
  const sizes = { sm:[ "8px 12px", 13, 8 ], md:[ "11px 16px", 14, 10 ], lg:[ "16px 22px", 17, 12 ], xl:[ "20px 26px", 19, 14 ] };
  const [pad, fs, rad] = sizes[size];
  const kinds = {
    primary: { background:C.red, color:"#fff", border:"1px solid "+C.red },
    dark:    { background:C.chrome, color:C.chromeFg, border:"1px solid "+C.chrome },
    outline: { background:"transparent", color:C.ink, border:`1px solid ${C.line}` },
    ghost:   { background:"transparent", color:C.inkSoft, border:"1px solid transparent" },
    green:   { background:C.green, color:"#fff", border:"1px solid "+C.green },
  };
  return (
    <button onClick={onClick} className="cg-btn" style={{
      display:"inline-flex", alignItems:"center", justifyContent:"center", gap:9,
      font:`700 ${fs}px/1 ${F.ui}`, padding:pad, borderRadius:rad, cursor:"pointer",
      width: block ? "100%" : "auto", whiteSpace:"nowrap", ...kinds[kind], ...style }}>
      {icon && <Icon name={icon} size={fs+3} color={kinds[kind].color} />}
      {children}
    </button>
  );
}
window.Btn = Btn;

/* Insignia del cerdo (logo de marca) */
function PigBadge({ size = 44, ring = true }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", overflow:"hidden",
      backgroundColor:C.cream, flexShrink:0,
      border: ring ? `2px solid rgba(241,231,214,0.22)` : "none",
      backgroundImage:`url(assets/pig-head.png)`, backgroundSize:"cover",
      backgroundPosition:"center 46%" }} />
  );
}
window.PigBadge = PigBadge;

/* Avatar de iAntonella — su personaje real (ícono círculo rojo, autoconenido) */
function AntonellaAvatar({ size = 38, glow = false }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, overflow:"hidden",
      backgroundImage:"url(assets/iantonella-rojo.png)",
      backgroundRepeat:"no-repeat",
      backgroundSize:"cover",
      backgroundPosition:"center",
      boxShadow: glow ? `0 0 0 4px ${C.redWash}` : "none" }} />
  );
}
window.AntonellaAvatar = AntonellaAvatar;

/* Número con tipografía de display */
function Stat({ value, prefix, suffix, color = C.ink, size = 34 }) {
  return (
    <div style={{ font:`400 ${size}px/1 ${F.display}`, color, letterSpacing:"0.01em",
      display:"flex", alignItems:"baseline", gap:4 }}>
      {prefix && <span style={{ font:`400 ${size*0.6}px/1 ${F.display}`, color:C.inkSoft }}>{prefix}</span>}
      {value}
      {suffix && <span style={{ font:`600 ${size*0.34}px/1 ${F.ui}`, color:C.inkSoft, marginLeft:2 }}>{suffix}</span>}
    </div>
  );
}
window.Stat = Stat;

/* Encabezado de pantalla */
function ScreenHead({ title, desc, right }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between",
      gap:16, flexWrap:"wrap", marginBottom:18 }}>
      <div>
        <h1 style={{ margin:0, font:`400 30px/1 ${F.display}`, color:C.ink, letterSpacing:"0.01em" }}>{title}</h1>
        {desc && <p style={{ margin:"8px 0 0", font:`400 14px/1.5 ${F.ui}`, color:C.inkSoft, maxWidth:560 }}>{desc}</p>}
      </div>
      {right && <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>{right}</div>}
    </div>
  );
}
window.ScreenHead = ScreenHead;

/* ============================================================
   Menu (dropdown) — trigger libre + items con íconos/acciones.
   Posición fija anti-recorte; cierra al hacer clic fuera o Esc.
   items: [{ label, icon, onClick, danger, sep }]
   ============================================================ */
function Menu({ trigger, items = [], align = "right", width = 208 }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current.getBoundingClientRect();
      const left = align === "right" ? r.right - width : r.left;
      setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(left, window.innerWidth - width - 8)) });
    };
    place();
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target) && !btnRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, align, width]);

  return (
    <>
      <span ref={btnRef} onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }} style={{ display: "inline-flex" }}>
        {trigger}
      </span>
      {open && pos && ReactDOM.createPortal(
        <div ref={menuRef} style={{ position: "fixed", top: pos.top, left: pos.left, width, zIndex: 200,
          background: C.paper, border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: C.shadow,
          overflow: "hidden", padding: 5 }}>
          {items.map((it, i) => it.sep ? (
            <div key={i} style={{ height: 1, background: C.lineSoft, margin: "5px 4px" }} />
          ) : (
            <button key={i} onClick={(e) => { e.stopPropagation(); setOpen(false); it.onClick && it.onClick(); }}
              className="cg-menu-item" style={{ width: "100%", display: "flex", alignItems: "center", gap: 10,
                font: `600 13px/1 ${F.ui}`, color: it.danger ? C.red : C.ink, background: "transparent",
                border: "none", cursor: "pointer", padding: "10px 11px", borderRadius: 8, textAlign: "left" }}>
              {it.icon && <Icon name={it.icon} size={15} color={it.danger ? C.red : C.inkSoft} />}
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.hint && <span style={{ font: `600 11px/1 ${F.mono}`, color: C.inkFaint }}>{it.hint}</span>}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
window.Menu = Menu;

/* Botón kebab (3 puntos) — disparador de menú de fila por defecto */
function Kebab({ items, align = "right" }) {
  return (
    <Menu align={align} items={items} trigger={
      <button title="Acciones" style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.line}`,
        background: C.paper, cursor: "pointer", display: "grid", placeItems: "center" }}>
        <Icon name="ellipsis-vertical" size={16} color={C.inkSoft} />
      </button>
    } />
  );
}
window.Kebab = Kebab;

/* Botón dividido: acción principal + menú (caret) */
function SplitButton({ children, icon, kind = "primary", size = "md", onClick, items = [] }) {
  const k = { primary: C.red, dark: C.chrome, green: C.green }[kind] || C.red;
  const fg = "#fff";
  return (
    <div style={{ display: "inline-flex", borderRadius: 10, overflow: "hidden", boxShadow: C.shadow }}>
      <Btn kind={kind} icon={icon} size={size} onClick={onClick} style={{ borderRadius: 0, boxShadow: "none" }}>{children}</Btn>
      <Menu align="right" items={items} trigger={
        <button className="cg-btn" style={{ height: "100%", padding: "0 10px", background: k, color: fg,
          border: "none", borderLeft: "1px solid rgba(255,255,255,0.22)", cursor: "pointer", display: "grid", placeItems: "center" }}>
          <Icon name="chevron-down" size={16} color={fg} />
        </button>
      } />
    </div>
  );
}
window.SplitButton = SplitButton;

/* ============================================================
   Modal — shell reutilizable (overlay + tarjeta centrada)
   ============================================================ */
function Modal({ open, onClose, title, subtitle, icon, children, footer, width = 560 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(33,28,25,0.42)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} className="cg-modal-in" style={{ width: `min(${width}px, 100%)`,
        background: C.bg, borderRadius: 18, border: `1px solid ${C.line}`, boxShadow: "0 40px 90px -30px rgba(0,0,0,0.5)",
        overflow: "hidden", marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "18px 20px", borderBottom: `1px solid ${C.line}` }}>
          {icon && <div style={{ width: 40, height: 40, borderRadius: 11, background: C.redWash, display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon name={icon} size={20} color={C.red} /></div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: `700 17px/1.2 ${F.ui}`, color: C.ink }}>{title}</div>
            {subtitle && <div style={{ font: `500 12.5px/1.3 ${F.ui}`, color: C.inkSoft, marginTop: 4 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", lineHeight: 0, padding: 4 }}>
            <Icon name="x" size={22} color={C.inkSoft} />
          </button>
        </div>
        <div style={{ padding: "20px" }}>{children}</div>
        {footer && <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "16px 20px",
          borderTop: `1px solid ${C.line}`, background: C.paper2 }}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
window.Modal = Modal;

/* Campo de formulario etiquetado (label + control) */
function FormField({ label, children, hint }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <span style={{ font: `700 11px/1 ${F.ui}`, letterSpacing: "0.05em", textTransform: "uppercase", color: C.inkSoft }}>{label}</span>
      {children}
      {hint && <span style={{ font: `500 11px/1.3 ${F.ui}`, color: C.inkFaint }}>{hint}</span>}
    </label>
  );
}
window.FormField = FormField;

/* Input de texto base, estilizado */
function TextInput({ value, onChange, placeholder, type = "text", right, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${C.line}`, borderRadius: 10,
      padding: "11px 13px", background: C.paper, ...style }}>
      <input value={value} onChange={onChange} placeholder={placeholder} type={type}
        style={{ flex: 1, border: "none", background: "transparent", outline: "none", font: `500 14px/1 ${F.ui}`, color: C.ink, minWidth: 0 }} />
      {right}
    </div>
  );
}
window.TextInput = TextInput;

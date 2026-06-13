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

/* ============================================================
   Cárnicos Gustavo — Sistema de diseño + datos del prototipo
   ============================================================ */
window.CG = window.CG || {};

/* ---------- TEMAS (paleta cálida / neutra · claro / oscuro) ---------- */
CG.themes = {
  "calida-claro": {
    bg:"#ECE5D8", paper:"#FBF7EF", paper2:"#F4EEE1", cream:"#F1E7D6",
    ink:"#211C19", ink80:"#3A332D", inkSoft:"#6B625A", inkFaint:"#9A9087",
    line:"rgba(33,28,25,0.12)", lineSoft:"rgba(33,28,25,0.07)",
    red:"#9E3326", redDeep:"#7E2A20", redSoft:"#C04A38", redWash:"#F3E0DB",
    tan:"#B7A88B", tanWash:"#E7DFCD",
    green:"#3F7D54", greenWash:"#E2ECDF", amber:"#C0851F", amberWash:"#F2E7CE",
    blue:"#3C6E8F", blueWash:"#DFE9EE",
    chrome:"#211C19", chromeFg:"#F1E7D6", chrome2:"#2C2621",
  },
  "neutra-claro": {
    bg:"#F0EFEE", paper:"#FFFFFF", paper2:"#F5F5F4", cream:"#ECECEB",
    ink:"#191919", ink80:"#333333", inkSoft:"#6B6B6B", inkFaint:"#9C9C9C",
    line:"rgba(0,0,0,0.10)", lineSoft:"rgba(0,0,0,0.05)",
    red:"#C0271C", redDeep:"#991B12", redSoft:"#DA3A2A", redWash:"#FBE3E0",
    tan:"#B6B6B4", tanWash:"#E7E7E5",
    green:"#2F7D4F", greenWash:"#E1EFE6", amber:"#B5811C", amberWash:"#F3E9CF",
    blue:"#3A6A8C", blueWash:"#E0EAEF",
    chrome:"#161616", chromeFg:"#ECECEB", chrome2:"#242424",
  },
  "calida-oscuro": {
    bg:"#1A1714", paper:"#241F1B", paper2:"#2C2621", cream:"#F1E7D6",
    ink:"#F1E7D6", ink80:"#D8CDBC", inkSoft:"#A99E8F", inkFaint:"#786E62",
    line:"rgba(241,231,214,0.13)", lineSoft:"rgba(241,231,214,0.06)",
    red:"#DA5742", redDeep:"#B23A2A", redSoft:"#E8735E", redWash:"#3A211C",
    tan:"#B7A88B", tanWash:"#38302A",
    green:"#5CA877", greenWash:"#21302A", amber:"#D9A441", amberWash:"#332A1A",
    blue:"#7AAAC9", blueWash:"#1E2A33",
    chrome:"#100E0C", chromeFg:"#F1E7D6", chrome2:"#1C1815",
  },
  "neutra-oscuro": {
    bg:"#121213", paper:"#1D1D1F", paper2:"#262628", cream:"#ECECEB",
    ink:"#ECECEB", ink80:"#CFCFCF", inkSoft:"#9C9C9C", inkFaint:"#6B6B6B",
    line:"rgba(255,255,255,0.13)", lineSoft:"rgba(255,255,255,0.06)",
    red:"#E2503F", redDeep:"#B83A2C", redSoft:"#EC6B5A", redWash:"#331C19",
    tan:"#8C8C8A", tanWash:"#2C2C2E",
    green:"#5CA877", greenWash:"#1F2D26", amber:"#D9A441", amberWash:"#2E2719",
    blue:"#7AAAC9", blueWash:"#1C2730",
    chrome:"#070708", chromeFg:"#ECECEB", chrome2:"#161618",
  },
};

// Objeto vivo: las pantallas leen CG.color.xxx en cada render.
// applyTheme MUTA este objeto (no lo reasigna) para que las referencias sigan válidas.
CG.color = Object.assign({}, CG.themes["calida-claro"]);
CG.applyTheme = function (p /* 'warm'|'neutral' */, m /* 'light'|'dark' */) {
  const palette = (p === "neutral") ? "neutra" : "calida";
  const dark = (m === "dark");
  const key = `${palette}-${dark ? "oscuro" : "claro"}`;
  Object.assign(CG.color, CG.themes[key] || CG.themes["calida-claro"]);
  // tokens derivados (el rail/chrome es SIEMPRE una superficie oscura)
  CG.color.railBg = CG.color.chrome;
  CG.color.railFg = CG.color.chromeFg;
  CG.color.railActive = CG.color.red;
  CG.color.railFgDim = (p === "neutral") ? "rgba(236,236,235,0.55)" : "rgba(241,231,214,0.52)";
  CG.color.shadow = dark ? "0 18px 50px -18px rgba(0,0,0,0.7)" : "0 18px 50px -22px rgba(33,28,25,0.38)";
  if (typeof document !== "undefined") document.body.style.background = CG.color.bg;
};
CG.applyTheme("warm", "light");   // poblar tokens derivados desde el inicio

// Tipografía del sistema
CG.font = {
  display: "'Anton', sans-serif",
  ui:      "'Archivo', system-ui, sans-serif",
  mono:    "'JetBrains Mono', monospace",
};

/* ---------- Módulos ---------- */
CG.modules = [
  { id:"panel",     label:"Panel",          icon:"layout-dashboard", group:"op" },
  { id:"compra",    label:"Compra del día", icon:"piggy-bank",       group:"op" },
  { id:"pedidos",   label:"Pedidos",        icon:"shopping-bag",     group:"op" },
  { id:"despiece",  label:"Despiece",       icon:"scissors",         group:"op" },
  { id:"bascula",   label:"Báscula",        icon:"scale",            group:"op" },
  { id:"cobro",     label:"Cobro",          icon:"banknote",         group:"op" },
  { id:"rendimiento",label:"Rendimiento",   icon:"clipboard-list",   group:"op" },
  { id:"cobranza",  label:"Cobranza",       icon:"hand-coins",       group:"op" },
  { id:"clientes",  label:"Clientes",       icon:"users",            group:"op" },
  { id:"pos",       label:"POS",            icon:"shopping-cart",    group:"op" },
];
// Submenú de Configuración (rueda dentada → popover)
CG.configItems = [
  { id:"productos", label:"Productos",      icon:"package" },
  { id:"recetas",   label:"Recetas",        icon:"book-open" },
  { id:"precios",   label:"Precios",        icon:"tag" },
  { id:"cold",      label:"Inventario Frío",icon:"snowflake" },
  { id:"caja",      label:"Caja",           icon:"dollar-sign" },
  { id:"payment",   label:"Métodos de pago",icon:"credit-card" },
  { id:"designsystem", label:"Sistema de Diseño", icon:"shapes" },
  { id:"settings",  label:"Configuración",  icon:"settings" },
];

// Paletas para el control de apariencia
CG.palettes = [
  { id:"warm",    name:"Cálida",  swatch:["#9E3326","#211C19","#F1E7D6"] },
  { id:"neutral", name:"Neutra",  swatch:["#C0271C","#161616","#E7E7E5"] },
];

// Etiqueta legible de cualquier ruta
CG.labelOf = function (id) {
  if (id === "config") return "Configuración";
  if (id === "designsystem") return "Sistema de diseño";
  const m = CG.modules.find(x=>x.id===id) || CG.configItems.find(x=>x.id===id);
  return m ? m.label : "";
};

/* ---------- Datos operativos (de las pantallas reales) ---------- */
CG.data = {
  compra: {
    fecha:"12/06/2026", americanos:50, nacionales:30, canales:80, kgPie:8510, kgCanal:106.4,
    proveedores:[
      { nombre:"La Barca",  americanos:0,  nacionales:30, canales:30, kgPie:3310, precioKg:40.5, kgCanal:110.3 },
      { nombre:"Maldonado", americanos:50, nacionales:0,  canales:50, kgPie:5200, precioKg:41.0, kgCanal:104.0 },
    ],
  },
  despiece: {
    canales:[
      { id:"ame", nombre:"Americano",           disp:49, kg:105,  tono:"red"   },
      { id:"esp", nombre:"Nacional · Espilomo", disp:30, kg:52.5, tono:"blue"  },
      { id:"lom", nombre:"Nacional · Lomo",     disp:30, kg:52.5, tono:"green" },
    ],
    piezas:[
      { n:"Cabeza",pz:1,pct:3.6,ped:0 },{ n:"Costillar",pz:2,pct:5.7,ped:0 },
      { n:"Desgrase",pz:1,pct:3.6,ped:0 },{ n:"Espaldilla",pz:2,pct:7.8,ped:0 },
      { n:"Filete",pz:1,pct:1.7,ped:0 },{ n:"Grasa",pz:1,pct:5.7,ped:0 },
      { n:"Hueso americano",pz:2,pct:5.0,ped:0 },{ n:"Lomo americano",pz:2,pct:15.8,ped:0 },
      { n:"Manos",pz:2,pct:4.7,ped:0 },{ n:"Mitad de cuero",pz:2,pct:4.2,ped:0 },
      { n:"Patas",pz:2,pct:1.8,ped:0 },{ n:"Pierna",pz:2,pct:24.9,ped:0,hijo:true },
    ],
  },
  bascula: {
    pedido:{ id:359, cliente:"Carnicería Marenco", total:0 },
    item:{ nombre:"CUERO", cat:"Cueros", idx:1, total:1 },
    recipientes:[
      { id:"ninguno",label:"Sin recipiente",tara:0 },{ id:"tambo",label:"Tambo Azul",tara:2.5 },
      { id:"tara",label:"Tara",tara:1.2 },{ id:"cubeta",label:"Cubeta",tara:0.9 },{ id:"otro",label:"Otro",tara:null },
    ],
  },
  cobro: {
    cola:[{ id:359, cliente:"Carnicería Marenco", items:1 }],
    pedido:{ id:359, cliente:"Carnicería Marenco", lineas:[{ producto:"CUERO", kg:6.200, precio:0 }] },
  },
  panel: {
    ingresos:184250, gastos:121480, ganancia:62770, margen:34,
    ingresosCat:[
      { n:"Lomos",v:74200,c:"red" },{ n:"Piernas",v:52100,c:"tan" },
      { n:"Costilla",v:31600,c:"amber" },{ n:"Vísceras",v:14900,c:"green" },{ n:"Otros",v:11450,c:"blue" },
    ],
    flujo:[42,55,38,61,72,49,83,66,58,77,69,90],
  },
};

/* ---------- Datos de Configuración ---------- */
CG.config = {
  productos:[
    { n:"AHUMADA", tipo:"Hijo", rend:null, precio:0, stock:0 },
    { n:"BARRIGA", tipo:"Hijo", rend:0, precio:100, stock:0 },
    { n:"BARRIGA C/C", tipo:"Hijo", rend:0, precio:0, stock:0 },
    { n:"BARRIGA SIN CUERO", tipo:"Hijo", rend:40, precio:0, stock:0 },
    { n:"C/LOMO", tipo:"Hijo", rend:0, precio:0, stock:0 },
    { n:"C/LOMO C/H", tipo:"Hijo", rend:0, precio:0, stock:0 },
    { n:"CABEZA", tipo:"Padre", rend:3.6, precio:0, stock:1 },
    { n:"CABEZA DE LOMO", tipo:"Hijo", rend:0, precio:0, stock:0 },
    { n:"CACHETE", tipo:"Hijo", rend:10, precio:0, stock:0 },
    { n:"CANAL AMERICANO", tipo:"Padre", rend:null, precio:45, stock:49 },
  ],
  precios:{
    cliente:"BALLESTEROS",
    lista:[
      { n:"CANAL AMERICANO", cat:"Canales", kg:45, pz:null },
      { n:"CANAL NACIONAL LADO ESPILOMO", cat:"Canales", kg:45, pz:null },
      { n:"CANAL NACIONAL LADO LOMO", cat:"Canales", kg:45, pz:null },
      { n:"AHUMADA", cat:"Compra", kg:0, pz:null },
      { n:"MANTECA", cat:"Compra", kg:0, pz:null },
      { n:"PRENSA MOLIDA", cat:"Compra", kg:0, pz:null },
      { n:"CUERO", cat:"Cueros", kg:0, pz:null },
    ],
  },
  cold:[
    { n:"CANAL AMERICANO", fresco:[5250,49], frio:[0,0] },
    { n:"CANAL NACIONAL LADO ESPILOMO", fresco:[1575,30], frio:[0,0] },
    { n:"CANAL NACIONAL LADO LOMO", fresco:[1575,30], frio:[0,0] },
    { n:"MITAD DE CUERO", fresco:[0,2], frio:[0,0] },
    { n:"COSTILLAR", fresco:[0,2], frio:[0,0] },
    { n:"HUESO AMERICANO", fresco:[0,2], frio:[0,0] },
    { n:"PIERNA", fresco:[0,2], frio:[0,0] },
    { n:"FILETE", fresco:[0,1], frio:[0,0] },
  ],
  payment:["Efectivo","Tarjeta","Transferencia"],
};

/* ---------- Datos operativos (Pedidos · Clientes · Cobranza · Rendimiento · POS) ---------- */
CG.ops = {
  pedidos:[
    { id:359, cliente:"Carnicería Marenco", total:1116.0, estado:"Lista para cobro", fecha:"12/06", items:1 },
    { id:358, cliente:"Abarrotes El Sol",   total:4820.5, estado:"Por pesar",        fecha:"12/06", items:6 },
    { id:357, cliente:"Tortas Don Beto",    total:980.0,  estado:"Pagada",           fecha:"12/06", items:3 },
    { id:356, cliente:"Carnicería La Güera", total:2310.0, estado:"Procesando pago",  fecha:"11/06", items:4 },
    { id:355, cliente:"Cocina Mariana",     total:0,      estado:"Parcial",          fecha:"11/06", items:5 },
    { id:354, cliente:"Super Carnes JR",    total:6740.0, estado:"Pagada",           fecha:"11/06", items:9 },
    { id:353, cliente:"Taquería El Pastor",  total:1450.0, estado:"Cancelada",        fecha:"10/06", items:2 },
  ],
  clientes:[
    { id:1, nombre:"Carnicería Marenco",  tel:"55 1840 2233", saldo:1116.0,  estado:"Activo", pedidos:42, gastado:184250 },
    { id:2, nombre:"Abarrotes El Sol",    tel:"55 2290 1187", saldo:2480.0,  estado:"Activo", pedidos:31, gastado:142100 },
    { id:3, nombre:"Tortas Don Beto",     tel:"55 6612 7740", saldo:0,       estado:"Activo", pedidos:58, gastado:96300 },
    { id:4, nombre:"Carnicería La Güera",  tel:"55 3398 5521", saldo:0,       estado:"Activo", pedidos:27, gastado:120800 },
    { id:5, nombre:"Cocina Mariana",      tel:"",             saldo:0,       estado:"Inactivo", pedidos:6,  gastado:18400 },
    { id:6, nombre:"Super Carnes JR",     tel:"55 7741 0098", saldo:0,       estado:"Activo", pedidos:73, gastado:312500 },
  ],
  cobranza:[
    { cliente:"Abarrotes El Sol",   cargos:9200, abonos:6720, saldo:2480, dias:64 },
    { cliente:"Carnicería Marenco", cargos:4116, abonos:3000, saldo:1116, dias:8 },
    { cliente:"Cocina Mariana",     cargos:1200, abonos:1200, saldo:0,    dias:0 },
  ],
  rendimiento:{
    proveedor:"La Barca", canales:30, kgComprado:3310, rend:88.2, rendEst:90,
    piezas:[
      { n:"PIERNA",          pz:60, est:823.4,  real:810.2 },
      { n:"LOMO AMERICANO",  pz:60, est:521.4,  real:498.0 },
      { n:"COSTILLAR",       pz:60, est:187.6,  real:190.4 },
      { n:"ESPALDILLA",      pz:60, est:258.2,  real:251.1 },
      { n:"CABEZA",          pz:30, est:117.5,  real:120.0 },
      { n:"MITAD DE CUERO",  pz:60, est:140.7,  real:0 },
      { n:"GRASA",           pz:30, est:187.6,  real:181.0 },
    ],
  },
  pos:{
    listas:["Mayoreo contado","Mayoreo crédito","Menudeo"],
    catalogo:[
      { n:"LOMO AMERICANO", precio:78.0, disp:"despiece", stock:"1 canal", cat:"Lomos" },
      { n:"PIERNA",         precio:70.0, disp:"stock",    stock:"12 pz / 156 kg", cat:"Jamones" },
      { n:"CUERO",          precio:18.0, disp:"pesaje",   stock:"por pesar", cat:"Cueros" },
      { n:"COSTILLAR",      precio:62.0, disp:"stock",    stock:"8 pz / 41 kg", cat:"Huesos" },
      { n:"CABEZA",         precio:24.0, disp:"faltante", stock:"sin stock", cat:"Otros" },
    ],
    carrito:[
      { n:"PIERNA",         precio:70.0, pz:2, kg:26.1, disp:"stock" },
      { n:"LOMO AMERICANO", precio:78.0, pz:2, kg:16.54, disp:"despiece" },
      { n:"CUERO",          precio:18.0, pz:1, kg:0,    disp:"pesaje" },
    ],
  },
};

/* ---------- Datos de RECETAS (núcleo del sistema) ----------
   Fiel a la semilla real del Configurador (catalog.js · pesajes 3-jun-2026). */
CG.catColors = {
  Lomos:"hsl(43 74% 49%)", Jamones:"hsl(350 70% 55%)", Pulpas:"hsl(320 55% 55%)",
  Cueros:"hsl(25 50% 45%)", Visceras:"hsl(265 55% 58%)", Huesos:"hsl(197 45% 42%)",
  Otros:"hsl(215 16% 47%)", Canales:"hsl(222 47% 30%)", Compra:"hsl(150 45% 38%)",
};
CG.recetas = {
  styles:[
    { type:"AMERICANO", parent:"CANAL AMERICANO", canalW:105, kind:"completo", accent:"hsl(12 70% 52%)",
      rows:[
        { n:"PIERNA", cat:"Jamones", pz:2, pct:24.86, kids:[
          { n:"JAMON", cat:"Jamones", pz:1, pct:80 },
          { n:"CODILLO", cat:"Huesos", pz:1, pct:10 },
          { n:"HUESO PELON", cat:"Huesos", pz:1, pct:10 },
        ]},
        { n:"LOMO AMERICANO", cat:"Lomos", pz:2, pct:15.75 },
        { n:"HUESO AMERICANO", cat:"Huesos", pz:2, pct:4.96 },
        { n:"ESPALDILLA", cat:"Otros", pz:2, pct:7.8, kids:[
          { n:"PULPA DE ESPALDILLA", cat:"Pulpas", pz:1, pct:80 },
          { n:"ESPALDILLA C/GRASA Y PAPADA", cat:"Otros", pz:1, pct:90, variant:true },
        ]},
        { n:"CABEZA", cat:"Otros", pz:1, pct:3.55, kids:[
          { n:"MASCARA COMPLETA", cat:"Otros", pz:1, pct:25 },
          { n:"PAPADA CORTA", cat:"Otros", pz:1, pct:15 },
          { n:"CACHETE", cat:"Otros", pz:2, pct:10 },
          { n:"RECORTE DE MASCARA", cat:"Otros", pz:1, pct:10 },
          { n:"LENGUA", cat:"Visceras", pz:1, pct:3 },
          { n:"OREJAS", cat:"Otros", pz:2, pct:3 },
          { n:"TROMPA", cat:"Otros", pz:1, pct:3 },
          { n:"SESOS", cat:"Visceras", pz:1, pct:2 },
        ]},
        { n:"MITAD DE CUERO", cat:"Cueros", pz:2, pct:4.25, kids:[
          { n:"CUERO CON PANZA", cat:"Cueros", pz:1, pct:50 },
          { n:"BARRIGA SIN CUERO", cat:"Otros", pz:1, pct:40 },
        ]},
        { n:"COSTILLAR", cat:"Huesos", pz:2, pct:5.67, kids:[
          { n:"PECHO", cat:"Otros", pz:1, pct:50 },
          { n:"LOMO", cat:"Lomos", pz:1, pct:40 },
        ]},
        { n:"MANOS", cat:"Huesos", pz:2, pct:4.72 },
        { n:"GRASA", cat:"Otros", pz:1, pct:5.67 },
        { n:"DESGRASE", cat:"Otros", pz:1, pct:3.55 },
        { n:"RETAZO", cat:"Pulpas", pz:1, pct:2.84 },
        { n:"PATAS", cat:"Huesos", pz:2, pct:1.79 },
        { n:"FILETE", cat:"Lomos", pz:1, pct:1.73 },
        { n:"RINON", cat:"Visceras", pz:2, pct:0.85 },
      ]},
    { type:"NACIONAL_LOMO", parent:"CANAL NACIONAL LADO LOMO", canalW:52.5, kind:"media", accent:"hsl(173 58% 33%)",
      rows:[
        { n:"PIERNA", cat:"Jamones", pz:1, pct:24.86, kids:[
          { n:"JAMON", cat:"Jamones", pz:1, pct:80 },
          { n:"CODILLO", cat:"Huesos", pz:1, pct:10 },
          { n:"HUESO PELON", cat:"Huesos", pz:1, pct:10 },
        ]},
        { n:"LOMO NACIONAL", cat:"Lomos", pz:1, pct:15.75 },
        { n:"ESPALDILLA", cat:"Otros", pz:1, pct:7.74 },
        { n:"CABEZA", cat:"Otros", pz:1, pct:6.33 },
        { n:"COSTILLAR", cat:"Huesos", pz:1, pct:5.63 },
        { n:"GRASA", cat:"Otros", pz:1, pct:5.63 },
        { n:"MITAD DE CUERO", cat:"Cueros", pz:1, pct:4.92 },
        { n:"MANOS", cat:"Huesos", pz:1, pct:4.72 },
        { n:"DESGRASE", cat:"Otros", pz:1, pct:3.52 },
        { n:"FILETE", cat:"Lomos", pz:1, pct:3.47 },
        { n:"RETAZO", cat:"Pulpas", pz:1, pct:2.81 },
        { n:"PATAS", cat:"Huesos", pz:1, pct:1.79 },
        { n:"RINON", cat:"Visceras", pz:2, pct:0.84 },
      ]},
    { type:"NACIONAL_ESPILOMO", parent:"CANAL NACIONAL LADO ESPILOMO", canalW:52.5, kind:"media", accent:"hsl(199 65% 36%)",
      rows:[
        { n:"ESPILOMO", cat:"Lomos", pz:1, pct:26.86, kids:[
          { n:"LOMO", cat:"Lomos", pz:1, pct:79 },
          { n:"ESPINAZO", cat:"Huesos", pz:1, pct:20 },
        ]},
        { n:"PIERNA", cat:"Jamones", pz:1, pct:24.86 },
        { n:"ESPALDILLA", cat:"Otros", pz:1, pct:5.44 },
        { n:"CABEZA", cat:"Otros", pz:1, pct:4.45 },
        { n:"COSTILLAR", cat:"Huesos", pz:1, pct:3.96 },
        { n:"GRASA", cat:"Otros", pz:1, pct:3.96 },
        { n:"MITAD DE CUERO", cat:"Cueros", pz:1, pct:3.46 },
        { n:"MANOS", cat:"Huesos", pz:1, pct:4.72 },
        { n:"FILETE", cat:"Lomos", pz:1, pct:3.47 },
        { n:"DESGRASE", cat:"Otros", pz:1, pct:2.47 },
        { n:"RETAZO", cat:"Pulpas", pz:1, pct:1.98 },
        { n:"PATAS", cat:"Huesos", pz:1, pct:1.79 },
        { n:"RINON", cat:"Visceras", pz:2, pct:0.59 },
      ]},
    { type:"POLINESIO", parent:"CANAL POLINESIO", canalW:105, kind:"completo", accent:"hsl(28 80% 48%)", draft:true,
      rows:[
        { n:"PIERNA", cat:"Jamones", pz:2, pct:24.86 },
        { n:"LOMO AMERICANO", cat:"Lomos", pz:2, pct:15.75 },
        { n:"ESPALDILLA", cat:"Otros", pz:2, pct:7.8 },
        { n:"COSTILLAR", cat:"Huesos", pz:2, pct:5.67 },
        { n:"CABEZA", cat:"Otros", pz:1, pct:3.55 },
        { n:"MITAD DE CUERO", cat:"Cueros", pz:2, pct:4.25 },
      ]},
  ],
  palette:{
    Lomos:["LOMO","LOMO AMERICANO","LOMO NACIONAL","ESPILOMO","FILETE","CABEZA DE LOMO","C/LOMO"],
    Jamones:["PIERNA","JAMON","JAMON S/H","JAMON C/G","PULPA DE JAMON"],
    Pulpas:["PULPA","PULPA DE ESPALDILLA","RETAZO","PULPA C/G"],
    Cueros:["MITAD DE CUERO","CUERO","CUERO CON PANZA","CUERO RECORTE"],
    Visceras:["RINON","LENGUA","SESOS","BUCHE","NANA","TRIPAS"],
    Huesos:["COSTILLAR","HUESO AMERICANO","ESPINAZO","CODILLO","HUESO PELON","MANOS","PATAS","CANA"],
    Otros:["CABEZA","ESPALDILLA","GRASA","DESGRASE","MANTECA","BARRIGA","PAPADA","CACHETE","MASCARA COMPLETA"],
    Compra:["AHUMADA","PRENSA MOLIDA","PRENSA NATURAL"],
  },
};

/* ---------- iAntonella inline por módulo ---------- */
CG.antonella = {
  panel:{ slot:{ tone:"sugerencia", titulo:"Resumen del día",
    texto:"Vas $62,770 de ganancia neta (margen 34%). Subió 3 pts vs. ayer, empujado por Lomos. Hay 2 clientes con saldo por cobrar venciendo hoy.",
    acciones:[{ label:"Ir a cobranza", icon:"hand-coins", go:"cobranza" },"Detalle de margen"] }},
  compra:{ slot:{ tone:"aviso", titulo:"Revisa la merma al recibir",
    texto:"Compraste 8,510 kg en pie (80 canales). Aún no registras kg recibidos en CEDIS — sin eso no puedo calcular la merma real ni el costo por canal de hoy.",
    acciones:[{ label:"Capturar kg recibidos", icon:"scale", go:"compra" },"¿Merma normal?"] }},
  despiece:{ slot:{ tone:"alerta", titulo:"Cuidado con despiezar de más",
    texto:"Tienes 49 canales americanos disponibles y 0 pedidos que demanden estas piezas. Despiezar genera piezas sin destino. Te conviene esperar pedidos o despiezar solo lo vendido.",
    acciones:[{ label:"Ver pedidos abiertos", icon:"receipt-text", go:"pedidos" },"Despiezar solo lo pedido"] }},
  bascula:{ slot:{ tone:"sugerencia", titulo:"Tip de pesaje",
    texto:"El CUERO de este pedido suele ir en Tambo Azul. Tócalo y resto 2.5 kg de tara automáticamente. Enter registra y salta al siguiente.",
    acciones:["Usar Tambo Azul"] }},
  cobro:{ slot:{ tone:"aviso", titulo:"Precio sin definir",
    texto:"El CUERO de Carnicería Marenco está en $0.00/kg. El último precio que le cobraste fue $18.00/kg (hace 6 días). ¿Aplico ese precio?",
    acciones:["Aplicar $18.00/kg","Ver historial del cliente"] }},
  pedidos:{ slot:{ tone:"ok", titulo:"Todo al día",
    texto:"1 pedido abierto (#359 · Carnicería Marenco) ya pasó báscula y está listo para cobro. No hay pedidos atorados.",
    acciones:[{ label:"Ir a pesaje", icon:"scale", go:"bascula" }] }},
  clientes:{ slot:{ tone:"aviso", titulo:"2 clientes con saldo vencido",
    texto:"Marenco ($1,116) y Abarrotes El Sol ($2,480) tienen saldo venciendo hoy. Marenco compra cada martes; suele liquidar al recibir.",
    acciones:[{ label:"Ver cobranza", icon:"hand-coins", go:"cobranza" },"Recordar por WhatsApp"] }},
  cobranza:{ slot:{ tone:"alerta", titulo:"Cartera vencida",
    texto:"$3,596 por cobrar en total. Hay $2,480 con más de 60 días (Abarrotes El Sol). Te conviene priorizar ese recordatorio hoy.",
    acciones:["Recordar a El Sol","Ver los de +60 días"] }},
  rendimiento:{ slot:{ tone:"sugerencia", titulo:"Calibra con el día",
    texto:"Capturaste pesos reales de 30 canales de La Barca. El rendimiento dio 88.2% (vs 90% estimado). Puedo recalibrar las recetas con estos pesos para afinar los % futuros.",
    acciones:[{ label:"Calibrar recetas", icon:"sliders-horizontal", go:"recetas" },"Ver diferencias"] }},
  pos:{ slot:{ tone:"sugerencia", titulo:"Disponibilidad en vivo",
    texto:"Clasifico cada pieza al agregarla: en stock, vía despiece o faltante. LOMO AMERICANO requiere despiezar 1 canal; CUERO va a pesaje. Te aviso antes de crear el pedido.",
    acciones:["¿Qué falta para este pedido?"] }},
  recetas:{ slot:{ tone:"alerta", titulo:"Revisa el cierre de pesos",
    texto:"El CANAL AMERICANO suma 85.3% de su peso en piezas: hay 14.7% de merma, alto para tu histórico (~8%). Probablemente falta capturar el kg de alguna pieza, o LOMO AMERICANO quedó bajo.",
    acciones:["Ver piezas faltantes","¿Merma aceptable?"] }},
  productos:{ slot:{ tone:"aviso", titulo:"Precios en cero",
    texto:"Tienes varias piezas hijas con precio $0.00 (BARRIGA C/C, C/LOMO…). No se podrán cobrar hasta asignarles precio o lista por cliente.",
    acciones:["Ver productos sin precio"] }},
  precios:{ slot:{ tone:"sugerencia", titulo:"Lista de BALLESTEROS",
    texto:"Este cliente solo tiene precio en los 3 canales ($45/kg). Las piezas despiezadas que suele llevar (LOMO, PIERNA) están en $0 — conviene completarlas antes de su próximo pedido.",
    acciones:["Copiar de otro cliente","Autocompletar sugeridos"] }},
  cold:{ slot:{ tone:"sugerencia", titulo:"Rotación de cámara",
    texto:"Solo se vende de fresco. Tienes 49 canales americanos en fresco sin pedidos: si no rotan hoy, súbelos a frío para no perder vida útil.",
    acciones:["Enviar sobrante a frío"] }},
  caja:{ slot:{ tone:"ok", titulo:"Caja al corriente",
    texto:"No hay transacciones pendientes hoy. Cuando registres ingresos/egresos los reflejo en el margen del Panel en tiempo real.",
    acciones:["Registrar egreso"] }},
  default:{ slot:{ tone:"sugerencia", titulo:"Estoy aquí para ayudarte",
    texto:"Conozco todo el sistema: inventario, despiece, pesaje, pedidos y cobranza. Pregúntame lo que sea o pídeme una acción.",
    acciones:["¿Qué puedo preguntarte?"] }},
};

/* ---------- Chat de iAntonella ---------- */
CG.chat = {
  greeting:"¡Hola! Soy iAntonella, el cerebro del sistema. Veo inventario, demanda, recetas y cobranza en tiempo real. ¿En qué te ayudo?",
  chips:{
    panel:["¿Cómo va el día?","¿Quién me debe?","Margen por producto"],
    compra:["¿Cuánta merma llevo?","Costo real por canal","¿Qué proveedor es más barato?"],
    despiece:["¿Qué me conviene despiezar?","¿Qué piezas faltan para pedidos?","Rendimiento del americano"],
    bascula:["¿Cuánto falta por pesar?","Tara del Tambo Azul","Siguiente pedido"],
    cobro:["Último precio de este cliente","¿Contado o crédito?","Total del día"],
    recetas:["¿Por qué hay tanta merma?","¿Cómo se despieza PIERNA?","¿Qué piezas no tienen receta?"],
    clientes:["¿Quién me debe?","Mejores clientes del mes","Crear un cliente"],
    cobranza:["¿Cuánto me deben en total?","¿Quién tiene +60 días?","Mandar recordatorios"],
    rendimiento:["¿Cuánto rindió hoy?","Diferencia vs estimado","Calibrar recetas"],
    pos:["¿Qué falta para este pedido?","Último precio del cliente","¿Requiere pesaje?"],
    default:["¿Qué puedes hacer?","Resumen del día","Buscar un cliente"],
  },
  replies:{
    "¿qué me conviene despiezar?":"Hoy NO te conviene despiezar americanos por adelantado: 0 pedidos demandan esas piezas. Solo 3 carnicerías pidieron Lomo. Te sugiero despiezar 2 canales nacionales lado Lomo y dejar los 49 americanos en cámara.",
    "¿cuánta merma llevo?":"No puedo cerrarla aún: registraste 8,510 kg comprados pero 0 kg recibidos en CEDIS. En cuanto peses los canales recibidos te calculo merma por proveedor y costo real por kg.",
    "¿cómo va el día?":"Ingresos $184,250 · Gastos $121,480 · Ganancia neta $62,770 (margen 34%). Vas 12% arriba del mismo día la semana pasada. Lo que más empuja: Lomos.",
    "¿por qué hay tanta merma?":"En CANAL AMERICANO las piezas suman 85.3% del peso. El faltante (14.7%) es merma. Tu histórico ronda 8%, así que reviso: LOMO AMERICANO está en 15.8% (bajo para 2 piezas) y PIERNA aún no cierra su sub-despiece. Captura esos kg y la merma baja.",
    "¿cómo se despieza pierna?":"PIERNA (24.9% del canal, 2 pzas) se ramifica en: JAMÓN 70%, HUESO DE PIERNA 18%, CUERO C/PANZA 8%. Como variante tienes JAMÓN S/HUESO (82%), que NO suma porque es alternativa al JAMÓN con hueso.",
    "default":"Entendido. Estoy revisando el estado del sistema para esa consulta — en la versión conectada te respondo con los datos reales de Supabase y, si me lo pides y confirmas, ejecuto la acción por ti.",
  },

  /* Tira de notificaciones/cards (parte superior del chat) — solo operación */
  cards:[
    { tone:"aviso",  icon:"scale",        label:"Por pesar",     value:"8 canales", sub:"pedido #358 en espera" },
    { tone:"alerta", icon:"package-x",    label:"Faltantes",     value:"3 piezas",  sub:"CABEZA · CUERO · GRASA" },
    { tone:"sugerencia", icon:"scissors", label:"Por despiezar", value:"2 canales", sub:"lado Lomo · piden 3 carnicerías" },
    { tone:"ok",     icon:"package-check",label:"En stock",      value:"156 kg",    sub:"listo para entregar" },
  ],

  /* Mini-dashboards por pestaña de contexto */
  context:{
    pedidos:{ icon:"receipt-text", label:"Pedidos", carousel:true, stats:[
        { label:"Total piezas hoy", value:"23", tone:"ink" },
        { label:"Por pesar", value:"8", tone:"amber" },
        { label:"Pesadas", value:"12", tone:"green" },
        { label:"Entregadas", value:"3", tone:"blue" },
      ], tip:"El #358 es el siguiente en la cola de pesaje. Desliza el carrusel para ver los últimos pedidos.",
      actions:[{ label:"Pesar siguiente", icon:"scale", go:"bascula" },{ label:"Ver pedidos", icon:"receipt-text", go:"pedidos" }] },
    inventario:{ icon:"boxes", label:"Inventario", stats:[
        { label:"En stock", value:"156 kg", tone:"ink" },
        { label:"Por despiece", value:"49 canales", tone:"blue" },
        { label:"Por pesar", value:"8", tone:"amber" },
        { label:"Faltantes", value:"3", tone:"red" },
      ], tip:"Tienes 49 canales americanos en cámara sin demanda. No despieces por adelantado: solo 3 carnicerías pidieron Lomo hoy.",
      actions:[{ label:"Ir a despiece", icon:"scissors", go:"despiece" },{ label:"Ver faltantes", icon:"package-x", ask:"mostrar alertas" }] },
    cobranza:{ icon:"hand-coins", label:"Cobranza", stats:[
        { label:"Total", value:"$3,596", tone:"red" },
        { label:"+60 días", value:"$2,480", tone:"red" },
        { label:"Clientes", value:"2", tone:"ink" },
        { label:"Vence hoy", value:"1", tone:"amber" },
      ], tip:"Abarrotes El Sol debe $2,480 con 64 días de antigüedad. Te sugiero mandar recordatorio por WhatsApp antes de tomar su próximo pedido.",
      actions:[{ label:"Ir a cobranza", icon:"hand-coins", go:"cobranza" },{ label:"Recordatorios", icon:"message-circle", ask:"mostrar alertas" }] },
    pesaje:{ icon:"scale", label:"Pesaje", stats:[
        { label:"En cola", value:"8", tone:"amber" },
        { label:"Pesados hoy", value:"22", tone:"green" },
        { label:"Kg del día", value:"1,840", tone:"ink" },
        { label:"Tara activa", value:"Tambo Azul", tone:"blue" },
      ], tip:"Siguiente en cola: PIERNA del pedido #358. Recuerda la tara del Tambo Azul (1.2 kg). ¿Abro la báscula?",
      actions:[{ label:"Abrir báscula", icon:"scale", go:"bascula" },{ label:"¿Cuánto falta?", icon:"list-checks", ask:"¿cuánto falta por pesar?" }] },
  },

  /* Respuestas por palabras clave */
  replies:{
    "¿cómo va el operativo?": "El día está bien. Tenemos 8 canales por pesar, 3 faltantes en inventario, y 2 canales listos para despiezar. Lo urgente es el pedido #358 — lleva 40 min en la cola.",
    "¿qué me sugeres?": "Ahora: pesa el #358 para cobrarlo antes del cierre. Después: no despieces americanos, solo hay demanda de Lomo (3 pedidos). Stock está bien (156 kg).",
    "mostrar alertas": "🟡 Pesaje: #358 en espera 40 min\n🔴 Faltantes: CABEZA, CUERO, GRASA (pedidos sin surtir)\n🟤 Stock: 49 americanos sin demanda. Propongo congelar despiece.",
    "ayuda": "Soy iAntonella, el cerebro del sistema. Puedo: pesar productos, estimar recetas, sugerir qué despiezar, recordar cobranzas y alertarte de inventario. Pregunta lo que necesites.",
    "crear pedido": "Abre el botón 'Nuevo pedido' arriba a la derecha. Te guío en cliente, artículos, total y pesaje si hace falta.",
    "pesar siguiente": "El siguiente es PIERNA del #358. Peso estimado 18.5 kg (ajusta con báscula). Tara: Tambo Azul (1.2 kg).",
    "¿cuánto falta por pesar?": "Faltan 8 canales: #358 (PIERNA, COSTILLAR), #357 (LOMO x2), #356 (AMERICANO). Unos 90 kg en total.",
    "estado de hoy": "Hoy: 7 pedidos, 23 piezas en movimiento. Pesadas: 12. Entregadas: 3. Por pesar: 8. Margen: bueno si cobramos hoy los 2 de crédito.",
    "estimar pesos": "En Recetas, selecciona la receta y toca 'Estimar pesos'. Calculo desde el % de cada pieza y me confirmas antes de aplicar.",
    "¿qué conviene despiezar?": "Solo Lomo hoy: 3 carnicerías lo pidieron. No despieces Americanos (0 demanda). Los 49 en cámara se pueden dejar enteros.",
    "ver merma del día": "Merma estimada: 12% (normal). Mayor pérdida: PIERNA (1.2 kg de grasa). Vamos bien.",
    "sugerir recetas": "Tienes 46 recetas cargadas. Las más usadas: Americano (8 pedidos), Lomo (6), Jamón (4). ¿Crear una nueva?",
    "¿qué está en stock?": "156 kg totales. Distribuido: Lomo 34 kg, Pierna 28 kg, Costillar 18 kg, Otros 76 kg.",
    "ver faltantes": "Faltan: CABEZA (1 pedido), CUERO (1), GRASA especial (1). Total 3 piezas sin surtir.",
    "sugerir compras": "Necesitas reposición de Lomos (bajo) y Jamón curado (0 en stock). Contacta al proveedor.",
    "¿quién me debe?": "Abarrotes El Sol: $2,480 (64 días). El Carnicero: $1,116 (21 días). Total $3,596.",
    "recordatorios de cobro": "Te envío WhatsApp a ambos hoy. Abarrotes El Sol primero (vence hoy). ¿Doy la orden?",
    "+60 días vencidos": "Solo Abarrotes El Sol: $2,480 hace 64 días. Sugiero visita o ajuste en próximo pedido.",
    "hacer abono": "Abre Cobranza > Cliente > Abonar. Ingresa monto, método (efectivo/transferencia) y confirma.",
    "tara del tambo azul": "Tambo Azul = 1.2 kg. Es el recipiente azul. No olvides la tara al pesar.",
    "siguiente en cola": "PIERNA del #358. Peso bruto esperado: 19.7 kg (neto ~18.5 kg con tara).",
    "¿cuánto pesé hoy?": "Pesado hasta ahora: 1,840 kg (22 canales completados). Promedio: 83.6 kg/canal.",
    "registrar": "Presiona el botón verde 'Registrar' en la báscula para guardar el peso.",
    "default": "Entendido. Estoy revisando el estado del sistema para esa consulta — en la versión conectada te respondo con los datos reales de Supabase y, si me lo pides y confirmas, ejecuto la acción por ti.",
  },
};

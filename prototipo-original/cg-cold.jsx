/* ============================================================
   INVENTARIO FRÍO — Transferencia Fresco ↔ Frío con tickets
   ============================================================ */

const { useState, useRef } = React;

function ColdInventoryScreen({ ai }) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([
    { id:1, name:"JAMÓN", fresh:15.2, frozen:8.5, unit:"kg" },
    { id:2, name:"LOMO", fresh:22.1, frozen:12.0, unit:"kg" },
    { id:3, name:"COSTILLA", fresh:18.5, frozen:5.2, unit:"kg" },
    { id:4, name:"CUERO", fresh:4.2, frozen:2.1, unit:"kg" },
    { id:5, name:"VÍSCERAS", fresh:3.1, frozen:1.0, unit:"kg" },
  ]);
  const [openDialog, setOpenDialog] = useState(null); // "toFrozen", "toFresh", or null
  const [selectedItem, setSelectedItem] = useState(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferUnit, setTransferUnit] = useState("kg");
  const [ticket, setTicket] = useState(null);
  const printRef = useRef();

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleTransfer = (item, direction) => {
    setSelectedItem({ ...item, direction });
    setOpenDialog(direction === "frozen" ? "toFrozen" : "toFresh");
    setTransferAmount("");
  };

  const confirmTransfer = () => {
    if (!transferAmount || !selectedItem) return;

    const amount = parseFloat(transferAmount);
    const now = new Date();
    const ticketNum = Math.floor(Math.random() * 100000);
    
    const newItems = items.map(item => {
      if (item.id === selectedItem.id) {
        if (selectedItem.direction === "frozen") {
          return {
            ...item,
            fresh: Math.max(0, item.fresh - amount),
            frozen: item.frozen + amount,
          };
        } else {
          return {
            ...item,
            frozen: Math.max(0, item.frozen - amount),
            fresh: item.fresh + amount,
          };
        }
      }
      return item;
    });

    setItems(newItems);
    setTicket({
      id: ticketNum,
      date: now.toLocaleDateString("es-MX"),
      time: now.toLocaleTimeString("es-MX"),
      product: selectedItem.name,
      direction: selectedItem.direction,
      amount,
      unit: transferUnit,
      fromFresh: selectedItem.direction === "frozen" ? selectedItem.fresh : selectedItem.frozen,
      toFresh: selectedItem.direction === "frozen" ? selectedItem.fresh - amount : selectedItem.fresh + amount,
    });
    
    setOpenDialog(null);
    setSelectedItem(null);
    ai?.chip?.("✓ Transferencia registrada");
  };

  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open("", "", "height=400,width=600");
      printWindow.document.write(printRef.current.innerHTML);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownload = () => {
    if (ticket) {
      const csv = `Ticket #${ticket.id}\n${ticket.date} ${ticket.time}\n\nProducto: ${ticket.product}\nTransferencia: ${ticket.direction === "frozen" ? "A Frío" : "A Fresco"}\nCantidad: ${ticket.amount} ${ticket.unit}\n`;
      const blob = new Blob([csv], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ticket-${ticket.id}.txt`;
      a.click();
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: 1200 }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Inventario Frío</h1>
        <div style={{ display: "flex", gap: 10 }}>
          {ticket && (
            <>
              <button
                onClick={handlePrint}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                🖨️ Imprimir
              </button>
              <button
                onClick={handleDownload}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                ⬇️ Descargar
              </button>
            </>
          )}
        </div>
      </div>

      {/* BUSCADOR */}
      <div style={{ position: "relative", marginBottom: 20 }}>
        <span style={{ position: "absolute", left: 12, top: 12, color: "#999", fontSize: 16 }}>🔍</span>
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px 10px 36px",
            border: "1px solid #ddd",
            borderRadius: 8,
            fontSize: 13,
          }}
        />
      </div>

      {/* GRID DE PRODUCTOS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filteredItems.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 16,
              background: "#fafafa",
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>{item.name}</h3>

            {/* ESTADO DUAL: FRESCO | FRÍO */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ textAlign: "center", padding: 12, background: "#fff", borderRadius: 6, border: "1px solid #f0ad4e" }}>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Fresco</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f0ad4e" }}>{item.fresh}</div>
                <div style={{ fontSize: 10, color: "#999" }}>{item.unit}</div>
              </div>

              <div style={{ textAlign: "center", padding: 12, background: "#fff", borderRadius: 6, border: "1px solid #2196F3" }}>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Frío</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#2196F3" }}>{item.frozen}</div>
                <div style={{ fontSize: 10, color: "#999" }}>{item.unit}</div>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                onClick={() => handleTransfer(item, "frozen")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #2196F3",
                  background: "#E3F2FD",
                  color: "#2196F3",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                ❄️ A Frío
              </button>

              <button
                onClick={() => handleTransfer(item, "fresh")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #f0ad4e",
                  background: "#FFF8E1",
                  color: "#f0ad4e",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                🔥 A Fresco
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* DIÁLOGO DE TRANSFERENCIA */}
      {openDialog && selectedItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setOpenDialog(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 700 }}>
              {selectedItem.direction === "frozen" ? "Transferir a Frío" : "Transferir a Fresco"}
            </h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#333" }}>
                Producto
              </label>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#666" }}>{selectedItem.name}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#333" }}>
                  Cantidad
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#333" }}>
                  Unidad
                </label>
                <select
                  value={transferUnit}
                  onChange={(e) => setTransferUnit(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  <option value="kg">Kg</option>
                  <option value="pz">Pz</option>
                </select>
              </div>
            </div>

            {/* TIMESTAMP */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: 10,
                background: "#f5f5f5",
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 12,
                color: "#666",
              }}
            >
              <span>🕐</span>
              {new Date().toLocaleString("es-MX")}
            </div>

            {/* BOTONES */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setOpenDialog(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  border: "1px solid #ddd",
                  background: "#fff",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>

              <button
                onClick={confirmTransfer}
                style={{
                  flex: 1,
                  padding: "10px",
                  border: "none",
                  background: selectedItem.direction === "frozen" ? "#2196F3" : "#f0ad4e",
                  color: "#fff",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TICKET GENERADO */}
      {ticket && (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: "#4CAF50", color: "#fff", padding: 16, borderRadius: 8, maxWidth: 300 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>✓ Transferencia registrada</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 10 }}>
            {ticket.product} • {ticket.amount} {ticket.unit}
          </div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>Ticket #{ticket.id}</div>
          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>{ticket.time}</div>
        </div>
      )}

      {/* REFERENCIA PARA IMPRIMIR (hidden) */}
      {ticket && (
        <div
          ref={printRef}
          style={{
            display: "none",
            padding: 20,
            fontSize: 14,
            fontFamily: "monospace",
            lineHeight: 1.6,
          }}
        >
          <div style={{ textAlign: "center", fontWeight: "bold", marginBottom: 10 }}>
            CÁRNICOS GUSTAVO
          </div>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            Ticket #{ticket.id}
          </div>
          <div>Fecha: {ticket.date}</div>
          <div>Hora: {ticket.time}</div>
          <div style={{ marginTop: 10 }}>Producto: {ticket.product}</div>
          <div>Transferencia: {ticket.direction === "frozen" ? "A Frío" : "A Fresco"}</div>
          <div>Cantidad: {ticket.amount} {ticket.unit}</div>
          <div style={{ marginTop: 10, borderTop: "1px solid #000", paddingTop: 10 }}>
            Fresco: {ticket.fromFresh} {ticket.unit}
          </div>
          <div>Frío: {ticket.toFresh} {ticket.unit}</div>
        </div>
      )}
    </div>
  );
}

// Export para que la app pueda usarlo
Object.assign(window, { ColdInventoryScreen });

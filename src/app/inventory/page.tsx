"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Edit3, Check, X, Trash2, Plus, Download, Pencil } from "lucide-react";
import { formatQuantity, fromMl, toMl, type DisplayUnit } from "@/lib/units";

interface InventoryItem {
  product_id: string;
  product_name: string;
  canonical_name: string;
  quantity_on_hand_ml: number;
  total_required_ml: number;
  project_count: number;
  deficit_ml: number;
  status: string;
  last_updated: string | null;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [unit, setUnit] = useState<DisplayUnit>("mL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "low" | "out" | "sufficient">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  const fetchInventory = useCallback(() => {
    fetch("/api/inventory")
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const filtered = items.filter((item) => {
    const matchesSearch =
      item.canonical_name.toLowerCase().includes(search.toLowerCase()) ||
      item.product_name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || item.status === filter;
    return matchesSearch && matchesFilter;
  });

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.product_id);
    setEditValue(String(fromMl(item.quantity_on_hand_ml, unit).toFixed(3)));
  };

  const saveEdit = async (productId: string) => {
    const valueMl = toMl(parseFloat(editValue) || 0, unit);
    await fetch("/api/inventory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, quantity_on_hand_ml: valueMl }),
    });
    setEditingId(null);
    fetchInventory();
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm("Delete this product and all its requirements?")) return;
    await fetch(`/api/products/${productId}`, { method: "DELETE" });
    fetchInventory();
  };

  const startEditName = (item: InventoryItem) => {
    setEditingNameId(item.product_id);
    setEditNameValue(item.canonical_name);
    setEditingId(null);
  };

  const saveEditName = async (productId: string) => {
    if (!editNameValue.trim()) return;
    await fetch(`/api/products/${productId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canonical_name: editNameValue.trim() }),
    });
    setEditingNameId(null);
    fetchInventory();
  };

  const addProduct = async () => {
    if (!newName.trim()) return;
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), canonical_name: newName.trim() }),
    });
    setNewName("");
    setShowAdd(false);
    fetchInventory();
  };

  const downloadCsv = () => {
    const rows = [
      ["Product", `Required (${unit})`, `On Hand (${unit})`, "Status"],
      ...filtered.map((item) => [
        item.canonical_name,
        formatQuantity(item.total_required_ml, unit),
        formatQuantity(item.quantity_on_hand_ml, unit),
        item.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    const rows = filtered
      .map(
        (item) => `
        <tr>
          <td>${item.canonical_name}</td>
          <td class="num">${formatQuantity(item.total_required_ml, unit)}</td>
          <td class="num">${formatQuantity(item.quantity_on_hand_ml, unit)}</td>
          <td class="${item.status}">${item.status === "out" ? "Out" : item.status === "low" ? "Low" : "OK"}</td>
        </tr>`
      )
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Inventory</title><style>
      body{font-family:sans-serif;font-size:12px;margin:2rem}
      h1{font-size:1.25rem;margin-bottom:0.25rem}
      p{color:#666;margin:0 0 1rem}
      table{border-collapse:collapse;width:100%}
      th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}
      th{background:#f5f5f5;font-weight:600}
      .num{text-align:right;font-family:monospace}
      .out{color:#dc2626;font-weight:600}
      .low{color:#d97706;font-weight:600}
      .sufficient{color:#16a34a}
      @media print{body{margin:0}}
    </style></head><body>
      <h1>Inventory Sheet</h1>
      <p>Generated ${new Date().toLocaleDateString()} &mdash; values in ${unit}</p>
      <table>
        <thead><tr><th>Product</th><th>Required (${unit})</th><th>On Hand (${unit})</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const statusCounts = {
    all: items.length,
    out: items.filter((i) => i.status === "out").length,
    low: items.filter((i) => i.status === "low").length,
    sufficient: items.filter((i) => i.status === "sufficient").length,
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ color: "var(--text-muted)" }}>Loading inventory...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em" }}>Inventory</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: 4 }}>
            {items.length} products tracked
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as DisplayUnit)}
            style={{ padding: "0.375rem 0.625rem", fontSize: "0.8125rem" }}
          >
            <option value="mL">mL</option>
            <option value="L">L</option>
            <option value="gal">Gallons</option>
            <option value="fl oz">fl oz</option>
          </select>
          <button
            onClick={downloadCsv}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "transparent", color: "var(--text-secondary)",
              padding: "0.5rem 0.875rem", borderRadius: 6,
              fontSize: "0.875rem", fontWeight: 500, border: "1px solid var(--border)", cursor: "pointer",
            }}
            title="Download spreadsheet (CSV)"
          >
            <Download size={15} /> CSV
          </button>
          <button
            onClick={downloadPdf}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "transparent", color: "var(--text-secondary)",
              padding: "0.5rem 0.875rem", borderRadius: 6,
              fontSize: "0.875rem", fontWeight: 500, border: "1px solid var(--border)", cursor: "pointer",
            }}
            title="Download PDF"
          >
            <Download size={15} /> PDF
          </button>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "var(--accent)", color: "#fff",
              padding: "0.5rem 1rem", borderRadius: 6,
              fontSize: "0.875rem", fontWeight: 500, border: "none", cursor: "pointer",
            }}
          >
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* Add product inline */}
      {showAdd && (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--accent)",
          borderRadius: 8, padding: "1rem 1.25rem", marginBottom: "1rem",
          display: "flex", gap: "0.75rem", alignItems: "center",
        }}>
          <input
            type="text"
            placeholder="Product name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addProduct()}
            style={{ flex: 1 }}
            autoFocus
          />
          <button
            onClick={addProduct}
            style={{ background: "var(--success)", color: "#fff", border: "none", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontSize: "0.875rem" }}
          >
            Add
          </button>
          <button
            onClick={() => { setShowAdd(false); setNewName(""); }}
            style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.5rem 1rem", cursor: "pointer", fontSize: "0.875rem" }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            type="search"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", paddingLeft: "2rem" }}
          />
        </div>
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {(["all", "out", "low", "sufficient"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "0.375rem 0.75rem", borderRadius: 6, fontSize: "0.8125rem",
                border: "1px solid var(--border)", cursor: "pointer",
                background: filter === f ? "var(--bg-hover)" : "transparent",
                color: filter === f ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {f === "all" ? "All" : f === "out" ? "Out of Stock" : f === "low" ? "Low Stock" : "Sufficient"}
              <span style={{ marginLeft: 6, opacity: 0.5 }}>{statusCounts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Required ({unit})</th>
              <th style={{ textAlign: "right" }}>On Hand ({unit})</th>
              <th style={{ textAlign: "right" }}>Deficit ({unit})</th>
              <th>Projects</th>
              <th style={{ width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                  {items.length === 0 ? "No products yet. Upload a spray plan to get started." : "No matching products."}
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.product_id}>
                  <td style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {editingNameId === item.product_id ? (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input
                          type="text"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditName(item.product_id);
                            if (e.key === "Escape") setEditingNameId(null);
                          }}
                          style={{ flex: 1, padding: "0.25rem 0.5rem" }}
                          autoFocus
                        />
                        <button
                          onClick={() => saveEditName(item.product_id)}
                          style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer", padding: 4 }}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingNameId(null)}
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        {item.canonical_name}
                        {item.product_name !== item.canonical_name && (
                          <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 2 }}>
                            aka {item.product_name}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${item.status === "out" ? "badge-danger" : item.status === "low" ? "badge-warning" : "badge-success"}`}>
                      {item.status === "out" ? "Out" : item.status === "low" ? "Low" : "OK"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8125rem" }}>
                    {formatQuantity(item.total_required_ml, unit)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {editingId === item.product_id ? (
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(item.product_id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          style={{ width: 100, textAlign: "right", padding: "0.25rem 0.5rem" }}
                          autoFocus
                        />
                        <button
                          onClick={() => saveEdit(item.product_id)}
                          style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer", padding: 4 }}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <span
                        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8125rem", cursor: "pointer" }}
                        onClick={() => startEdit(item)}
                      >
                        {formatQuantity(item.quantity_on_hand_ml, unit)}
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.8125rem",
                      color: item.deficit_ml < 0 ? "var(--danger)" : "var(--success)",
                    }}
                  >
                    {item.deficit_ml < 0 ? "" : "+"}{formatQuantity(item.deficit_ml, unit)}
                  </td>
                  <td>
                    <span className="badge badge-info">{item.project_count}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => startEditName(item)}
                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                        title="Rename product"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => startEdit(item)}
                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                        title="Edit stock"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => deleteProduct(item.product_id)}
                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                        title="Delete product"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

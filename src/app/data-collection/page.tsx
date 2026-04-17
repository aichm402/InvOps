"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

const GROUPS = [100, 200, 300];
const REPS = ["A", "B", "C", "D", "E", "F"];
const ROWS = 24;
const DATA_TYPES = ["a", "b", "c", "d", "e"];
const COMMON_EVENTS = [
  "Control 0-100%",
  "Phytotoxicity",
  "Weed Species",
  "Stand Count",
  "Weed Density per sq. meter",
];

function buildPrintHTML(
  project: string,
  date: string,
  location: string,
  dat: string,
  dataLabels: string[]
): string {
  const headerVal = (val: string, label: string) =>
    `<span class="hdr-label">${label}</span><span class="hdr-val">${val || ""}</span>`;

  const groupHTML = (base: number) => {
    const rows = Array.from({ length: ROWS }, (_, i) => {
      const plot = base + i + 1;
      const cells = REPS.map(() => `<td></td>`).join("");
      return `<tr><td class="plot">${plot}</td>${cells}</tr>`;
    }).join("");

    const headerCells = REPS.map((r) => `<th>${r}</th>`).join("");

    return `
      <table>
        <thead>
          <tr><th></th>${headerCells}</tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  };

  const legendItems = DATA_TYPES.map((letter, i) => {
    const label = dataLabels[i] || "";
    return `<div class="legend-item">
      <span class="legend-letter">${letter}</span>
      <span class="legend-val">${label}</span>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Ratings Sheet</title>
  <style>
    @page { size: landscape; margin: 0.5in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9pt; }

    .page-header {
      display: flex;
      gap: 2rem;
      align-items: baseline;
      margin-bottom: 6px;
      border-bottom: 1px solid #000;
      padding-bottom: 4px;
    }
    .hdr-label { font-weight: bold; margin-right: 4px; }
    .hdr-val {
      display: inline-block;
      min-width: 120px;
      border-bottom: 1px solid #000;
      margin-right: 1.5rem;
    }

    .grid {
      display: flex;
      gap: 6px;
      width: 100%;
    }
    .grid > table {
      flex: 1;
      border-collapse: collapse;
    }
    table th, table td {
      border: 1px solid #000;
      width: 20px;
      height: 18px;
      text-align: center;
      vertical-align: middle;
      padding: 0;
    }
    table th {
      background: #f0f0f0;
      font-weight: bold;
      font-size: 8pt;
    }
    table td.plot {
      font-weight: bold;
      font-size: 8pt;
      white-space: nowrap;
      width: 28px;
    }

    .legend {
      margin-top: 10px;
      display: flex;
      gap: 1.5rem;
      font-size: 8pt;
      flex-wrap: wrap;
    }
    .legend-item {
      display: flex;
      align-items: baseline;
      gap: 5px;
    }
    .legend-letter {
      font-weight: bold;
      font-size: 9pt;
    }
    .legend-val {
      display: inline-block;
      min-width: 110px;
      border-bottom: 1px solid #000;
      padding-bottom: 1px;
    }
  </style>
</head>
<body>
  <div class="page-header">
    ${headerVal(project, "Project")}
    ${headerVal(date, "DATE")}
    ${headerVal(location, "Location")}
    ${headerVal(dat, "DAT")}
  </div>

  <div class="grid">
    ${GROUPS.map((base) => groupHTML(base)).join("")}
  </div>

  <div class="legend">
    ${legendItems}
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;
}

export default function DataCollectionPage() {
  const [project, setProject] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [dat, setDat] = useState("");
  const [dataLabels, setDataLabels] = useState<string[]>(Array(5).fill(""));

  function setLabel(index: number, value: string) {
    setDataLabels((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleGenerate() {
    const html = buildPrintHTML(project, date, location, dat, dataLabels);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.onafterprint = () => URL.revokeObjectURL(url);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--text-primary)",
    fontSize: "0.875rem",
    padding: "0.5rem 0.75rem",
    width: "100%",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: "0.25rem",
    display: "block",
  };

  return (
    <div style={{ padding: "2rem", maxWidth: 680 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.25rem" }}>
        Data Collection
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "2rem" }}>
        Generate a blank ratings sheet to print and use in the field.
      </p>

      {/* Header fields */}
      <div
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "1.5rem",
          marginBottom: "1rem",
        }}
      >
        <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "1rem" }}>
          Sheet Header
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={labelStyle}>Project</label>
            <input
              style={inputStyle}
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="e.g. ARM-2026-01"
            />
          </div>
          <div>
            <label style={labelStyle}>Date</label>
            <input
              style={inputStyle}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input
              style={inputStyle}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Lincoln, NE"
            />
          </div>
          <div>
            <label style={labelStyle}>DAT</label>
            <input
              style={inputStyle}
              value={dat}
              onChange={(e) => setDat(e.target.value)}
              placeholder="e.g. 14"
            />
          </div>
        </div>
      </div>

      {/* Data type legend */}
      <div
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
          Data Types (a – e)
        </p>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
          Select or type the data being collected for each letter. Leave blank to fill by hand.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {DATA_TYPES.map((letter, i) => (
            <div key={letter} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "0.9375rem",
                  width: 20,
                  textAlign: "center",
                  color: "var(--text-primary)",
                  flexShrink: 0,
                }}
              >
                {letter}
              </span>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  list={`suggestions-${letter}`}
                  style={inputStyle}
                  value={dataLabels[i]}
                  onChange={(e) => setLabel(i, e.target.value)}
                  placeholder="Select or type..."
                />
                <datalist id={`suggestions-${letter}`}>
                  {COMMON_EVENTS.map((event) => (
                    <option key={event} value={event} />
                  ))}
                </datalist>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleGenerate}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          padding: "0.625rem 1.25rem",
          fontSize: "0.875rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <FileDown size={16} />
        Generate Ratings Sheet
      </button>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Check, AlertTriangle, X, Loader2 } from "lucide-react";
import Link from "next/link";

interface UploadedProduct {
  name: string;
  normalized_name: string;
  amount: number;
  amount_ml: number;
  unit: string;
  matched_product_name: string;
  match_score: number;
  is_new: boolean;
  flagged: boolean;
  confidence: string;
}

interface UploadResult {
  project: { id: string; name: string; source_filename: string };
  products: UploadedProduct[];
  warnings: string[];
}

export default function UploadPage() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const result: UploadResult = await res.json();
      setResults((prev) => [result, ...prev]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );
    files.forEach(uploadFile);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(uploadFile);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em" }}>Upload Spray Plan</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: 4 }}>
          Upload ARM spray plan PDFs to extract product requirements
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 12,
          padding: "3rem 2rem",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "var(--accent-muted)" : "var(--bg-card)",
          transition: "all 0.2s",
          marginBottom: "2rem",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        {uploading ? (
          <>
            <Loader2 size={40} style={{ color: "var(--accent)", margin: "0 auto 1rem", animation: "spin 1s linear infinite" }} />
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontWeight: 500, marginBottom: "0.5rem" }}>Processing PDF...</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              Extracting product requirements
            </div>
          </>
        ) : (
          <>
            <Upload size={40} style={{ color: "var(--text-muted)", margin: "0 auto 1rem" }} />
            <div style={{ fontWeight: 500, marginBottom: "0.5rem" }}>
              Drop spray plan PDF here or click to browse
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
              Supports ARM-generated spray plan PDFs with product quantity tables
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "var(--danger-muted)", border: "1px solid var(--danger)",
            borderRadius: 8, padding: "1rem 1.25rem", marginBottom: "1.5rem",
            display: "flex", alignItems: "center", gap: "0.75rem",
          }}
        >
          <X size={18} style={{ color: "var(--danger)" }} />
          <div style={{ color: "var(--danger)", fontSize: "0.875rem" }}>{error}</div>
        </div>
      )}

      {/* Results */}
      {results.map((result, idx) => (
        <div
          key={idx}
          style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 8, marginBottom: "1rem", overflow: "hidden",
          }}
        >
          <div style={{
            padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <FileText size={20} style={{ color: "var(--accent)" }} />
              <div>
                <div style={{ fontWeight: 500 }}>{result.project.name}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {result.products.length} products extracted
                </div>
              </div>
            </div>
            <Link
              href="/projects"
              style={{
                fontSize: "0.8125rem", color: "var(--accent)", textDecoration: "none",
                padding: "0.375rem 0.75rem", border: "1px solid var(--accent)",
                borderRadius: 6,
              }}
            >
              View in Projects
            </Link>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div style={{ padding: "0.75rem 1.25rem", background: "var(--warning-muted)" }}>
              {result.warnings.map((w, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", color: "var(--warning)" }}>
                  <AlertTriangle size={14} /> {w}
                </div>
              ))}
            </div>
          )}

          {/* Product list */}
          <table>
            <thead>
              <tr>
                <th>Parsed Name</th>
                <th>Matched To</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {result.products.map((p, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                    {p.name}
                    {p.normalized_name !== p.name && (
                      <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 2 }}>
                        Normalized: {p.normalized_name}
                      </div>
                    )}
                  </td>
                  <td>
                    {p.matched_product_name}
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: "0.6875rem",
                        color: p.match_score < 0.1 ? "var(--success)" : p.match_score < 0.3 ? "var(--warning)" : "var(--text-muted)",
                      }}
                    >
                      ({(100 - p.match_score * 100).toFixed(0)}% match)
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8125rem" }}>
                    {p.amount.toFixed(3)} {p.unit}
                  </td>
                  <td>
                    {p.is_new ? (
                      <span className="badge badge-info">New product</span>
                    ) : p.flagged ? (
                      <span className="badge badge-warning">
                        <AlertTriangle size={12} style={{ marginRight: 4 }} /> Review
                      </span>
                    ) : (
                      <span className="badge badge-success">
                        <Check size={12} style={{ marginRight: 4 }} /> Matched
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

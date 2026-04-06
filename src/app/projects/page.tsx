"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, Trash2, AlertTriangle, ChevronDown, ChevronUp, X, Pencil } from "lucide-react";
import { formatQuantity, type DisplayUnit } from "@/lib/units";

interface Project {
  id: string;
  name: string;
  source_filename: string;
  upload_date: string;
  status: string;
  product_count: number;
  total_required_ml: number;
  flagged_count: number;
}

interface ProjectRequirement {
  id: string;
  product_id: string;
  product_name: string;
  canonical_name: string;
  required_quantity_ml: number;
  original_quantity: number;
  original_unit: string;
  flagged: number;
  flag_reason: string | null;
}

interface ProjectDetail extends Project {
  requirements: ProjectRequirement[];
}

interface ProductOption {
  id: string;
  canonical_name: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<DisplayUnit>("mL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);

  // Review modal state
  const [reviewingReq, setReviewingReq] = useState<ProjectRequirement | null>(null);
  const [canonicalName, setCanonicalName] = useState("");
  const [mergeIntoId, setMergeIntoId] = useState("");
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Edit product name modal state
  const [editingReq, setEditingReq] = useState<ProjectRequirement | null>(null);
  const [editName, setEditName] = useState("");
  const [editMergeIntoId, setEditMergeIntoId] = useState("");

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data);
        setLoading(false);
      });
  }, []);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json();
    setDetail(data);
  };

  const deleteProject = async (id: string) => {
    if (!confirm("Delete this project and all its parsed requirements?")) return;
    await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
    setProjects(projects.filter((p) => p.id !== id));
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
    }
  };

  const openReview = async (req: ProjectRequirement) => {
    setReviewingReq(req);
    setCanonicalName(req.canonical_name);
    setMergeIntoId("");
    if (allProducts.length === 0) {
      const res = await fetch("/api/products");
      const data: ProductOption[] = await res.json();
      setAllProducts(data);
    }
  };

  const closeReview = () => {
    setReviewingReq(null);
    setCanonicalName("");
    setMergeIntoId("");
  };

  const openEdit = async (req: ProjectRequirement) => {
    setEditingReq(req);
    setEditName(req.canonical_name);
    setEditMergeIntoId("");
    if (allProducts.length === 0) {
      const res = await fetch("/api/products");
      const data: ProductOption[] = await res.json();
      setAllProducts(data);
    }
  };

  const closeEdit = () => {
    setEditingReq(null);
    setEditName("");
    setEditMergeIntoId("");
  };

  const submitEdit = async () => {
    if (!editingReq) return;
    if (!editMergeIntoId && !editName.trim()) return;
    setSubmitting(true);
    try {
      if (editMergeIntoId) {
        // Merge path: use requirements PATCH (same as Review modal)
        const res = await fetch(`/api/requirements/${editingReq.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ merge_into_product_id: editMergeIntoId }),
        });
        if (!res.ok) return;
        const mergedProduct = allProducts.find((p) => p.id === editMergeIntoId);
        if (detail && mergedProduct) {
          setDetail({
            ...detail,
            requirements: detail.requirements.map((r) =>
              r.id === editingReq.id
                ? { ...r, canonical_name: mergedProduct.canonical_name, product_id: editMergeIntoId }
                : r
            ),
          });
        }
      } else {
        // Rename path
        const res = await fetch(`/api/products/${editingReq.product_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canonical_name: editName.trim() }),
        });
        if (!res.ok) return;
        if (detail) {
          setDetail({
            ...detail,
            requirements: detail.requirements.map((r) =>
              r.product_id === editingReq.product_id
                ? { ...r, canonical_name: editName.trim() }
                : r
            ),
          });
        }
      }
      closeEdit();
    } finally {
      setSubmitting(false);
    }
  };

  const submitReview = async () => {
    if (!reviewingReq) return;
    setSubmitting(true);
    try {
      const body: Record<string, string> = {};
      if (mergeIntoId) {
        body.merge_into_product_id = mergeIntoId;
      } else {
        body.canonical_name = canonicalName;
      }

      const res = await fetch(`/api/requirements/${reviewingReq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) return;

      // Update detail state to reflect the cleared flag (and merged name if applicable)
      if (detail) {
        const mergedProduct = mergeIntoId
          ? allProducts.find((p) => p.id === mergeIntoId)
          : null;

        setDetail({
          ...detail,
          requirements: detail.requirements.map((r) => {
            if (r.id !== reviewingReq.id) return r;
            return {
              ...r,
              flagged: 0,
              flag_reason: null,
              canonical_name: mergedProduct
                ? mergedProduct.canonical_name
                : canonicalName,
              product_id: mergeIntoId || r.product_id,
            };
          }),
        });

        // Update the flagged_count on the project header
        setProjects((prev) =>
          prev.map((p) =>
            p.id === detail.id
              ? { ...p, flagged_count: Math.max(0, p.flagged_count - 1) }
              : p
          )
        );
      }

      closeReview();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ color: "var(--text-muted)" }}>Loading projects...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em" }}>Projects</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: 4 }}>
            {projects.length} spray plans uploaded
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
          <Link
            href="/upload"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "var(--accent)", color: "#fff",
              padding: "0.5rem 1rem", borderRadius: 6,
              fontSize: "0.875rem", fontWeight: 500, textDecoration: "none",
            }}
          >
            Upload PDF
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8,
          padding: "3rem", textAlign: "center",
        }}>
          <FolderOpen size={40} style={{ color: "var(--text-muted)", margin: "0 auto 1rem" }} />
          <h3 style={{ fontSize: "1rem", fontWeight: 500, marginBottom: "0.5rem" }}>No projects yet</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            <Link href="/upload" style={{ color: "var(--accent)" }}>Upload a spray plan PDF</Link> to get started.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {projects.map((project) => (
            <div
              key={project.id}
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}
            >
              {/* Project header row */}
              <div
                style={{
                  padding: "1rem 1.25rem",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  cursor: "pointer",
                }}
                onClick={() => toggleExpand(project.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {expandedId === project.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "0.9375rem" }}>{project.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                      {project.source_filename} · {new Date(project.upload_date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span className="badge badge-info">{project.product_count} products</span>
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatQuantity(project.total_required_ml, unit)} {unit}
                  </span>
                  {project.flagged_count > 0 && (
                    <span className="badge badge-warning" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <AlertTriangle size={12} /> {project.flagged_count} flagged
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4 }}
                    title="Delete project"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === project.id && detail && (
                <div style={{ borderTop: "1px solid var(--border)" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th style={{ textAlign: "right" }}>Required ({unit})</th>
                        <th style={{ textAlign: "right" }}>Original</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.requirements?.map((req) => (
                        <tr key={req.id}>
                          <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                            {req.canonical_name}
                            {req.product_name !== req.canonical_name && (
                              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: 8 }}>
                                (parsed as: {req.product_name})
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8125rem" }}>
                            {formatQuantity(req.required_quantity_ml, unit)}
                          </td>
                          <td style={{ textAlign: "right", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                            {req.original_quantity} {req.original_unit}
                          </td>
                          <td>
                            {req.flagged ? (
                              <button
                                onClick={() => openReview(req)}
                                className="badge badge-warning"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  background: "none", border: "none", cursor: "pointer",
                                  font: "inherit", padding: "0.2rem 0.5rem",
                                }}
                                title={req.flag_reason ?? "Review this product match"}
                              >
                                <AlertTriangle size={12} /> Review
                              </button>
                            ) : (
                              <button
                                onClick={() => openEdit(req)}
                                className="badge badge-success"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  background: "none", border: "none", cursor: "pointer",
                                  font: "inherit", padding: "0.2rem 0.5rem",
                                }}
                                title="Edit canonical name"
                              >
                                <Pencil size={11} /> OK
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit product name modal */}
      {editingReq && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeEdit(); }}
        >
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "1.5rem", width: 480, maxWidth: "90vw",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>Edit Product</h2>
              <button
                onClick={closeEdit}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Current info */}
            <div style={{
              background: "var(--bg-surface, var(--bg))", border: "1px solid var(--border)",
              borderRadius: 6, padding: "0.75rem 1rem", marginBottom: "1.25rem",
              fontSize: "0.875rem",
            }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <span style={{ color: "var(--text-muted)", minWidth: 90 }}>Parsed as:</span>
                <span style={{ fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" }}>
                  {editingReq.product_name}
                </span>
              </div>
            </div>

            {/* Option A: rename */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.375rem" }}>
                Confirm canonical name
              </label>
              <input
                type="text"
                value={editMergeIntoId ? "" : editName}
                onChange={(e) => { setEditMergeIntoId(""); setEditName(e.target.value); }}
                onKeyDown={(e) => { if (e.key === "Enter") submitEdit(); if (e.key === "Escape") closeEdit(); }}
                placeholder="Canonical product name"
                disabled={!!editMergeIntoId}
                style={{
                  width: "100%", padding: "0.5rem 0.625rem", fontSize: "0.875rem",
                  borderRadius: 6, border: "1px solid var(--border)",
                  background: editMergeIntoId ? "var(--bg-surface, var(--bg))" : undefined,
                  opacity: editMergeIntoId ? 0.5 : 1,
                  boxSizing: "border-box",
                }}
                autoFocus
              />
            </div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ flex: 1, borderTop: "1px solid var(--border)" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>or</span>
              <div style={{ flex: 1, borderTop: "1px solid var(--border)" }} />
            </div>

            {/* Option B: merge */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.375rem" }}>
                Merge into existing product
              </label>
              <select
                value={editMergeIntoId}
                onChange={(e) => setEditMergeIntoId(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.625rem", fontSize: "0.875rem", borderRadius: 6, border: "1px solid var(--border)", boxSizing: "border-box" }}
              >
                <option value="">— select a product —</option>
                {allProducts
                  .filter((p) => p.id !== editingReq.product_id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.canonical_name}</option>
                  ))}
              </select>
              {editMergeIntoId && (
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.375rem" }}>
                  &ldquo;{editingReq.product_name}&rdquo; will be added as an alias of the selected product.
                </p>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.625rem" }}>
              <button
                onClick={closeEdit}
                style={{ padding: "0.5rem 1rem", borderRadius: 6, fontSize: "0.875rem", background: "none", border: "1px solid var(--border)", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={submitEdit}
                disabled={submitting || (!editMergeIntoId && !editName.trim())}
                style={{
                  padding: "0.5rem 1rem", borderRadius: 6, fontSize: "0.875rem", fontWeight: 500,
                  background: "var(--accent)", color: "#fff", border: "none",
                  cursor: submitting ? "wait" : "pointer",
                  opacity: submitting || (!editMergeIntoId && !editName.trim()) ? 0.6 : 1,
                }}
              >
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review modal */}
      {reviewingReq && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeReview(); }}
        >
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "1.5rem", width: 480, maxWidth: "90vw",
          }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>Review Product Match</h2>
              <button
                onClick={closeReview}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Parsed info */}
            <div style={{
              background: "var(--bg-surface, var(--bg))", border: "1px solid var(--border)",
              borderRadius: 6, padding: "0.75rem 1rem", marginBottom: "1.25rem",
              fontSize: "0.875rem",
            }}>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.375rem" }}>
                <span style={{ color: "var(--text-muted)", minWidth: 90 }}>Parsed as:</span>
                <span style={{ fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" }}>
                  {reviewingReq.product_name}
                </span>
              </div>
              {reviewingReq.flag_reason && (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <span style={{ color: "var(--text-muted)", minWidth: 90 }}>Reason:</span>
                  <span style={{ color: "var(--warning, #f59e0b)" }}>{reviewingReq.flag_reason}</span>
                </div>
              )}
            </div>

            {/* Option A: confirm / rename */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.375rem" }}>
                Confirm canonical name
              </label>
              <input
                type="text"
                value={mergeIntoId ? "" : canonicalName}
                onChange={(e) => { setMergeIntoId(""); setCanonicalName(e.target.value); }}
                placeholder="Canonical product name"
                disabled={!!mergeIntoId}
                style={{
                  width: "100%", padding: "0.5rem 0.625rem", fontSize: "0.875rem",
                  borderRadius: 6, border: "1px solid var(--border)",
                  background: mergeIntoId ? "var(--bg-surface, var(--bg))" : undefined,
                  opacity: mergeIntoId ? 0.5 : 1,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ flex: 1, borderTop: "1px solid var(--border)" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>or</span>
              <div style={{ flex: 1, borderTop: "1px solid var(--border)" }} />
            </div>

            {/* Option B: merge with existing */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.375rem" }}>
                Merge into existing product
              </label>
              <select
                value={mergeIntoId}
                onChange={(e) => setMergeIntoId(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.625rem", fontSize: "0.875rem", borderRadius: 6, border: "1px solid var(--border)", boxSizing: "border-box" }}
              >
                <option value="">— select a product —</option>
                {allProducts
                  .filter((p) => p.id !== reviewingReq.product_id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.canonical_name}</option>
                  ))}
              </select>
              {mergeIntoId && (
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.375rem" }}>
                  &ldquo;{reviewingReq.product_name}&rdquo; will be added as an alias of the selected product.
                </p>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.625rem" }}>
              <button
                onClick={closeReview}
                style={{
                  padding: "0.5rem 1rem", borderRadius: 6, fontSize: "0.875rem",
                  background: "none", border: "1px solid var(--border)", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={submitReview}
                disabled={submitting || (!mergeIntoId && !canonicalName.trim())}
                style={{
                  padding: "0.5rem 1rem", borderRadius: 6, fontSize: "0.875rem", fontWeight: 500,
                  background: "var(--accent)", color: "#fff", border: "none",
                  cursor: submitting ? "wait" : "pointer",
                  opacity: submitting || (!mergeIntoId && !canonicalName.trim()) ? 0.6 : 1,
                }}
              >
                {submitting ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

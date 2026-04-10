"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, Trash2, AlertTriangle, ChevronDown, ChevronUp, X, Pencil, Plus } from "lucide-react";
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
  crop: string | null;
  application_timings: string | null;
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

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  notes: string | null;
  color: string | null;
}

interface ProjectDetail extends Project {
  requirements: ProjectRequirement[];
  crop: string | null;
  application_timings: string | null;
  events: CalendarEvent[];
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
  const [cropFilter, setCropFilter] = useState("all");
  const [timingFilter, setTimingFilter] = useState("all");
  const [collapsedCrops, setCollapsedCrops] = useState<Set<string>>(new Set());
  const [renamingCrop, setRenamingCrop] = useState<string | null>(null);
  const [renamingCropVal, setRenamingCropVal] = useState("");

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

  const [productsExpanded, setProductsExpanded] = useState(false);

  // Edit crop/timings modal state
  const [editingSpray, setEditingSpray] = useState(false);
  const [sprayEditCrop, setSprayEditCrop] = useState("");
  const [sprayEditTimings, setSprayEditTimings] = useState<string[]>([]);
  const [sprayEditNewTiming, setSprayEditNewTiming] = useState("");
  const [sprayEditTimingRename, setSprayEditTimingRename] = useState<string | null>(null);
  const [sprayEditTimingRenameVal, setSprayEditTimingRenameVal] = useState("");
  const [spraySubmitting, setSpraySubmitting] = useState(false);

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
    setProductsExpanded(false);
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

  const openSprayEdit = () => {
    if (!detail) return;
    setSprayEditCrop(detail.crop ?? "");
    setSprayEditTimings(detail.application_timings ? JSON.parse(detail.application_timings) : []);
    setSprayEditNewTiming("");
    setSprayEditTimingRename(null);
    setEditingSpray(true);
  };

  const closeSprayEdit = () => {
    setEditingSpray(false);
    setSprayEditTimingRename(null);
  };

  const saveSprayEdit = async () => {
    if (!detail) return;
    setSpraySubmitting(true);
    try {
      const res = await fetch(`/api/projects/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crop: sprayEditCrop.trim() || null,
          application_timings: sprayEditTimings,
        }),
      });
      if (!res.ok) return;
      const newCrop = sprayEditCrop.trim() || null;
      const newTimings = sprayEditTimings.length > 0 ? JSON.stringify(sprayEditTimings) : null;
      setDetail({ ...detail, crop: newCrop, application_timings: newTimings });
      setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, crop: newCrop, application_timings: newTimings } : p));
      closeSprayEdit();
    } finally {
      setSpraySubmitting(false);
    }
  };

  const commitCropRename = async (oldCrop: string, newCrop: string, groupProjects: Project[]) => {
    const trimmed = newCrop.trim();
    if (!trimmed || trimmed === oldCrop) { setRenamingCrop(null); return; }
    // Update all projects in this crop group
    await Promise.all(
      groupProjects.map((p) =>
        fetch(`/api/projects/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ crop: trimmed }),
        })
      )
    );
    setProjects((prev) => prev.map((p) => (p.crop ?? "Unknown / Bareground") === oldCrop ? { ...p, crop: trimmed } : p));
    if (detail && (detail.crop ?? "Unknown / Bareground") === oldCrop) {
      setDetail({ ...detail, crop: trimmed });
    }
    setRenamingCrop(null);
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

  // Derive filter options from loaded data
  const allCrops = Array.from(new Set(projects.map((p) => p.crop ?? "Unknown / Bareground"))).sort();
  const allTimings = Array.from(new Set(projects.flatMap((p) => p.application_timings ? JSON.parse(p.application_timings) as string[] : []))).sort();

  const visibleProjects = projects.filter((p) => {
    if (cropFilter !== "all") {
      const c = p.crop ?? "Unknown / Bareground";
      if (c !== cropFilter) return false;
    }
    if (timingFilter !== "all") {
      const timings: string[] = p.application_timings ? JSON.parse(p.application_timings) : [];
      if (!timings.includes(timingFilter)) return false;
    }
    return true;
  });

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <FolderOpen size={22} color="var(--accent)" />
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em" }}>Project Details</h1>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: 4 }}>
            {visibleProjects.length}{visibleProjects.length !== projects.length ? ` of ${projects.length}` : ""} spray plan{projects.length !== 1 ? "s" : ""}
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

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Crop:</label>
          <select
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
            style={{ padding: "0.375rem 0.625rem", fontSize: "0.8125rem", borderRadius: 6, border: "1px solid var(--border)" }}
          >
            <option value="all">All crops</option>
            {allCrops.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Application Timing:</label>
          <select
            value={timingFilter}
            onChange={(e) => setTimingFilter(e.target.value)}
            style={{ padding: "0.375rem 0.625rem", fontSize: "0.8125rem", borderRadius: 6, border: "1px solid var(--border)" }}
          >
            <option value="all">All timings</option>
            {allTimings.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {(cropFilter !== "all" || timingFilter !== "all") && (
          <button
            onClick={() => { setCropFilter("all"); setTimingFilter("all"); }}
            style={{ fontSize: "0.8125rem", color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "0.375rem 0.625rem", cursor: "pointer" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {visibleProjects.length === 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "3rem", textAlign: "center" }}>
          <FolderOpen size={40} style={{ color: "var(--text-muted)", margin: "0 auto 1rem" }} />
          {projects.length === 0 ? (
            <>
              <h3 style={{ fontSize: "1rem", fontWeight: 500, marginBottom: "0.5rem" }}>No projects yet</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                <Link href="/upload" style={{ color: "var(--accent)" }}>Upload a spray plan PDF</Link> to get started.
              </p>
            </>
          ) : (
            <>
              <h3 style={{ fontSize: "1rem", fontWeight: 500, marginBottom: "0.5rem" }}>No projects match your filters</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                <button onClick={() => { setCropFilter("all"); setTimingFilter("all"); }} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, fontSize: "inherit" }}>Clear filters</button> to see all projects.
              </p>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {(() => {
            // Group visible projects by crop
            const grouped: Record<string, Project[]> = {};
            for (const p of visibleProjects) {
              const key = p.crop ?? "Unknown / Bareground";
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(p);
            }

            return Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([cropKey, cropProjects]) => {
                const collapsed = collapsedCrops.has(cropKey);
                const cropTimings = Array.from(new Set(cropProjects.flatMap((p) => p.application_timings ? JSON.parse(p.application_timings) as string[] : []))).sort();

                const timingBadge = (t: string) => {
                  const style =
                    t.toUpperCase().startsWith("PRE") || t === "PREPLANT"
                      ? { background: "rgba(34,197,94,0.15)", color: "#16a34a" }
                      : t.toUpperCase().startsWith("POST") || ["EPOST","MPOST","LPOST","BPOST"].includes(t)
                      ? { background: "rgba(59,130,246,0.15)", color: "#2563eb" }
                      : t === "BURNDOWN" || t === "FOLIAR"
                      ? { background: "rgba(249,115,22,0.15)", color: "#ea580c" }
                      : { background: "rgba(107,114,128,0.15)", color: "#6b7280" };
                  return (
                    <span key={t} style={{ ...style, padding: "0.2rem 0.5rem", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                      {t}
                    </span>
                  );
                };

                return (
                  <div key={cropKey} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    {/* Crop group header */}
                    <div
                      style={{ padding: "0.875rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-secondary)", borderBottom: collapsed ? "none" : "1px solid var(--border)" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0 }}>
                        <div
                          style={{ cursor: "pointer", display: "flex", alignItems: "center" }}
                          onClick={() => setCollapsedCrops((prev) => { const next = new Set(prev); next.has(cropKey) ? next.delete(cropKey) : next.add(cropKey); return next; })}
                        >
                          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        </div>

                        {renamingCrop === cropKey ? (
                          <input
                            value={renamingCropVal}
                            onChange={(e) => setRenamingCropVal(e.target.value)}
                            onBlur={() => commitCropRename(cropKey, renamingCropVal, cropProjects)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitCropRename(cropKey, renamingCropVal, cropProjects);
                              if (e.key === "Escape") setRenamingCrop(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ fontWeight: 600, fontSize: "1rem", padding: "0.15rem 0.375rem", borderRadius: 4, border: "1px solid var(--accent)", background: "var(--bg-card)", width: 200 }}
                            autoFocus
                          />
                        ) : (
                          <span
                            style={{ fontWeight: 600, fontSize: "1rem", cursor: "pointer" }}
                            onClick={() => setCollapsedCrops((prev) => { const next = new Set(prev); next.has(cropKey) ? next.delete(cropKey) : next.add(cropKey); return next; })}
                          >
                            {cropKey}
                          </span>
                        )}

                        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                          {cropProjects.length} project{cropProjects.length !== 1 ? "s" : ""}
                        </span>

                        <button
                          onClick={(e) => { e.stopPropagation(); setRenamingCrop(cropKey); setRenamingCropVal(cropKey === "Unknown / Bareground" ? "" : cropKey); }}
                          title="Rename crop"
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, display: "flex", alignItems: "center" }}
                        >
                          <Pencil size={13} />
                        </button>
                      </div>

                      <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                        {cropTimings.map(timingBadge)}
                      </div>
                    </div>

                    {/* Projects within crop group */}
                    {!collapsed && cropProjects.map((project, idx) => (
                      <div
                        key={project.id}
                        style={{ borderBottom: idx < cropProjects.length - 1 ? "1px solid var(--border)" : "none", overflow: "hidden" }}
                      >
                        {/* Project header row */}
                        <div
                          style={{ padding: "0.875rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                          onClick={() => toggleExpand(project.id)}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            {expandedId === project.id ? <ChevronUp size={16} style={{ opacity: 0.6 }} /> : <ChevronDown size={16} style={{ opacity: 0.6 }} />}
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
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {expandedId === project.id && detail && (
                          <div style={{ borderTop: "1px solid var(--border)" }}>
                            {/* Crop + timings summary */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexWrap: "wrap", gap: "0.5rem" }}>
                              <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>CROP</span>
                                  <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                                    {detail.crop ?? <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontWeight: 400 }}>Not set</span>}
                                  </span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>APPLICATION TIMING</span>
                                  {detail.application_timings
                                    ? (JSON.parse(detail.application_timings) as string[]).map(timingBadge)
                                    : <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontStyle: "italic" }}>Not set</span>}
                                </div>
                              </div>
                              <button
                                onClick={openSprayEdit}
                                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8125rem", padding: "0.3rem 0.625rem", borderRadius: 6, border: "1px solid var(--border)", background: "none", cursor: "pointer", color: "var(--text-secondary)" }}
                              >
                                <Pencil size={13} /> Edit
                              </button>
                            </div>
                            {/* Products — collapsible */}
                            <div style={{ borderTop: "1px solid var(--border)" }}>
                              <button
                                onClick={() => setProductsExpanded((v) => !v)}
                                style={{
                                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                                  padding: "0.625rem 1.25rem", background: "none", border: "none", cursor: "pointer",
                                  borderBottom: productsExpanded ? "1px solid var(--border)" : "none",
                                }}
                              >
                                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
                                  PRODUCTS ({detail.requirements?.length ?? 0})
                                </span>
                                {productsExpanded ? <ChevronUp size={14} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
                              </button>
                              {productsExpanded && (
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
                                            <button onClick={() => openReview(req)} className="badge badge-warning" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", font: "inherit", padding: "0.2rem 0.5rem" }} title={req.flag_reason ?? "Review this product match"}>
                                              <AlertTriangle size={12} /> Review
                                            </button>
                                          ) : (
                                            <button onClick={() => openEdit(req)} className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", font: "inherit", padding: "0.2rem 0.5rem" }} title="Edit canonical name">
                                              <Pencil size={11} /> OK
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>

                            {/* Linked Calendar Events */}
                            <div style={{ borderTop: "1px solid var(--border)", padding: "0.875rem 1.25rem" }}>
                              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                                LINKED CALENDAR EVENTS
                              </div>
                              {detail.events?.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                  {detail.events.map((ev) => (
                                    <div
                                      key={ev.id}
                                      style={{
                                        display: "flex", alignItems: "center", gap: "0.75rem",
                                        padding: "0.5rem 0.75rem", borderRadius: 6,
                                        background: "var(--bg-secondary)",
                                        borderLeft: `3px solid ${ev.color ?? "var(--accent)"}`,
                                      }}
                                    >
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>{ev.title}</div>
                                        {ev.notes && (
                                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {ev.notes}
                                          </div>
                                        )}
                                      </div>
                                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono', monospace" }}>
                                        {new Date(ev.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                                  No calendar events linked.{" "}
                                  <Link href="/calendar" style={{ color: "var(--accent)", textDecoration: "none" }}>Add one in Calendar.</Link>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              });
          })()}
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

      {/* Edit crop/timings modal */}
      {editingSpray && detail && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeSprayEdit(); }}
        >
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "1.5rem", width: 500, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
              <div>
                <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}>Edit Crop &amp; Timings</h2>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>{detail.name}</p>
              </div>
              <button onClick={closeSprayEdit} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}>
                <X size={18} />
              </button>
            </div>

            {/* Crop */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.375rem" }}>Crop</label>
              <input
                type="text"
                value={sprayEditCrop}
                onChange={(e) => setSprayEditCrop(e.target.value)}
                placeholder="e.g. Soybean, Corn, Wheat"
                onKeyDown={(e) => { if (e.key === "Escape") closeSprayEdit(); }}
                style={{ width: "100%", padding: "0.5rem 0.625rem", fontSize: "0.875rem", borderRadius: 6, border: "1px solid var(--border)", boxSizing: "border-box" }}
                autoFocus
              />
            </div>

            {/* Timings */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.5rem" }}>Application Timings</label>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "0.625rem" }}>
                {sprayEditTimings.length === 0 && (
                  <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontStyle: "italic" }}>No timings set.</p>
                )}
                {sprayEditTimings.map((t) => (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {sprayEditTimingRename === t ? (
                      <input
                        type="text"
                        value={sprayEditTimingRenameVal}
                        onChange={(e) => setSprayEditTimingRenameVal(e.target.value.toUpperCase())}
                        onBlur={() => {
                          const trimmed = sprayEditTimingRenameVal.trim();
                          if (trimmed && trimmed !== t && !sprayEditTimings.includes(trimmed)) {
                            setSprayEditTimings(sprayEditTimings.map((x) => x === t ? trimmed : x).sort());
                          }
                          setSprayEditTimingRename(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setSprayEditTimingRename(null);
                        }}
                        style={{ padding: "0.2rem 0.5rem", fontSize: "0.8125rem", borderRadius: 4, border: "1px solid var(--accent)", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, width: 120 }}
                        autoFocus
                      />
                    ) : (
                      <span style={{
                        padding: "0.2rem 0.5rem", borderRadius: 4, fontSize: "0.75rem",
                        fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", minWidth: 60, textAlign: "center",
                        ...(t.startsWith("PRE") || t === "PREPLANT"
                          ? { background: "rgba(34,197,94,0.15)", color: "#16a34a" }
                          : t.startsWith("POST") || ["EPOST","MPOST","LPOST","BPOST"].includes(t)
                          ? { background: "rgba(59,130,246,0.15)", color: "#2563eb" }
                          : t === "BURNDOWN" || t === "FOLIAR"
                          ? { background: "rgba(249,115,22,0.15)", color: "#ea580c" }
                          : { background: "rgba(107,114,128,0.15)", color: "#6b7280" }),
                      }}>
                        {t}
                      </span>
                    )}
                    <button
                      onClick={() => { setSprayEditTimingRename(t); setSprayEditTimingRenameVal(t); }}
                      title="Rename"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setSprayEditTimings(sprayEditTimings.filter((x) => x !== t))}
                      title="Remove"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2 }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add new timing */}
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  value={sprayEditNewTiming}
                  onChange={(e) => setSprayEditNewTiming(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = sprayEditNewTiming.trim();
                      if (val && !sprayEditTimings.includes(val)) {
                        setSprayEditTimings([...sprayEditTimings, val].sort());
                      }
                      setSprayEditNewTiming("");
                    }
                  }}
                  placeholder="Add timing code (e.g. PRE, POST)"
                  style={{ flex: 1, padding: "0.4rem 0.625rem", fontSize: "0.8125rem", borderRadius: 6, border: "1px solid var(--border)", fontFamily: "'JetBrains Mono', monospace" }}
                />
                <button
                  onClick={() => {
                    const val = sprayEditNewTiming.trim();
                    if (val && !sprayEditTimings.includes(val)) {
                      setSprayEditTimings([...sprayEditTimings, val].sort());
                    }
                    setSprayEditNewTiming("");
                  }}
                  disabled={!sprayEditNewTiming.trim()}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "0.4rem 0.75rem", borderRadius: 6, fontSize: "0.8125rem", background: "var(--accent)", color: "#fff", border: "none", cursor: sprayEditNewTiming.trim() ? "pointer" : "not-allowed", opacity: sprayEditNewTiming.trim() ? 1 : 0.5 }}
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.625rem" }}>
              <button
                onClick={() => { closeSprayEdit(); deleteProject(detail.id); }}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.875rem", borderRadius: 6, fontSize: "0.875rem", background: "none", border: "1px solid var(--danger, #ef4444)", color: "var(--danger, #ef4444)", cursor: "pointer" }}
                title="Delete this project"
              >
                <Trash2 size={14} /> Delete Project
              </button>
              <div style={{ display: "flex", gap: "0.625rem" }}>
                <button onClick={closeSprayEdit} style={{ padding: "0.5rem 1rem", borderRadius: 6, fontSize: "0.875rem", background: "none", border: "1px solid var(--border)", cursor: "pointer" }}>
                  Cancel
                </button>
                <button
                  onClick={saveSprayEdit}
                  disabled={spraySubmitting}
                  style={{ padding: "0.5rem 1rem", borderRadius: 6, fontSize: "0.875rem", fontWeight: 500, background: "var(--accent)", color: "#fff", border: "none", cursor: spraySubmitting ? "wait" : "pointer", opacity: spraySubmitting ? 0.7 : 1 }}
                >
                  {spraySubmitting ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

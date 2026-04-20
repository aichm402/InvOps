"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, Trash2, AlertTriangle, ChevronDown, ChevronUp, X, Pencil, Plus } from "lucide-react";
import { formatQuantity, type DisplayUnit } from "@/lib/units";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  events: CalendarEvent[];
}

interface ProductOption {
  id: string;
  canonical_name: string;
}

// ── Shared style constants ────────────────────────────────────────────────────

const MODAL_OVERLAY: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 50,
  background: "rgba(0,0,0,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const MODAL_BOX: React.CSSProperties = {
  background: "var(--bg-card)", border: "1px solid var(--border)",
  borderRadius: 10, padding: "1.5rem", width: 480, maxWidth: "90vw",
};

const CLOSE_BTN: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  color: "var(--text-muted)", padding: 2,
};

const CANCEL_BTN: React.CSSProperties = {
  padding: "0.5rem 1rem", borderRadius: 6, fontSize: "0.875rem",
  background: "none", border: "1px solid var(--border)", cursor: "pointer",
};

// ── Timing badge ──────────────────────────────────────────────────────────────

function getTimingStyle(t: string): React.CSSProperties {
  const u = t.toUpperCase();
  if (u.startsWith("PRE") || u === "PREPLANT")
    return { background: "rgba(34,197,94,0.15)", color: "var(--success)" };
  if (u.startsWith("POST") || ["EPOST", "MPOST", "LPOST", "BPOST"].includes(u))
    return { background: "rgba(59,130,246,0.15)", color: "#2563eb" };
  if (u === "BURNDOWN" || u === "FOLIAR")
    return { background: "rgba(249,115,22,0.15)", color: "#ea580c" };
  return { background: "rgba(107,114,128,0.15)", color: "#6b7280" };
}

function TimingBadge({ t }: { t: string }) {
  return (
    <span style={{
      ...getTimingStyle(t),
      padding: "0.2rem 0.5rem", borderRadius: 4,
      fontSize: "0.75rem", fontWeight: 600,
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {t}
    </span>
  );
}

// ── ProductMatchModal (shared by Edit Product and Review Product Match) ────────

interface ProductMatchModalProps {
  title: string;
  parsedName: string;
  flagReason?: string | null;
  nameValue: string;
  onNameChange: (v: string) => void;
  mergeId: string;
  onMergeChange: (id: string) => void;
  products: ProductOption[];
  excludeId: string;
  submitting: boolean;
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
}

function ProductMatchModal({
  title, parsedName, flagReason,
  nameValue, onNameChange,
  mergeId, onMergeChange,
  products, excludeId,
  submitting, submitLabel,
  onClose, onSubmit,
}: ProductMatchModalProps) {
  const canSubmit = !submitting && (!!mergeId || !!nameValue.trim());

  return (
    <div
      style={{ ...MODAL_OVERLAY, padding: "1rem" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={MODAL_BOX}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={CLOSE_BTN}><X size={18} /></button>
        </div>

        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.75rem 1rem", marginBottom: "1.25rem", fontSize: "0.875rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: flagReason ? "0.375rem" : 0 }}>
            <span style={{ color: "var(--text-muted)", minWidth: 90 }}>Parsed as:</span>
            <span style={{ fontWeight: 500, fontFamily: "'JetBrains Mono', monospace" }}>{parsedName}</span>
          </div>
          {flagReason && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <span style={{ color: "var(--text-muted)", minWidth: 90 }}>Reason:</span>
              <span style={{ color: "var(--warning)" }}>{flagReason}</span>
            </div>
          )}
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.375rem" }}>
            Confirm canonical name
          </label>
          <input
            type="text"
            value={mergeId ? "" : nameValue}
            onChange={(e) => { onMergeChange(""); onNameChange(e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); if (e.key === "Escape") onClose(); }}
            placeholder="Canonical product name"
            disabled={!!mergeId}
            style={{ width: "100%", padding: "0.5rem 0.625rem", fontSize: "0.875rem", borderRadius: 6, border: "1px solid var(--border)", opacity: mergeId ? 0.5 : 1, boxSizing: "border-box" }}
            autoFocus
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ flex: 1, borderTop: "1px solid var(--border)" }} />
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>or</span>
          <div style={{ flex: 1, borderTop: "1px solid var(--border)" }} />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.375rem" }}>
            Merge into existing product
          </label>
          <select
            value={mergeId}
            onChange={(e) => onMergeChange(e.target.value)}
            style={{ width: "100%", padding: "0.5rem 0.625rem", fontSize: "0.875rem", borderRadius: 6, border: "1px solid var(--border)", boxSizing: "border-box" }}
          >
            <option value="">— select a product —</option>
            {products.filter((p) => p.id !== excludeId).map((p) => (
              <option key={p.id} value={p.id}>{p.canonical_name}</option>
            ))}
          </select>
          {mergeId && (
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.375rem" }}>
              &ldquo;{parsedName}&rdquo; will be added as an alias of the selected product.
            </p>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.625rem" }}>
          <button onClick={onClose} style={CANCEL_BTN}>Cancel</button>
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            style={{ padding: "0.5rem 1rem", borderRadius: 6, fontSize: "0.875rem", fontWeight: 500, background: "var(--accent)", color: "#fff", border: "none", cursor: submitting ? "wait" : "pointer", opacity: canSubmit ? 1 : 0.6 }}
          >
            {submitting ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EditCropTimingsModal ──────────────────────────────────────────────────────

interface EditCropTimingsModalProps {
  detail: ProjectDetail;
  crop: string;
  timings: string[];
  newTiming: string;
  renamingTiming: string | null;
  renamingTimingVal: string;
  submitting: boolean;
  onCropChange: (v: string) => void;
  onTimingsChange: (t: string[]) => void;
  onNewTimingChange: (v: string) => void;
  onRenamingTimingChange: (t: string | null) => void;
  onRenamingTimingValChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}

function EditCropTimingsModal({
  detail, crop, timings, newTiming,
  renamingTiming, renamingTimingVal, submitting,
  onCropChange, onTimingsChange, onNewTimingChange,
  onRenamingTimingChange, onRenamingTimingValChange,
  onClose, onSave, onDelete,
}: EditCropTimingsModalProps) {
  const addTiming = () => {
    const val = newTiming.trim();
    if (val && !timings.includes(val)) onTimingsChange([...timings, val].sort());
    onNewTimingChange("");
  };

  const commitRename = () => {
    const trimmed = renamingTimingVal.trim();
    if (trimmed && trimmed !== renamingTiming && !timings.includes(trimmed)) {
      onTimingsChange(timings.map((x) => x === renamingTiming ? trimmed : x).sort());
    }
    onRenamingTimingChange(null);
  };

  return (
    <div style={MODAL_OVERLAY} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...MODAL_BOX, width: 500, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 4 }}>Edit Crop &amp; Timings</h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>{detail.name}</p>
          </div>
          <button onClick={onClose} style={CLOSE_BTN}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.375rem" }}>Crop</label>
          <input
            type="text"
            value={crop}
            onChange={(e) => onCropChange(e.target.value)}
            placeholder="e.g. Soybean, Corn, Wheat"
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            style={{ width: "100%", padding: "0.5rem 0.625rem", fontSize: "0.875rem", borderRadius: 6, border: "1px solid var(--border)", boxSizing: "border-box" }}
            autoFocus
          />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, marginBottom: "0.5rem" }}>Application Timings</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "0.625rem" }}>
            {timings.length === 0 && (
              <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontStyle: "italic" }}>No timings set.</p>
            )}
            {timings.map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {renamingTiming === t ? (
                  <input
                    type="text"
                    value={renamingTimingVal}
                    onChange={(e) => onRenamingTimingValChange(e.target.value.toUpperCase())}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") onRenamingTimingChange(null);
                    }}
                    style={{ padding: "0.2rem 0.5rem", fontSize: "0.8125rem", borderRadius: 4, border: "1px solid var(--accent)", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, width: 120 }}
                    autoFocus
                  />
                ) : (
                  <span style={{ ...getTimingStyle(t), padding: "0.2rem 0.5rem", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", minWidth: 60, textAlign: "center" }}>
                    {t}
                  </span>
                )}
                <button onClick={() => { onRenamingTimingChange(t); onRenamingTimingValChange(t); }} title="Rename" style={CLOSE_BTN}>
                  <Pencil size={13} />
                </button>
                <button onClick={() => onTimingsChange(timings.filter((x) => x !== t))} title="Remove" style={CLOSE_BTN}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={newTiming}
              onChange={(e) => onNewTimingChange(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTiming(); } }}
              placeholder="Add timing code (e.g. PRE, POST)"
              style={{ flex: 1, padding: "0.4rem 0.625rem", fontSize: "0.8125rem", borderRadius: 6, border: "1px solid var(--border)", fontFamily: "'JetBrains Mono', monospace" }}
            />
            <button
              onClick={addTiming}
              disabled={!newTiming.trim()}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "0.4rem 0.75rem", borderRadius: 6, fontSize: "0.8125rem", background: "var(--accent)", color: "#fff", border: "none", cursor: newTiming.trim() ? "pointer" : "not-allowed", opacity: newTiming.trim() ? 1 : 0.5 }}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.625rem" }}>
          <button
            onClick={() => { onClose(); onDelete(detail.id); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "0.5rem 0.875rem", borderRadius: 6, fontSize: "0.875rem", background: "none", border: "1px solid var(--danger)", color: "var(--danger)", cursor: "pointer" }}
          >
            <Trash2 size={14} /> Delete Project
          </button>
          <div style={{ display: "flex", gap: "0.625rem" }}>
            <button onClick={onClose} style={CANCEL_BTN}>Cancel</button>
            <button
              onClick={onSave}
              disabled={submitting}
              style={{ padding: "0.5rem 1rem", borderRadius: 6, fontSize: "0.875rem", fontWeight: 500, background: "var(--accent)", color: "#fff", border: "none", cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ProjectDetailModal ────────────────────────────────────────────────────────

interface ProjectDetailModalProps {
  detail: ProjectDetail;
  unit: DisplayUnit;
  productsExpanded: boolean;
  onToggleProducts: () => void;
  onOpenReview: (req: ProjectRequirement) => void;
  onOpenEdit: (req: ProjectRequirement) => void;
  onOpenSprayEdit: () => void;
  onClose: () => void;
}

function ProjectDetailModal({
  detail, unit,
  productsExpanded, onToggleProducts,
  onOpenReview, onOpenEdit, onOpenSprayEdit,
  onClose,
}: ProjectDetailModalProps) {
  const timings: string[] = detail.application_timings ? JSON.parse(detail.application_timings) : [];

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, width: "min(860px, 95vw)", maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "sticky", top: 0, background: "var(--bg-card)", zIndex: 1 }}>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: 4 }}>{detail.name}</h2>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {detail.source_filename} · {new Date(detail.upload_date).toLocaleDateString()}
            </div>
          </div>
          <button onClick={onClose} style={{ ...CLOSE_BTN, marginLeft: "1rem", flexShrink: 0 }}><X size={18} /></button>
        </div>

        {/* Crop + timings */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1.5rem", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>CROP</span>
              <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                {detail.crop ?? <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontWeight: 400 }}>Not set</span>}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>APPLICATION TIMING</span>
              {timings.length > 0
                ? timings.map((t) => <TimingBadge key={t} t={t} />)
                : <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontStyle: "italic" }}>Not set</span>}
            </div>
          </div>
          <button
            onClick={onOpenSprayEdit}
            style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8125rem", padding: "0.3rem 0.625rem", borderRadius: 6, border: "1px solid var(--border)", background: "none", cursor: "pointer", color: "var(--text-secondary)" }}
          >
            <Pencil size={13} /> Edit
          </button>
        </div>

        {/* Products — collapsible */}
        <div style={{ borderBottom: "1px solid var(--border)" }}>
          <button
            onClick={onToggleProducts}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1.5rem", background: "none", border: "none", cursor: "pointer", borderBottom: productsExpanded ? "1px solid var(--border)" : "none" }}
          >
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>
              PRODUCTS ({detail.requirements?.length ?? 0})
            </span>
            {productsExpanded
              ? <ChevronUp size={14} style={{ color: "var(--text-muted)" }} />
              : <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
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
                        <button onClick={() => onOpenReview(req)} className="badge badge-warning" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", font: "inherit", padding: "0.2rem 0.5rem" }} title={req.flag_reason ?? "Review this product match"}>
                          <AlertTriangle size={12} /> Review
                        </button>
                      ) : (
                        <button onClick={() => onOpenEdit(req)} className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", font: "inherit", padding: "0.2rem 0.5rem" }} title="Edit canonical name">
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
        <div style={{ padding: "0.875rem 1.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
            LINKED CALENDAR EVENTS
          </div>
          {detail.events?.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {detail.events.map((ev) => (
                <div
                  key={ev.id}
                  style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0.75rem", borderRadius: 6, background: "var(--bg-secondary)", borderLeft: `3px solid ${ev.color ?? "var(--accent)"}` }}
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
    </div>
  );
}

// ── ProjectsPage ──────────────────────────────────────────────────────────────

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

  // Review modal
  const [reviewingReq, setReviewingReq] = useState<ProjectRequirement | null>(null);
  const [canonicalName, setCanonicalName] = useState("");
  const [mergeIntoId, setMergeIntoId] = useState("");

  // Edit product modal
  const [editingReq, setEditingReq] = useState<ProjectRequirement | null>(null);
  const [editName, setEditName] = useState("");
  const [editMergeIntoId, setEditMergeIntoId] = useState("");

  // Shared across both product modals
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [productsExpanded, setProductsExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Edit crop/timings modal
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
      .then((data) => { setProjects(data); setLoading(false); });
  }, []);

  const openProjectModal = async (id: string) => {
    setExpandedId(id);
    setProductsExpanded(false);
    const data = await fetch(`/api/projects/${id}`).then((r) => r.json());
    setDetail(data);
    setModalOpen(true);
  };

  const closeProjectModal = () => { setModalOpen(false); setExpandedId(null); setDetail(null); };

  const deleteProject = async (id: string) => {
    if (!confirm("Delete this project and all its parsed requirements?")) return;
    await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
    setProjects(projects.filter((p) => p.id !== id));
    if (expandedId === id) closeProjectModal();
  };

  const ensureProducts = async () => {
    if (allProducts.length === 0) {
      const data: ProductOption[] = await fetch("/api/products").then((r) => r.json());
      setAllProducts(data);
    }
  };

  const openReview = async (req: ProjectRequirement) => {
    setReviewingReq(req); setCanonicalName(req.canonical_name); setMergeIntoId("");
    await ensureProducts();
  };
  const closeReview = () => { setReviewingReq(null); setCanonicalName(""); setMergeIntoId(""); };

  const openEdit = async (req: ProjectRequirement) => {
    setEditingReq(req); setEditName(req.canonical_name); setEditMergeIntoId("");
    await ensureProducts();
  };
  const closeEdit = () => { setEditingReq(null); setEditName(""); setEditMergeIntoId(""); };

  const openSprayEdit = () => {
    if (!detail) return;
    setSprayEditCrop(detail.crop ?? "");
    setSprayEditTimings(detail.application_timings ? JSON.parse(detail.application_timings) : []);
    setSprayEditNewTiming("");
    setSprayEditTimingRename(null);
    setEditingSpray(true);
  };
  const closeSprayEdit = () => { setEditingSpray(false); setSprayEditTimingRename(null); };

  const saveSprayEdit = async () => {
    if (!detail) return;
    setSpraySubmitting(true);
    try {
      const res = await fetch(`/api/projects/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crop: sprayEditCrop.trim() || null, application_timings: sprayEditTimings }),
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
    if (detail && (detail.crop ?? "Unknown / Bareground") === oldCrop) setDetail({ ...detail, crop: trimmed });
    setRenamingCrop(null);
  };

  const submitEdit = async () => {
    if (!editingReq || (!editMergeIntoId && !editName.trim())) return;
    setSubmitting(true);
    try {
      if (editMergeIntoId) {
        const res = await fetch(`/api/requirements/${editingReq.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ merge_into_product_id: editMergeIntoId }),
        });
        if (!res.ok) return;
        const merged = allProducts.find((p) => p.id === editMergeIntoId);
        if (detail && merged) {
          setDetail({ ...detail, requirements: detail.requirements.map((r) => r.id === editingReq.id ? { ...r, canonical_name: merged.canonical_name, product_id: editMergeIntoId } : r) });
        }
      } else {
        const res = await fetch(`/api/products/${editingReq.product_id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canonical_name: editName.trim() }),
        });
        if (!res.ok) return;
        if (detail) {
          setDetail({ ...detail, requirements: detail.requirements.map((r) => r.product_id === editingReq.product_id ? { ...r, canonical_name: editName.trim() } : r) });
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
      const body = mergeIntoId ? { merge_into_product_id: mergeIntoId } : { canonical_name: canonicalName };
      const res = await fetch(`/api/requirements/${reviewingReq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      if (detail) {
        const merged = mergeIntoId ? allProducts.find((p) => p.id === mergeIntoId) : null;
        setDetail({
          ...detail,
          requirements: detail.requirements.map((r) =>
            r.id !== reviewingReq.id ? r : {
              ...r, flagged: 0, flag_reason: null,
              canonical_name: merged ? merged.canonical_name : canonicalName,
              product_id: mergeIntoId || r.product_id,
            }
          ),
        });
        setProjects((prev) => prev.map((p) => p.id === detail.id ? { ...p, flagged_count: Math.max(0, p.flagged_count - 1) } : p));
      }
      closeReview();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading-state"><div style={{ color: "var(--text-muted)" }}>Loading projects...</div></div>;
  }

  const allCrops = Array.from(new Set(projects.map((p) => p.crop ?? "Unknown / Bareground"))).sort();
  const allTimings = Array.from(new Set(projects.flatMap((p) => p.application_timings ? JSON.parse(p.application_timings) as string[] : []))).sort();

  const visibleProjects = projects.filter((p) => {
    if (cropFilter !== "all" && (p.crop ?? "Unknown / Bareground") !== cropFilter) return false;
    if (timingFilter !== "all") {
      const t: string[] = p.application_timings ? JSON.parse(p.application_timings) : [];
      if (!t.includes(timingFilter)) return false;
    }
    return true;
  });

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
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
          <select value={unit} onChange={(e) => setUnit(e.target.value as DisplayUnit)} style={{ padding: "0.375rem 0.625rem", fontSize: "0.8125rem" }}>
            <option value="mL">mL</option>
            <option value="L">L</option>
            <option value="gal">Gallons</option>
            <option value="fl oz">fl oz</option>
          </select>
          <Link href="/upload" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent)", color: "#fff", padding: "0.5rem 1rem", borderRadius: 6, fontSize: "0.875rem", fontWeight: 500, textDecoration: "none" }}>
            Upload PDF
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Crop:</label>
          <select value={cropFilter} onChange={(e) => setCropFilter(e.target.value)} style={{ padding: "0.375rem 0.625rem", fontSize: "0.8125rem", borderRadius: 6, border: "1px solid var(--border)" }}>
            <option value="all">All crops</option>
            {allCrops.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.8125rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>Application Timing:</label>
          <select value={timingFilter} onChange={(e) => setTimingFilter(e.target.value)} style={{ padding: "0.375rem 0.625rem", fontSize: "0.8125rem", borderRadius: 6, border: "1px solid var(--border)" }}>
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

      {/* Project list */}
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
                const toggleCollapse = () =>
                  setCollapsedCrops((prev) => { const next = new Set(prev); next.has(cropKey) ? next.delete(cropKey) : next.add(cropKey); return next; });

                return (
                  <div key={cropKey} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    {/* Crop group header */}
                    <div style={{ padding: "0.875rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-secondary)", borderBottom: collapsed ? "none" : "1px solid var(--border)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0 }}>
                        <div style={{ cursor: "pointer", display: "flex", alignItems: "center" }} onClick={toggleCollapse}>
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
                          <span style={{ fontWeight: 600, fontSize: "1rem", cursor: "pointer" }} onClick={toggleCollapse}>
                            {cropKey}
                          </span>
                        )}
                        <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                          {cropProjects.length} project{cropProjects.length !== 1 ? "s" : ""}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setRenamingCrop(cropKey); setRenamingCropVal(cropKey === "Unknown / Bareground" ? "" : cropKey); }}
                          title="Rename crop"
                          style={{ ...CLOSE_BTN, display: "flex", alignItems: "center" }}
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                        {cropTimings.map((t) => <TimingBadge key={t} t={t} />)}
                      </div>
                    </div>

                    {/* Projects within crop group */}
                    {!collapsed && cropProjects.map((project, idx) => (
                      <div key={project.id} style={{ borderBottom: idx < cropProjects.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <div
                          style={{ padding: "0.875rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                          onClick={() => openProjectModal(project.id)}
                        >
                          <div>
                            <div style={{ fontWeight: 500, fontSize: "0.9375rem" }}>{project.name}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                              {project.source_filename} · {new Date(project.upload_date).toLocaleDateString()}
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
                      </div>
                    ))}
                  </div>
                );
              });
          })()}
        </div>
      )}

      {/* Modals */}
      {modalOpen && detail && (
        <ProjectDetailModal
          detail={detail}
          unit={unit}
          productsExpanded={productsExpanded}
          onToggleProducts={() => setProductsExpanded((v) => !v)}
          onOpenReview={openReview}
          onOpenEdit={openEdit}
          onOpenSprayEdit={openSprayEdit}
          onClose={closeProjectModal}
        />
      )}

      {editingReq && (
        <ProductMatchModal
          title="Edit Product"
          parsedName={editingReq.product_name}
          nameValue={editName}
          onNameChange={setEditName}
          mergeId={editMergeIntoId}
          onMergeChange={setEditMergeIntoId}
          products={allProducts}
          excludeId={editingReq.product_id}
          submitting={submitting}
          submitLabel="Save"
          onClose={closeEdit}
          onSubmit={submitEdit}
        />
      )}

      {reviewingReq && (
        <ProductMatchModal
          title="Review Product Match"
          parsedName={reviewingReq.product_name}
          flagReason={reviewingReq.flag_reason}
          nameValue={canonicalName}
          onNameChange={setCanonicalName}
          mergeId={mergeIntoId}
          onMergeChange={setMergeIntoId}
          products={allProducts}
          excludeId={reviewingReq.product_id}
          submitting={submitting}
          submitLabel="Confirm"
          onClose={closeReview}
          onSubmit={submitReview}
        />
      )}

      {editingSpray && detail && (
        <EditCropTimingsModal
          detail={detail}
          crop={sprayEditCrop}
          timings={sprayEditTimings}
          newTiming={sprayEditNewTiming}
          renamingTiming={sprayEditTimingRename}
          renamingTimingVal={sprayEditTimingRenameVal}
          submitting={spraySubmitting}
          onCropChange={setSprayEditCrop}
          onTimingsChange={setSprayEditTimings}
          onNewTimingChange={setSprayEditNewTiming}
          onRenamingTimingChange={setSprayEditTimingRename}
          onRenamingTimingValChange={setSprayEditTimingRenameVal}
          onClose={closeSprayEdit}
          onSave={saveSprayEdit}
          onDelete={deleteProject}
        />
      )}
    </div>
  );
}

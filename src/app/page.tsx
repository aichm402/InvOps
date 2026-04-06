"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  FolderOpen,
  AlertTriangle,
  TrendingUp,
  Upload,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatQuantity, type DisplayUnit } from "@/lib/units";
import { LogoIcon } from "@/components/Logo";

interface Analytics {
  summary: {
    total_products: number;
    total_projects: number;
    flagged_items: number;
    total_required_ml: number;
    total_on_hand_ml: number;
  };
  statusBreakdown: { status: string; count: number }[];
  topProducts: { name: string; total_ml: number; on_hand_ml: number }[];
  byProject: { project_name: string; product_count: number; total_ml: number }[];
}

interface Project {
  id: string;
  name: string;
  source_filename: string;
  upload_date: string;
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

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [unit, setUnit] = useState<DisplayUnit>("mL");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/analytics").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]).then(([a, projs]) => {
      setAnalytics(a);
      setProjects(projs);
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
    setDetail(await res.json());
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ color: "var(--text-muted)" }}>Loading dashboard...</div>
      </div>
    );
  }

  const s = analytics?.summary;

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <LogoIcon size={52} />
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Inventory<span style={{ color: "var(--accent)" }}>Ops</span>
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: 2 }}>
              Herbicide inventory overview
            </p>
          </div>
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
              fontSize: "0.875rem", fontWeight: 500,
              textDecoration: "none", transition: "background 0.15s",
            }}
          >
            <Upload size={16} /> Upload PDF
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
        <Link href="/inventory" style={{ textDecoration: "none", display: "block" }}>
          <StatCard icon={<Package size={20} />} label="Products" value={s?.total_products ?? 0} color="var(--accent)" clickable />
        </Link>
        <Link href="/projects" style={{ textDecoration: "none", display: "block" }}>
          <StatCard icon={<FolderOpen size={20} />} label="Projects" value={s?.total_projects ?? 0} color="var(--success)" clickable />
        </Link>

        <Link href="/analytics" style={{ textDecoration: "none", display: "block" }}>
          <StatCard
            icon={<TrendingUp size={20} />}
            label="Total Required"
            value={`${formatQuantity(s?.total_required_ml ?? 0, unit)} ${unit}`}
            color="var(--accent)"
            clickable
          />
        </Link>
        <StatCard
          icon={<AlertTriangle size={20} />}
          label="Flagged Products"
          value={projects.reduce((n, p) => n + p.flagged_count, 0)}
          color={projects.some((p) => p.flagged_count > 0) ? "var(--warning, #f59e0b)" : "var(--success)"}
        />
      </div>

      {/* Two columns: projects + recent projects summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Projects panel */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600 }}>Projects</h2>
            <Link href="/projects" style={{ fontSize: "0.75rem", color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}>
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {projects.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No projects yet.{" "}
              <Link href="/upload" style={{ color: "var(--accent)" }}>Upload a spray plan</Link>
            </div>
          ) : (
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              {projects.slice(0, 8).map((proj) => (
                <div key={proj.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  {/* Project row */}
                  <div
                    style={{
                      padding: "0.75rem 1.25rem",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      cursor: "pointer",
                    }}
                    onClick={() => toggleExpand(proj.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0 }}>
                      {expandedId === proj.id ? <ChevronUp size={15} style={{ flexShrink: 0 }} /> : <ChevronDown size={15} style={{ flexShrink: 0 }} />}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.875rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {proj.name}
                        </div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 1 }}>
                          {new Date(proj.upload_date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                      <span className="badge badge-info">{proj.product_count} products</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
                        {formatQuantity(proj.total_required_ml, unit)} {unit}
                      </span>
                      {proj.flagged_count > 0 && (
                        <span className="badge badge-warning" style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <AlertTriangle size={11} /> {proj.flagged_count}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded product rows */}
                  {expandedId === proj.id && detail && (
                    <div style={{ borderTop: "1px solid var(--border)", background: "var(--bg-surface, var(--bg))" }}>
                      {detail.requirements?.map((req) => (
                        <div
                          key={req.id}
                          style={{
                            padding: "0.5rem 1.25rem 0.5rem 2.75rem",
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            borderBottom: "1px solid var(--border)",
                            fontSize: "0.8125rem",
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 500 }}>{req.canonical_name}</span>
                            {req.product_name !== req.canonical_name && (
                              <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: 6 }}>
                                ({req.product_name})
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              {formatQuantity(req.required_quantity_ml, unit)} {unit}
                            </span>
                            {req.flagged ? (
                              <Link
                                href="/projects"
                                style={{ textDecoration: "none" }}
                                title={req.flag_reason ?? "Review this product match"}
                              >
                                <span className="badge badge-warning" style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "0.6875rem" }}>
                                  <AlertTriangle size={10} /> Review
                                </span>
                              </Link>
                            ) : (
                              <span className="badge badge-success" style={{ fontSize: "0.6875rem" }}>OK</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Projects */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600 }}>Recent Projects</h2>
            <Link href="/projects" style={{ fontSize: "0.75rem", color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}>
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {!analytics?.byProject?.length ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No projects uploaded yet.{" "}
              <Link href="/upload" style={{ color: "var(--accent)" }}>Upload a spray plan</Link>
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {analytics.byProject.slice(0, 8).map((proj, i) => (
                <div
                  key={i}
                  style={{
                    padding: "0.75rem 1.25rem",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>{proj.project_name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                      {proj.product_count} products · {formatQuantity(proj.total_ml, unit)} {unit}
                    </div>
                  </div>
                  <span className="badge badge-info">{proj.product_count} items</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  clickable,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  clickable?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "1.25rem",
        cursor: clickable ? "pointer" : undefined,
        transition: clickable ? "border-color 0.15s" : undefined,
      }}
      onMouseEnter={clickable ? (e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)"; } : undefined}
      onMouseLeave={clickable ? (e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)"; } : undefined}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.75rem" }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 8,
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color,
          }}
        >
          {icon}
        </div>
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
        {value}
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

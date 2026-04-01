"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, Trash2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<DisplayUnit>("mL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);

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
                              <span className="badge badge-warning" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <AlertTriangle size={12} /> Review
                              </span>
                            ) : (
                              <span className="badge badge-success">OK</span>
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
    </div>
  );
}

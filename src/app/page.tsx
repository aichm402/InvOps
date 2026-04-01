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
} from "lucide-react";
import { formatQuantity, type DisplayUnit } from "@/lib/units";

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

interface InventoryItem {
  product_id: string;
  product_name: string;
  canonical_name: string;
  quantity_on_hand_ml: number;
  total_required_ml: number;
  status: string;
  deficit_ml: number;
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [alerts, setAlerts] = useState<InventoryItem[]>([]);
  const [unit, setUnit] = useState<DisplayUnit>("mL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/analytics").then((r) => r.json()),
      fetch("/api/inventory").then((r) => r.json()),
    ]).then(([a, inv]) => {
      setAnalytics(a);
      setAlerts(inv.filter((i: InventoryItem) => i.status !== "sufficient"));
      setLoading(false);
    });
  }, []);

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
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em" }}>Dashboard</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: 4 }}>
            Herbicide inventory overview
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
          label="Low/Out Stock"
          value={alerts.length}
          color={alerts.length > 0 ? "var(--danger)" : "var(--success)"}
        />
      </div>

      {/* Two columns: alerts + recent projects */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Alerts */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600 }}>Stock Alerts</h2>
            <Link href="/inventory" style={{ fontSize: "0.75rem", color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}>
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {alerts.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              All products sufficiently stocked
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {alerts.slice(0, 8).map((item) => (
                <div
                  key={item.product_id}
                  style={{
                    padding: "0.75rem 1.25rem",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>{item.canonical_name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                      Need: {formatQuantity(item.total_required_ml, unit)} {unit} · Have: {formatQuantity(item.quantity_on_hand_ml, unit)} {unit}
                    </div>
                  </div>
                  <span className={`badge ${item.status === "out" ? "badge-danger" : "badge-warning"}`}>
                    {item.status === "out" ? "Out" : "Low"}
                  </span>
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

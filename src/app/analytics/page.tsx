"use client";

import { useEffect, useState } from "react";
import { formatQuantity, type DisplayUnit } from "@/lib/units";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

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

const STATUS_COLORS: Record<string, string> = {
  sufficient: "#34d399",
  low: "#fbbf24",
  out: "#f87171",
};

const CHART_TICK_COLOR = "#9599b3";
const CHART_TOOLTIP_STYLE = {
  background: "#1a1d2b",
  border: "1px solid #2a2e42",
  borderRadius: 6,
  fontSize: "0.8125rem",
} as const;

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [unit, setUnit] = useState<DisplayUnit>("mL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading || !data) {
    return <div className="loading-state"><div style={{ color: "var(--text-muted)" }}>Loading analytics...</div></div>;
  }

  const barData = data.topProducts.map((p) => ({
    name: p.name.length > 16 ? p.name.substring(0, 14) + "..." : p.name,
    fullName: p.name,
    required: parseFloat(formatQuantity(p.total_ml, unit)),
    onHand: parseFloat(formatQuantity(p.on_hand_ml, unit)),
  }));

  const pieData = data.statusBreakdown.map((s) => ({
    name: s.status === "sufficient" ? "Sufficient" : s.status === "low" ? "Low Stock" : "Out of Stock",
    value: s.count,
    color: STATUS_COLORS[s.status] || "#5e6380",
  }));

  const projectData = data.byProject.map((p) => ({
    name: p.project_name.length > 20 ? p.project_name.substring(0, 18) + "..." : p.project_name,
    fullName: p.project_name,
    total: parseFloat(formatQuantity(p.total_ml, unit)),
    products: p.product_count,
  }));

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em" }}>Analytics</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: 4 }}>
            Inventory insights across all projects
          </p>
        </div>
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
      </div>

      {data.summary.total_products === 0 ? (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8,
          padding: "3rem", textAlign: "center", color: "var(--text-muted)",
        }}>
          No data available yet. Upload spray plans to see analytics.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
          {/* Top products bar chart */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem" }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "1rem" }}>
              Top Products — Required vs On Hand ({unit})
            </h2>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={barData} margin={{ top: 5, right: 20, bottom: 30, left: 10 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: CHART_TICK_COLOR, fontSize: 11 }}
                    angle={-35}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fill: CHART_TICK_COLOR, fontSize: 11 }} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={{ color: "#e8eaf0" }}
                    formatter={(value: unknown, name: unknown) => [
                      `${Number(value).toFixed(2)} ${unit}`,
                      name === "required" ? "Required" : "On Hand",
                    ]}
                    labelFormatter={(_label: unknown, payload: unknown) => {
                      const p = payload as Array<{ payload?: { fullName?: string } }>;
                      return p?.[0]?.payload?.fullName || String(_label);
                    }}
                  />
                  <Bar dataKey="required" fill="#4f8cff" radius={[3, 3, 0, 0]} name="required" />
                  <Bar dataKey="onHand" fill="#34d399" radius={[3, 3, 0, 0]} name="onHand" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 350, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                No product data
              </div>
            )}
          </div>

          {/* Inventory status pie */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem" }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "1rem" }}>
              Inventory Status
            </h2>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    formatter={(value: unknown) => (
                      <span style={{ color: CHART_TICK_COLOR, fontSize: "0.8125rem" }}>{String(value)}</span>
                    )}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 350, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                No status data
              </div>
            )}
          </div>

          {/* Requirements by project */}
          <div style={{ gridColumn: "1 / -1", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "1.25rem" }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "1rem" }}>
              Total Requirements by Project ({unit})
            </h2>
            {projectData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={projectData} margin={{ top: 5, right: 20, bottom: 30, left: 10 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: CHART_TICK_COLOR, fontSize: 11 }}
                    angle={-20}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis tick={{ fill: CHART_TICK_COLOR, fontSize: 11 }} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value: unknown, name: unknown) => [
                      name === "total" ? `${Number(value).toFixed(2)} ${unit}` : String(value),
                      name === "total" ? "Total Volume" : "Products",
                    ]}
                    labelFormatter={(_label: unknown, payload: unknown) => {
                      const p = payload as Array<{ payload?: { fullName?: string } }>;
                      return p?.[0]?.payload?.fullName || String(_label);
                    }}
                  />
                  <Bar dataKey="total" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                No project data
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

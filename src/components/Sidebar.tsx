"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  BarChart3,
  Upload,
  Beaker,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/upload", label: "Upload PDF", icon: Upload },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 240,
        minHeight: "100vh",
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "1.5rem 1.25rem",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "var(--accent-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Beaker size={18} color="var(--accent)" />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.9375rem", letterSpacing: "-0.01em" }}>
            InventoryOps
          </div>
          <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
            Herbicide Inventory
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "0.75rem", flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.625rem 0.75rem",
                borderRadius: 6,
                fontSize: "0.875rem",
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                background: isActive ? "var(--bg-hover)" : "transparent",
                textDecoration: "none",
                marginBottom: "0.125rem",
                transition: "all 0.15s",
              }}
            >
              <Icon size={18} style={{ opacity: isActive ? 1 : 0.6 }} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderTop: "1px solid var(--border)",
          fontSize: "0.6875rem",
          color: "var(--text-muted)",
        }}
      >
        ARM Spray Plan Parser
      </div>
    </aside>
  );
}

import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata = {
  title: "InventoryOps — Herbicide Inventory Management",
  description: "Parse ARM spray plan PDFs and manage herbicide inventory",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Sidebar />
        <main style={{ marginLeft: 240, minHeight: "100vh", padding: "2rem" }}>
          {children}
        </main>
      </body>
    </html>
  );
}

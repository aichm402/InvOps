import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata = {
  title: "FieldOps — Research Management",
  description: "Parse ARM spray plan PDFs and manage field research inventory",
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

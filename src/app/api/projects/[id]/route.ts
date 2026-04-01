import { NextRequest, NextResponse } from "next/server";
import { getDb, query } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await getDb();
  const { id } = await params;

  const project = query(`SELECT * FROM projects WHERE id = ?`, [id]);
  if (project.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const requirements = query(
    `SELECT ir.*, p.name as product_name, p.canonical_name
     FROM inventory_requirements ir
     JOIN products p ON p.id = ir.product_id
     WHERE ir.project_id = ?
     ORDER BY p.canonical_name ASC`,
    [id]
  );

  return NextResponse.json({ ...project[0], requirements });
}

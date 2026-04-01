import { NextRequest, NextResponse } from "next/server";
import { getDb, query, run } from "@/lib/db";

// GET /api/projects - List all projects with requirement summaries
export async function GET() {
  await getDb();
  const projects = query(`
    SELECT p.*,
      COUNT(ir.id) as product_count,
      COALESCE(SUM(ir.required_quantity_ml), 0) as total_required_ml,
      SUM(CASE WHEN ir.flagged = 1 THEN 1 ELSE 0 END) as flagged_count
    FROM projects p
    LEFT JOIN inventory_requirements ir ON ir.project_id = p.id
    GROUP BY p.id
    ORDER BY p.upload_date DESC
  `);
  return NextResponse.json(projects);
}

// DELETE /api/projects - Delete a project by id (passed as query param)
export async function DELETE(req: NextRequest) {
  await getDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  run(`DELETE FROM inventory_requirements WHERE project_id = ?`, [id]);
  run(`DELETE FROM projects WHERE id = ?`, [id]);
  return NextResponse.json({ success: true });
}

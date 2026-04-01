import { NextRequest, NextResponse } from "next/server";
import { getDb, query, run } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await getDb();
  const { id } = await params;
  const product = query(
    `SELECT p.*, 
      COALESCE(s.quantity_on_hand_ml, 0) as quantity_on_hand_ml
    FROM products p
    LEFT JOIN inventory_stock s ON s.product_id = p.id
    WHERE p.id = ?`,
    [id]
  );
  if (product.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const aliases = query(
    `SELECT * FROM product_aliases WHERE product_id = ?`,
    [id]
  );
  const requirements = query(
    `SELECT ir.*, pj.name as project_name 
     FROM inventory_requirements ir 
     JOIN projects pj ON pj.id = ir.project_id 
     WHERE ir.product_id = ?`,
    [id]
  );

  return NextResponse.json({ ...product[0], aliases, requirements });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await getDb();
  const { id } = await params;
  const body = await req.json();
  const { canonical_name } = body;

  if (canonical_name) {
    run(
      `UPDATE products SET canonical_name = ?, updated_at = datetime('now') WHERE id = ?`,
      [canonical_name.trim(), id]
    );
  }

  const product = query(`SELECT * FROM products WHERE id = ?`, [id]);
  return NextResponse.json(product[0]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await getDb();
  const { id } = await params;
  run(`DELETE FROM inventory_requirements WHERE product_id = ?`, [id]);
  run(`DELETE FROM inventory_stock WHERE product_id = ?`, [id]);
  run(`DELETE FROM product_aliases WHERE product_id = ?`, [id]);
  run(`DELETE FROM products WHERE id = ?`, [id]);
  return NextResponse.json({ success: true });
}

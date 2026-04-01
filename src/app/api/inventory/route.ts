import { NextRequest, NextResponse } from "next/server";
import { getDb, query, run } from "@/lib/db";
import { v4 as uuid } from "uuid";

// GET /api/inventory - Full inventory status
export async function GET() {
  await getDb();
  const inventory = query(`
    SELECT 
      p.id as product_id,
      p.name as product_name,
      p.canonical_name,
      COALESCE(s.quantity_on_hand_ml, 0) as quantity_on_hand_ml,
      COALESCE(agg.total_required_ml, 0) as total_required_ml,
      COALESCE(agg.project_count, 0) as project_count,
      (COALESCE(s.quantity_on_hand_ml, 0) - COALESCE(agg.total_required_ml, 0)) as deficit_ml,
      s.last_updated,
      CASE 
        WHEN COALESCE(s.quantity_on_hand_ml, 0) = 0 AND COALESCE(agg.total_required_ml, 0) > 0 THEN 'out'
        WHEN COALESCE(s.quantity_on_hand_ml, 0) < COALESCE(agg.total_required_ml, 0) THEN 'low'
        ELSE 'sufficient'
      END as status
    FROM products p
    LEFT JOIN inventory_stock s ON s.product_id = p.id
    LEFT JOIN (
      SELECT product_id,
        SUM(required_quantity_ml) as total_required_ml,
        COUNT(DISTINCT project_id) as project_count
      FROM inventory_requirements
      GROUP BY product_id
    ) agg ON agg.product_id = p.id
    ORDER BY 
      CASE 
        WHEN COALESCE(s.quantity_on_hand_ml, 0) = 0 AND COALESCE(agg.total_required_ml, 0) > 0 THEN 0
        WHEN COALESCE(s.quantity_on_hand_ml, 0) < COALESCE(agg.total_required_ml, 0) THEN 1
        ELSE 2
      END,
      p.canonical_name ASC
  `);
  return NextResponse.json(inventory);
}

// PUT /api/inventory - Update stock for a product
export async function PUT(req: NextRequest) {
  await getDb();
  const body = await req.json();
  const { product_id, quantity_on_hand_ml } = body;

  if (!product_id || quantity_on_hand_ml === undefined) {
    return NextResponse.json(
      { error: "product_id and quantity_on_hand_ml required" },
      { status: 400 }
    );
  }

  const existing = query(
    `SELECT id FROM inventory_stock WHERE product_id = ?`,
    [product_id]
  );

  if (existing.length > 0) {
    run(
      `UPDATE inventory_stock SET quantity_on_hand_ml = ?, last_updated = datetime('now') WHERE product_id = ?`,
      [quantity_on_hand_ml, product_id]
    );
  } else {
    run(
      `INSERT INTO inventory_stock (id, product_id, quantity_on_hand_ml) VALUES (?, ?, ?)`,
      [uuid(), product_id, quantity_on_hand_ml]
    );
  }

  return NextResponse.json({ success: true });
}

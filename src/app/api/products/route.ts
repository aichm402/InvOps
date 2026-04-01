import { NextRequest, NextResponse } from "next/server";
import { getDb, query, run } from "@/lib/db";
import { v4 as uuid } from "uuid";

// GET /api/products - List all products
export async function GET() {
  await getDb();
  const products = query(`
    SELECT p.*, 
      COALESCE(s.quantity_on_hand_ml, 0) as quantity_on_hand_ml,
      COALESCE(agg.total_required_ml, 0) as total_required_ml,
      COALESCE(agg.project_count, 0) as project_count
    FROM products p
    LEFT JOIN inventory_stock s ON s.product_id = p.id
    LEFT JOIN (
      SELECT product_id, 
        SUM(required_quantity_ml) as total_required_ml,
        COUNT(DISTINCT project_id) as project_count
      FROM inventory_requirements
      GROUP BY product_id
    ) agg ON agg.product_id = p.id
    ORDER BY p.canonical_name ASC
  `);
  return NextResponse.json(products);
}

// POST /api/products - Create a new product
export async function POST(req: NextRequest) {
  await getDb();
  const body = await req.json();
  const { name, canonical_name } = body;

  if (!name || !canonical_name) {
    return NextResponse.json(
      { error: "name and canonical_name are required" },
      { status: 400 }
    );
  }

  const id = uuid();
  try {
    run(
      `INSERT INTO products (id, name, canonical_name, unit) VALUES (?, ?, ?, 'mL')`,
      [id, name.trim(), canonical_name.trim()]
    );

    // Also add the original name as an alias if different from canonical
    if (name.trim().toLowerCase() !== canonical_name.trim().toLowerCase()) {
      run(
        `INSERT OR IGNORE INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?)`,
        [uuid(), id, name.trim()]
      );
    }

    const product = query(`SELECT * FROM products WHERE id = ?`, [id]);
    return NextResponse.json(product[0], { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg.includes("UNIQUE")) {
      return NextResponse.json(
        { error: "A product with that name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

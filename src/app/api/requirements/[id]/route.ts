import { NextRequest, NextResponse } from "next/server";
import { getDb, query, run } from "@/lib/db";
import { v4 as uuid } from "uuid";

// PATCH /api/requirements/:id
// Body: { canonical_name?: string, merge_into_product_id?: string }
// - merge_into_product_id: reassign this requirement to an existing product,
//   add the old product name as an alias, delete the old product if unused
// - canonical_name: rename the product's canonical name
// In both cases the requirement's flag is cleared.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await getDb();
  const { id } = await params;
  const body = await req.json();
  const { canonical_name, merge_into_product_id } = body;

  const rows = query<{ product_id: string; flagged: number }>(
    `SELECT product_id, flagged FROM inventory_requirements WHERE id = ?`,
    [id]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Requirement not found" }, { status: 404 });
  }
  const { product_id } = rows[0];

  if (merge_into_product_id && merge_into_product_id !== product_id) {
    // Get the old product name to register as an alias
    const oldProduct = query<{ name: string }>(
      `SELECT name FROM products WHERE id = ?`,
      [product_id]
    );
    if (oldProduct.length > 0) {
      // Add old product name as an alias on the target product (ignore if already exists)
      run(
        `INSERT OR IGNORE INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?)`,
        [uuid(), merge_into_product_id, oldProduct[0].name]
      );
    }

    // Reassign this requirement to the target product
    run(
      `UPDATE inventory_requirements SET product_id = ?, flagged = 0, flag_reason = NULL WHERE id = ?`,
      [merge_into_product_id, id]
    );

    // Delete the old product if it has no remaining requirements
    const remaining = query(
      `SELECT COUNT(*) as cnt FROM inventory_requirements WHERE product_id = ?`,
      [product_id]
    );
    if ((remaining[0] as { cnt: number }).cnt === 0) {
      run(`DELETE FROM inventory_stock WHERE product_id = ?`, [product_id]);
      run(`DELETE FROM product_aliases WHERE product_id = ?`, [product_id]);
      run(`DELETE FROM products WHERE id = ?`, [product_id]);
    }
  } else {
    // Just rename canonical name and/or clear the flag
    if (canonical_name) {
      run(
        `UPDATE products SET canonical_name = ?, updated_at = datetime('now') WHERE id = ?`,
        [canonical_name.trim(), product_id]
      );
    }
    run(
      `UPDATE inventory_requirements SET flagged = 0, flag_reason = NULL WHERE id = ?`,
      [id]
    );
  }

  return NextResponse.json({ success: true });
}

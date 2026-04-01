import { NextResponse } from "next/server";
import { getDb, query } from "@/lib/db";

export async function GET() {
  await getDb();

  // Summary stats
  const totals = query(`
    SELECT
      (SELECT COUNT(*) FROM products) as total_products,
      (SELECT COUNT(*) FROM projects) as total_projects,
      (SELECT COUNT(*) FROM inventory_requirements WHERE flagged = 1) as flagged_items,
      (SELECT COALESCE(SUM(required_quantity_ml), 0) FROM inventory_requirements) as total_required_ml,
      (SELECT COALESCE(SUM(quantity_on_hand_ml), 0) FROM inventory_stock) as total_on_hand_ml
  `);

  // Status breakdown
  const statusBreakdown = query(`
    SELECT 
      CASE 
        WHEN COALESCE(s.quantity_on_hand_ml, 0) = 0 AND COALESCE(agg.total_required_ml, 0) > 0 THEN 'out'
        WHEN COALESCE(s.quantity_on_hand_ml, 0) < COALESCE(agg.total_required_ml, 0) THEN 'low'
        ELSE 'sufficient'
      END as status,
      COUNT(*) as count
    FROM products p
    LEFT JOIN inventory_stock s ON s.product_id = p.id
    LEFT JOIN (
      SELECT product_id, SUM(required_quantity_ml) as total_required_ml
      FROM inventory_requirements
      GROUP BY product_id
    ) agg ON agg.product_id = p.id
    WHERE agg.total_required_ml > 0
    GROUP BY status
  `);

  // Top products by requirement volume
  const topProducts = query(`
    SELECT 
      p.canonical_name as name,
      SUM(ir.required_quantity_ml) as total_ml,
      COALESCE(s.quantity_on_hand_ml, 0) as on_hand_ml
    FROM inventory_requirements ir
    JOIN products p ON p.id = ir.product_id
    LEFT JOIN inventory_stock s ON s.product_id = p.id
    GROUP BY ir.product_id
    ORDER BY total_ml DESC
    LIMIT 10
  `);

  // Requirements by project
  const byProject = query(`
    SELECT 
      pj.name as project_name,
      COUNT(DISTINCT ir.product_id) as product_count,
      SUM(ir.required_quantity_ml) as total_ml
    FROM projects pj
    LEFT JOIN inventory_requirements ir ON ir.project_id = pj.id
    GROUP BY pj.id
    ORDER BY pj.upload_date DESC
  `);

  return NextResponse.json({
    summary: totals[0] || {},
    statusBreakdown,
    topProducts,
    byProject,
  });
}

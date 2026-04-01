import { NextRequest, NextResponse } from "next/server";
import { getDb, query, run } from "@/lib/db";
import { parseSprayPlanPdf } from "@/lib/pdf-parser";
import { findBestMatch, normalizeProductName } from "@/lib/fuzzy-match";
import { v4 as uuid } from "uuid";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export async function POST(req: NextRequest) {
  await getDb();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save file to disk
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const savedFilename = `${Date.now()}_${file.name}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, savedFilename), buffer);

    // Parse PDF
    const parseResult = await parseSprayPlanPdf(buffer);

    // Create project record
    const projectId = uuid();
    run(
      `INSERT INTO projects (id, name, source_filename, status) VALUES (?, ?, ?, ?)`,
      [
        projectId,
        parseResult.projectName,
        savedFilename,
        parseResult.products.length > 0 ? "parsed" : "needs_review",
      ]
    );

    // Get existing products for matching
    const existingProducts = query<{
      id: string;
      name: string;
      canonical_name: string;
    }>(`SELECT id, name, canonical_name FROM products`);

    const aliases = query<{ alias: string; product_id: string }>(
      `SELECT alias, product_id FROM product_aliases`
    );

    const results = [];

    for (const parsedProduct of parseResult.products) {
      const normalized = normalizeProductName(parsedProduct.name);
      const match = findBestMatch(normalized, existingProducts, aliases);

      let productId: string;
      let isNew = false;

      if (match.matched && match.product && match.score < 0.3) {
        // Good match - use existing product
        productId = match.product.id;

        // Add as alias if the name is different
        if (
          normalized.toLowerCase() !== match.product.name.toLowerCase() &&
          normalized.toLowerCase() !== match.product.canonical_name.toLowerCase()
        ) {
          const existingAlias = query(
            `SELECT id FROM product_aliases WHERE alias = ?`,
            [normalized]
          );
          if (existingAlias.length === 0) {
            run(
              `INSERT OR IGNORE INTO product_aliases (id, product_id, alias) VALUES (?, ?, ?)`,
              [uuid(), productId, normalized]
            );
          }
        }
      } else {
        // New product or low-confidence match
        productId = uuid();
        isNew = true;

        try {
          run(
            `INSERT INTO products (id, name, canonical_name, unit) VALUES (?, ?, ?, 'mL')`,
            [productId, normalized, normalized]
          );
          // Update local cache
          existingProducts.push({
            id: productId,
            name: normalized,
            canonical_name: normalized,
          });
        } catch {
          // If name collision, find the existing one
          const existing = query<{ id: string }>(
            `SELECT id FROM products WHERE name = ?`,
            [normalized]
          );
          if (existing.length > 0) {
            productId = existing[0].id;
            isNew = false;
          }
        }
      }

      // Create inventory requirement
      const reqId = uuid();
      const flagged =
        parsedProduct.confidence === "low" ||
        (match.matched && match.score > 0.2);

      run(
        `INSERT INTO inventory_requirements 
         (id, product_id, project_id, required_quantity_ml, original_quantity, original_unit, flagged, flag_reason) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reqId,
          productId,
          projectId,
          parsedProduct.amountMl,
          parsedProduct.amount,
          parsedProduct.unit,
          flagged ? 1 : 0,
          flagged
            ? `Fuzzy match score: ${match.score.toFixed(2)}. Review recommended.`
            : null,
        ]
      );

      // Initialize stock record if new product
      const stockExists = query(
        `SELECT id FROM inventory_stock WHERE product_id = ?`,
        [productId]
      );
      if (stockExists.length === 0) {
        run(
          `INSERT INTO inventory_stock (id, product_id, quantity_on_hand_ml) VALUES (?, ?, 0)`,
          [uuid(), productId]
        );
      }

      results.push({
        name: parsedProduct.name,
        normalized_name: normalized,
        amount: parsedProduct.amount,
        amount_ml: parsedProduct.amountMl,
        unit: parsedProduct.unit,
        matched_product_id: productId,
        matched_product_name: match.product?.canonical_name || normalized,
        match_score: match.score,
        is_new: isNew,
        flagged,
        confidence: parsedProduct.confidence,
      });
    }

    return NextResponse.json({
      project: {
        id: projectId,
        name: parseResult.projectName,
        source_filename: savedFilename,
      },
      products: results,
      warnings: parseResult.warnings,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Upload error:", e);
    return NextResponse.json(
      { error: `Failed to process PDF: ${msg}` },
      { status: 500 }
    );
  }
}

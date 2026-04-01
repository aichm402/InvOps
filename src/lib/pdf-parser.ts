import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { detectUnit, toMl } from "./units";

export interface ParsedProduct {
  name: string;
  amount: number;
  unit: string;
  amountMl: number;
  confidence: "high" | "medium" | "low";
  rawLine: string;
}

export interface ParseResult {
  products: ParsedProduct[];
  projectName: string;
  warnings: string[];
}

// Known form type codes that appear at the end of product lines
const FORM_TYPES = new Set([
  "SC", "EC", "SL", "L", "F", "OL", "TK", "ZC", "WG", "WP", "DF", "DG",
  "GR", "ME", "SE", "CS", "EW", "DC", "OD", "SP", "WS", "FS",
]);

// Known form unit patterns
const FORM_UNIT_PATTERNS = [
  /LBA?E?\/GAL/i,
  /GA\/L/i,
  /gAE\/L/i,
  /lb\/gal/i,
  /LB\/GAL/i,
  /%/,
];

export async function parseSprayPlanPdf(buffer: Buffer): Promise<ParseResult> {
  // Write buffer to temp file, run pdftotext, read text
  const tmpDir = os.tmpdir();
  const tmpPdf = path.join(tmpDir, `inventoryops_${Date.now()}.pdf`);
  const tmpTxt = path.join(tmpDir, `inventoryops_${Date.now()}.txt`);
  
  try {
    fs.writeFileSync(tmpPdf, buffer);
    execSync(`pdftotext -layout "${tmpPdf}" "${tmpTxt}"`, { timeout: 15000 });
    const text = fs.readFileSync(tmpTxt, "utf-8");
    
    const warnings: string[] = [];
    const projectName = extractProjectName(text);
    const products = extractProductQuantities(text, warnings);

    if (products.length === 0) {
      warnings.push(
        "No product quantities found. The PDF may not contain a standard ARM product summary table."
      );
    }

    return { products, projectName, warnings };
  } finally {
    try { fs.unlinkSync(tmpPdf); } catch {}
    try { fs.unlinkSync(tmpTxt); } catch {}
  }
}

function extractProjectName(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Look for Trial ID pattern
  for (const line of lines.slice(0, 20)) {
    const trialMatch = line.match(/Trial\s+ID:\s*(.+?)(?:\s+Cooperator|\s+$)/i);
    if (trialMatch) {
      return trialMatch[1].trim();
    }
  }

  // Look for the study title (usually line 2-3 in ARM PDFs)
  for (const line of lines.slice(0, 10)) {
    if (
      line.length > 20 &&
      !line.includes("ARM ") &&
      !line.includes("Page ") &&
      !line.includes("University")
    ) {
      return line.substring(0, 80);
    }
  }

  return "Unknown Project";
}

function extractProductQuantities(text: string, warnings: string[]): ParsedProduct[] {
  const lines = text.split("\n");
  const products: ParsedProduct[] = [];

  // Find the start of the product quantities section
  let inSection = false;
  let pastHeader = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect start of product quantities section
    if (
      line.includes("Product quantities required") ||
      line.includes("product quantities required")
    ) {
      inSection = true;
      pastHeader = false;
      continue;
    }

    if (!inSection) continue;

    // Skip the header line
    if (line.startsWith("Amount") && line.includes("Treatment Name")) {
      pastHeader = true;
      continue;
    }

    // Also skip header-like lines
    if (line.includes("Amount*") && line.includes("Unit")) {
      pastHeader = true;
      continue;
    }

    if (!pastHeader && inSection) {
      // Sometimes the header is on the same line as "Product quantities..."
      // Just try parsing anyway after seeing the section marker
      if (i > 0 && lines[i - 1].trim().includes("Product quantities required")) {
        pastHeader = true;
      } else {
        pastHeader = true; // Force past header after section marker
      }
    }

    // End of section detection
    if (
      line.startsWith("*") ||
      line.includes("Per area") ||
      line.includes("Per volume") ||
      line.includes("Product amount calculations") ||
      line === "" ||
      line.includes("General Trial Information") ||
      line.includes("Status:") ||
      line.includes("ARM Trial Created") ||
      line.includes("Regulations")
    ) {
      if (products.length > 0) {
        // We found products, stop if we hit a blank line or notes section
        inSection = false;
        continue;
      }
      // Keep looking if we haven't found any products yet
      if (line.startsWith("*")) continue;
      if (line === "") continue;
    }

    // Try to parse a product line
    const parsed = parseProductLine(line);
    if (parsed) {
      products.push(parsed);
    }
  }

  // Deduplicate: if the same section appeared twice (split across pages), merge
  return deduplicateProducts(products, warnings);
}

function parseProductLine(line: string): ParsedProduct | null {
  // Pattern: AMOUNT UNIT PRODUCT_NAME [FORM_CONC FORM_UNIT FORM_TYPE [LOT_CODE]]
  // Example: 41.667 mL Flexion 4 LBA/GAL L
  // Example: 1,012.390 mL AMS 3.4 LB/GAL SL
  // Example: 770.833 mL ATRAZIN 4L 480 GA/L SC

  // Match amount at start (with optional commas)
  const amountMatch = line.match(/^([\d,]+\.?\d*)\s+(mL|L|gal|GAL|fl\s*oz)/i);
  if (!amountMatch) return null;

  const rawAmount = amountMatch[1].replace(/,/g, "");
  const amount = parseFloat(rawAmount);
  if (isNaN(amount)) return null;

  const unit = amountMatch[2].trim();
  const rest = line.substring(amountMatch[0].length).trim();

  if (!rest) return null;

  // Now extract product name from the rest
  // Strip form type and form info from the end
  const productName = extractProductName(rest);

  if (!productName || productName.length < 2) return null;

  const detectedUnit = detectUnit(unit);
  const amountMl = toMl(amount, detectedUnit);

  // Determine confidence
  let confidence: "high" | "medium" | "low" = "high";
  if (productName.length < 3) confidence = "medium";
  if (amount <= 0) confidence = "low";

  return {
    name: productName,
    amount,
    unit: detectedUnit,
    amountMl,
    confidence,
    rawLine: line,
  };
}

function extractProductName(rest: string): string {
  // Strategy: work backwards from the end, stripping form type and form info
  const tokens = rest.split(/\s+/);

  // Try to find where form info starts by looking for form type codes from the end
  let cutIndex = tokens.length;

  // Check if last token is a form type or lot code
  for (let i = tokens.length - 1; i >= 1; i--) {
    const token = tokens[i].toUpperCase();

    // If it's a known form type
    if (FORM_TYPES.has(token)) {
      cutIndex = i;
      // Check if previous tokens are form unit and concentration
      if (i >= 2) {
        const prevToken = tokens[i - 1];
        const isFormUnit = FORM_UNIT_PATTERNS.some((p) => p.test(prevToken));
        if (isFormUnit && i >= 3) {
          // Check if the one before that is a number (form concentration)
          const concToken = tokens[i - 2];
          if (/^\d+\.?\d*$/.test(concToken)) {
            cutIndex = i - 2;
          } else {
            cutIndex = i - 1;
          }
        } else if (/^\d+\.?\d*$/.test(prevToken) && i >= 2) {
          // Sometimes form unit is combined like "480" "GA/L"
          cutIndex = i - 1;
        }
      }
      break;
    }

    // Check if this token looks like a form unit
    const isFormUnit = FORM_UNIT_PATTERNS.some((p) => p.test(token));
    if (isFormUnit) {
      cutIndex = i;
      if (i >= 2 && /^\d+\.?\d*$/.test(tokens[i - 1])) {
        cutIndex = i - 1;
      }
      break;
    }
  }

  const nameTokens = tokens.slice(0, cutIndex);
  return nameTokens.join(" ").trim();
}

function deduplicateProducts(
  products: ParsedProduct[],
  warnings: string[]
): ParsedProduct[] {
  const seen = new Map<string, ParsedProduct>();

  for (const product of products) {
    const key = product.name.toLowerCase();
    if (seen.has(key)) {
      const existing = seen.get(key)!;
      // If amounts are identical, it's a duplicate from page break
      if (Math.abs(existing.amount - product.amount) < 0.001) {
        continue; // Skip duplicate
      } else {
        // Different amounts for same name — add both, flag it
        warnings.push(
          `Product "${product.name}" appears with different amounts: ${existing.amount} and ${product.amount}`
        );
        // Keep the larger amount
        if (product.amount > existing.amount) {
          seen.set(key, product);
        }
      }
    } else {
      seen.set(key, product);
    }
  }

  return Array.from(seen.values());
}

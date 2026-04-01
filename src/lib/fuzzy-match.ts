import Fuse from "fuse.js";

export interface ProductCandidate {
  id: string;
  name: string;
  canonical_name: string;
}

export interface MatchResult {
  matched: boolean;
  product?: ProductCandidate;
  score: number;
  inputName: string;
}

const MATCH_THRESHOLD = 0.4; // Lower = stricter matching

export function findBestMatch(
  inputName: string,
  existingProducts: ProductCandidate[],
  aliases: { alias: string; product_id: string }[]
): MatchResult {
  // 1. Check exact match on canonical name or product name (case-insensitive)
  const exactMatch = existingProducts.find(
    (p) =>
      p.name.toLowerCase() === inputName.toLowerCase() ||
      p.canonical_name.toLowerCase() === inputName.toLowerCase()
  );
  if (exactMatch) {
    return { matched: true, product: exactMatch, score: 0, inputName };
  }

  // 2. Check aliases
  const aliasMatch = aliases.find(
    (a) => a.alias.toLowerCase() === inputName.toLowerCase()
  );
  if (aliasMatch) {
    const product = existingProducts.find((p) => p.id === aliasMatch.product_id);
    if (product) {
      return { matched: true, product, score: 0, inputName };
    }
  }

  // 3. Fuzzy match on product names and canonical names
  const searchItems = [
    ...existingProducts.map((p) => ({ ...p, searchField: p.name })),
    ...existingProducts.map((p) => ({ ...p, searchField: p.canonical_name })),
    ...aliases.map((a) => {
      const product = existingProducts.find((p) => p.id === a.product_id);
      return product ? { ...product, searchField: a.alias } : null;
    }).filter(Boolean),
  ];

  const fuse = new Fuse(searchItems, {
    keys: ["searchField"],
    threshold: MATCH_THRESHOLD,
    includeScore: true,
  });

  const results = fuse.search(inputName);

  if (results.length > 0 && results[0].score !== undefined) {
    const best = results[0];
    return {
      matched: true,
      product: {
        id: best.item!.id,
        name: best.item!.name,
        canonical_name: best.item!.canonical_name,
      },
      score: best.score!,
      inputName,
    };
  }

  return { matched: false, score: 1, inputName };
}

// Normalize a product name for canonical storage
export function normalizeProductName(rawName: string): string {
  return rawName
    .trim()
    .replace(/\s+/g, " ")
    // Remove concentration info that sometimes appears in the name field
    .replace(/\s+\d+\s*(LBA?\/GAL|GA\/L|gAE\/L|%)\s*/gi, "")
    .replace(/\s+(SC|EC|SL|L|F|OL|TK|ZC)$/i, "")
    .trim();
}

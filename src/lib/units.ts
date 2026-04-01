export type DisplayUnit = "mL" | "L" | "gal" | "fl oz" | "oz (dry)";

// All conversions TO mL
const TO_ML: Record<string, number> = {
  mL: 1,
  ml: 1,
  L: 1000,
  l: 1000,
  gal: 3785.41,
  GAL: 3785.41,
  "fl oz": 29.5735,
  "FL OZ": 29.5735,
  "oz (dry)": 29.5735, // approximate for display
};

// Convert any recognized unit to mL
export function toMl(value: number, fromUnit: string): number {
  const normalized = fromUnit.trim();
  const factor = TO_ML[normalized];
  if (!factor) {
    // If we can't recognize the unit, assume mL
    console.warn(`Unknown unit "${fromUnit}", assuming mL`);
    return value;
  }
  return value * factor;
}

// Convert from mL to a display unit
export function fromMl(valueMl: number, toUnit: DisplayUnit): number {
  const factor = TO_ML[toUnit];
  if (!factor) return valueMl;
  return valueMl / factor;
}

// Format a mL value for display in the given unit
export function formatQuantity(valueMl: number, displayUnit: DisplayUnit): string {
  const converted = fromMl(valueMl, displayUnit);
  if (converted >= 1000) {
    return converted.toFixed(1);
  }
  if (converted >= 10) {
    return converted.toFixed(2);
  }
  return converted.toFixed(3);
}

export const DISPLAY_UNITS: DisplayUnit[] = ["mL", "L", "gal", "fl oz"];

// Detect unit from a string like "mL", "L", etc.
export function detectUnit(unitStr: string): string {
  const s = unitStr.trim().toLowerCase();
  if (s === "ml") return "mL";
  if (s === "l") return "L";
  if (s === "gal" || s === "gallon" || s === "gallons") return "gal";
  if (s.includes("fl") && s.includes("oz")) return "fl oz";
  if (s === "oz") return "fl oz";
  return "mL";
}

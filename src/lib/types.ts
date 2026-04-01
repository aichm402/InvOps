export interface Product {
  id: string;
  name: string;
  canonical_name: string;
  unit: string;
  created_at: string;
  updated_at: string;
}

export interface ProductAlias {
  id: string;
  product_id: string;
  alias: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  source_filename: string;
  upload_date: string;
  status: string;
  notes: string | null;
}

export interface InventoryRequirement {
  id: string;
  product_id: string;
  project_id: string;
  required_quantity_ml: number;
  original_quantity: number;
  original_unit: string;
  flagged: number;
  flag_reason: string | null;
  created_at: string;
}

export interface InventoryStock {
  id: string;
  product_id: string;
  quantity_on_hand_ml: number;
  last_updated: string;
}

// Aggregated views
export interface ProductInventorySummary {
  product_id: string;
  product_name: string;
  canonical_name: string;
  total_required_ml: number;
  quantity_on_hand_ml: number;
  deficit_ml: number;
  project_count: number;
  status: "sufficient" | "low" | "out";
}

export interface ProjectDetail extends Project {
  requirements: (InventoryRequirement & { product_name: string })[];
}

export interface UploadResult {
  project: Project;
  products: {
    name: string;
    amount: number;
    unit: string;
    matched_product_id: string | null;
    matched_product_name: string | null;
    match_score: number;
    is_new: boolean;
  }[];
  warnings: string[];
}

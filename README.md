# InventoryOps — Herbicide Inventory Management

A web-based dashboard that parses ARM spray plan PDFs and aggregates herbicide product requirements across projects. Built for University of Nebraska-Lincoln weed science research operations.

## What It Does

1. **Upload** ARM-generated spray plan PDFs
2. **Parse** the "Product quantities required" summary table automatically
3. **Match** parsed product names to your canonical product dictionary (fuzzy matching)
4. **Aggregate** total requirements across all projects
5. **Compare** requirements against manually entered stock levels
6. **Alert** when products are low or out of stock

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

That's it — SQLite database is created automatically on first run. No Docker, no Postgres, no extra setup.

## Tech Stack

- **Next.js 15** (React, App Router, API Routes)
- **SQLite** via sql.js (zero-config, file-based)
- **pdf-parse** for PDF text extraction
- **Fuse.js** for fuzzy product name matching
- **Recharts** for analytics charts
- **Tailwind CSS** for styling

## Project Structure

```
inventoryops/
├── src/
│   ├── app/                    # Next.js pages and API routes
│   │   ├── page.tsx            # Dashboard
│   │   ├── inventory/          # Inventory management
│   │   ├── projects/           # Project/spray plan viewer
│   │   ├── analytics/          # Charts and reporting
│   │   ├── upload/             # PDF upload interface
│   │   └── api/                # REST API
│   │       ├── products/       # CRUD for products
│   │       ├── projects/       # Project management
│   │       ├── inventory/      # Stock level updates
│   │       ├── upload/         # PDF processing pipeline
│   │       └── analytics/      # Aggregated statistics
│   ├── components/
│   │   └── Sidebar.tsx         # Navigation sidebar
│   └── lib/
│       ├── db.ts               # SQLite database layer
│       ├── pdf-parser.ts       # ARM PDF parser
│       ├── fuzzy-match.ts      # Product name matching
│       ├── units.ts            # Unit conversion (mL, L, gal, fl oz)
│       └── types.ts            # TypeScript interfaces
├── data/                       # SQLite database file (auto-created)
├── uploads/                    # Stored PDF files
└── README.md
```

## How the PDF Parser Works

ARM spray plan PDFs contain a summary table titled "Product quantities required for listed treatments and applications of trials included in this table." The parser:

1. Extracts text from the PDF using pdf-parse
2. Locates the "Product quantities required" section
3. Parses each line: AMOUNT UNIT PRODUCT_NAME FORM_CONC FORM_UNIT FORM_TYPE
4. Strips formulation metadata, keeping only the product name and required amount
5. Converts all amounts to mL for internal storage
6. Fuzzy-matches names against the canonical product dictionary
7. Creates new products or aliases as needed

The 25% overage adjustment is already included in the PDF amounts.

## Product Name Normalization

When a PDF contains a product name the system hasn't seen before:

- **Exact match**: Matched immediately (case-insensitive)
- **Alias match**: Checks known aliases (e.g., "ATRAZIN 4L" maps to "Atrazine")
- **Fuzzy match** (score < 0.3): Matched with confidence, alias auto-created
- **No match**: Created as new product, flagged for review

You can manage the canonical product dictionary and aliases in the Inventory page.

## Unit Conversion

Everything is stored internally in mL. The UI lets you switch display units at any time:
mL (1:1), L (divide by 1000), Gallons (divide by 3785.41), fl oz (divide by 29.5735)

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/products | List all products with stock and requirement totals |
| POST | /api/products | Create a product |
| GET | /api/products/:id | Product detail with aliases and requirements |
| PUT | /api/products/:id | Update product |
| DELETE | /api/products/:id | Delete product |
| GET | /api/projects | List all projects |
| GET | /api/projects/:id | Project detail with requirements |
| DELETE | /api/projects?id= | Delete project |
| POST | /api/upload | Upload and parse a spray plan PDF |
| GET | /api/inventory | Full inventory status (required vs on-hand) |
| PUT | /api/inventory | Update stock level for a product |
| GET | /api/analytics | Aggregated analytics data |

## Database

SQLite database stored at data/inventoryops.db. Delete this file to reset all data.

Tables: products, product_aliases, projects, inventory_requirements, inventory_stock

## Future Migration to PostgreSQL

The database layer (src/lib/db.ts) is the only file that touches SQLite directly. To migrate, replace sql.js with a Postgres client and update the three functions: getDb(), query(), and run(). The SQL is standard and Postgres-compatible.

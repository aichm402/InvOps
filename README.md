# FieldOps — ARM Research Management

A web-based dashboard for managing herbicide inventory and spray plan logistics at University of Nebraska-Lincoln weed science research operations. Parses ARM spray plan PDFs, aggregates product requirements across projects, and tracks inventory against on-hand stock.

## What It Does

1. **Upload** ARM-generated spray plan PDFs
2. **Parse** the "Product quantities required" summary table automatically using `pdftotext`
3. **Match** parsed product names to your canonical product dictionary (fuzzy matching)
4. **Aggregate** total requirements across all projects
5. **Compare** requirements against manually entered stock levels
6. **Alert** when products are low or out of stock
7. **Schedule** application events on a shared research calendar

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

SQLite database is created automatically on first run. No Docker, no Postgres, no extra setup.

> **Prerequisite:** `pdftotext` must be installed on the host system (part of `poppler-utils` on Linux/macOS, or `brew install poppler` on Mac). This is used to extract text from ARM PDFs.

## Tech Stack

- **Next.js 16** (React 19, App Router, API Routes)
- **SQLite** via `better-sqlite3` (zero-config, file-based, synchronous)
- **pdftotext** (system CLI, part of poppler) for PDF text extraction
- **Fuse.js** for fuzzy product name matching
- **Recharts** for analytics charts
- **Tailwind CSS v4** for styling
- **Radix UI** for accessible UI primitives

## Project Structure

```
fieldops/
├── src/
│   ├── app/                    # Next.js pages and API routes
│   │   ├── page.tsx            # Dashboard
│   │   ├── inventory/          # Inventory management
│   │   ├── projects/           # Project/spray plan viewer
│   │   ├── analytics/          # Charts and reporting
│   │   ├── calendar/           # Research calendar
│   │   ├── upload/             # PDF upload interface
│   │   └── api/                # REST API
│   │       ├── products/       # CRUD for products
│   │       ├── projects/       # Project management
│   │       ├── inventory/      # Stock level updates
│   │       ├── upload/         # PDF processing pipeline
│   │       ├── analytics/      # Aggregated statistics
│   │       ├── calendar/       # Calendar event management
│   │       └── requirements/   # Resolve flagged/unmatched requirements
│   ├── components/
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   └── Logo.tsx            # FieldOps logo
│   └── lib/
│       ├── db.ts               # SQLite database layer (better-sqlite3)
│       ├── pdf-parser.ts       # ARM PDF parser (pdftotext-based)
│       ├── fuzzy-match.ts      # Product name matching
│       ├── units.ts            # Unit conversion (mL, L, gal, fl oz)
│       └── types.ts            # TypeScript interfaces
├── data/                       # SQLite database file (auto-created)
├── uploads/                    # Stored PDF files
└── README.md
```

## How the PDF Parser Works

ARM spray plan PDFs contain a summary table titled "Product quantities required for listed treatments and applications of trials included in this table." The parser:

1. Writes the uploaded PDF to a temp file
2. Runs `pdftotext -layout` to extract text while preserving column alignment
3. Locates the "Product quantities required" section
4. Parses each line: AMOUNT UNIT PRODUCT_NAME FORM_CONC FORM_UNIT FORM_TYPE
5. Strips formulation metadata, keeping only the product name and required amount
6. Converts all amounts to mL for internal storage
7. Fuzzy-matches names against the canonical product dictionary
8. Creates new products (flagged for review) or aliases as needed

The 25% overage adjustment is already included in the PDF amounts.

## Product Name Normalization

When a PDF contains a product name the system hasn't seen before:

- **Exact match**: Matched immediately (case-insensitive)
- **Alias match**: Checks known aliases (e.g., "ATRAZIN 4L" maps to "Atrazine")
- **Fuzzy match** (score < 0.3): Matched with confidence, alias auto-created
- **No match**: Created as new product, flagged for review

Flagged requirements can be resolved via the Requirements API — either by renaming the product's canonical name or by merging it into an existing product (which also adds an alias automatically).

You can manage the canonical product dictionary and aliases in the Inventory page.

## Unit Conversion

Everything is stored internally in mL. The UI lets you switch display units at any time:
- mL (1:1)
- L (÷ 1000)
- Gallons (÷ 3785.41)
- fl oz (÷ 29.5735)

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
| GET | /api/calendar | List calendar events |
| POST | /api/calendar | Create a calendar event |
| PUT | /api/calendar/:id | Update a calendar event |
| DELETE | /api/calendar/:id | Delete a calendar event |
| PATCH | /api/requirements/:id | Resolve a flagged requirement (rename or merge product) |

## Database

SQLite database stored at `data/inventoryops.db`. Delete this file to reset all data.

Tables: `products`, `product_aliases`, `projects`, `inventory_requirements`, `inventory_stock`, `calendar_events`, `calendar_event_projects`

## Future Migration to PostgreSQL

The database layer (`src/lib/db.ts`) is the only file that touches SQLite directly, using `better-sqlite3`. To migrate, replace it with a Postgres client (e.g., `pg` or `postgres`) and update `getDb()`, `query()`, and `run()`. The SQL is standard and Postgres-compatible.

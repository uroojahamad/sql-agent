import Link from "next/link";

export type DatabaseTab = "categories" | "products" | "sales";

export interface CategoryTableRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductTableRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryName: string;
  unitPrice: string;
  currency: string;
  stockQuantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaleTableRow {
  id: string;
  orderReference: string | null;
  productSku: string;
  productName: string;
  categoryName: string;
  quantity: number;
  unitPrice: string;
  currency: string;
  soldAt: string;
  createdAt: string;
}

type DatabaseViewerProps =
  | { activeTab: "categories"; rows: CategoryTableRow[] }
  | { activeTab: "products"; rows: ProductTableRow[] }
  | { activeTab: "sales"; rows: SaleTableRow[] };

const tabs: Array<{ value: DatabaseTab; label: string }> = [
  { value: "categories", label: "Categories" },
  { value: "products", label: "Products" },
  { value: "sales", label: "Sales" },
];

const tableHeadingClass =
  "whitespace-nowrap border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400";
const tableCellClass =
  "whitespace-nowrap border-b border-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800/80 dark:text-zinc-300";

function formatMoney(amount: string | number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function RecordId({ value }: { value: string }) {
  return (
    <code className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" title={value}>
      {value.slice(0, 8)}…
    </code>
  );
}

function EmptyTable() {
  return (
    <div className="px-6 py-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
      No records found in this table.
    </div>
  );
}

function CategoriesTable({ rows }: { rows: CategoryTableRow[] }) {
  if (rows.length === 0) return <EmptyTable />;

  return (
    <table className="min-w-full border-separate border-spacing-0">
      <thead>
        <tr>
          <th className={tableHeadingClass}>ID</th>
          <th className={tableHeadingClass}>Name</th>
          <th className={tableHeadingClass}>Slug</th>
          <th className={tableHeadingClass}>Description</th>
          <th className={tableHeadingClass}>Products</th>
          <th className={tableHeadingClass}>Created</th>
          <th className={tableHeadingClass}>Updated</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50">
            <td className={tableCellClass}><RecordId value={row.id} /></td>
            <td className={`${tableCellClass} font-medium text-zinc-950 dark:text-white`}>{row.name}</td>
            <td className={tableCellClass}>{row.slug}</td>
            <td className={`${tableCellClass} max-w-sm whitespace-normal`}>{row.description ?? "—"}</td>
            <td className={tableCellClass}>{row.productCount}</td>
            <td className={tableCellClass}>{formatDate(row.createdAt)}</td>
            <td className={tableCellClass}>{formatDate(row.updatedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProductsTable({ rows }: { rows: ProductTableRow[] }) {
  if (rows.length === 0) return <EmptyTable />;

  return (
    <table className="min-w-full border-separate border-spacing-0">
      <thead>
        <tr>
          <th className={tableHeadingClass}>ID</th>
          <th className={tableHeadingClass}>SKU</th>
          <th className={tableHeadingClass}>Product</th>
          <th className={tableHeadingClass}>Category</th>
          <th className={tableHeadingClass}>Price</th>
          <th className={tableHeadingClass}>Stock</th>
          <th className={tableHeadingClass}>Status</th>
          <th className={tableHeadingClass}>Created</th>
          <th className={tableHeadingClass}>Updated</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50">
            <td className={tableCellClass}><RecordId value={row.id} /></td>
            <td className={`${tableCellClass} font-mono text-xs`}>{row.sku}</td>
            <td className={`${tableCellClass} max-w-sm whitespace-normal`}>
              <div className="font-medium text-zinc-950 dark:text-white">{row.name}</div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{row.description ?? "No description"}</div>
            </td>
            <td className={tableCellClass}>{row.categoryName}</td>
            <td className={`${tableCellClass} font-medium`}>{formatMoney(row.unitPrice, row.currency)}</td>
            <td className={tableCellClass}>{row.stockQuantity}</td>
            <td className={tableCellClass}>
              <span className={row.isActive
                ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}>
                {row.isActive ? "Active" : "Inactive"}
              </span>
            </td>
            <td className={tableCellClass}>{formatDate(row.createdAt)}</td>
            <td className={tableCellClass}>{formatDate(row.updatedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SalesTable({ rows }: { rows: SaleTableRow[] }) {
  if (rows.length === 0) return <EmptyTable />;

  return (
    <table className="min-w-full border-separate border-spacing-0">
      <thead>
        <tr>
          <th className={tableHeadingClass}>ID</th>
          <th className={tableHeadingClass}>Order</th>
          <th className={tableHeadingClass}>Product</th>
          <th className={tableHeadingClass}>Category</th>
          <th className={tableHeadingClass}>Qty</th>
          <th className={tableHeadingClass}>Unit price</th>
          <th className={tableHeadingClass}>Total</th>
          <th className={tableHeadingClass}>Sold</th>
          <th className={tableHeadingClass}>Recorded</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50">
            <td className={tableCellClass}><RecordId value={row.id} /></td>
            <td className={`${tableCellClass} font-mono text-xs`}>{row.orderReference ?? "—"}</td>
            <td className={tableCellClass}>
              <div className="font-medium text-zinc-950 dark:text-white">{row.productName}</div>
              <div className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">{row.productSku}</div>
            </td>
            <td className={tableCellClass}>{row.categoryName}</td>
            <td className={tableCellClass}>{row.quantity}</td>
            <td className={tableCellClass}>{formatMoney(row.unitPrice, row.currency)}</td>
            <td className={`${tableCellClass} font-semibold text-zinc-950 dark:text-white`}>
              {formatMoney(Number(row.unitPrice) * row.quantity, row.currency)}
            </td>
            <td className={tableCellClass}>{formatDate(row.soldAt)}</td>
            <td className={tableCellClass}>{formatDate(row.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DatabaseViewer(props: DatabaseViewerProps) {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-950 dark:bg-black dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Temporary admin view</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Database records</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              Read-only view of the Category, Product, and Sale records currently stored in Neon.
            </p>
          </div>
          <Link href="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
            Back to SQL agent
          </Link>
        </header>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-4 border-b border-zinc-200 px-4 pt-4 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <nav className="flex gap-1 overflow-x-auto" aria-label="Database tables">
              {tabs.map((tab) => {
                const isActive = tab.value === props.activeTab;
                return (
                  <Link
                    key={tab.value}
                    href={`/database?tab=${tab.value}`}
                    aria-current={isActive ? "page" : undefined}
                    className={isActive
                      ? "border-b-2 border-indigo-600 px-4 py-3 text-sm font-semibold text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                      : "border-b-2 border-transparent px-4 py-3 text-sm font-medium text-zinc-500 hover:border-zinc-300 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white"}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
            <p className="pb-4 text-sm text-zinc-500 dark:text-zinc-400">
              {props.rows.length} records
            </p>
          </div>

          <div className="overflow-x-auto">
            {props.activeTab === "categories" && <CategoriesTable rows={props.rows} />}
            {props.activeTab === "products" && <ProductsTable rows={props.rows} />}
            {props.activeTab === "sales" && <SalesTable rows={props.rows} />}
          </div>
        </section>
      </div>
    </main>
  );
}

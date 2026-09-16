"use client";

import { Button, Empty, Table, Tabs, Tag, Tooltip } from "antd";
import type { TableColumnsType } from "antd";
import { useRouter } from "next/navigation";

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

const tabs: Array<{ key: DatabaseTab; label: string }> = [
  { key: "categories", label: "Categories" },
  { key: "products", label: "Products" },
  { key: "sales", label: "Sales" },
];

const formatMoney = (amount: string | number, currency: string) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(amount));
};

const formatDate = (value: string) => {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
};

const RecordId = ({ value }: { value: string }) => {
  return (
    <Tooltip title={value}>
      <code className="rounded-md bg-white/6 px-2 py-1 font-mono text-xs text-agent-soft">
        {value.slice(0, 8)}…
      </code>
    </Tooltip>
  );
};

const categoryColumns: TableColumnsType<CategoryTableRow> = [
  {
    title: "ID",
    dataIndex: "id",
    width: 120,
    render: (value: string) => <RecordId value={value} />,
  },
  { title: "Name", dataIndex: "name", width: 190 },
  {
    title: "Slug",
    dataIndex: "slug",
    width: 170,
    render: (value: string) => (
      <span className="font-mono text-xs text-agent-soft">{value}</span>
    ),
  },
  {
    title: "Description",
    dataIndex: "description",
    width: 330,
    render: (value: string | null) => value ?? "—",
  },
  { title: "Products", dataIndex: "productCount", width: 110 },
  {
    title: "Created",
    dataIndex: "createdAt",
    width: 190,
    render: formatDate,
  },
  {
    title: "Updated",
    dataIndex: "updatedAt",
    width: 190,
    render: formatDate,
  },
];

const productColumns: TableColumnsType<ProductTableRow> = [
  {
    title: "ID",
    dataIndex: "id",
    width: 120,
    render: (value: string) => <RecordId value={value} />,
  },
  {
    title: "SKU",
    dataIndex: "sku",
    width: 120,
    render: (value: string) => (
      <span className="font-mono text-xs text-agent-soft">{value}</span>
    ),
  },
  {
    title: "Product",
    dataIndex: "name",
    width: 280,
    render: (value: string, row) => (
      <div>
        <strong className="font-semibold text-agent-text">{value}</strong>
        <p className="mt-1 mb-0 text-xs text-agent-faint">
          {row.description ?? "No description"}
        </p>
      </div>
    ),
  },
  { title: "Category", dataIndex: "categoryName", width: 170 },
  {
    title: "Price",
    dataIndex: "unitPrice",
    width: 120,
    render: (value: string, row) => formatMoney(value, row.currency),
  },
  { title: "Stock", dataIndex: "stockQuantity", width: 90 },
  {
    title: "Status",
    dataIndex: "isActive",
    width: 110,
    render: (isActive: boolean) => (
      <Tag color={isActive ? "success" : "default"} bordered={false}>
        {isActive ? "Active" : "Inactive"}
      </Tag>
    ),
  },
  {
    title: "Created",
    dataIndex: "createdAt",
    width: 190,
    render: formatDate,
  },
  {
    title: "Updated",
    dataIndex: "updatedAt",
    width: 190,
    render: formatDate,
  },
];

const saleColumns: TableColumnsType<SaleTableRow> = [
  {
    title: "ID",
    dataIndex: "id",
    width: 120,
    render: (value: string) => <RecordId value={value} />,
  },
  {
    title: "Order",
    dataIndex: "orderReference",
    width: 150,
    render: (value: string | null) => (
      <span className="font-mono text-xs text-agent-soft">{value ?? "—"}</span>
    ),
  },
  {
    title: "Product",
    dataIndex: "productName",
    width: 250,
    render: (value: string, row) => (
      <div>
        <strong className="font-semibold text-agent-text">{value}</strong>
        <p className="mt-1 mb-0 font-mono text-xs text-agent-faint">
          {row.productSku}
        </p>
      </div>
    ),
  },
  { title: "Category", dataIndex: "categoryName", width: 160 },
  { title: "Qty", dataIndex: "quantity", width: 75 },
  {
    title: "Unit price",
    dataIndex: "unitPrice",
    width: 120,
    render: (value: string, row) => formatMoney(value, row.currency),
  },
  {
    title: "Total",
    key: "total",
    width: 120,
    render: (_, row) => (
      <strong className="font-semibold text-agent-text">
        {formatMoney(Number(row.unitPrice) * row.quantity, row.currency)}
      </strong>
    ),
  },
  {
    title: "Sold",
    dataIndex: "soldAt",
    width: 190,
    render: formatDate,
  },
  {
    title: "Recorded",
    dataIndex: "createdAt",
    width: 190,
    render: formatDate,
  },
];

const tableLocale = {
  emptyText: (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="No records found in this table."
    />
  ),
};

export const DatabaseViewer = (props: DatabaseViewerProps) => {
  const router = useRouter();
  const pagination =
    props.rows.length > 15
      ? { pageSize: 15, showSizeChanger: false, hideOnSinglePage: true }
      : false;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_80%_-20%,rgba(112,225,245,0.08),transparent_34%),#07090d] px-4 py-10 text-agent-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold tracking-[0.2em] text-agent-accent uppercase">
              Temporary admin view
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Database records
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-agent-soft">
              Read-only view of the Category, Product, and Sale records currently
              stored in Neon.
            </p>
          </div>
          <Button href="/" className="!self-start sm:!self-auto">
            Back to SQL agent
          </Button>
        </header>

        <section className="overflow-hidden rounded-2xl border border-white/8 bg-[rgba(15,19,26,0.88)] shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <Tabs
            activeKey={props.activeTab}
            items={tabs}
            onChange={(key) => router.push(`/database?tab=${key}`)}
            tabBarExtraContent={
              <span className="text-sm text-agent-faint">
                {props.rows.length} records
              </span>
            }
            className="px-4 pt-2 sm:px-6"
          />

          <div className="-mt-4">
            {props.activeTab === "categories" && (
              <Table<CategoryTableRow>
                rowKey="id"
                columns={categoryColumns}
                dataSource={props.rows}
                pagination={pagination}
                locale={tableLocale}
                scroll={{ x: 1210 }}
              />
            )}
            {props.activeTab === "products" && (
              <Table<ProductTableRow>
                rowKey="id"
                columns={productColumns}
                dataSource={props.rows}
                pagination={pagination}
                locale={tableLocale}
                scroll={{ x: 1550 }}
              />
            )}
            {props.activeTab === "sales" && (
              <Table<SaleTableRow>
                rowKey="id"
                columns={saleColumns}
                dataSource={props.rows}
                pagination={pagination}
                locale={tableLocale}
                scroll={{ x: 1375 }}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

import type { Metadata } from "next";
import {
  DatabaseViewer,
  type CategoryTableRow,
  type DatabaseTab,
  type ProductTableRow,
  type SaleTableRow,
} from "@/components/database-viewer";
import { listCategories } from "@/database/repositories/categories";
import { findProducts } from "@/database/repositories/products";
import { listSales } from "@/database/repositories/sales";

export const metadata: Metadata = {
  title: "Database records | SQL Agent",
  description: "Temporary read-only viewer for SQL Agent database records.",
};

interface DatabasePageProps {
  searchParams: Promise<{
    tab?: string | string[];
  }>;
}

function parseTab(value: string | string[] | undefined): DatabaseTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "products" || tab === "sales" ? tab : "categories";
}

export default async function DatabasePage({ searchParams }: DatabasePageProps) {
  const { tab } = await searchParams;
  const activeTab = parseTab(tab);

  if (activeTab === "products") {
    const products = await findProducts({ activeOnly: false, limit: 100 });
    const rows: ProductTableRow[] = products.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      categoryName: product.category.name,
      unitPrice: product.unitPrice.toString(),
      currency: product.currency,
      stockQuantity: product.stockQuantity,
      isActive: product.isActive,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    }));

    return <DatabaseViewer activeTab="products" rows={rows} />;
  }

  if (activeTab === "sales") {
    const sales = await listSales(100);
    const rows: SaleTableRow[] = sales.map((sale) => ({
      id: sale.id,
      orderReference: sale.orderReference,
      productSku: sale.product.sku,
      productName: sale.product.name,
      categoryName: sale.product.category.name,
      quantity: sale.quantity,
      unitPrice: sale.unitPrice.toString(),
      currency: sale.currency,
      soldAt: sale.soldAt.toISOString(),
      createdAt: sale.createdAt.toISOString(),
    }));

    return <DatabaseViewer activeTab="sales" rows={rows} />;
  }

  const categories = await listCategories(100);
  const rows: CategoryTableRow[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    productCount: category._count.products,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  }));

  return <DatabaseViewer activeTab="categories" rows={rows} />;
}

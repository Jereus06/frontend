import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatLong } from "@/lib/dates";
import { num, peso } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { Product, Sale } from "@/lib/types";

export const Route = createFileRoute("/inventory")({ component: InventoryPage });

function InventoryPage() {
  return (
    <div className="page-enter mx-auto flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">Inventory & records</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Products, lead times, and safety stock drive reorder points. Sales history is the only
          input the models need.
        </p>
      </header>
      <Tabs defaultValue="products">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="sales">Sales ledger</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <ProductsPanel />
        </TabsContent>
        <TabsContent value="sales">
          <SalesPanel />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProductsPanel() {
  const products = useAppStore((s) => s.products);
  const updateProduct = useAppStore((s) => s.updateProduct);
  const addProduct = useAppStore((s) => s.addProduct);
  const importProducts = useAppStore((s) => s.importProducts);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [inventoryCsv, setInventoryCsv] = useState("");
  const [query, setQuery] = useState("");
  const filteredProducts = products.filter((product) => {
    const search = query.trim().toLowerCase();
    return (
      !search ||
      product.name.toLowerCase().includes(search) ||
      product.sku.toLowerCase().includes(search) ||
      product.category.toLowerCase().includes(search)
    );
  });

  function importInventory() {
    const rows = parseInventoryCsv(inventoryCsv, products);
    if (!rows.length) {
      toast.error("No valid inventory rows found. Check the CSV columns and values.");
      return;
    }
    importProducts(rows);
    toast.success(`Imported ${rows.length} inventory rows.`);
    setInventoryCsv("");
    setImportOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <Label htmlFor="product-search" className="sr-only">
            Search inventory products
          </Label>
          <Input
            id="product-search"
            type="search"
            placeholder="Search by product, SKU, or category"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen((value) => !value)}>
            {importOpen ? "Close import" : "Import inventory"}
          </Button>
          <Button variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Close form" : "Add product"}
          </Button>
        </div>
      </div>
      {importOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Import inventory CSV</CardTitle>
            <CardDescription>
              Columns: SKU, Product, Category, Unit, On Hand, Lead Time, Safety Stock, Unit Cost.
              Existing SKUs are updated.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <textarea
              value={inventoryCsv}
              onChange={(event) => setInventoryCsv(event.target.value)}
              rows={7}
              className="w-full rounded-xl border border-border bg-surface p-3 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              placeholder={"SKU-001,Rice 5kg,Staples,bag,24,3,5,320"}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={importInventory}>
                Import inventory
              </Button>
              <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
                Upload file
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      setInventoryCsv(String(reader.result ?? ""));
                      toast.success(`Loaded ${file.name}`);
                    };
                    reader.readAsText(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </CardContent>
        </Card>
      )}
      {open && <AddProductForm onAdd={addProduct} onDone={() => setOpen(false)} />}
      <div className="grid gap-3">
        {filteredProducts.map((p) => (
          <ProductEditor
            key={`${p.id}-${p.currentStock}-${p.leadTimeDays}-${p.safetyStock}`}
            product={p}
            onSave={(patch) => updateProduct(p.id, patch)}
          />
        ))}
        {filteredProducts.length === 0 && (
          <Card>
            <CardContent className="text-sm text-muted">
              No inventory products match “{query}”.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ProductEditor({
  product,
  onSave,
}: {
  product: Product;
  onSave: (patch: Partial<Product>) => void;
}) {
  const [lead, setLead] = useState(String(product.leadTimeDays));
  const [ss, setSs] = useState(String(product.safetyStock));
  const [stock, setStock] = useState(String(product.currentStock));

  function save() {
    onSave({
      leadTimeDays: Math.max(1, Number(lead) || 1),
      safetyStock: Math.max(0, Number(ss) || 0),
      currentStock: Math.max(0, Number(stock) || 0),
    });
    toast.success(`Updated ${product.name}`);
  }

  return (
    <Card>
      <CardContent className="grid gap-4 md:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))_auto] md:items-end">
        <div>
          <p className="font-medium">{product.name}</p>
          <p className="text-xs text-muted">
            {product.sku} · {product.category} · {peso(product.unitCost)} / {product.unit}
          </p>
        </div>
        <Field label="On hand" value={stock} onChange={setStock} />
        <Field label="Lead time (days)" value={lead} onChange={setLead} />
        <Field label="Safety stock" value={ss} onChange={setSs} />
        <Button variant="secondary" onClick={save}>
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function AddProductForm({
  onAdd,
  onDone,
}: {
  onAdd: (p: Omit<Product, "id" | "sku"> & { sku?: string }) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Staples");
  const [unit, setUnit] = useState("pc");
  const [stock, setStock] = useState("0");
  const [lead, setLead] = useState("3");
  const [ss, setSs] = useState("5");
  const [cost, setCost] = useState("10");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      category,
      unit,
      currentStock: Number(stock) || 0,
      leadTimeDays: Number(lead) || 3,
      safetyStock: Number(ss) || 0,
      unitCost: Number(cost) || 0,
    });
    toast.success(`Added ${name.trim()}`);
    onDone();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New product</CardTitle>
        <CardDescription>
          Needs a few weeks of sales before forecasts become reliable.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
          <div className="grid gap-1.5 md:col-span-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Unit</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>On hand</Label>
            <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Lead time</Label>
            <Input type="number" value={lead} onChange={(e) => setLead(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Safety stock</Label>
            <Input type="number" value={ss} onChange={(e) => setSs(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Unit cost (PHP)</Label>
            <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Add to catalog</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SalesPanel() {
  const sales = useAppStore((s) => s.sales);
  const products = useAppStore((s) => s.products);
  const importSales = useAppStore((s) => s.importSales);
  const [csv, setCsv] = useState("");
  const nameById = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p.name])),
    [products],
  );
  const recent = [...sales].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 40);

  function importCsv() {
    const rows = parseCsv(csv, products);
    if (!rows.length) {
      toast.error("No matching rows. Use Date, Product, Quantity.");
      return;
    }
    importSales(rows);
    toast.success(`Imported ${rows.length} sales rows.`);
    setCsv("");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Recent sales</CardTitle>
          <CardDescription>
            Sales records currently available ({num(sales.length)} rows).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 font-medium">Qty</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-2 pr-3 tabular">{s.date}</td>
                  <td className="pr-3">{nameById[s.productId] ?? s.productId}</td>
                  <td className="tabular">{num(s.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Import CSV</CardTitle>
          <CardDescription>
            Columns: Date, Product, Quantity. Product can be name or SKU.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={10}
            className="w-full rounded-xl border border-border bg-surface p-3 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            placeholder={
              "2026-09-18,Lucky Me Pancit Canton,12\n2026-09-18,Nature Spring Water 500ml,20"
            }
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={importCsv}>
              Import rows
            </Button>
            <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
              Upload file
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const text = String(reader.result ?? "");
                    setCsv(text);
                    toast.success(`Loaded ${file.name}`);
                  };
                  reader.readAsText(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function parseCsv(text: string, products: Product[]): Sale[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: Sale[] = [];
  for (const line of lines) {
    if (/^date/i.test(line)) continue;
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 3) continue;
    const [date, productKey, qtyRaw] = parts;
    const qty = Number(qtyRaw);
    if (!date || !Number.isFinite(qty) || qty <= 0) continue;
    const match = products.find(
      (p) =>
        p.name.toLowerCase() === productKey.toLowerCase() ||
        p.sku.toLowerCase() === productKey.toLowerCase() ||
        p.id === productKey,
    );
    if (!match) continue;
    rows.push({
      id: `imp-${match.id}-${date}-${rows.length}-${Date.now()}`,
      productId: match.id,
      date,
      qty,
    });
  }
  return rows;
}

function parseInventoryCsv(text: string, products: Product[]): Product[] {
  const existingBySku = new Map(products.map((product) => [product.sku.toLowerCase(), product]));
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line, index) => {
      if (/^sku\s*,/i.test(line)) return [];
      const [sku, name, category, unit, stockRaw, leadRaw, safetyRaw, costRaw] = line
        .split(",")
        .map((value) => value.trim());
      const currentStock = Number(stockRaw);
      const leadTimeDays = Number(leadRaw);
      const safetyStock = Number(safetyRaw);
      const unitCost = Number(costRaw);
      if (
        !sku ||
        !name ||
        !category ||
        !unit ||
        ![currentStock, leadTimeDays, safetyStock, unitCost].every(Number.isFinite) ||
        currentStock < 0 ||
        leadTimeDays < 1 ||
        safetyStock < 0 ||
        unitCost < 0
      )
        return [];
      const existing = existingBySku.get(sku.toLowerCase());
      return [
        {
          id: existing?.id ?? `imp-product-${Date.now()}-${index}`,
          sku,
          name,
          category,
          unit,
          currentStock,
          leadTimeDays,
          safetyStock,
          unitCost,
        },
      ];
    });
}

function SettingsPanel() {
  const settings = useAppStore((s) => s.settings);
  const sales = useAppStore((s) => s.sales);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetDemo = useAppStore((s) => s.resetDemo);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Store & model settings</CardTitle>
        <CardDescription>
          Business settings control the planning view. Model controls are grouped separately below.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid max-w-xl gap-4">
        <div className="grid gap-1.5">
          <Label>Store name</Label>
          <Input
            value={settings.storeName}
            onChange={(e) => updateSettings({ storeName: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Location</Label>
          <Input
            value={settings.storeLocation}
            onChange={(e) => updateSettings({ storeLocation: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Forecast horizon</Label>
          <Select
            value={String(settings.forecastHorizon)}
            onChange={(e) => updateSettings({ forecastHorizon: Number(e.target.value) })}
          >
            {[7, 14, 21, 30].map((n) => (
              <option key={n} value={n}>
                {n} days
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Cover days after delivery</Label>
          <Select
            value={String(settings.coverDays)}
            onChange={(e) => updateSettings({ coverDays: Number(e.target.value) })}
          >
            {[3, 7, 10, 14].map((n) => (
              <option key={n} value={n}>
                {n} days
              </option>
            ))}
          </Select>
        </div>
        <SalesHistorySummary sales={sales} />
        <section className="grid gap-4 rounded-xl border border-border bg-surface-2 p-4">
          <div>
            <h3 className="font-medium">Advanced forecasting settings</h3>
            <p className="text-sm text-muted">
              Research and model controls for the local forecast run.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label>Moving Average window (days)</Label>
            <Select
              value={String(settings.maWindow)}
              onChange={(e) => updateSettings({ maWindow: Number(e.target.value) })}
            >
              {[3, 7, 14].map((n) => (
                <option key={n} value={n}>
                  {n} days
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>ML product limit</Label>
            <Select
              value={String(settings.topNProducts)}
              onChange={(e) => updateSettings({ topNProducts: Number(e.target.value) })}
            >
              {[5, 8, 12, 20].map((n) => (
                <option key={n} value={n}>
                  Top {n} eligible products
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted">
              Maximum ML scope only. Products must still meet history and data-quality requirements,
              so not every product in this limit is guaranteed to qualify for ML.
            </p>
          </div>
        </section>
        <Button
          variant="outline"
          onClick={() => {
            resetDemo();
            toast.success("Demo data restored.");
          }}
        >
          Reset demo data
        </Button>
      </CardContent>
    </Card>
  );
}

function SalesHistorySummary({ sales }: { sales: Sale[] }) {
  const validDates = sales
    .map((sale) => sale.date)
    .filter((date) => !Number.isNaN(Date.parse(date)))
    .sort();
  const first = validDates[0];
  const last = validDates.at(-1);
  if (!first || !last) {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
        <p className="font-medium">Limited history</p>
        <p className="text-sm text-muted">
          No dated sales records are available. XGBoost eligibility may be unavailable and a simpler
          forecasting method may be used.
        </p>
      </div>
    );
  }
  const days = Math.floor((Date.parse(last) - Date.parse(first)) / 86_400_000) + 1;
  const months = Math.max(1, Math.round(days / 30.44));
  const limited = days < 56;
  return (
    <div
      className={`rounded-xl border p-4 ${limited ? "border-warning/30 bg-warning/5" : "border-border bg-surface-2"}`}
    >
      <p className="font-medium">{limited ? "Limited history" : "Available sales history"}</p>
      <p className="mt-1 text-sm">
        {formatLong(first)} – {formatLong(last)}
      </p>
      <p className="text-sm text-muted">
        {num(days)} days / about {months} month{months === 1 ? "" : "s"}
      </p>
      {limited && (
        <p className="mt-2 text-sm text-muted">
          Only about {Math.max(1, Math.round(days / 7))} weeks of sales are available. XGBoost
          eligibility may be unavailable and a simpler forecasting method may be used.
        </p>
      )}
    </div>
  );
}

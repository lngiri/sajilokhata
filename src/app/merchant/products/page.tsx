"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { getCurrentMerchantId } from "@/lib/auth";
import {
  getAllMerchantProducts,
  createMerchantProduct,
  updateMerchantProduct,
  deleteMerchantProduct,
} from "@/app/actions/products";

interface Product {
  id: string;
  name: string;
  unit: string;
  default_rate: number;
  category: string | null;
  is_active: boolean;
  sort_order: number;
}

const UNITS = ["piece", "liter", "kg", "jar", "npr"];

export default function ProductsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState("");
  const [formUnit, setFormUnit] = useState("piece");
  const [formRate, setFormRate] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentMerchantId().then((id) => {
      if (!id) {
        router.replace("/login?redirect=/merchant/products");
        return;
      }
      setMerchantId(id);
    });
  }, []);

  const loadProducts = useCallback(async () => {
    if (!merchantId) return;
    setLoading(true);
    try {
      const data = await getAllMerchantProducts(merchantId);
      setProducts(data as Product[]);
    } catch (e: any) {
      const msg = e?.message || "";
      if (
        msg.includes("does not exist") ||
        msg.includes("relation") ||
        msg.includes("merchant_products")
      ) {
        setProducts([]);
      } else {
        addToast("Failed to load products: " + msg, "error");
      }
    } finally {
      setLoading(false);
    }
  }, [merchantId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const resetForm = () => {
    setFormName("");
    setFormUnit("piece");
    setFormRate("");
    setFormCategory("");
    setEditingProduct(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formRate || Number(formRate) <= 0) {
      addToast("Enter product name and rate", "error");
      return;
    }
    setSaving(true);
    try {
      if (editingProduct) {
        await updateMerchantProduct(editingProduct.id, {
          name: formName.trim(),
          unit: formUnit,
          default_rate: Number(formRate),
          category: formCategory.trim() || undefined,
        });
        addToast("Product updated", "success");
      } else {
        await createMerchantProduct({
          merchant_id: merchantId!,
          name: formName.trim(),
          unit: formUnit,
          default_rate: Number(formRate),
          category: formCategory.trim() || undefined,
        });
        addToast("Product added", "success");
      }
      resetForm();
      loadProducts();
    } catch (e: any) {
      addToast(e?.message || "Failed to save product", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      await updateMerchantProduct(product.id, { is_active: !product.is_active });
      loadProducts();
    } catch {
      addToast("Failed to update product", "error");
    }
  };

  const handleDelete = async (product: Product) => {
    try {
      await deleteMerchantProduct(product.id);
      addToast("Product removed", "success");
      loadProducts();
    } catch {
      addToast("Failed to remove product", "error");
    }
  };

  const activeProducts = products.filter((p) => p.is_active);
  const inactiveProducts = products.filter((p) => !p.is_active);

  useEffect(() => {
    if (showForm) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [showForm]);

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <a href="/merchant/dashboard" className="text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </a>
            <h1 className="text-lg font-bold text-[var(--color-text)]">My Products</h1>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium active:scale-[0.97] transition-transform"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeProducts.length === 0 && inactiveProducts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-50 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25M12 13.875l2.25 2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">No products yet</p>
            <p className="text-gray-400 text-xs mt-1">Add products to speed up credit entries</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium active:scale-[0.97] transition-transform"
            >
              Add Your First Product
            </button>
          </div>
        ) : (
          <>
            {activeProducts.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Active ({activeProducts.length})</h2>
                {activeProducts.map((product) => (
                  <div key={product.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-[var(--color-text)] truncate">{product.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Rs. {product.default_rate.toLocaleString()} / {product.unit}
                          {product.category && <span className="ml-2 text-gray-400">• {product.category}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => {
                            setEditingProduct(product);
                            setFormName(product.name);
                            setFormUnit(product.unit);
                            setFormRate(String(product.default_rate));
                            setFormCategory(product.category || "");
                            setShowForm(true);
                          }}
                          className="p-2 text-gray-400 hover:text-[var(--color-primary)]"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          className="p-2 text-gray-400 hover:text-red-500"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {inactiveProducts.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Inactive ({inactiveProducts.length})</h2>
                {inactiveProducts.map((product) => (
                  <div key={product.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-50 opacity-60">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-500 truncate">{product.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Rs. {product.default_rate.toLocaleString()} / {product.unit}
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleActive(product)}
                        className="text-xs text-[var(--color-primary)] font-medium"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85dvh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-6 pt-6 pb-2">
              <h2 className="text-lg font-bold text-[var(--color-text)]">
                {editingProduct ? "Edit Product" : "Add Product"}
              </h2>
              <button onClick={resetForm} className="p-1 text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">Product Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Full Cream Milk, Basmati Rice"
                  autoFocus
                  className="w-full mt-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm font-medium text-[var(--color-text)]">Rate (Rs.) *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formRate}
                    onChange={(e) => setFormRate(e.target.value)}
                    placeholder="0"
                    className="w-full mt-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-center"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-[var(--color-text)]">Unit</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full mt-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-sm appearance-none"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">Category</label>
                <input
                  type="text"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="Optional: e.g. Dairy, Groceries"
                  className="w-full mt-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex-shrink-0 flex gap-3 px-6 pb-6 pt-4 border-t border-gray-100">
              <button onClick={resetForm} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formRate || Number(formRate) <= 0}
                className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {saving ? "Saving..." : editingProduct ? "Update" : "Add Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

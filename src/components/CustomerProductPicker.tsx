"use client";

import { useEffect, useState } from "react";
import { getPublicMerchantProducts } from "@/app/actions/products";
import type { PublicProduct } from "@/app/actions/products";

interface CustomerProductPickerProps {
  merchantId: string;
  selectedProductId: string | null;
  onSelect: (product: PublicProduct | null) => void;
}

/**
 * Optional product chips shown to a customer while entering a khata entry.
 * Tapping a product pre-fills amount/description; "Custom" clears the choice.
 * Controlled by the parent via `selectedProductId` (reset on new scan).
 * Hidden entirely when the merchant has no active products (or offline).
 */
export default function CustomerProductPicker({
  merchantId,
  selectedProductId,
  onSelect,
}: CustomerProductPickerProps) {
  const [products, setProducts] = useState<PublicProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    setProducts([]);
    if (!merchantId) return;

    getPublicMerchantProducts(merchantId)
      .then((data) => {
        if (!cancelled) setProducts(data);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });

    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  if (products.length === 0) return null;

  const chipClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
      active
        ? "bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] border-[var(--color-primary)]"
        : "bg-[var(--color-surface)] text-gray-600 dark:text-gray-300 border-[var(--color-border)]"
    }`;

  return (
    <div>
      <label className="text-sm font-medium text-[var(--color-text)]">
        Products (optional)
      </label>
      <div className="mt-1.5 flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={chipClass(selectedProductId === null)}
        >
          Custom
        </button>
        {products.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className={chipClass(selectedProductId === p.id)}
          >
            {p.name}
            <span className="ml-1 opacity-70">Rs {p.default_rate}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

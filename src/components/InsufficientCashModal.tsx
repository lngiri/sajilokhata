"use client";

import { motion, AnimatePresence } from "framer-motion";
import { formatNumber } from "@/lib/format";

interface Props {
  open: boolean;
  cashBalance: number;
  amount: number;
  onEdit: () => void;
  onRecordAnyway: () => void;
}

export default function InsufficientCashModal({ open, cashBalance, amount, onEdit, onRecordAnyway }: Props) {
  const shortfall = Math.max(0, amount - cashBalance);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={onEdit}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-2xl"
          >
            <div className="w-12 h-12 mx-auto rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>

            <h2 className="text-lg font-bold text-gray-900 dark:text-white text-center">Insufficient Cash in Hand</h2>

            <div className="mt-4 space-y-2 bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
              <p className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                <span>Cash in hand</span>
                <span className="font-semibold">Rs. {formatNumber(cashBalance)}</span>
              </p>
              <p className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                <span>This expense</span>
                <span className="font-semibold">Rs. {formatNumber(amount)}</span>
              </p>
              <p className="flex justify-between text-sm font-medium text-red-700 dark:text-red-300">
                <span>Shortfall</span>
                <span className="font-semibold">Rs. {formatNumber(shortfall)}</span>
              </p>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              Your current cash in hand is not enough to cover this purchase. If you paid from a bank, card or your own money, you can still record this expense.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={onEdit}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
              >
                Edit amount
              </button>
              <button
                onClick={onRecordAnyway}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform"
              >
                Yes, record anyway
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

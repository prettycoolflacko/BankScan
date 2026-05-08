'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Badge } from './ui/badge';
import { useEffect, useState } from 'react';
import { Trash2, Loader2, Eraser, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

type Transaction = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  bank: string;
  type: string;
  description: string;
  statement_id: string | null;
  created_at: string;
};

interface TransactionListProps {
  refreshTrigger: number;
  selectedStatementId: string | null;
  onDataChanged: () => void;
}

function formatCurrency(amount: number, currency: string = 'IDR'): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function TransactionList({ refreshTrigger, selectedStatementId, onDataChanged }: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Reset selection when data changes
  useEffect(() => {
    setSelectedIds(new Set());
    fetchTransactions();
  }, [refreshTrigger, selectedStatementId]);

  async function fetchTransactions() {
    try {
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const url = selectedStatementId
        ? `/api/transactions?statement_id=${selectedStatementId}`
        : '/api/transactions';

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const data: Transaction[] = await res.json();

      // Sort by date DESC, then by created_at DESC as tiebreaker
      const sorted = [...(Array.isArray(data) ? data : [])].sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setTransactions(sorted);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  // --- Selection helpers ---
  const allSelected = transactions.length > 0 && selectedIds.size === transactions.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map(t => t.id)));
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- Delete handlers ---
  const handleDeleteRow = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to delete');
      }
      toast.success('Transaction deleted');
      setTransactions(prev => prev.filter(t => t.id !== id));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!confirm(`Delete ${ids.length} selected transaction${ids.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;

    setBulkDeleting(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Bulk delete failed');
      }
      toast.success(`${ids.length} transaction${ids.length !== 1 ? 's' : ''} deleted`);
      setTransactions(prev => prev.filter(t => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleClearAll = async () => {
    const label = selectedStatementId ? "this statement's transactions" : 'ALL transactions';
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;

    setClearingAll(true);
    try {
      const url = selectedStatementId
        ? `/api/transactions?statement_id=${selectedStatementId}`
        : '/api/transactions';
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to clear');
      }
      toast.success('Transactions cleared');
      setTransactions([]);
      setSelectedIds(new Set());
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setClearingAll(false);
    }
  };

  // Totals (based on current view)
  const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="animate-spin h-4 w-4" />
        Loading transactions…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 border rounded-xl bg-destructive/5 border-destructive/20">
        <p className="text-sm font-medium text-destructive">Failed to load transactions</p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center p-8 border rounded-xl bg-muted/20">
        <p className="text-sm text-muted-foreground">
          {selectedStatementId
            ? 'No transactions found for this statement.'
            : 'No transactions yet. Upload an e-statement to begin.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary / actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1 text-red-500">
            <TrendingDown className="w-3.5 h-3.5" />
            {formatCurrency(totalExpense)}
          </span>
          <span className="flex items-center gap-1 text-green-500">
            <TrendingUp className="w-3.5 h-3.5" />
            {formatCurrency(totalIncome)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Bulk delete — appears only when rows are selected */}
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-red-500/30 text-red-500 bg-red-500/5 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {bulkDeleting
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Trash2 className="w-3 h-3" />}
              Delete {selectedIds.size} selected
            </button>
          )}

          {/* Clear all */}
          <button
            onClick={handleClearAll}
            disabled={clearingAll}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border text-muted-foreground hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5 transition-colors disabled:opacity-50"
          >
            {clearingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eraser className="w-3 h-3" />}
            {selectedStatementId ? 'Clear Statement' : 'Clear All'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {/* Select-all checkbox */}
              <TableHead className="w-[40px] pr-0">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                  className="cursor-pointer accent-primary w-4 h-4"
                  aria-label="Select all transactions"
                />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Type</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => {
              const isSelected = selectedIds.has(t.id);
              return (
                <TableRow
                  key={t.id}
                  className={`group cursor-pointer ${isSelected ? 'bg-primary/5' : ''}`}
                  onClick={() => toggleRow(t.id)}
                >
                  {/* Row checkbox */}
                  <TableCell className="pr-0" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(t.id)}
                      className="cursor-pointer accent-primary w-4 h-4"
                      aria-label={`Select transaction ${t.description}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {new Date(t.date + 'T00:00:00').toLocaleDateString('id-ID')}
                  </TableCell>
                  <TableCell>{t.bank}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={t.description}>
                    {t.description || '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(t.amount, t.currency || 'IDR')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={t.type === 'INCOME' ? 'default' : 'destructive'}
                      className={t.type === 'INCOME' ? 'bg-green-500 hover:bg-green-600' : ''}
                    >
                      {t.type}
                    </Badge>
                  </TableCell>
                  {/* Row delete */}
                  <TableCell onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleDeleteRow(t.id)}
                      disabled={deletingId === t.id}
                      className="p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50"
                      title="Delete this transaction"
                    >
                      {deletingId === t.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

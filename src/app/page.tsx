'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingDown, TrendingUp, CalendarDays, CalendarRange, Clock, PlusCircle, FileText, Loader2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type Transaction = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  bank: string;
  type: string;
  description: string;
  created_at: string;
};

type Summary = {
  todayExpense: number;
  todayIncome: number;
  monthExpense: number;
  monthIncome: number;
  allTimeExpense: number;
  allTimeIncome: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportRes, txRes] = await Promise.all([
        fetch('/api/reports'),
        fetch('/api/transactions?limit=10'),
      ]);
      if (reportRes.ok) setSummary(await reportRes.json());
      if (txRes.ok) setRecent(await txRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setRecent(prev => prev.filter(t => t.id !== id));
      toast.success('Deleted');
      // Refresh summary
      const r = await fetch('/api/reports');
      if (r.ok) setSummary(await r.json());
    } catch { toast.error('Failed to delete'); }
    finally { setDeletingId(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your financial overview</p>
      </div>

      {/* ── Spending Summary Cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Today */}
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CalendarDays className="w-3.5 h-3.5" /> Today
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <p className="text-xs text-red-500">Expense</p>
              <p className="text-base font-semibold">{fmt(summary?.todayExpense ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-green-500">Income</p>
              <p className="text-base font-semibold">{fmt(summary?.todayIncome ?? 0)}</p>
            </div>
          </div>
        </div>

        {/* This Month */}
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CalendarRange className="w-3.5 h-3.5" /> This Month
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <p className="text-xs text-red-500">Expense</p>
              <p className="text-base font-semibold">{fmt(summary?.monthExpense ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-green-500">Income</p>
              <p className="text-base font-semibold">{fmt(summary?.monthIncome ?? 0)}</p>
            </div>
          </div>
        </div>

        {/* All Time */}
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock className="w-3.5 h-3.5" /> All Time
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <p className="text-xs text-red-500">Expense</p>
              <p className="text-base font-semibold">{fmt(summary?.allTimeExpense ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-green-500">Income</p>
              <p className="text-base font-semibold">{fmt(summary?.allTimeIncome ?? 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/add"
          className="flex items-center justify-center gap-2 rounded-xl border bg-primary text-primary-foreground p-3 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <PlusCircle className="w-4 h-4" /> Add Transaction
        </Link>
        <Link
          href="/statements"
          className="flex items-center justify-center gap-2 rounded-xl border bg-card p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <FileText className="w-4 h-4" /> Upload Statement
        </Link>
      </div>

      {/* ── Recent Transactions ───────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Recent Transactions</h2>
          <Link href="/statements" className="text-xs text-primary hover:underline">View all →</Link>
        </div>

        {recent.length === 0 ? (
          <div className="text-center p-6 rounded-xl border bg-muted/20">
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card group">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  t.type === 'EXPENSE' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
                }`}>
                  {t.type === 'EXPENSE' ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.description || '-'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}{t.bank}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${t.type === 'EXPENSE' ? 'text-red-500' : 'text-green-500'}`}>
                    {t.type === 'EXPENSE' ? '-' : '+'}{fmt(t.amount)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={deletingId === t.id}
                  className="p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50 shrink-0"
                >
                  {deletingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

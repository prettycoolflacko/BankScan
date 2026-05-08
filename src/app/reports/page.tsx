'use client';

import { useEffect, useState } from 'react';
import { Loader2, TrendingDown, TrendingUp, CalendarDays, CalendarRange, Clock } from 'lucide-react';

type ReportData = {
  todayExpense: number;
  todayIncome: number;
  monthExpense: number;
  monthIncome: number;
  allTimeExpense: number;
  allTimeIncome: number;
  monthlyBreakdown: { month: string; expense: number; income: number }[];
  topExpenses: { description: string; amount: number; date: string; category: string | null }[];
  categoryBreakdown: { category: string; amount: number }[];
};

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function fmtShort(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/reports');
        if (res.ok) setData(await res.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-muted-foreground text-sm">Failed to load reports.</div>
    );
  }

  // Chart scaling
  const chartMax = Math.max(
    ...data.monthlyBreakdown.map(m => Math.max(m.expense, m.income)),
    1
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Your spending insights and trends</p>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard icon={CalendarDays} label="Today" expense={data.todayExpense} income={data.todayIncome} />
        <SummaryCard icon={CalendarRange} label="Month" expense={data.monthExpense} income={data.monthIncome} />
        <SummaryCard icon={Clock} label="All Time" expense={data.allTimeExpense} income={data.allTimeIncome} />
      </div>

      {/* ── Monthly Bar Chart ─────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold mb-4">Monthly Overview (Last 6 Months)</h2>
        <div className="space-y-3">
          {data.monthlyBreakdown.map(m => {
            const [y, mo] = m.month.split('-');
            const label = `${MONTH_LABELS[mo]} ${y}`;
            const expPct = chartMax > 0 ? (m.expense / chartMax) * 100 : 0;
            const incPct = chartMax > 0 ? (m.income / chartMax) * 100 : 0;

            return (
              <div key={m.month}>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span className="font-medium">{label}</span>
                  <div className="flex gap-3">
                    <span className="text-red-500">-{fmtShort(m.expense)}</span>
                    <span className="text-green-500">+{fmtShort(m.income)}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(expPct, 0.5)}%` }}
                    />
                  </div>
                  <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(incPct, 0.5)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Expense</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Income</span>
        </div>
      </div>

      {/* ── Category Breakdown ────────────────────────────────── */}
      {data.categoryBreakdown.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Spending by Category</h2>
          <div className="space-y-2">
            {data.categoryBreakdown.map((c, i) => {
              const pct = data.allTimeExpense > 0 ? (c.amount / data.allTimeExpense) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="font-medium truncate">{c.category}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">{fmt(c.amount)}</span>
                  </div>
                  <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Top Expenses ──────────────────────────────────────── */}
      {data.topExpenses.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Top Expenses</h2>
          <div className="space-y-2">
            {data.topExpenses.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    {t.category && ` · ${t.category}`}
                  </p>
                </div>
                <p className="text-sm font-semibold text-red-500 shrink-0">{fmt(t.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, expense, income }: {
  icon: any; label: string; expense: number; income: number;
}) {
  return (
    <div className="rounded-xl border bg-card p-3 space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div>
        <p className="text-[10px] text-red-500 leading-none mb-0.5">Expense</p>
        <p className="text-xs font-semibold leading-tight">{fmt(expense)}</p>
      </div>
      <div>
        <p className="text-[10px] text-green-500 leading-none mb-0.5">Income</p>
        <p className="text-xs font-semibold leading-tight">{fmt(income)}</p>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AddTransactionPage() {
  const router = useRouter();
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const formatPreview = (val: string) => {
    const num = parseFloat(val.replace(/[^0-9]/g, ''));
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !date) {
      toast.error('Please fill in all required fields.');
      return;
    }

    const numericAmount = parseFloat(amount.replace(/[^0-9]/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/transactions/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numericAmount,
          type,
          description: description.trim(),
          date,
          category: category.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to add transaction');
      }

      setSuccess(true);
      toast.success('Transaction added!');

      // Reset after a moment
      setTimeout(() => {
        setSuccess(false);
        setAmount('');
        setDescription('');
        setCategory('');
        setDate(new Date().toISOString().split('T')[0]);
      }, 1500);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Add Transaction</h1>
        <p className="text-sm text-muted-foreground">Manually record an expense or income</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Type Toggle ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('EXPENSE')}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
              type === 'EXPENSE'
                ? 'bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20'
                : 'bg-card text-muted-foreground hover:bg-muted/50'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setType('INCOME')}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
              type === 'INCOME'
                ? 'bg-green-500 text-white border-green-500 shadow-md shadow-green-500/20'
                : 'bg-card text-muted-foreground hover:bg-muted/50'
            }`}
          >
            Income
          </button>
        </div>

        {/* ── Amount ───────────────────────────────────────────── */}
        <div>
          <label className="text-sm font-medium block mb-1.5">Amount (Rp) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              className="w-full pl-10 pr-4 py-3 text-lg font-semibold rounded-xl border bg-card focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>
          {amount && (
            <p className="text-xs text-muted-foreground mt-1">Rp {formatPreview(amount)}</p>
          )}
        </div>

        {/* ── Description ──────────────────────────────────────── */}
        <div>
          <label className="text-sm font-medium block mb-1.5">Description *</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Lunch at warung, Salary, Grab ride..."
            className="w-full px-4 py-3 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          />
        </div>

        {/* ── Date ─────────────────────────────────────────────── */}
        <div>
          <label className="text-sm font-medium block mb-1.5">Date *</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            required
          />
        </div>

        {/* ── Category (optional) ──────────────────────────────── */}
        <div>
          <label className="text-sm font-medium block mb-1.5">
            Category <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="e.g. Food, Transport, Salary..."
            className="w-full px-4 py-3 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* ── Submit ────────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={submitting || success}
          className={`w-full flex items-center justify-center gap-2 p-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-70 ${
            success
              ? 'bg-green-500 text-white'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
          ) : success ? (
            <><CheckCircle2 className="w-4 h-4" /> Added!</>
          ) : (
            `Add ${type === 'EXPENSE' ? 'Expense' : 'Income'}`
          )}
        </button>
      </form>
    </div>
  );
}

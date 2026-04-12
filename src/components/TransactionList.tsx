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

interface TransactionListProps {
  refreshTrigger: number;
}

export function TransactionList({ refreshTrigger }: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        setLoading(true);
        setError(null);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const res = await fetch('/api/transactions', {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setTransactions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    }

    fetchTransactions();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Loading transactions…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 border rounded-xl bg-destructive/5 border-destructive/20">
        <p className="text-sm font-medium text-destructive">Failed to load transactions</p>
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
        <p className="text-xs text-muted-foreground mt-1">Check that your Supabase environment variables are set in .env.local</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center p-8 border rounded-xl bg-muted/20">
        <p className="text-sm text-muted-foreground">No transactions yet. Upload a receipt to begin.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">
                {new Date(t.date).toLocaleDateString()}
              </TableCell>
              <TableCell>{t.bank}</TableCell>
              <TableCell className="max-w-[200px] truncate" title={t.description}>
                {t.description || '-'}
              </TableCell>
              <TableCell className="text-right font-medium">
                {new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: t.currency || 'IDR',
                }).format(t.amount)}
              </TableCell>
              <TableCell className="text-right">
                <Badge variant={t.type === 'INCOME' ? 'default' : 'destructive'} className={t.type === 'INCOME' ? 'bg-green-500 hover:bg-green-600' : ''}>
                  {t.type}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

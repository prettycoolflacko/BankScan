'use client';

import { useEffect, useState } from 'react';
import { Trash2, FileText, Loader2, Info, TrendingDown, TrendingUp, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface Statement {
  id: string;
  filename: string;
  classifier: string;
  created_at: string;
  transactionCount: number;
  totalExpense: number;
  totalIncome: number;
}

interface StatementListProps {
  refreshTrigger: number;
  onStatementsChanged: () => void;
  selectedStatementId: string | null;
  onSelectStatement: (id: string | null) => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

export function StatementList({ refreshTrigger, onStatementsChanged, selectedStatementId, onSelectStatement }: StatementListProps) {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchStatements();
  }, [refreshTrigger]);

  const fetchStatements = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/statements');
      if (!res.ok) throw new Error('Failed to fetch statements');
      const data = await res.json();
      setStatements(data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load past statements');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, filename: string) => {
    e.stopPropagation(); // Don't trigger selection
    if (!confirm(`Delete "${filename}" and all its transactions?`)) return;

    setIsDeleting(id);
    try {
      const res = await fetch(`/api/statements/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to delete');
      }
      toast.success(`${filename} deleted`);
      if (selectedStatementId === id) onSelectStatement(null);
      onStatementsChanged();
      fetchStatements();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSelect = (id: string) => {
    onSelectStatement(selectedStatementId === id ? null : id);
  };

  // Compute grand totals
  const grandTotalExpense = statements.reduce((sum, s) => sum + s.totalExpense, 0);
  const grandTotalIncome = statements.reduce((sum, s) => sum + s.totalIncome, 0);
  const grandTotalTransactions = statements.reduce((sum, s) => sum + s.transactionCount, 0);

  if (isLoading) {
    return (
      <div className="flex justify-center p-6 border rounded-xl bg-card">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (statements.length === 0) {
    return (
      <div className="text-center p-6 border rounded-xl bg-card text-muted-foreground">
        <Info className="w-6 h-6 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No statements uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Grand totals summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 border rounded-lg bg-red-500/5 border-red-500/20">
          <div className="flex items-center gap-1.5 text-red-500 mb-1">
            <TrendingDown className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Total Expense</span>
          </div>
          <p className="text-sm font-semibold">{formatCurrency(grandTotalExpense)}</p>
        </div>
        <div className="p-3 border rounded-lg bg-green-500/5 border-green-500/20">
          <div className="flex items-center gap-1.5 text-green-500 mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Total Income</span>
          </div>
          <p className="text-sm font-semibold">{formatCurrency(grandTotalIncome)}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {statements.length} statement{statements.length !== 1 ? 's' : ''} · {grandTotalTransactions} transaction{grandTotalTransactions !== 1 ? 's' : ''}
      </p>

      {/* Statements list */}
      <div className="border rounded-xl bg-card overflow-hidden">
        {/* "Show All" option */}
        <button
          onClick={() => onSelectStatement(null)}
          className={`w-full p-3 text-left text-sm font-medium flex items-center gap-2 transition-colors border-b ${
            selectedStatementId === null
              ? 'bg-primary/5 text-primary'
              : 'hover:bg-muted/30 text-muted-foreground'
          }`}
        >
          <FileText className="w-4 h-4" />
          All Statements
          <span className="ml-auto text-xs opacity-70">{grandTotalTransactions} txns</span>
        </button>

        <div className="divide-y">
          {statements.map((stmt) => {
            const isSelected = selectedStatementId === stmt.id;
            return (
              <div
                key={stmt.id}
                onClick={() => handleSelect(stmt.id)}
                className={`p-4 cursor-pointer transition-colors ${
                  isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-none truncate">{stmt.filename}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                          {stmt.classifier.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {stmt.transactionCount} txns
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, stmt.id, stmt.filename)}
                    disabled={isDeleting === stmt.id}
                    className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50 shrink-0"
                    title="Delete statement and its transactions"
                  >
                    {isDeleting === stmt.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Inline expense/income for this statement */}
                {isSelected && (
                  <div className="mt-3 ml-7 grid grid-cols-2 gap-2">
                    <div className="text-xs">
                      <span className="text-red-500">Expense: </span>
                      <span className="font-medium">{formatCurrency(stmt.totalExpense)}</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-green-500">Income: </span>
                      <span className="font-medium">{formatCurrency(stmt.totalIncome)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

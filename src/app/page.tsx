'use client';

import { useState } from 'react';
import { UploadZone } from '@/components/UploadZone';
import { TransactionList } from '@/components/TransactionList';
import { StatementList } from '@/components/StatementList';
import { Wallet } from 'lucide-react';

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);

  const refresh = () => setRefreshTrigger(prev => prev + 1);

  return (
    <main className="container max-w-5xl mx-auto py-8 px-4 space-y-8">
      <header className="flex items-center space-x-3 pb-6 border-b">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Wallet className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">BankScan</h1>
          <p className="text-sm text-muted-foreground">Smart financial tracker powered by local PDF parsing</p>
        </div>
      </header>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1 space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Upload e-Statement</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Drop your Bank Mandiri PDF e-statement below to automatically extract and save the transactions locally.
            </p>
            <UploadZone onUploadSuccess={refresh} />
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Uploaded Statements</h2>
            <StatementList
              refreshTrigger={refreshTrigger}
              onStatementsChanged={refresh}
              selectedStatementId={selectedStatementId}
              onSelectStatement={setSelectedStatementId}
            />
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-4">
              {selectedStatementId ? 'Statement Transactions' : 'All Transactions'}
            </h2>
            <TransactionList
              refreshTrigger={refreshTrigger}
              selectedStatementId={selectedStatementId}
              onDataChanged={refresh}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

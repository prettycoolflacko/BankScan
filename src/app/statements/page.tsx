'use client';

import { useState } from 'react';
import { UploadZone } from '@/components/UploadZone';
import { TransactionList } from '@/components/TransactionList';
import { StatementList } from '@/components/StatementList';

export default function StatementsPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);

  const refresh = () => setRefreshTrigger(prev => prev + 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Statements</h1>
        <p className="text-sm text-muted-foreground">Upload e-statements or browse imported transactions</p>
      </div>

      {/* Upload */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Upload e-Statement</h2>
        <UploadZone onUploadSuccess={refresh} />
      </div>

      {/* Statement List */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Uploaded Statements</h2>
        <StatementList
          refreshTrigger={refreshTrigger}
          onStatementsChanged={refresh}
          selectedStatementId={selectedStatementId}
          onSelectStatement={setSelectedStatementId}
        />
      </div>

      {/* Transactions */}
      <div>
        <h2 className="text-sm font-semibold mb-3">
          {selectedStatementId ? 'Statement Transactions' : 'All Transactions'}
        </h2>
        <TransactionList
          refreshTrigger={refreshTrigger}
          selectedStatementId={selectedStatementId}
          onDataChanged={refresh}
        />
      </div>
    </div>
  );
}

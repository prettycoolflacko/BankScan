import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch statements
    const { data: statements, error } = await supabaseServer
      .from('statements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed fetching statements:', error);
      return NextResponse.json({ error: 'Failed fetching statements' }, { status: 500 });
    }

    // For each statement, get transaction count + expense/income totals
    const enriched = await Promise.all(
      (statements || []).map(async (stmt) => {
        const { data: txns } = await supabaseServer
          .from('transactions')
          .select('amount, type')
          .eq('statement_id', stmt.id);

        const transactionCount = txns?.length || 0;
        const totalExpense = txns
          ?.filter((t) => t.type === 'EXPENSE')
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        const totalIncome = txns
          ?.filter((t) => t.type === 'INCOME')
          .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

        return {
          ...stmt,
          transactionCount,
          totalExpense,
          totalIncome,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (err) {
    console.error('Statements API Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

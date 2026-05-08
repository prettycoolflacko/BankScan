import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    // Fetch ALL transactions — try with category column, fall back without
    let result: any = await supabaseServer
      .from('transactions')
      .select('date, amount, type, description, category')
      .order('date', { ascending: false });

    // If category column doesn't exist yet, retry without it
    if (result.error?.message?.includes('category')) {
      result = await supabaseServer
        .from('transactions')
        .select('date, amount, type, description')
        .order('date', { ascending: false });
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    const allTx = result.data;

    const txns: any[] = allTx || [];

    // Today
    const todayTx = txns.filter(t => t.date === todayStr);
    const todayExpense = todayTx.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);
    const todayIncome = todayTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);

    // This month
    const monthTx = txns.filter(t => t.date >= monthStart);
    const monthExpense = monthTx.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);
    const monthIncome = monthTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);

    // All time
    const allTimeExpense = txns.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);
    const allTimeIncome = txns.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);

    // Monthly breakdown (last 6 months)
    const monthlyMap = new Map<string, { expense: number; income: number }>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, { expense: 0, income: 0 });
    }

    for (const t of txns) {
      const key = t.date.substring(0, 7); // YYYY-MM
      const entry = monthlyMap.get(key);
      if (entry) {
        if (t.type === 'EXPENSE') entry.expense += Number(t.amount);
        else entry.income += Number(t.amount);
      }
    }

    const monthlyBreakdown = Array.from(monthlyMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .reverse(); // oldest first

    // Top 10 expenses
    const topExpenses = txns
      .filter(t => t.type === 'EXPENSE')
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 10)
      .map(t => ({ description: t.description, amount: Number(t.amount), date: t.date, category: (t as any).category ?? null }));

    // Category breakdown (expenses only)
    const categoryMap = new Map<string, number>();
    for (const t of txns.filter(x => x.type === 'EXPENSE')) {
      const cat = (t as any).category || 'Uncategorized';
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(t.amount));
    }
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      todayExpense, todayIncome,
      monthExpense, monthIncome,
      allTimeExpense, allTimeIncome,
      monthlyBreakdown,
      topExpenses,
      categoryBreakdown,
    });
  } catch (err) {
    console.error('Reports API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

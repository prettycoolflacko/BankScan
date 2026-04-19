import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const statementId = searchParams.get('statement_id');

    let query = supabaseServer
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    // Filter by statement if specified
    if (statementId) {
      query = query.eq('statement_id', statementId);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const { data: transactions, error } = await query.abortSignal(controller.signal);
    clearTimeout(timeoutId);

    if (error) {
      console.error('[transactions] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(transactions ?? []);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('abort')) {
      return NextResponse.json({ error: 'Database request timed out (>25s). Check your Supabase connection.' }, { status: 504 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE all transactions (or filtered by statement_id)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const statementId = searchParams.get('statement_id');

    if (statementId) {
      const { error } = await supabaseServer
        .from('transactions')
        .delete()
        .eq('statement_id', statementId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // Delete ALL — cascade via statements table
      const { error: stmtError } = await supabaseServer
        .from('statements')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (stmtError) console.error('Failed to delete statements:', stmtError);

      // Also delete orphan transactions without statement_id
      const { error } = await supabaseServer
        .from('transactions')
        .delete()
        .is('statement_id', null);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST with body { ids: string[] } — bulk delete selected transactions
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ids: string[] = body?.ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from('transactions')
      .delete()
      .in('id', ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

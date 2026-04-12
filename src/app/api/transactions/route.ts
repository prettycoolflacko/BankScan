import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[transactions] Fetching from Supabase...');
    console.log('[transactions] URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

    // Add a timeout wrapping the Supabase call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const { data: transactions, error } = await supabaseServer
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .abortSignal(controller.signal);

    clearTimeout(timeoutId);

    if (error) {
      console.error('[transactions] Supabase error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    console.log('[transactions] Got', transactions?.length ?? 0, 'results');
    return NextResponse.json(transactions ?? []);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[transactions] Catch error:', message);

    if (message.includes('abort')) {
      return NextResponse.json(
        { error: 'Database request timed out. Check your Supabase connection.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

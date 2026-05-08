import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const { id } = p;

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete transaction:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete Transaction Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

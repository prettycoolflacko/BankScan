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
      return NextResponse.json({ error: 'Statement ID is required' }, { status: 400 });
    }

    // Rely on CASCADE to delete related transactions if configured,
    // otherwise the backend delete would just delete the statement.
    // If the database has cascade setup properly, this implies clearing the statement clears transactions.
    const { error: stmtError } = await supabaseServer
      .from('statements')
      .delete()
      .eq('id', id);

    if (stmtError) {
      console.error('Failed to delete statement:', stmtError);
      return NextResponse.json({ error: 'Database error while deleting statement' }, { status: 500 });
    }

    // Since we set up ON DELETE CASCADE for statement_id in the transactions table, 
    // we don't have to manually delete the transactions. The DB does it for us!

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete Statement Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

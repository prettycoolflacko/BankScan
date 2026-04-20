import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, type, description, date, category } = body;

    if (!amount || !type || !description || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, type, description, date' },
        { status: 400 }
      );
    }

    if (!['INCOME', 'EXPENSE'].includes(type)) {
      return NextResponse.json({ error: 'Type must be INCOME or EXPENSE' }, { status: 400 });
    }

    const numericAmount = parseFloat(String(amount).replace(/[^0-9.]/g, ''));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    const record: Record<string, any> = {
      amount: numericAmount,
      type,
      description: description.trim(),
      date,
      currency: 'IDR',
      bank: 'Manual',
      statement_id: null,
    };

    // Try inserting with category (may fail if column doesn't exist yet)
    if (category?.trim()) record.category = category.trim();

    let result = await supabaseServer.from('transactions').insert(record).select().single();

    // If category column doesn't exist yet, retry without it
    if (result.error?.message?.includes('category')) {
      delete record.category;
      result = await supabaseServer.from('transactions').insert(record).select().single();
    }

    if (result.error) {
      console.error('Manual insert error:', result.error);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (err) {
    console.error('Manual transaction error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

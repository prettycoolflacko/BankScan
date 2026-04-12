import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const TransactionSchema = z.object({
  date: z.string().describe("ISO 8601 date string of the transaction (YYYY-MM-DD)"),
  amount: z.number().describe("The transfer amount strictly as a number without currency symbols"),
  currency: z.string().describe("Currency code, e.g., IDR, USD"),
  bank: z.string().describe("Source of the money: e.g. Mandiri, BCA, ShopeePay, GoPay"),
  type: z.enum(['INCOME', 'EXPENSE']).describe("Whether money is moving in (INCOME) or out (EXPENSE) of the user's perspective. Assume typical user is the one displaying the receipt."),
  description: z.string().describe("Any available note, destination, or description from the receipt"),
});

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Call Gemini to analyze the image
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
      Analyze this image which is a financial transaction screenshot (could be from a bank like Livin' by Mandiri, BCA, or an e-money wallet like ShopeePay, GoPay, etc).
      Extract the transaction details into JSON. 
      Respond strictly with valid JSON matching this schema, completely without markdown formatting:
      {
        "date": "YYYY-MM-DD",
        "amount": 100000,
        "currency": "IDR",
        "bank": "Bank Name or Wallet Name",
        "type": "INCOME or EXPENSE",
        "description": "Details like target/source name or transaction title"
      }
    `;

    const imageParts = [
      {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType: file.type,
        },
      },
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const textOutput = response.text().trim().replace(/```json/g, '').replace(/```/g, '');

    // Validate structured output
    const rawJson = JSON.parse(textOutput);
    const parsedData = TransactionSchema.parse(rawJson);

    // Insert into Supabase
    const { data: dbData, error } = await supabaseServer
      .from('transactions')
      .insert([{
        date: parsedData.date,
        amount: parsedData.amount,
        currency: parsedData.currency,
        bank: parsedData.bank,
        type: parsedData.type,
        description: parsedData.description
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to insert to database' }, { status: 500 });
    }

    return NextResponse.json(dbData);
  } catch (error: unknown) {
    console.error('Extraction error:', error);

    // Surface the real error message (e.g. 429 quota, 404 model not found)
    let message = 'Failed to process file';
    let status = 500;

    if (error && typeof error === 'object' && 'message' in error) {
      const msg = (error as { message: string }).message;
      message = msg;

      if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
        status = 429;
        message = 'Gemini API quota exceeded. Please wait a minute and try again, or check your billing at https://ai.dev/rate-limit';
      } else if (msg.includes('404')) {
        status = 404;
        message = 'Gemini model not found. Check your GEMINI_API_KEY and model name.';
      }
    }

    return NextResponse.json({ error: message }, { status });
  }
}

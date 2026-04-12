import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
// @ts-ignore
import PDFParser from 'pdf2json';

/**
 * Safely decode URI-encoded text from pdf2json.
 * Falls back to the original string if decoding fails.
 */
function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    // Replace common URI-encoded characters manually
    return text
      .replace(/%20/g, ' ')
      .replace(/%2C/g, ',')
      .replace(/%2F/g, '/')
      .replace(/%27/g, "'")
      .replace(/%28/g, '(')
      .replace(/%29/g, ')')
      .replace(/%3A/g, ':')
      .replace(/%2D/g, '-')
      .replace(/%26/g, '&')
      .replace(/%23/g, '#')
      .replace(/%2E/g, '.')
      .replace(/%25/g, '%');
  }
}

async function parsePDFText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);
    
    pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', () => {
      resolve(pdfParser.getRawTextContent());
    });
    
    pdfParser.parseBuffer(buffer);
  });
}

/**
 * Parse DD-MMM-YY (e.g. "22-Feb-26") to a YYYY-MM-DD ISO date string.
 */
function parseDate(dateStr: string): string {
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04',
    May: '05', Jun: '06', Jul: '07', Aug: '08',
    Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  };

  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date().toISOString().split('T')[0];

  const day = parts[0].padStart(2, '0');
  const month = months[parts[1]] || '01';
  let year = parseInt(parts[2], 10);
  // Convert 2-digit year: 00-49 -> 2000s, 50-99 -> 1900s
  year = year < 50 ? 2000 + year : 1900 + year;

  return `${year}-${month}-${day}`;
}

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Please upload a valid PDF file' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extract raw text
    const rawText = await parsePDFText(buffer);
    
    // Decode the text safely
    const text = safeDecode(rawText);

    // DEBUG: Log the first 3000 chars so we can see the actual structure
    console.log('=== PDF RAW TEXT (first 3000 chars) ===');
    console.log(text.substring(0, 3000));
    console.log('=== END PDF TEXT ===');

    const transactions = [];

    // Split by various newline patterns pdf2json may use
    const lines = text.split(/\r?\n/);

    console.log(`Total lines: ${lines.length}`);

    // Regex patterns for Mandiri Credit Card Statement
    // Format: "22-Feb-26  22-Feb-26  POWER CASH SEPTEMBER 2025 093006  1,166,666.00"
    // With optional CR at the end for credit/income entries
    // The regex is flexible with whitespace between columns
    const lineRegex = /(\d{2}-[A-Za-z]{3}-\d{2})\s+(\d{2}-[A-Za-z]{3}-\d{2})\s+(.+?)\s+([\d,.]+\.\d{2})\s*(CR)?\s*$/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const match = line.match(lineRegex);
      if (match) {
        const txnDate = match[1];
        const description = match[3].trim();
        const amountStr = match[4];
        const isCr = !!match[5];

        const amount = parseFloat(amountStr.replace(/,/g, ''));
        const type = isCr ? 'INCOME' : 'EXPENSE';
        const isoDate = parseDate(txnDate);

        // Skip zero-amount entries (e.g. BUNGA CICILAN = 0.00)
        if (amount === 0) continue;

        console.log(`  MATCH [${i}]: ${txnDate} | ${description} | ${amount} | ${type}`);

        transactions.push({
          date: isoDate,
          amount,
          currency: 'IDR',
          bank: 'Mandiri',
          type,
          description
        });
      }
    }

    console.log(`Found ${transactions.length} transactions`);

    if (transactions.length === 0) {
      return NextResponse.json({ 
        error: 'Could not detect any transactions in this PDF. Check the server console for raw text output to debug.' 
      }, { status: 400 });
    }

    // Insert into Supabase
    const { data: dbData, error } = await supabaseServer
      .from('transactions')
      .insert(transactions)
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: 'Failed to insert to database: ' + error.message }, { status: 500 });
    }

    return NextResponse.json(dbData);
  } catch (error: unknown) {
    console.error('Extraction error:', error);
    let message = 'Failed to process PDF';
    if (error && typeof error === 'object' && 'message' in error) {
      message = (error as { message: string }).message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
// @ts-ignore
import PDFParser from 'pdf2json';

/**
 * Safely decode URI-encoded text from pdf2json.
 */
function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
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
    const text = safeDecode(rawText);

    console.log(`Total lines: ${text.split(/\r?\n/).length}`);

    // CLASSIFICATION LOGIC
    let classifier = 'UNKNOWN';
    const textUpper = text.toUpperCase();
    
    if (textUpper.includes('LEMBAR TAGIHAN KARTU KREDIT') && textUpper.includes('MANDIRI')) {
      classifier = 'MANDIRI_CREDIT_CARD';
    } 
    // Add additional bank classifiers here when needed:
    // else if (textUpper.includes('BCA') && textUpper.includes('E-STATEMENT')) {
    //   classifier = 'BCA_STATEMENT';
    // }

    // 1. Insert into statements table first
    const { data: statementData, error: statementError } = await supabaseServer
      .from('statements')
      .insert({
        filename: file.name,
        classifier: classifier
      })
      .select('id')
      .single();

    if (statementError || !statementData) {
      console.error('Failed to create statement record:', statementError);
      return NextResponse.json({ error: 'Failed to create statement record' }, { status: 500 });
    }

    const statementId = statementData.id;
    const transactions = [];
    const lines = text.split(/\r?\n/);

    if (classifier === 'MANDIRI_CREDIT_CARD') {
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

          if (amount === 0) continue;

          transactions.push({
            date: isoDate,
            amount,
            currency: 'IDR',
            bank: 'Mandiri',
            type,
            description,
            statement_id: statementId // Link to the statement!
          });
        }
      }
    } else {
      // If we don't recognize it, we delete the statement record we just created
      await supabaseServer.from('statements').delete().eq('id', statementId);
      return NextResponse.json({ 
        error: 'Unsupported PDF format. Currently only Mandiri Credit Card e-statements are supported.' 
      }, { status: 400 });
    }

    console.log(`Found ${transactions.length} transactions`);

    if (transactions.length === 0) {
      // Clean up statement record if empty
      await supabaseServer.from('statements').delete().eq('id', statementId);
      return NextResponse.json({ 
        error: 'Could not detect any transactions in this PDF. It was recognized but format may have changed.' 
      }, { status: 400 });
    }

    // 2. Insert mapped transactions into Supabase
    const { error: txError } = await supabaseServer
      .from('transactions')
      .insert(transactions);

    if (txError) {
      console.error('Supabase error inserting tx:', txError);
      // Clean up statement record
      await supabaseServer.from('statements').delete().eq('id', statementId);
      return NextResponse.json({ error: 'Failed to insert transactions to database: ' + txError.message }, { status: 500 });
    }

    // Respond successfully
    return NextResponse.json({ 
      success: true, 
      statementId, 
      transactionCount: transactions.length 
    });

  } catch (error: unknown) {
    console.error('Extraction error:', error);
    let message = 'Failed to process PDF';
    if (error && typeof error === 'object' && 'message' in error) {
      message = (error as { message: string }).message;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

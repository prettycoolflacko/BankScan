import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
// @ts-ignore
import PDFParser from 'pdf2json';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execFileAsync = promisify(execFile);

// ─── PDF helpers ──────────────────────────────────────────────────────────────

function isPDFEncrypted(buffer: Buffer): boolean {
  const str = buffer.toString('latin1');
  return str.includes('/Encrypt');
}

async function decryptWithQpdf(buffer: Buffer, password: string): Promise<Buffer<ArrayBuffer>> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'bankscan-'));
  const inputPath = join(tmpDir, 'input.pdf');
  const outputPath = join(tmpDir, 'output.pdf');
  try {
    await writeFile(inputPath, buffer);
    await execFileAsync('qpdf', ['--password=' + password, '--decrypt', inputPath, outputPath]);
    const raw = await readFile(outputPath);
    const out = Buffer.allocUnsafe(raw.byteLength) as Buffer<ArrayBuffer>;
    raw.copy(out);
    return out;
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

async function isQpdfAvailable(): Promise<boolean> {
  try { await execFileAsync('qpdf', ['--version']); return true; }
  catch { return false; }
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text
      .replace(/%20/g, ' ').replace(/%2C/g, ',').replace(/%2F/g, '/')
      .replace(/%27/g, "'").replace(/%28/g, '(').replace(/%29/g, ')')
      .replace(/%3A/g, ':').replace(/%2D/g, '-').replace(/%26/g, '&')
      .replace(/%23/g, '#').replace(/%2E/g, '.').replace(/%25/g, '%');
  }
}

async function parsePDFText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);
    pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
    pdfParser.on('pdfParser_dataReady', () => resolve(pdfParser.getRawTextContent()));
    pdfParser.parseBuffer(buffer);
  });
}

// ─── Date parsers ─────────────────────────────────────────────────────────────

/** Parses DD-MMM-YY (credit card) → YYYY-MM-DD */
function parseCCDate(dateStr: string): string {
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04',
    May: '05', Jun: '06', Jul: '07', Aug: '08',
    Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date().toISOString().split('T')[0];
  const day = parts[0].padStart(2, '0');
  const month = months[parts[1]] || '01';
  let year = parseInt(parts[2], 10);
  year = year < 50 ? 2000 + year : 1900 + year;
  return `${year}-${month}-${day}`;
}

/** Parses DD Mon YYYY (savings/tabungan) → YYYY-MM-DD */
function parseSavingsDate(day: string, mon: string, year: string): string {
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04',
    Mei: '05', May: '05', Jun: '06', Jul: '07',
    Agu: '08', Aug: '08', Sep: '09', Okt: '10',
    Oct: '10', Nov: '11', Des: '12', Dec: '12',
  };
  const m = months[mon] || months[mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase()] || '01';
  return `${year}-${m}-${day.padStart(2, '0')}`;
}

/** Parse Indonesian amount string (e.g. "175.000,00") → number */
function parseIDRAmount(amountStr: string): number {
  // Indonesian format: dots = thousands separators, comma = decimal separator
  return parseFloat(amountStr.replace(/\./g, '').replace(',', '.'));
}

// ─── Transaction parsers ───────────────────────────────────────────────────────

/**
 * Parser for Mandiri Credit Card (Lembar Tagihan Kartu Kredit)
 * Line format: DD-MMM-YY  DD-MMM-YY  DESCRIPTION  AMOUNT [CR]
 */
function parseMandiriCreditCard(lines: string[], statementId: string) {
  const transactions: any[] = [];
  const lineRegex = /(\d{2}-[A-Za-z]{3}-\d{2})\s+(\d{2}-[A-Za-z]{3}-\d{2})\s+(.+?)\s+([\d,.]+\.\d{2})\s*(CR)?\s*$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(lineRegex);
    if (!match) continue;

    const amount = parseFloat(match[4].replace(/,/g, ''));
    if (amount === 0) continue;

    const isCr = !!match[5];
    transactions.push({
      date: parseCCDate(match[1]),
      amount,
      currency: 'IDR',
      bank: 'Mandiri',
      type: isCr ? 'INCOME' : 'EXPENSE',
      description: match[3].trim(),
      statement_id: statementId,
    });
  }
  return transactions;
}

/**
 * Parser for Mandiri Tabungan (Savings Account e-Statement)
 * The PDF renders as:
 *   [multi-line description]
 *   [balance][rownum]                                    [+/-][amount]
 *   [HH:MM:SS WIB]
 *   [DD Mon YYYY]
 */
function parseMandiriTabungan(lines: string[], statementId: string) {
  const transactions: any[] = [];

  // Matches the balance+rownum + amount line
  // e.g. "3.100.112,001                           +175.000,00"
  // The amount part is what we care about: [+-] followed by IDR-formatted number
  const amountLineRegex = /^\d{1,3}(?:\.\d{3})*,\d{2}\d+\s+([+-])(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;
  const dateRegex = /^(\d{2}) ([A-Za-z]{3}) (\d{4})$/;
  const timeRegex = /^\d{2}:\d{2}:\d{2} WIB$/;

  // First pass: find all amount lines and their indices
  type Entry = { lineIdx: number; amount: number; type: 'INCOME' | 'EXPENSE'; dateLineIdx: number; date: string };
  const entries: Entry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const m = line.match(amountLineRegex);
    if (!m) continue;

    const amount = parseIDRAmount(m[2]);
    if (amount === 0) continue;

    // Look forward for date line (skip time line)
    let date = '';
    let dateLineIdx = -1;
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const next = lines[j].trim();
      const dm = next.match(dateRegex);
      if (dm) {
        date = parseSavingsDate(dm[1], dm[2], dm[3]);
        dateLineIdx = j;
        break;
      }
    }
    if (!date) continue; // No date found, skip

    entries.push({
      lineIdx: i,
      amount,
      type: m[1] === '+' ? 'INCOME' : 'EXPENSE',
      dateLineIdx,
      date,
    });
  }

  // Second pass: extract descriptions
  for (let e = 0; e < entries.length; e++) {
    const entry = entries[e];
    const prevEndIdx = e > 0 ? entries[e - 1].dateLineIdx + 1 : 0;

    // Collect description lines between previous tx end and current amount line
    const descLines: string[] = [];
    for (let i = prevEndIdx; i < entry.lineIdx; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (timeRegex.test(line) || dateRegex.test(line)) continue;
      // Skip lines that look like headers/totals
      if (/^(No|Date|Tanggal|Keterangan|Nominal|Saldo|Balance|Amount|Remarks)$/i.test(line)) continue;
      descLines.push(line);
    }

    // Use the last 3 meaningful lines as description (most specific)
    const description = descLines.slice(-3).join(' ').trim().substring(0, 250);

    transactions.push({
      date: entry.date,
      amount: entry.amount,
      currency: 'IDR',
      bank: 'Mandiri',
      type: entry.type,
      description: description || 'Mandiri Transaction',
      statement_id: statementId,
    });
  }

  return transactions;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;
    const password = (data.get('password') as string | null) ?? '';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Please upload a valid PDF file' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);

    // Encryption check & decryption
    const encrypted = isPDFEncrypted(buffer);
    if (encrypted) {
      if (!password) {
        return NextResponse.json(
          { error: 'This PDF is password-protected.', code: 'PASSWORD_REQUIRED' },
          { status: 422 }
        );
      }
      const qpdfOk = await isQpdfAvailable();
      if (!qpdfOk) {
        return NextResponse.json(
          { error: 'PDF decryption requires qpdf. Run: sudo apt install qpdf', code: 'QPDF_MISSING' },
          { status: 503 }
        );
      }
      try {
        buffer = await decryptWithQpdf(buffer, password);
        console.log('[extract] PDF decrypted successfully via qpdf');
      } catch (err: any) {
        const isWrongPw = ((err?.message ?? '') + (err?.stderr ?? '')).toLowerCase().includes('invalid password');
        return NextResponse.json(
          { error: isWrongPw ? 'Wrong PDF password. Please try again.' : 'Failed to decrypt PDF.', code: isWrongPw ? 'WRONG_PASSWORD' : 'DECRYPT_FAILED' },
          { status: 422 }
        );
      }
    }

    // Extract text
    const rawText = await parsePDFText(buffer);
    const text = safeDecode(rawText);
    const lines = text.split(/\r?\n/);

    console.log('=== PDF TEXT SAMPLE (first 800 chars) ===');
    console.log(text.substring(0, 800));
    console.log(`Total lines: ${lines.length}`);

    // ── Classification ──────────────────────────────────────────────────────
    const textUpper = text.toUpperCase();
    const isMandiri = textUpper.includes('MANDIRI');

    // Credit Card signals
    const isCreditCard =
      textUpper.includes('KARTU KREDIT') ||
      textUpper.includes('CREDIT CARD') ||
      textUpper.includes('LEMBAR TAGIHAN') ||
      textUpper.includes('TAGIHAN BULAN');

    // Savings (Tabungan) signals
    const isTabungan =
      textUpper.includes('TABUNGAN') ||
      textUpper.includes('DANA MASUK') ||
      textUpper.includes('DANA KELUAR') ||
      textUpper.includes('SALDO AKHIR') ||
      textUpper.includes('E-STATEMENT');

    let classifier = 'UNKNOWN';
    if (isMandiri && isCreditCard) classifier = 'MANDIRI_CREDIT_CARD';
    else if (isMandiri && isTabungan) classifier = 'MANDIRI_TABUNGAN';

    console.log(`[extract] Classifier: ${classifier} (creditCard=${isCreditCard}, tabungan=${isTabungan})`);

    if (classifier === 'UNKNOWN') {
      return NextResponse.json({
        error: 'Unsupported PDF format. Supported: Mandiri Credit Card & Mandiri Tabungan e-statements.',
      }, { status: 400 });
    }

    // ── Insert statement record ──────────────────────────────────────────────
    const { data: statementData, error: statementError } = await supabaseServer
      .from('statements')
      .insert({ filename: file.name, classifier })
      .select('id')
      .single();

    if (statementError || !statementData) {
      console.error('Failed to create statement record:', statementError);
      return NextResponse.json({ error: 'Failed to create statement record' }, { status: 500 });
    }

    const statementId = statementData.id;

    // ── Parse transactions ───────────────────────────────────────────────────
    let transactions: any[] = [];
    if (classifier === 'MANDIRI_CREDIT_CARD') {
      transactions = parseMandiriCreditCard(lines, statementId);
    } else if (classifier === 'MANDIRI_TABUNGAN') {
      transactions = parseMandiriTabungan(lines, statementId);
    }

    console.log(`[extract] Found ${transactions.length} transactions`);

    if (transactions.length === 0) {
      await supabaseServer.from('statements').delete().eq('id', statementId);
      return NextResponse.json({
        error: 'No transactions detected. The PDF was recognized but the format may differ from expected.',
      }, { status: 400 });
    }

    // ── Save to Supabase ─────────────────────────────────────────────────────
    const { error: txError } = await supabaseServer
      .from('transactions')
      .insert(transactions);

    if (txError) {
      await supabaseServer.from('statements').delete().eq('id', statementId);
      return NextResponse.json({ error: 'Failed to save transactions: ' + txError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, statementId, transactionCount: transactions.length });

  } catch (error: unknown) {
    console.error('Extraction error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

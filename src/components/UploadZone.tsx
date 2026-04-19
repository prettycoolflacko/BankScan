'use client';

import { useRef, useState, type DragEvent } from 'react';
import { FileText, Loader2, Lock, KeyRound, X } from 'lucide-react';
import { toast } from 'sonner';

interface UploadZoneProps {
  onUploadSuccess: () => void;
}

type UploadState = 'idle' | 'uploading' | 'password_required' | 'unlocking';

export function UploadZone({ onUploadSuccess }: UploadZoneProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [wrongPassword, setWrongPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const submitFile = async (file: File, pw: string = '') => {
    const isUnlocking = pw !== '';
    setUploadState(isUnlocking ? 'unlocking' : 'uploading');
    setWrongPassword(false);

    const formData = new FormData();
    formData.append('file', file);
    if (pw) formData.append('password', pw);

    try {
      const response = await fetch('/api/extract', { method: 'POST', body: formData });
      const body = await response.json().catch(() => ({}));

      if (response.status === 422 && body?.code === 'PASSWORD_REQUIRED') {
        // PDF is encrypted — switch to password prompt
        setPendingFile(file);
        setUploadState('password_required');
        setTimeout(() => passwordInputRef.current?.focus(), 50);
        return;
      }

      if (response.status === 422 && body?.code === 'WRONG_PASSWORD') {
        setWrongPassword(true);
        setUploadState('password_required');
        setTimeout(() => passwordInputRef.current?.focus(), 50);
        return;
      }

      if (!response.ok) {
        throw new Error(body?.error || 'Upload failed');
      }

      toast.success(`PDF processed successfully!`);
      resetState();
      onUploadSuccess();
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : 'Failed to process PDF.';
      toast.error(msg);
      setUploadState('idle');
    }
  };

  const handleFile = (file: File) => {
    if (!file) return;
    setPendingFile(file);
    submitFile(file);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFile || !password.trim()) return;
    submitFile(pendingFile, password);
  };

  const resetState = () => {
    setUploadState('idle');
    setPendingFile(null);
    setPassword('');
    setWrongPassword(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClick = () => {
    if (uploadState === 'idle') fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      handleFile(file);
    } else {
      toast.error('Please upload a PDF e-statement.');
    }
  };

  // --- Password prompt UI ---
  if (uploadState === 'password_required' || uploadState === 'unlocking') {
    return (
      <div className="border-2 border-dashed rounded-xl p-6 border-amber-500/50 bg-amber-500/5">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
            <Lock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Password-protected PDF</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate" title={pendingFile?.name}>
              {pendingFile?.name}
            </p>
          </div>
          <button
            onClick={resetState}
            className="ml-auto p-1 text-muted-foreground hover:text-foreground rounded"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              PDF Password
            </label>
            <input
              ref={passwordInputRef}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter PDF password…"
              disabled={uploadState === 'unlocking'}
              className={`w-full text-sm px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 transition-colors ${
                wrongPassword ? 'border-red-500 focus:ring-red-500/30' : 'border-border'
              }`}
              autoComplete="current-password"
            />
            {wrongPassword && (
              <p className="text-xs text-red-500 mt-1">Incorrect password. Please try again.</p>
            )}
          </div>
          <button
            type="submit"
            disabled={!password.trim() || uploadState === 'unlocking'}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {uploadState === 'unlocking' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Unlocking…</>
            ) : (
              <><KeyRound className="w-4 h-4" /> Unlock & Process</>
            )}
          </button>
        </form>
      </div>
    );
  }

  // --- Normal upload UI ---
  const isUploading = uploadState === 'uploading';
  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleInputChange}
        className="hidden"
      />
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center p-12 text-center transition-colors border-2 border-dashed rounded-xl ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40'
        } ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isUploading ? (
          <Loader2 className="h-10 w-10 text-muted-foreground animate-spin mb-4" />
        ) : (
          <FileText className="h-10 w-10 text-muted-foreground mb-4" />
        )}

        {isUploading ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">Extracting data...</p>
            <p className="text-xs text-muted-foreground">Parsing PDF e-statement…</p>
          </div>
        ) : isDragging ? (
          <p className="text-sm font-medium">Drop the PDF here…</p>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium">Drag & drop a PDF e-statement</p>
            <p className="text-xs text-muted-foreground">
              or <span className="text-primary underline underline-offset-2">click to browse</span>
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Supports Bank Mandiri Credit Card Statements · Password-protected PDFs OK
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

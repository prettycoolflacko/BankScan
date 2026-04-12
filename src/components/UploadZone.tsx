'use client';

import { useRef, useState, type DragEvent } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UploadZoneProps {
  onUploadSuccess: () => void;
}

export function UploadZone({ onUploadSuccess }: UploadZoneProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || 'Upload failed');
      }

      toast.success('File processed successfully!');
      onUploadSuccess();
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : 'Failed to process image.';
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    } else {
      toast.error('Please upload an image file (PNG or JPG).');
    }
  };

  return (
    <div>
      {/* Hidden native file input — guaranteed to open Dolphin / system file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleInputChange}
        className="hidden"
      />

      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center p-12 text-center transition-colors border-2 border-dashed rounded-xl ${isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/40'
          } ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
      >
        {isUploading ? (
          <Loader2 className="h-10 w-10 text-muted-foreground animate-spin mb-4" />
        ) : (
          <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
        )}

        {isUploading ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">Extracting data...</p>
            <p className="text-xs text-muted-foreground">Gemini 1.5 Flash is processing your document…</p>
          </div>
        ) : isDragging ? (
          <p className="text-sm font-medium">Drop the image here…</p>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium">Drag & drop a screenshot</p>
            <p className="text-xs text-muted-foreground">
              or <span className="text-primary underline underline-offset-2">click to browse</span>
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Supports Bank Mandiri, BCA, ShopeePay, GoPay receipts (PNG/JPG)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import { RefreshCw, Upload } from 'lucide-react';
import type { ChangeEventHandler, DragEventHandler, RefObject } from 'react';

interface UploadDropZoneProps {
  isUploading: boolean;
  dragActive: boolean;
  uploadTypeLabel: string;
  fileInputRef: RefObject<HTMLInputElement>;
  onFileClick: () => void;
  onDragEnter: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onChange: ChangeEventHandler<HTMLInputElement>;
}

export default function UploadDropZone({
  isUploading,
  dragActive,
  uploadTypeLabel,
  fileInputRef,
  onFileClick,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
  onChange,
}: UploadDropZoneProps) {
  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`px-4 py-4 text-center border-t border-dashed transition-all ${
        isUploading
          ? 'bg-[color:rgba(44,53,97,0.07)] border-[color:rgba(44,53,97,0.22)] text-[var(--brand-primary)] animate-pulse'
          : dragActive
            ? 'bg-[color:rgba(44,53,97,0.06)] border-[color:rgba(44,53,97,0.22)] text-[var(--brand-primary)]'
            : 'bg-slate-50/80 border-slate-200 text-slate-500'
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={onChange}
        accept="image/*,application/pdf"
        className="hidden"
        disabled={isUploading}
      />
      {isUploading ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-1">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--brand-primary)]">
            <RefreshCw className="w-4 h-4 animate-spin text-[var(--brand-sky)]" />
            <span>Validation in progress...</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 text-[11px]">
          <Upload className={`w-3.5 h-3.5 ${dragActive ? 'animate-bounce text-[var(--brand-sky)]' : 'text-slate-400'}`} />
          <span>
            Drag & Drop verification files here or{' '}
            <button
              onClick={onFileClick}
              disabled={isUploading}
              className="text-[var(--brand-primary)] hover:text-[var(--brand-sky)] font-bold underline underline-offset-2"
            >
              select from computer
            </button>{' '}
            for <strong className="text-slate-800 uppercase font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] ml-0.5">{uploadTypeLabel}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

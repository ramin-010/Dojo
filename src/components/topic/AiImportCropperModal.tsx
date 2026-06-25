'use client';

import React, { useState, useRef, useEffect } from 'react';
import Cropper, { ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { X, Crop, ChevronRight, Check, RotateCw } from 'lucide-react';

interface AiImportCropperModalProps {
  files: File[];
  onConfirm: (croppedFiles: File[]) => void;
  onCancel: () => void;
}

export function AiImportCropperModal({ files, onConfirm, onCancel }: AiImportCropperModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [croppedBlobs, setCroppedBlobs] = useState<(Blob | null)[]>(new Array(files.length).fill(null));
  const cropperRef = useRef<ReactCropperElement>(null);

  // When modal is open, prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  if (!files || files.length === 0) return null;

  const currentFile = files[currentIndex];
  const imageUrl = URL.createObjectURL(currentFile);

  const handleRotate = () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.rotate(90); // Rotate 90 degrees clockwise
    }
  };

  const handleNext = () => {
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.getCroppedCanvas().toBlob((blob) => {
        if (blob) {
          const newBlobs = [...croppedBlobs];
          newBlobs[currentIndex] = blob;
          setCroppedBlobs(newBlobs);

          if (currentIndex < files.length - 1) {
            setCurrentIndex(currentIndex + 1);
          } else {
            finalize(newBlobs);
          }
        }
      }, currentFile.type, 0.9);
    }
  };

  const finalize = (finalBlobs: (Blob | null)[]) => {
    // Convert Blobs back to Files
    const finalFiles = finalBlobs.map((blob, idx) => {
      const originalFile = files[idx];
      return new File([blob!], originalFile.name, { type: originalFile.type });
    });
    onConfirm(finalFiles);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-[2px] p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-5xl flex flex-col h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Minimal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-zinc-900/50">
          <h2 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
            <Crop className="w-4 h-4 text-zinc-400" />
            Crop Image ({currentIndex + 1} of {files.length})
          </h2>
          <div className="flex items-center gap-1">
            <button 
              onClick={handleRotate}
              className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-100 transition-all"
              title="Rotate 90°"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button 
              onClick={onCancel}
              className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cropper Area */}
        <div className="flex-1 min-h-0 bg-black/40 relative flex items-center justify-center overflow-hidden">
          <Cropper
            src={imageUrl}
            style={{ height: '100%', width: '100%' }}
            autoCropArea={0.95}
            background={true}
            guides={true}
            ref={cropperRef}
            viewMode={2}
            dragMode="crop"
            responsive={true}
            checkOrientation={false}
          />
        </div>

        {/* Minimal Footer */}
        <div className="p-3 px-4 border-t border-zinc-800/50 bg-zinc-900/50 flex items-center justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-1.5 rounded-md text-xs font-semibold bg-zinc-100 text-zinc-900 hover:bg-white transition-colors"
          >
            {currentIndex < files.length - 1 ? (
              <>Next Image <ChevronRight className="w-3 h-3" /></>
            ) : (
              <>Confirm <Check className="w-3 h-3" /></>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

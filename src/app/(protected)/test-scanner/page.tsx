'use client';

import React, { useState } from 'react';
import { Upload, Sliders, Image as ImageIcon } from 'lucide-react';
import { ResourcePreviewModal } from '@/app/(protected)/topic/[id]/components/resources/ResourcePreviewModal';

export default function TestScannerPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter params - Optimal defaults for "Adobe Scan" effect
  const [grayscale, setGrayscale] = useState(true);
  const [normalize, setNormalize] = useState(true);
  const [contrastMultiplier, setContrastMultiplier] = useState(1.8);
  const [brightnessOffset, setBrightnessOffset] = useState(10);
  const [sharpenSigma, setSharpenSigma] = useState(1.5);
  const [thresholdEnabled, setThresholdEnabled] = useState(false);
  const [thresholdLevel, setThresholdLevel] = useState(180);

  // Preview modal state
  const [previewResource, setPreviewResource] = useState<any | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setOriginalUrl(URL.createObjectURL(file));
      setProcessedUrl(null);
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) return;

    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      // Append params
      formData.append('grayscale', grayscale.toString());
      formData.append('normalize', normalize.toString());
      formData.append('contrastMultiplier', contrastMultiplier.toString());
      formData.append('brightnessOffset', brightnessOffset.toString());
      formData.append('sharpenSigma', sharpenSigma.toString());
      formData.append('thresholdEnabled', thresholdEnabled.toString());
      formData.append('thresholdLevel', thresholdLevel.toString());

      const res = await fetch('/api/test-scan', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Failed to process image');
      }

      const data = await res.json();
      if (data.url) {
        setProcessedUrl(data.url);
      }
    } catch (err) {
      console.error(err);
      alert('Error processing image');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <ImageIcon className="text-purple-500" />
          Scanner Pipeline Lab
        </h1>
        <p className="text-muted-foreground mb-8">Test Sharp image processing parameters to achieve the perfect "Adobe Scan" effect.</p>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Controls */}
          <div className="col-span-1 bg-zinc-950 border border-border p-6 rounded-xl shadow-xl h-fit">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-400" /> Parameters
            </h2>

            <div className="space-y-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={grayscale} onChange={e => setGrayscale(e.target.checked)} className="rounded bg-black border-border" />
                <span className="text-sm font-medium">Grayscale</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={normalize} onChange={e => setNormalize(e.target.checked)} className="rounded bg-black border-border" />
                <span className="text-sm font-medium">Normalize (Auto Contrast)</span>
              </label>

              <div>
                <label className="flex justify-between text-sm font-medium mb-2">
                  <span>Contrast Multiplier</span>
                  <span className="text-muted-foreground">{contrastMultiplier}x</span>
                </label>
                <input type="range" min="0.5" max="3" step="0.1" value={contrastMultiplier} onChange={e => setContrastMultiplier(parseFloat(e.target.value))} className="w-full accent-purple-500" />
              </div>

              <div>
                <label className="flex justify-between text-sm font-medium mb-2">
                  <span>Brightness Offset</span>
                  <span className="text-muted-foreground">{brightnessOffset}</span>
                </label>
                <input type="range" min="-128" max="128" step="1" value={brightnessOffset} onChange={e => setBrightnessOffset(parseInt(e.target.value))} className="w-full accent-purple-500" />
              </div>

              <div>
                <label className="flex justify-between text-sm font-medium mb-2">
                  <span>Sharpen Sigma</span>
                  <span className="text-muted-foreground">{sharpenSigma}</span>
                </label>
                <input type="range" min="0" max="5" step="0.1" value={sharpenSigma} onChange={e => setSharpenSigma(parseFloat(e.target.value))} className="w-full accent-purple-500" />
              </div>

              <hr className="border-border" />

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={thresholdEnabled} onChange={e => setThresholdEnabled(e.target.checked)} className="rounded bg-black border-border" />
                <span className="text-sm font-medium">B&W Thresholding</span>
              </label>

              {thresholdEnabled && (
                <div>
                  <label className="flex justify-between text-sm font-medium mb-2">
                    <span>Threshold Level</span>
                    <span className="text-muted-foreground">{thresholdLevel}</span>
                  </label>
                  <input type="range" min="1" max="254" step="1" value={thresholdLevel} onChange={e => setThresholdLevel(parseInt(e.target.value))} className="w-full accent-purple-500" />
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-border">
              <label className="flex items-center justify-center w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-pointer transition-colors mb-3">
                <Upload className="w-4 h-4 mr-2 text-muted-foreground" />
                <span className="text-sm font-medium">Upload Notes Image</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>

              <button
                onClick={handleProcess}
                disabled={!selectedFile || isProcessing}
                className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg disabled:opacity-50 transition-colors shadow-lg shadow-purple-500/20"
              >
                {isProcessing ? 'Processing...' : 'Process Image'}
              </button>
            </div>
          </div>

          {/* Viewer */}
          <div className="col-span-1 lg:col-span-3 grid grid-cols-1 gap-6">
            
            <div className="bg-zinc-950 border border-border rounded-xl shadow-xl overflow-hidden flex flex-col h-[70vh]">
              <div className="bg-zinc-900 border-b border-border py-3 px-4 flex justify-between items-center shrink-0">
                <span className="font-medium text-sm">Original Image</span>
              </div>
              <div className="flex-1 min-h-0 p-4 flex items-center justify-center bg-[#050505]">
                {originalUrl ? (
                  <img 
                    src={originalUrl} 
                    onClick={() => setPreviewResource({ category: 'image', url: originalUrl, title: 'Original Image', type: 'image', size: '0', addedAt: '' })}
                    className="max-w-full max-h-full object-contain rounded drop-shadow-2xl ring-1 ring-white/5 cursor-zoom-in hover:opacity-90 transition-opacity" 
                    alt="Original" 
                  />
                ) : (
                  <span className="text-muted-foreground/30 text-sm font-medium">No image uploaded</span>
                )}
              </div>
            </div>

            <div className="bg-zinc-950 border border-border rounded-xl shadow-xl overflow-hidden flex flex-col h-[70vh]">
              <div className="bg-zinc-900 border-b border-border py-3 px-4 flex justify-between items-center shrink-0">
                <span className="font-medium text-sm">Processed Image (Scan Effect)</span>
              </div>
              <div className="flex-1 min-h-0 p-4 flex items-center justify-center bg-[#050505]">
                {processedUrl ? (
                  <img 
                    src={processedUrl} 
                    onClick={() => setPreviewResource({ category: 'image', url: processedUrl, title: 'Processed Scan', type: 'image', size: '0', addedAt: '' })}
                    className="max-w-full max-h-full object-contain rounded drop-shadow-2xl ring-1 ring-white/5 cursor-zoom-in hover:opacity-90 transition-opacity" 
                    alt="Processed" 
                  />
                ) : (
                  <span className="text-muted-foreground/30 text-sm font-medium">Click Process to see results</span>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>

      <ResourcePreviewModal 
        resource={previewResource} 
        onClose={() => setPreviewResource(null)} 
      />
    </div>
  );
}

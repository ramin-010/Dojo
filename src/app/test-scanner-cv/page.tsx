'use client';

import React, { useState } from 'react';
import { Upload, Sliders, Image as ImageIcon } from 'lucide-react';
import { ResourcePreviewModal } from '@/app/topic/[id]/components/resources/ResourcePreviewModal';

export default function TestScannerCvPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Filter params - Claude Pipeline
  const [outputMode, setOutputMode] = useState<'binary' | 'grayscale' | 'cream'>('binary');
  const [denoiseStrength, setDenoiseStrength] = useState(7.0);

  // Preview modal state
  const [previewResource, setPreviewResource] = useState<any | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setOriginalUrl(URL.createObjectURL(file));
      setProcessedUrl(null);
      setStats(null);
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) return;

    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('output_mode', outputMode);
      formData.append('denoise_strength', denoiseStrength.toString());

      const res = await fetch('/api/test-scan-cv', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to process image');
      }

      const data = await res.json();
      if (data.url) {
        setProcessedUrl(data.url);
        setStats({
          timing: data.timing_ms,
          stages: data.stages
        });
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error processing image. Check server console.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <ImageIcon className="text-purple-500" />
          Production Document Scanner (Python Microservice)
        </h1>
        <p className="text-muted-foreground mb-8">Test the ultimate Claude Pipeline powered by FastAPI + OpenCV Contrib + Scikit-Image.</p>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Controls */}
          <div className="col-span-1 bg-zinc-950 border border-border p-6 rounded-xl shadow-xl h-fit">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-purple-400" /> Parameters
            </h2>

            <div className="space-y-6">
              
              <div>
                <label className="flex text-sm font-medium mb-3">Output Mode</label>
                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => setOutputMode('binary')}
                    className={`py-2 px-3 text-sm rounded border text-left ${outputMode === 'binary' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-black border-border'}`}
                  >
                    <strong>Binary</strong> (Pure B&W)
                  </button>
                  <button 
                    onClick={() => setOutputMode('grayscale')}
                    className={`py-2 px-3 text-sm rounded border text-left ${outputMode === 'grayscale' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-black border-border'}`}
                  >
                    <strong>Grayscale</strong> (Anti-aliased)
                  </button>
                  <button 
                    onClick={() => setOutputMode('cream')}
                    className={`py-2 px-3 text-sm rounded border text-left ${outputMode === 'cream' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-black border-border'}`}
                  >
                    <strong>Cream</strong> (Apple Notes style)
                  </button>
                </div>
              </div>

              <div>
                <label className="flex justify-between text-sm font-medium mb-2">
                  <span>Denoise Strength</span>
                  <span className="text-muted-foreground">{denoiseStrength.toFixed(1)}</span>
                </label>
                <input 
                  type="range" min="1.0" max="15.0" step="0.5" 
                  value={denoiseStrength} 
                  onChange={e => setDenoiseStrength(parseFloat(e.target.value))} 
                  className="w-full accent-purple-500" 
                />
                <p className="text-[10px] text-muted-foreground mt-1">Guided filter strength. 5 = light, 7 = medium, 12 = heavy.</p>
              </div>

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
                {isProcessing ? 'Running Python Pipeline...' : 'Run Pipeline'}
              </button>
            </div>

            {stats && (
              <div className="mt-6 pt-4 border-t border-border/50 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-white mb-2">Performance: {stats.timing.toFixed(0)}ms</p>
                {Object.entries(stats.stages).map(([stage, time]: any) => (
                  <div key={stage} className="flex justify-between">
                    <span>{stage}</span>
                    <span>{time.toFixed(1)}ms</span>
                  </div>
                ))}
              </div>
            )}
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
                <span className="font-medium text-sm">Processed Pipeline Output</span>
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

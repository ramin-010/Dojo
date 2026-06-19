'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  FileText,
  Terminal,
  ImagePlus,
  Link2,
  X,
} from 'lucide-react';
import { CanvasBlockData } from '../core/types';

interface CanvasBlockMenuProps {
  onAddBlock: (type: CanvasBlockData['type'], x?: number, y?: number, content?: string) => void;
  onAddImage?: (file: File) => void;
}

const BLOCK_TYPES = [
  { type: 'text' as const,  label: 'Text Note',     icon: FileText,  color: 'text-blue-400' },
  { type: 'code' as const,  label: 'Code Snippet',  icon: Terminal,   color: 'text-emerald-400' },
  { type: 'image' as const, label: 'Image',          icon: ImagePlus,  color: 'text-amber-400' },
  { type: 'embed' as const, label: 'Embed URL',      icon: Link2,      color: 'text-purple-400' },
];

export function CanvasBlockMenu({ onAddBlock, onAddImage }: CanvasBlockMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (type: CanvasBlockData['type']) => {
    if (type === 'image') {
      fileInputRef.current?.click();
      return;
    }
    if (type === 'embed') {
      setShowUrlInput(true);
      return;
    }
    onAddBlock(type);
    setIsOpen(false);
  };

  const handleUrlSubmit = () => {
    if (!urlValue.trim()) return;
    onAddBlock('embed', undefined, undefined, urlValue);
    setUrlValue('');
    setShowUrlInput(false);
    setIsOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddImage?.(file);
      setIsOpen(false);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="absolute bottom-4 right-4 z-30">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-14 right-0 bg-popover backdrop-blur-xl border border-border rounded-xl shadow-2xl p-2 min-w-[180px]"
          >
            {BLOCK_TYPES.map(({ type, label, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => handleSelect(type)}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Icon className={`w-4 h-4 ${color}`} />
                <span>{label}</span>
              </button>
            ))}

            <AnimatePresence>
              {showUrlInput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-2 pt-2 border-t border-border mt-1">
                    <input
                      type="url"
                      placeholder="https://..."
                      value={urlValue}
                      onChange={e => setUrlValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleUrlSubmit()}
                      autoFocus
                      className="flex-1 bg-muted text-xs rounded-md px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    <button
                      onClick={() => { setShowUrlInput(false); setUrlValue(''); }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setIsOpen(!isOpen);
          setShowUrlInput(false);
        }}
        className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
      >
        <motion.div animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
          <Plus className="w-6 h-6" />
        </motion.div>
      </motion.button>
    </div>
  );
}

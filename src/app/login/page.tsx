'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

function LoginContent() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard';
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus on load
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success('Access granted');
        router.push(callbackUrl);
        router.refresh(); // Force a refresh to ensure middleware picks up the cookie
      } else {
        toast.error(data.error || 'Invalid password');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch (err) {
      toast.error('Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm px-6">
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 border border-accent/20">
          <div className="w-6 h-6 rounded bg-accent" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1">Enter your password to access your workspace</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative group">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            placeholder="••••••••"
            className="w-full px-4 py-3 bg-sidebar border border-divider/50 rounded-xl outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all text-center tracking-[0.2em] font-medium"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !password.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-foreground text-background rounded-xl font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Unlock Workspace
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground selection:bg-indigo-500/30">
      <Suspense fallback={<div className="flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>}>
        <LoginContent />
      </Suspense>
    </div>
  );
}

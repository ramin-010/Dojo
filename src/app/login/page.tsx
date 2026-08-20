'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowRight, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

function LoginContent() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard';
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, [isRegister]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    if (isRegister && password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister 
        ? { name: name.trim(), email: email.trim(), password, rememberMe } 
        : { email: email.trim(), password, rememberMe };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(isRegister ? 'Account created!' : 'Welcome back!');
        router.push(callbackUrl);
        router.refresh();
      } else {
        toast.error(data.error || 'Something went wrong');
        if (!isRegister) {
          setPassword('');
        }
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
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isRegister ? 'Create Account' : 'Welcome back'}
        </h1>
        <p className="text-sm text-muted mt-1">
          {isRegister ? 'Set up your workspace' : 'Sign in to your workspace'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {isRegister && (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
            placeholder="Your name"
            className="w-full px-4 py-3 bg-sidebar border border-divider/50 rounded-xl outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all text-sm"
          />
        )}

        <input
          ref={emailRef}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          placeholder="Email address"
          className="w-full px-4 py-3 bg-sidebar border border-divider/50 rounded-xl outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all text-sm"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          placeholder="Password"
          className="w-full px-4 py-3 bg-sidebar border border-divider/50 rounded-xl outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all text-sm"
        />

        {isRegister && (
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            placeholder="Confirm password"
            className="w-full px-4 py-3 bg-sidebar border border-divider/50 rounded-xl outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all text-sm"
          />
        )}

        <label className="flex items-center gap-2 cursor-pointer select-none pb-2 pt-1">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLoading}
            className="w-4 h-4 rounded border-divider/50 text-accent focus:ring-accent/50 focus:ring-1"
          />
          <span className="text-sm text-muted">Remember me</span>
        </label>

        <button
          type="submit"
          disabled={isLoading || !email.trim() || !password.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-foreground text-background rounded-xl font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : isRegister ? (
            <>
              Create Account
              <UserPlus className="w-4 h-4" />
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Registration disabled for now
      <div className="mt-6 text-center">
        <button
          onClick={() => {
            setIsRegister(!isRegister);
            setPassword('');
            setConfirmPassword('');
          }}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
        </button>
      </div>
      */}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground selection:bg-indigo-500/30">
      <Suspense fallback={<div className="flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted" /></div>}>
        <LoginContent />
      </Suspense>
    </div>
  );
}

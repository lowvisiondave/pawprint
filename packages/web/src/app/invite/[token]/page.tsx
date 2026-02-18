'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';

interface InviteData {
  valid: boolean;
  workspaceId?: number;
  workspaceName?: string;
  workspaceSlug?: string;
  role?: string;
  expiresAt?: string;
  error?: string;
}

export default function InvitePage() {
  const { token } = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function validateInvite() {
      if (!token) return;
      
      try {
        const res = await fetch(`/api/v1/invite/validate?token=${token}`);
        const data = await res.json();
        setInviteData(data);
      } catch (err) {
        setInviteData({ valid: false, error: 'Failed to validate invite' });
      } finally {
        setLoading(false);
      }
    }
    
    if (status !== 'loading') {
      validateInvite();
    }
  }, [token, status]);

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    setError(null);
    
    try {
      const res = await fetch('/api/v1/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Failed to accept invite');
        return;
      }
      
      // Redirect to dashboard with the workspace
      router.push(`/dashboard?workspace_id=${data.workspace.id}`);
    } catch (err) {
      setError('Something went wrong');
    } finally {
      setAccepting(false);
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="max-w-md w-full mx-4 p-8 bg-zinc-900 rounded-lg border border-zinc-800">
          <h1 className="text-2xl font-bold text-white mb-2">Join Workspace</h1>
          {inviteData?.valid ? (
            <>
              <p className="text-zinc-400 mb-6">
                You've been invited to join <strong className="text-white">{inviteData.workspaceName}</strong>
              </p>
              <p className="text-zinc-500 text-sm mb-6">
                Sign in with GitHub to accept the invite
              </p>
            </>
          ) : (
            <p className="text-red-400 mb-6">{inviteData?.error || 'Invalid invite'}</p>
          )}
          <button
            onClick={() => signIn('github', { callbackUrl: `/invite/${token}` })}
            className="w-full py-3 px-4 bg-zinc-100 hover:bg-white text-zinc-900 font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            Continue with GitHub
          </button>
        </div>
      </div>
    );
  }

  if (!inviteData?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="max-w-md w-full mx-4 p-8 bg-zinc-900 rounded-lg border border-zinc-800">
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Invite</h1>
          <p className="text-red-400">{inviteData?.error || 'This invite link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="max-w-md w-full mx-4 p-8 bg-zinc-900 rounded-lg border border-zinc-800">
        <h1 className="text-2xl font-bold text-white mb-2">Join Workspace</h1>
        <p className="text-zinc-400 mb-6">
          You've been invited to join <strong className="text-white">{inviteData.workspaceName}</strong>
        </p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
        >
          {accepting ? 'Joining...' : 'Accept Invite & Get API Key'}
        </button>
        
        <p className="mt-4 text-zinc-500 text-sm text-center">
          You'll be redirected to generate your API key
        </p>
      </div>
    </div>
  );
}

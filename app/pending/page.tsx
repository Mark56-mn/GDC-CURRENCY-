'use client';

import { useState, useEffect } from 'react';
import { getPendingTransactions, removePendingTransaction, getFailedTransactions } from '@/src/db.js';
import Link from 'next/link';
import { getSessionUser } from '@/src/wallet.js';

export default function PendingPage() {
  const [pending, setPending] = useState<any[]>([]);
  const [failed, setFailed] = useState<any[]>([]);
  const [status, setStatus] = useState('');

  const loadTransactions = async () => {
    const pend = await getPendingTransactions();
    setPending(pend || []);
    
    const fail = await getFailedTransactions();
    setFailed(fail || []);
  };

  useEffect(() => {
    getPendingTransactions().then(pend => setPending(pend || []));
    getFailedTransactions().then(fail => setFailed(fail || []));
  }, []);

  const handleRetry = async (tx: any) => {
    setStatus('Retrying transaction...');
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: tx.payload })
      });

      if (response.ok) {
        await removePendingTransaction(tx.id);
        setStatus('Transaction sent successfully!');
        loadTransactions();
        setTimeout(() => setStatus(''), 4000);
      } else {
        const err = await response.text();
        setStatus(`Retry failed: ${err}`);
      }
    } catch (err: any) {
      setStatus(`Network error: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0c0d10] text-[#e0e0e0] font-sans flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-4xl flex flex-col gap-8">
        <header className="flex justify-between items-center bg-[#13151a] p-6 rounded-2xl border border-[#1f2229]">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[10px] text-[#00e5ff] uppercase font-bold tracking-widest hover:underline">&larr; Back to Dashboard</Link>
            <h1 className="text-xl font-bold tracking-tight">Offline Queue</h1>
          </div>
        </header>

        {status && (
          <div className="bg-[#1a1c22] border border-[#00e5ff] text-[#00e5ff] p-4 flex items-center justify-between shadow-[0_0_15px_rgba(0,229,255,0.1)] rounded-lg">
            <span className="text-xs font-mono font-bold tracking-wider">{status}</span>
          </div>
        )}

        <section className="bg-[#13151a] p-6 rounded-2xl border border-[#1f2229] flex flex-col gap-6">
          <h2 className="text-sm uppercase font-bold tracking-widest text-[#666]">Pending Transactions</h2>
          {pending.length === 0 ? (
            <p className="text-xs text-[#555] italic">No pending offline transactions.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {pending.map((tx: any) => (
                <div key={tx.id} className="bg-[#0e1014] p-4 rounded-xl border border-[#2d3039] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex flex-col gap-1 text-xs font-mono">
                    <span className="text-white">To: <span className="text-[#999]">{tx.payload.to_pubkey}</span></span>
                    <span className="text-[#00ff9d]">Amount: {tx.payload.amount} GDC</span>
                  </div>
                  <button onClick={() => handleRetry(tx)} className="bg-[#00e5ff] text-black px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[#00ccdd] transition-colors whitespace-nowrap">
                    Retry Now
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-[#13151a] p-6 rounded-2xl border border-[#1f2229] flex flex-col gap-6">
          <h2 className="text-sm uppercase font-bold tracking-widest text-[#666]">Failed Transactions</h2>
          {failed.length === 0 ? (
            <p className="text-xs text-[#555] italic">No failed transactions.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {failed.map((tx: any) => (
                <div key={tx.id} className="bg-[#2a1315] p-4 rounded-xl border border-[#3d1a1f] flex flex-col gap-2">
                  <div className="flex flex-col gap-1 text-xs font-mono">
                    <span className="text-white">To: <span className="text-[#999]">{tx.payload.to_pubkey}</span></span>
                    <span className="text-[#ff3366]">Amount: {tx.payload.amount} GDC</span>
                  </div>
                  {tx.error && (
                    <div className="text-[10px] text-[#ff3366] bg-[#1a0a0c] p-2 rounded block">
                      Error: {tx.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

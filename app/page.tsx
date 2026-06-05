'use client';

import { useState } from 'react';
import { createWallet, unlockWallet, getBalance, sendTransaction, requestFaucet } from '../src/wallet.js';

export default function Home() {
  const [pin, setPin] = useState('');
  const [pubKey, setPubKey] = useState('');
  const [balance, setBalance] = useState(0);
  const [toPubkey, setToPubkey] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');

  const [transactions, setTransactions] = useState<any[]>([]);

  const refreshHistory = async (key: string) => {
    try {
      const { getTransactionHistory } = await import('../src/wallet.js');
      const hist = await getTransactionHistory(key, 5);
      setTransactions(hist || []);
    } catch (e) {
      console.error("Failed to refresh history", e);
    }
  };

  const handleCreate = async () => {
    try {
      const key = await createWallet(pin);
      setPubKey(key);
      setStatus('Wallet created successfully.');
      refreshHistory(key);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  };

  const handleUnlock = async () => {
    try {
      const wallet = await unlockWallet(pin);
      if (wallet) {
        setPubKey(wallet.publicKeyBase64);
        setStatus('Wallet unlocked.');
        const bal = await getBalance(wallet.publicKeyBase64);
        setBalance(bal);
        refreshHistory(wallet.publicKeyBase64);
      } else {
        setStatus('Invalid PIN or wallet not found.');
      }
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  };

  const handleSend = async () => {
    try {
      setStatus('Sending transaction...');
      await sendTransaction(toPubkey, Number(amount), pin);
      setStatus('Transaction sent successfully.');
      const bal = await getBalance(pubKey);
      setBalance(bal);
      refreshHistory(pubKey);
      setToPubkey('');
      setAmount('');
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  };

  const handleFaucet = async () => {
    if (!pubKey) return;
    try {
      setStatus('Requesting test coins...');
      await requestFaucet(pubKey);
      setStatus('Success! 50 GDC credited.');
      const bal = await getBalance(pubKey);
      setBalance(bal);
      refreshHistory(pubKey);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  };

  const balanceInt = Math.floor(balance);
  const balanceDec = (balance % 1).toFixed(2).substring(2);

  return (
    <div className="h-screen w-full bg-[#0c0d10] text-[#e0e0e0] font-sans flex flex-col overflow-hidden">
      {/* Top Header Navigation */}
      <header className="h-16 border-b border-[#24262b] flex items-center justify-between px-8 bg-[#0f1115] shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gradient-to-tr from-[#00e5ff] to-[#0066ff] rounded-lg flex items-center justify-center">
            <span className="font-bold text-black text-xs">GDC</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-medium tracking-tight">
              GDC Wallet <span className="text-[#00e5ff] opacity-80 text-xs ml-2 uppercase font-mono tracking-widest">v2.4.1</span>
            </h1>
            <p className="text-[10px] text-gray-500">Client-side modules initialized.</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase text-[#666] font-bold">Edge Sync Status</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00ff9d] shadow-[0_0_8px_#00ff9d]"></div>
              <span className="text-xs font-mono">/sync-batch ACTIVE</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        {/* Left Sidebar: Identity */}
        <aside className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-[#24262b] flex flex-col p-6 gap-8 bg-[#0a0b0e] shrink-0 lg:overflow-y-auto">
          <section className="space-y-4">
            <h3 className="text-[10px] uppercase text-[#666] font-bold tracking-widest">Wallet Authentication</h3>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[#888] font-bold uppercase">Wallet PIN</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full bg-[#13151a] border border-[#1f2229] rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-[#00e5ff] transition-colors"
                placeholder="Enter 4-6 digit PIN"
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="flex-1 bg-[#1a1c22] text-[#00e5ff] rounded-lg py-3 text-xs font-bold uppercase hover:bg-[#252830] transition-colors border border-[#2d3039]"
              >
                Create
              </button>
              <button
                onClick={handleUnlock}
                className="flex-1 bg-[#00e5ff] text-black rounded-lg py-3 text-xs font-bold uppercase hover:bg-[#00ccdd] transition-colors shadow-[0_0_20px_rgba(0,229,255,0.2)]"
              >
                Unlock
              </button>
            </div>
          </section>

          {pubKey && (
            <section>
              <h3 className="text-[10px] uppercase text-[#666] font-bold mb-3 tracking-widest">Active Identity</h3>
              <div className="p-3 bg-[#13151a] rounded-lg border border-[#1f2229] font-mono text-[11px] break-all leading-relaxed text-[#00e5ff]">
                {pubKey}
              </div>
            </section>
          )}

          {status && (
            <section>
              <h3 className="text-[10px] uppercase text-[#666] font-bold mb-3 tracking-widest">System Message</h3>
              <div className={`p-3 bg-[#13151a] rounded-lg border border-[#1f2229] text-xs leading-tight ${status.startsWith('Error') || status.startsWith('Invalid') ? 'text-[#ff4d4d]' : 'text-[#00ff9d]'}`}>
                {status}
              </div>
            </section>
          )}

          <nav className="mt-auto flex flex-col gap-2 pt-4">
            <button className="flex items-center justify-start gap-3 p-3 bg-[#1a1c22] text-[#00e5ff] rounded-lg text-sm transition-colors cursor-default">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
              Dashboard
            </button>
            <a href="/public-transactions.html" className="flex items-center justify-start gap-3 p-3 text-[#999] rounded-lg text-sm hover:bg-[#1a1c22] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Transactions
            </a>
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col p-6 md:p-8 bg-gradient-to-b from-[#0e1014] to-[#0c0d10] w-full shrink-0 lg:shrink lg:overflow-y-auto">
          {pubKey ? (
            <>
              {/* Top Balance Panel */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 w-full gap-6">
                <div className="flex flex-col gap-1 flex-1">
                  <span className="text-[11px] uppercase text-[#666] font-bold tracking-[0.2em]">Total GDC Balance</span>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <h2 className="text-5xl md:text-6xl font-light text-white break-all">{balanceInt}.<span className="text-2xl opacity-50">{balanceDec}</span></h2>
                    <span className="text-[#00e5ff] text-xl font-mono">GDC</span>
                  </div>
                  <span className="text-sm text-[#00ff9d] font-mono">+0.00 GDC (Last 24h)</span>
                </div>
                <div className="flex gap-4">
                  <div className="h-24 w-32 bg-[#13151a] border border-[#1f2229] rounded-xl p-3 flex flex-col justify-between hidden lg:flex">
                    <span className="text-[10px] text-[#666] uppercase font-bold">Exchange Rate</span>
                    <div className="font-mono">
                      <div className="text-white text-lg">$1.042</div>
                      <div className="text-[#00ff9d] text-[10px]">▲ 0.4%</div>
                    </div>
                  </div>
                  <div className="h-24 w-40 bg-[#13151a] border border-[#1f2229] rounded-xl p-3 flex flex-col justify-between overflow-hidden hidden xl:flex">
                    <span className="text-[10px] text-[#666] uppercase font-bold">24h Activity</span>
                    <div className="h-12 w-full flex items-end gap-[2px]">
                      <div className="w-full h-1/2 bg-[#2d3039]"></div><div className="w-full h-2/3 bg-[#2d3039]"></div><div className="w-full h-full bg-[#00e5ff]"></div><div className="w-full h-3/4 bg-[#2d3039]"></div><div className="w-full h-1/2 bg-[#2d3039]"></div><div className="w-full h-2/3 bg-[#2d3039]"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Transactions List */}
              <div className="flex-1 flex flex-col w-full">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Transaction History</h4>
                  <span className="text-xs text-[#666] font-mono">Ledger Node View</span>
                </div>
                
                <div className="flex-1 bg-[#0a0b0e] border border-[#1f2229] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                  <div className="grid grid-cols-[1fr_2fr_1fr_1fr] px-6 py-4 border-b border-[#1f2229] bg-[#13151a] text-[10px] uppercase font-bold text-[#666] tracking-widest">
                    <div>Type</div>
                    <div>Address / Hash</div>
                    <div className="text-right">Amount</div>
                    <div className="text-right">Status</div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto font-mono text-xs">
                    {transactions.length === 0 ? (
                      <div className="grid grid-cols-[1fr_2fr_1fr_1fr] px-6 py-5 border-b border-[#13151a] hover:bg-[#13151a] transition-colors">
                        <div className="flex items-center gap-2 text-[#666]">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#666]"></div>
                          <span>INFO</span>
                        </div>
                        <div className="text-[#999] opacity-70">Awaiting transactions...</div>
                        <div className="text-right text-white font-medium">-</div>
                        <div className="text-right text-[#666]">-</div>
                      </div>
                    ) : (
                      transactions.map(tx => {
                        const isSent = tx.from_pubkey === pubKey;
                        const actionColor = isSent ? 'text-[#ff4d4d]' : 'text-[#00ff9d]';
                        const actionBg = isSent ? 'bg-[#ff4d4d]' : 'bg-[#00ff9d]';
                        const actionText = isSent ? 'SENT' : 'RECEIVED';
                        const addressShow = isSent ? tx.to_pubkey : tx.from_pubkey;
                        const maskedAddress = addressShow ? `${addressShow.substring(0, 8)}...` : '-';
                        
                        return (
                          <div key={tx.id || tx.created_at} className="grid grid-cols-[1fr_2fr_1fr_1fr] px-6 py-5 border-b border-[#13151a] hover:bg-[#13151a] transition-colors">
                            <div className={`flex items-center gap-2 ${actionColor}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${actionBg}`}></div>
                              <span>{actionText}</span>
                            </div>
                            <div className="text-[#999] opacity-70" title={addressShow}>{maskedAddress}</div>
                            <div className="text-right text-white font-medium">{isSent ? '-' : '+'} {Number(tx.amount).toFixed(2)}</div>
                            <div className="text-right text-[#666] capitalize">{tx.status || 'Confirmed'}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="p-4 bg-[#13151a] border-t border-[#1f2229] flex justify-center">
                    <a href="/public-transactions.html" className="text-[10px] text-[#00e5ff] uppercase font-bold tracking-widest hover:underline cursor-pointer">View Public Ledger In Network Dashboard</a>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-[#666]">
                <div className="w-16 h-16 rounded-full bg-[#13151a] border border-[#1f2229] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-[#444]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </div>
                <h2 className="text-lg font-medium text-white mb-2">Wallet Locked</h2>
                <p className="text-sm">Please create or unlock a wallet to continue.</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Action Panel */}
        {pubKey && (
          <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-[#24262b] flex flex-col p-6 gap-8 bg-[#0a0b0e] shrink-0 lg:overflow-y-auto">
            <div className="flex flex-col gap-4">
              <h3 className="text-[10px] uppercase text-[#666] font-bold tracking-widest">Test Network</h3>
              <div className="bg-[#13151a] border border-[#1f2229] rounded-xl p-4 text-center">
                <p className="text-xs text-[#999] mb-4">Request testnet tokens. Limit 1 claim per 24 hours.</p>
                <button 
                  onClick={handleFaucet}
                  className="w-full py-2.5 bg-[#1a1c22] border border-[#2d3039] text-[#00ff9d] font-bold text-xs uppercase rounded-lg hover:bg-[#252830] transition-colors"
                >
                  Get Test Coins
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="text-[10px] uppercase text-[#666] font-bold tracking-widest">Send GDC</h3>
              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[#888] font-bold uppercase">To PubKey</label>
                  <input 
                    type="text" 
                    value={toPubkey}
                    onChange={(e) => setToPubkey(e.target.value)}
                    placeholder="Recipient Public Key..." 
                    className="bg-[#13151a] border border-[#1f2229] rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-[#00e5ff] transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-[#888] font-bold uppercase">Amount (GDC)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00" 
                      className="w-full bg-[#13151a] border border-[#1f2229] rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-[#00e5ff] transition-colors"
                    />
                    <span className="absolute right-3 top-3 text-[10px] text-[#666] font-bold select-none cursor-pointer hover:text-white transition-colors" onClick={() => setAmount(balance.toString())}>MAX</span>
                  </div>
                </div>
                <button 
                  onClick={handleSend}
                  className="w-full py-3 bg-[#00e5ff] text-black font-bold text-xs uppercase rounded-lg shadow-[0_0_20px_rgba(0,229,255,0.2)] hover:bg-[#00ccdd] transition-colors"
                >
                  Execute Transaction
                </button>
              </div>
            </div>

            <div className="mt-auto p-4 bg-[#13151a] border border-[#1f2229] rounded-xl">
              <h4 className="text-[10px] text-[#666] uppercase font-bold mb-4 flex items-center gap-2">
                <div className="w-1 h-3 bg-[#00ff9d]"></div>
                Sync Metrics
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#999]">Latency</span>
                  <span className="text-[10px] font-mono">42ms</span>
                </div>
                <div className="w-full h-1 bg-[#1a1c22] rounded-full overflow-hidden">
                  <div className="w-[85%] h-full bg-[#00e5ff]"></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#999]">Edges</span>
                  <span className="text-[10px] font-mono">Optimal</span>
                </div>
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* Bottom Bar Info */}
      <footer className="h-8 border-t border-[#24262b] bg-[#0c0d10] px-8 flex items-center justify-between shrink-0 hidden md:flex">
        <div className="flex gap-6 text-[10px] font-medium uppercase tracking-widest text-[#666]">
          <span>Network: Mainnet-Sync</span>
          <span>DB: IndexedDB gdc_v2</span>
        </div>
        <div className="text-[10px] font-mono text-[#444]">
          GDC-CLI: v2.4.1
        </div>
      </footer>
    </div>
  );
}

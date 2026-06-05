'use client';

import { useState, useEffect } from 'react';
import { signUp, login, logout, getSessionUser, getBalance, sendTransaction, requestFaucet } from '../src/wallet.js';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pubKey, setPubKey] = useState('');
  const [balance, setBalance] = useState(0);
  const [toPubkey, setToPubkey] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'wallet'|'node'>('wallet');
  const [nodeInfo, setNodeInfo] = useState<any>(null);
  const [syncBatches, setSyncBatches] = useState<any[]>([]);
  const [batchInput, setBatchInput] = useState('');

  const refreshHistory = async (key: string) => {
    try {
      const { getTransactionHistory } = await import('../src/wallet.js');
      const hist = await getTransactionHistory(key, 5);
      setTransactions(hist || []);
    } catch (e) {
      console.error("Failed to refresh history", e);
    }
  };

  const fetchData = async (id: string) => {
    const bal = await getBalance(id);
    setBalance(bal);
    refreshHistory(id);
  };

  useEffect(() => {
    getSessionUser().then(user => {
      if (user) {
        setPubKey(user.id);
        fetchData(user.id);
      }
      setIsLoading(false);
    }).catch(err => {
      console.error("Auth session check failed", err);
      setIsLoading(false);
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(
        function(registration) {
          console.log('ServiceWorker registration successful');
        },
        function(err) {
          console.log('ServiceWorker registration failed: ', err);
        }
      );
    }
  }, []);

  const handleSignUp = async () => {
    try {
      setStatus('Creating account...');
      const user = await signUp(email, password);
      if (user) {
        setPubKey(user.id);
        setStatus('Account created successfully.');
        fetchData(user.id);
      }
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  };

  const handleLogin = async () => {
    try {
      setStatus('Authenticating...');
      const user = await login(email, password);
      if (user) {
        setPubKey(user.id);
        setStatus('');
        fetchData(user.id);
      }
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  };

  const handleSend = async () => {
    try {
      setStatus('Sending transaction...');
      await sendTransaction(toPubkey, Number(amount), pubKey);
      setStatus('Transaction sent successfully.');
      fetchData(pubKey);
      setToPubkey('');
      setAmount('');
      setTimeout(() => setStatus(''), 5000);
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
      fetchData(pubKey);
      setTimeout(() => setStatus(''), 5000);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  };

  const loadNodeInfo = () => {
    import('../src/wallet.js').then(({ registerNode, getSyncBatches }) => {
       registerNode(pubKey).then(info => setNodeInfo(info)).catch(e => console.warn(e));
       getSyncBatches(10).then(batches => setSyncBatches(batches || [])).catch(e => console.warn(e));
    }).catch(e => console.warn("Node load err", e));
  };

  useEffect(() => {
    if (viewMode === 'node' && pubKey) {
       loadNodeInfo();
    }
  }, [viewMode, pubKey]);

  const handleBatchSubmit = async () => {
    if (!nodeInfo || !batchInput) return;
    try {
      setStatus('Submitting batch...');
      const { submitSyncBatch } = await import('../src/wallet.js');
      await submitSyncBatch(batchInput, nodeInfo.device_id);
      setBatchInput('');
      setStatus('Batch processed successfully');
      loadNodeInfo();
      setTimeout(() => setStatus(''), 3000);
    } catch (err: any) {
      setStatus(`Batch error: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    setPubKey('');
    setEmail('');
    setPassword('');
    setBalance(0);
    setTransactions([]);
    setStatus('Logged out successfully.');
  };

  const balanceInt = Math.floor(balance);
  const balanceDec = (balance % 1).toFixed(2).substring(2);

  const actionPanelUI = (
    <>
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
              placeholder="Recipient ID (UUID)" 
              className="bg-[#13151a] border border-[#1f2229] rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:border-[#00e5ff] transition-colors break-all"
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
    </>
  );

  const nodeModeUI = (
    <div className="flex-1 flex flex-col w-full h-full min-h-[400px]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 w-full gap-6">
        <div className="flex flex-col gap-1 flex-1">
          <span className="text-[11px] uppercase text-[#666] font-bold tracking-[0.2em]">Node Operations</span>
          <h2 className="text-xl md:text-3xl font-light text-white break-all">
            Device: <span className="text-[#00e5ff] font-mono whitespace-nowrap">{nodeInfo?.device_id || 'Loading...'}</span>
          </h2>
        </div>
        <div className="flex gap-4 overflow-x-auto w-full md:w-auto">
          <div className="h-24 min-w-[120px] bg-[#13151a] border border-[#1f2229] rounded-xl p-3 flex flex-col justify-between whitespace-nowrap shrink-0">
            <span className="text-[10px] text-[#666] uppercase font-bold">Rewards Earned</span>
            <div className="text-[#00ff9d] text-2xl font-mono">{nodeInfo?.rewards_earned || 0}</div>
          </div>
          <div className="h-24 min-w-[120px] bg-[#13151a] border border-[#1f2229] rounded-xl p-3 flex flex-col justify-between whitespace-nowrap shrink-0">
            <span className="text-[10px] text-[#666] uppercase font-bold">Status</span>
            <div className={`text-xl font-mono ${nodeInfo?.frozen ? 'text-[#ff4d4d]' : 'text-white'}`}>
              {nodeInfo?.frozen ? 'FROZEN' : 'ACTIVE'}
            </div>
          </div>
          <div className="h-24 min-w-[100px] bg-[#13151a] border border-[#1f2229] rounded-xl p-3 flex flex-col justify-between whitespace-nowrap shrink-0 hidden md:flex">
            <span className="text-[10px] text-[#666] uppercase font-bold">Strikes</span>
            <div className="text-[#ff4d4d] text-xl font-mono">{nodeInfo?.strikes || 0}</div>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-8 flex-1 w-full min-h-0">
        <div className="w-full lg:w-1/2 flex flex-col min-h-[250px]">
           <h3 className="text-[10px] uppercase text-[#666] font-bold tracking-widest mb-4 shrink-0">Submit Sync Batch</h3>
           <textarea 
              value={batchInput}
              onChange={e => setBatchInput(e.target.value)}
              className="flex-1 bg-[#13151a] border border-[#1f2229] p-4 text-xs font-mono text-white rounded-xl focus:outline-none focus:border-[#00e5ff] resize-none"
              placeholder={'{\n  "transactions": [\n    ...\n  ]\n}'}
           ></textarea>
           <button onClick={handleBatchSubmit} className="mt-4 w-full py-3 bg-[#00e5ff] text-black font-bold text-xs uppercase rounded-lg shadow-[0_0_20px_rgba(0,229,255,0.2)] hover:bg-[#00ccdd] transition-colors shrink-0">Submit Batch</button>
        </div>

        <div className="w-full lg:w-1/2 flex flex-col bg-[#0a0b0e] border border-[#1f2229] rounded-2xl p-4 min-h-[250px]">
           <h4 className="text-[10px] uppercase text-[#666] font-bold tracking-widest mb-4 shrink-0">Recent Sync Log</h4>
           <div className="flex-1 overflow-y-auto space-y-2 font-mono text-xs pr-2">
             {syncBatches.length === 0 ? <div className="text-[#666] p-4 text-center">No recent sync batches.</div> : 
               syncBatches.map((b, idx) => (
                 <div key={b.id || `batch-${idx}`} className="p-3 bg-[#13151a] border border-[#1f2229] rounded-lg">
                   <div className="flex justify-between text-[#888] mb-1">
                      <span>{new Date(b.created_at).toLocaleTimeString()}</span>
                      <span className="text-[#00ff9d]">{b.status}</span>
                   </div>
                 </div>
               ))
             }
           </div>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return <div className="min-h-screen w-full bg-[#08090b] flex items-center justify-center text-[#666]">Loading...</div>;
  }

  if (!pubKey) {
    // Dedicated Authentication Page
    return (
      <div className="min-h-screen w-full bg-[#08090b] text-[#e0e0e0] font-sans flex flex-col items-center justify-center relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[#00e5ff]/5 to-[#0066ff]/5 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="z-10 w-full max-w-sm p-6 flex flex-col items-center">
          {/* Logo and Header */}
          <div className="w-16 h-16 bg-gradient-to-tr from-[#00e5ff] to-[#0066ff] rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,229,255,0.2)]">
            <span className="font-bold text-black text-xl tracking-wider">GDC</span>
          </div>
          <h1 className="text-2xl font-light tracking-tight text-white mb-2">Welcome to GDC</h1>
          <p className="text-[#666] text-xs mb-10 font-mono">Secure Node Access Terminal</p>

          {/* Auth form */}
          <div className="bg-[#0e1014] border border-[#1f2229] rounded-2xl p-6 w-full shadow-2xl flex flex-col gap-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#00e5ff] to-[#0066ff]"></div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-[#888] font-bold uppercase tracking-widest text-left">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#13151a] border border-[#2d3039] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#00e5ff] transition-colors"
                  placeholder="name@example.com"
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-[10px] text-[#888] font-bold uppercase tracking-widest text-left">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#13151a] border border-[#2d3039] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-[#00e5ff] transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <button
                onClick={handleLogin}
                className="w-full bg-[#00e5ff] text-black rounded-xl py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-[#00ccdd] transition-all shadow-[0_0_15px_rgba(0,229,255,0.15)] hover:shadow-[0_0_25px_rgba(0,229,255,0.3)]"
              >
                Log In
              </button>
              <div className="flex items-center gap-4 my-1">
                <div className="flex-1 h-[1px] bg-[#1f2229]"></div>
                <span className="text-[9px] text-[#555] uppercase font-bold tracking-widest">OR</span>
                <div className="flex-1 h-[1px] bg-[#1f2229]"></div>
              </div>
              <button
                onClick={handleSignUp}
                className="w-full bg-[#1a1c22] text-[#00e5ff] rounded-xl py-3.5 text-xs font-bold uppercase tracking-widest hover:bg-[#252830] transition-colors border border-[#2d3039]"
              >
                Sign Up
              </button>
            </div>

            {status && (
              <div className={`p-4 rounded-xl text-center text-xs border ${status.startsWith('Error') || status.startsWith('Invalid') ? 'bg-[#ff4d4d]/10 border-[#ff4d4d]/20 text-[#ff4d4d]' : 'bg-[#00ff9d]/10 border-[#00ff9d]/20 text-[#00ff9d]'}`}>
                {status}
              </div>
            )}
          </div>

          <div className="mt-8 flex gap-4 text-[9px] font-medium uppercase tracking-widest text-[#444]">
            <span>v2.4.1</span>
            <span>•</span>
            <span>Mainnet-Sync</span>
            <span>•</span>
            <span>Supabase Auth</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#0c0d10] text-[#e0e0e0] font-sans flex flex-col overflow-hidden">
      {/* Top Header Navigation */}
      <header className="h-16 border-b border-[#24262b] flex items-center justify-between px-6 md:px-8 bg-[#0f1115] shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gradient-to-tr from-[#00e5ff] to-[#0066ff] rounded-lg flex items-center justify-center shrink-0">
            <span className="font-bold text-black text-xs">GDC</span>
          </div>
          <div className="flex flex-col hidden sm:flex">
            <h1 className="text-lg font-medium tracking-tight">
              GDC Wallet <span className="text-[#00e5ff] opacity-80 text-xs ml-2 uppercase font-mono tracking-widest hidden md:inline">v2.4.1</span>
            </h1>
            <p className="text-[10px] text-gray-500">Cloud Auth Active.</p>
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <button 
            onClick={handleLogout}
            className="text-[10px] uppercase text-[#666] font-bold tracking-widest hover:text-white transition-colors"
          >
            Logout
          </button>
          <div className="w-px h-6 bg-[#24262b] hidden md:block"></div>
          <div className="flex flex-col items-end hidden md:flex">
            <span className="text-[10px] uppercase text-[#666] font-bold">Edge Sync Status</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00ff9d] shadow-[0_0_8px_#00ff9d]"></div>
              <span className="text-xs font-mono">/sync-batch ACTIVE</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative">
        {/* Left Sidebar: Identity & Nav */}
        <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-[#24262b] flex flex-col p-6 gap-6 bg-[#0a0b0e] shrink-0 lg:overflow-y-auto order-3 lg:order-none">
          <section>
            <h3 className="text-[10px] uppercase text-[#666] font-bold mb-3 tracking-widest">Active Identity</h3>
            <div className="p-3 bg-[#13151a] rounded-lg border border-[#1f2229] font-mono text-[11px] break-all leading-relaxed text-[#00e5ff]">
              {pubKey}
            </div>
          </section>

          {status && (
            <section>
              <h3 className="text-[10px] uppercase text-[#666] font-bold mb-3 tracking-widest">System Message</h3>
              <div className={`p-3 bg-[#13151a] rounded-lg border border-[#1f2229] text-xs leading-tight ${status.startsWith('Error') || status.startsWith('Invalid') ? 'text-[#ff4d4d]' : 'text-[#00ff9d]'}`}>
                {status}
              </div>
            </section>
          )}

          <nav className="mt-auto flex flex-col gap-2 pt-4 hidden lg:flex">
            <button onClick={() => setViewMode('wallet')} className={`flex items-center justify-start gap-3 p-3 rounded-lg text-sm transition-colors ${viewMode === 'wallet' ? 'bg-[#1a1c22] text-[#00e5ff]' : 'text-[#999] hover:bg-[#1a1c22]'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
              Dashboard
            </button>
            <button onClick={() => setViewMode('node')} className={`flex items-center justify-start gap-3 p-3 rounded-lg text-sm transition-colors ${viewMode === 'node' ? 'bg-[#1a1c22] text-[#00ff9d]' : 'text-[#999] hover:bg-[#1a1c22]'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              Node Terminal
            </button>
            <a href="/pending" className="flex items-center justify-start gap-3 p-3 text-[#999] rounded-lg text-sm hover:bg-[#1a1c22] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Offline Queue
            </a>
            <a href="/public-transactions.html" className="flex items-center justify-start gap-3 p-3 text-[#999] rounded-lg text-sm hover:bg-[#1a1c22] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0-2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Ledger
            </a>
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col p-4 md:p-8 bg-gradient-to-b from-[#0e1014] to-[#0c0d10] w-full shrink-0 lg:shrink lg:overflow-y-auto order-1 lg:order-none">
          {viewMode === 'node' ? nodeModeUI : (
            <>
              {/* Top Balance Panel */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 lg:mb-10 w-full gap-6">
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

              {/* Mobile Action Panel (Hidden on Desktop) */}
              <div className="flex flex-col md:grid md:grid-cols-2 gap-6 lg:hidden mb-8 w-full shrink-0">
                {actionPanelUI}
              </div>

              {/* Recent Transactions List */}
              <div className="flex-1 flex flex-col w-full">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">Transaction History</h4>
                  <span className="text-xs text-[#666] font-mono">Ledger Node View</span>
                </div>
                
                <div className="flex-1 bg-[#0a0b0e] border border-[#1f2229] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                  <div className="grid grid-cols-[1fr_2fr_1fr_1fr] px-6 py-4 border-b border-[#1f2229] bg-[#13151a] text-[10px] uppercase font-bold text-[#666] tracking-widest hidden md:grid">
                    <div>Type</div>
                    <div>Address / Hash</div>
                    <div className="text-right">Amount</div>
                    <div className="text-right">Status</div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto font-mono text-xs">
                    {transactions.length === 0 ? (
                      <div className="flex flex-col md:grid md:grid-cols-[1fr_2fr_1fr_1fr] px-6 py-5 border-b border-[#13151a] hover:bg-[#13151a] transition-colors gap-2 md:gap-0">
                        <div className="flex items-center gap-2 text-[#666]">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#666]"></div>
                          <span>INFO</span>
                        </div>
                        <div className="text-[#999] opacity-70">Awaiting transactions...</div>
                        <div className="text-left md:text-right text-white font-medium">-</div>
                        <div className="text-left md:text-right text-[#666]">-</div>
                      </div>
                    ) : (
                      transactions.map(tx => {
                        const isSent = tx.from_pubkey === pubKey;
                        const actionColor = isSent ? 'text-[#ff4d4d]' : 'text-[#00ff9d]';
                        const actionBg = isSent ? 'bg-[#ff4d4d]' : 'bg-[#00ff9d]';
                        const actionText = isSent ? 'SENT' : 'RECEIVED';
                        const addressShow = isSent ? tx.to_pubkey : tx.from_pubkey;
                        const maskedAddress = addressShow ? `${addressShow.substring(0, 12)}...` : '-';
                        
                        return (
                          <div key={tx.id || tx.created_at} className="flex flex-col md:grid md:grid-cols-[1fr_2fr_1fr_1fr] px-6 py-5 border-b border-[#13151a] hover:bg-[#13151a] transition-colors gap-2 md:gap-0">
                            <div className={`flex items-center gap-2 ${actionColor} font-bold`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${actionBg}`}></div>
                              <span>{actionText}</span>
                            </div>
                            <div className="text-[#999] opacity-80 pl-3 md:pl-0" title={addressShow}>{maskedAddress}</div>
                            <div className="text-left md:text-right text-white font-medium pl-3 md:pl-0 flex md:block items-center gap-2">
                              <span className="md:hidden text-[#666] mr-2">Amount:</span>
                              {isSent ? '-' : '+'} {Number(tx.amount).toFixed(2)} GDC
                            </div>
                            <div className="text-left md:text-right text-[#666] capitalize pl-3 md:pl-0 flex md:block items-center gap-2">
                              <span className="md:hidden mr-2">Status:</span>
                              {tx.status || 'Confirmed'}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="p-4 bg-[#13151a] border-t border-[#1f2229] flex justify-center mt-auto">
                    <a href="/public-transactions.html" className="text-[10px] text-[#00e5ff] uppercase font-bold tracking-widest hover:underline cursor-pointer">View Public Ledger</a>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Sidebar: Action Panel */}
        {viewMode === 'wallet' && (
          <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-[#24262b] flex-col p-6 gap-8 bg-[#0a0b0e] shrink-0 lg:overflow-y-auto hidden lg:flex order-2 lg:order-none">
            {actionPanelUI}

            <div className="mt-auto p-4 bg-[#13151a] border border-[#1f2229] rounded-xl hidden lg:block">
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
          <span>Auth: Supabase</span>
        </div>
        <div className="text-[10px] font-mono text-[#444]">
          GDC-CLI: v2.4.1
        </div>
      </footer>
    </div>
  );
}
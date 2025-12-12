import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { WebsiteData, ExtractionStatus, Stats } from './types';
import { findEmailsForUrl } from './services/geminiService';
import { exportToExcel } from './utils/fileUtils';
import InputSection from './components/InputSection';
import ResultsTable from './components/ResultsTable';
import { Play, Download, Trash2, Search, Zap, Archive, Info, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const App: React.FC = () => {
  const [websites, setWebsites] = useState<WebsiteData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetAudience, setTargetAudience] = useState('');
  
  // History state: Record<normalizedUrl, emails[]>
  const [history, setHistory] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('emailScout_history');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [notification, setNotification] = useState<string | null>(null);

  // Helper to normalize URLs for comparison (e.g. https://www.google.com -> www.google.com)
  const normalizeUrl = (url: string) => {
    return url.replace(/^(https?:\/\/)?/, '').replace(/\/$/, '').toLowerCase();
  };

  // Stats calculation
  const stats: Stats = useMemo(() => {
    const processed = websites.filter(w => w.status === ExtractionStatus.COMPLETED || w.status === ExtractionStatus.FAILED).length;
    const found = websites.filter(w => w.emails.length > 0).length;
    const total = websites.length;
    return {
      total,
      processed,
      found,
      successRate: processed > 0 ? Math.round((found / processed) * 100) : 0
    };
  }, [websites]);

  const addUrls = useCallback((urls: string[]) => {
    setNotification(null);
    const newEntries: WebsiteData[] = [];
    let skippedHistoryCount = 0;
    let skippedDuplicateCount = 0;

    // Create a Set of currently normalized URLs for fast lookup
    const currentNormalized = new Set(websites.map(w => normalizeUrl(w.url)));

    urls.forEach(url => {
      const normalized = normalizeUrl(url);

      if (currentNormalized.has(normalized)) {
        skippedDuplicateCount++;
      } else if (history[normalized]) {
        skippedHistoryCount++;
      } else {
        newEntries.push({
          id: uuidv4(),
          url: url,
          status: ExtractionStatus.IDLE,
          emails: []
        });
        currentNormalized.add(normalized); // Prevent duplicates within the new batch
      }
    });
    
    // Construct notification message
    if (skippedHistoryCount > 0) {
      let msg = `${skippedHistoryCount} website${skippedHistoryCount > 1 ? 's' : ''} already in your history were skipped.`;
      if (skippedDuplicateCount > 0) {
        msg += ` (${skippedDuplicateCount} duplicates in list ignored)`;
      }
      setNotification(msg);
    } else if (skippedDuplicateCount > 0) {
      setNotification(`${skippedDuplicateCount} duplicate website${skippedDuplicateCount > 1 ? 's' : ''} ignored.`);
    }

    if (newEntries.length > 0) {
      setWebsites(prev => [...prev, ...newEntries]);
    }
  }, [websites, history]);

  const removeWebsite = useCallback((id: string) => {
    setWebsites(prev => prev.filter(w => w.id !== id));
  }, []);

  const clearList = useCallback(() => {
    if (websites.length === 0) return;
    if (window.confirm("Are you sure you want to discard this list? Unsaved data will be lost.")) {
      setWebsites([]);
      setNotification(null);
    }
  }, [websites]);

  const saveAndClear = useCallback(() => {
    if (websites.length === 0) return;

    const newHistory = { ...history };
    let savedCount = 0;

    websites.forEach(w => {
      // Save COMPLETED and FAILED (as empty emails) so we don't scrape again.
      if (w.status === ExtractionStatus.COMPLETED || w.status === ExtractionStatus.FAILED) {
        const key = normalizeUrl(w.url);
        newHistory[key] = w.emails;
        savedCount++;
      }
    });

    localStorage.setItem('emailScout_history', JSON.stringify(newHistory));
    setHistory(newHistory);
    setWebsites([]);
    setNotification(`Saved ${savedCount} websites to history and cleared the list.`);
    
    // Auto-dismiss notification after 5s
    setTimeout(() => setNotification(null), 5000);
  }, [websites, history]);

  const processQueue = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setNotification(null);

    const pendingItems = websites.filter(w => w.status === ExtractionStatus.IDLE);
    
    // Simple sequential processing to be polite to rate limits and ensure stability
    for (const item of pendingItems) {
      // Update status to processing
      setWebsites(prev => prev.map(w => w.id === item.id ? { ...w, status: ExtractionStatus.PROCESSING } : w));

      try {
        const emails = await findEmailsForUrl(item.url, targetAudience);
        
        setWebsites(prev => prev.map(w => 
          w.id === item.id ? { 
            ...w, 
            status: ExtractionStatus.COMPLETED, 
            emails: emails 
          } : w
        ));
      } catch (error: any) {
        console.error("Processing Error", error);
        
        // Handle Rate Limiting (429) specifically
        const isRateLimit = error?.status === 429 || 
                            error?.code === 429 || 
                            error?.message?.includes('429') || 
                            error?.message?.includes('quota') || 
                            error?.message?.includes('RESOURCE_EXHAUSTED');

        if (isRateLimit) {
          setNotification("Rate limit reached (429). The scan has been paused to preserve quota. Please wait 1-2 minutes before resuming.");
          setIsProcessing(false);
          
          // Revert current item to IDLE so it can be retried later
          setWebsites(prev => prev.map(w => 
            w.id === item.id ? { ...w, status: ExtractionStatus.IDLE } : w
          ));
          return; // STOP EXECUTION
        }

        setWebsites(prev => prev.map(w => 
          w.id === item.id ? { 
            ...w, 
            status: ExtractionStatus.FAILED, 
            error: error.message || "Failed to scout" 
          } : w
        ));
      }

      // DELAY: 4000ms
      // Gemini Free Tier limit is approx 15 RPM (1 request every 4 seconds).
      // We increased this from 500ms to 4000ms to avoid 429 errors.
      await new Promise(resolve => setTimeout(resolve, 4000));
    }

    setIsProcessing(false);
  };

  const handleExport = () => {
    if (websites.length === 0) return;
    exportToExcel(websites);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12 font-sans">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white shadow-sm">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">EmailScout AI</h1>
              <p className="text-xs text-slate-500 font-medium">Intelligent Lead Discovery</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex items-center gap-4 mr-4 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1">
                   <Zap className="w-3 h-3 text-yellow-500" />
                   Powered by Gemini Flash 2.5
                </span>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Top Controls */}
        <div className="mb-8">
           <InputSection 
             onUrlsExtracted={addUrls} 
             isProcessing={isProcessing} 
             targetAudience={targetAudience}
             setTargetAudience={setTargetAudience}
           />
           
           {notification && (
             <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 text-sm animate-fade-in ${
               notification.toLowerCase().includes('rate limit') || notification.toLowerCase().includes('error') 
                 ? 'bg-red-50 border border-red-100 text-red-800' 
                 : 'bg-blue-50 border border-blue-100 text-blue-800'
             }`}>
                {notification.toLowerCase().includes('rate limit') ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <Info className="w-4 h-4 flex-shrink-0" />}
                <span>{notification}</span>
                <button 
                  onClick={() => setNotification(null)}
                  className={`ml-auto ${notification.toLowerCase().includes('rate limit') ? 'text-red-400 hover:text-red-600' : 'text-blue-400 hover:text-blue-600'}`}
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>
           )}
        </div>

        {/* Action Bar & Stats */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
             <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-6">
                <div className="flex flex-col">
                   <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total</span>
                   <span className="text-lg font-bold text-slate-800 leading-none">{stats.total}</span>
                </div>
                <div className="w-px h-8 bg-slate-100"></div>
                <div className="flex flex-col">
                   <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Found</span>
                   <span className="text-lg font-bold text-emerald-600 leading-none">{stats.found}</span>
                </div>
                <div className="w-px h-8 bg-slate-100"></div>
                <div className="flex flex-col">
                   <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Success</span>
                   <span className="text-lg font-bold text-primary-600 leading-none">{stats.successRate}%</span>
                </div>
             </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={clearList}
              disabled={isProcessing || websites.length === 0}
              className="px-3 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
              title="Discard current list without saving"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Discard</span>
            </button>
            <button
              onClick={saveAndClear}
              disabled={isProcessing || websites.length === 0}
              className="px-3 py-2 text-slate-700 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
              title="Save completed emails to history and clear list"
            >
              <Archive className="w-4 h-4" />
              <span className="hidden sm:inline">Save & Clear</span>
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
            <button
              onClick={handleExport}
              disabled={websites.length === 0}
              className="px-4 py-2 text-slate-700 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
            <button
              onClick={processQueue}
              disabled={isProcessing || websites.every(w => w.status !== ExtractionStatus.IDLE)}
              className={`px-6 py-2 rounded-lg text-sm font-bold text-white shadow-md flex items-center gap-2 transition-all transform active:scale-95 ${
                isProcessing 
                  ? 'bg-slate-400 cursor-wait' 
                  : websites.every(w => w.status !== ExtractionStatus.IDLE) && websites.length > 0
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-primary-600 hover:bg-primary-700'
              } disabled:opacity-70 disabled:cursor-not-allowed`}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  {websites.length > 0 && websites.every(w => w.status !== ExtractionStatus.IDLE) ? "Scan Complete" : "Start Extraction"}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Area */}
        <ResultsTable data={websites} onRemove={removeWebsite} />

      </main>
    </div>
  );
};

export default App;
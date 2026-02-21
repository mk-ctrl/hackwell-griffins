import React, { useEffect, useState } from 'react';
import { ShieldCheck, BrainCircuit, Activity } from 'lucide-react'; // For modern icons
import { motion, AnimatePresence } from 'framer-motion'; // For smooth animations

function App() {
  const [scrapedText, setScrapedText] = useState("");
  const [thoughts, setThoughts] = useState([]);
  const [score, setScore] = useState(0);

  useEffect(() => {
    // 1. Listen for data from the Content Script (Scraper)
    const messageListener = (message) => {
      if (message.type === "NEW_POST_DETECTED") {
        setScrapedText(message.text);
        startAgentAnalysis(message.text);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  // 2. Simulate the "Agentic Reasoning" for the UI
  const startAgentAnalysis = (text) => {
    setThoughts([]); // Clear previous thoughts
    setScore(0);
    
    // In the final version, this will be a WebSocket call to your Python Backend
    const steps = [
      "Deconstructing linguistic patterns...",
      "Searching for Emotional Framing (Fear detected)...",
      "Cross-referencing with historical propaganda DNA...",
      "Analysis complete: High Manipulation Intent."
    ];

    steps.forEach((step, index) => {
      setTimeout(() => {
        setThoughts(prev => [...prev, step]);
        if (index === steps.length - 1) setScore(85); // High risk score
      }, (index + 1) * 1000);
    });
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-200 flex flex-col font-sans overflow-hidden">
      {/* Header Section */}
      <div className="p-4 border-b border-slate-800 bg-slate-900 flex items-center gap-2">
        <ShieldCheck className="text-emerald-400" />
        <h1 className="font-bold text-lg">MindArmor XAI</h1>
      </div>

      {/* Cognitive Friction Meter */}
      <div className="p-6 bg-slate-900/50">
        <div className="flex justify-between text-[10px] text-slate-500 mb-2 font-mono">
          <span>LOGIC (SYSTEM 2)</span>
          <span>EMOTION (SYSTEM 1)</span>
        </div>
        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500"
          />
        </div>
      </div>

      {/* Live Thought Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Agent Reasoning</p>
        <AnimatePresence>
          {thoughts.map((thought, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-3 bg-slate-800/40 border-l-2 border-emerald-500 rounded-r-lg text-sm"
            >
              {thought}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Scraped Content Preview */}
      {scrapedText && (
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <p className="text-[10px] text-slate-500 mb-1">CURRENTLY ANALYZING:</p>
          <p className="text-xs italic text-slate-400 line-clamp-2">"{scrapedText}"</p>
        </div>
      )}
    </div>
  );
}

export default App;
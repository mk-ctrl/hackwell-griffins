import React, { useEffect, useRef, useState, useCallback } from 'react';
import './style.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnalysisItem {
  original: string;
  risk: number;
  type?: string;
  explanation: string;
  neutral?: string;
  source?: 'backend' | 'heuristic';
}

interface SiteStats {
  totalElements: number;
  manipulativeCount: number;
  avgRisk: number;
  lastVisit: number;
}

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function riskLabel(risk: number): string {
  if (risk > 0.7) return 'High';
  if (risk > 0.35) return 'Medium';
  return 'Low';
}

function riskClass(risk: number): string {
  if (risk > 0.7) return 'risk-high';
  if (risk > 0.35) return 'risk-medium';
  return 'risk-low';
}

function trustLabel(density: number): string {
  if (density > 0.5) return 'Low Trust';
  if (density > 0.2) return 'Moderate';
  return 'Trusted';
}

function trustClass(density: number): string {
  if (density > 0.5) return 'trust-low';
  if (density > 0.2) return 'trust-med';
  return 'trust-high';
}

// Gamification: manipulation type pool for quiz distractors
const MANIPULATION_TYPES = [
  'Fear Appeal', 'Absolute Language', 'Scarcity', 'Bandwagon',
  'False Dilemma', 'Emotional Framing', 'Urgency', 'Ad Hominem',
];

function getQuizChoices(correctType: string): string[] {
  const correct = correctType || 'Emotional Framing';
  const distractors = MANIPULATION_TYPES.filter(
    t => t.toLowerCase() !== correct.toLowerCase()
  );
  // Shuffle & pick 2 distractors
  const shuffled = distractors.sort(() => Math.random() - 0.5).slice(0, 2);
  const choices = [...shuffled, correct].sort(() => Math.random() - 0.5);
  return choices;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const RiskBadge: React.FC<{ risk: number }> = ({ risk }) => (
  <span className={`risk-badge ${riskClass(risk)}`}>
    {riskLabel(risk)} · {Math.round(risk * 100)}%
  </span>
);

const RiskBar: React.FC<{ risk: number }> = ({ risk }) => (
  <div className="risk-bar-track">
    <div
      className={`risk-bar-fill ${riskClass(risk)}`}
      style={{ width: `${Math.round(risk * 100)}%` }}
    />
  </div>
);

// ─── Toggle Switch ───────────────────────────────────────────────────────────

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon?: string;
}> = ({ checked, onChange, label, icon }) => (
  <label className="toggle-row">
    {icon && <span className="toggle-icon">{icon}</span>}
    <span className="toggle-label">{label}</span>
    <span className={`toggle-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="toggle-knob" />
    </span>
  </label>
);

// ─── Deep Dive Chat ──────────────────────────────────────────────────────────

const DeepDiveChat: React.FC<{ item: AnalysisItem }> = ({ item }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = () => {
    const question = input.trim();
    if (!question) return;

    setMessages(prev => [...prev, { role: 'user', text: question }]);
    setInput('');
    setIsTyping(true);

    chrome.runtime.sendMessage(
      { action: 'deepDiveChat', context: item, question },
      (response) => {
        setIsTyping(false);
        if (response?.reply) {
          setMessages(prev => [...prev, { role: 'ai', text: response.reply }]);
        }
      }
    );
  };

  return (
    <div className="deep-dive-area">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-hint">Ask anything about this manipulation pattern…</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble chat-bubble-${msg.role}`}>
            {msg.text}
          </div>
        ))}
        {isTyping && (
          <div className="chat-bubble chat-bubble-ai">
            <span className="typing-indicator">
              <span /><span /><span />
            </span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="chat-input-row">
        <input
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Why is this manipulative?"
        />
        <button className="chat-send" onClick={sendMessage}>→</button>
      </div>
    </div>
  );
};

// ─── Analysis Card ───────────────────────────────────────────────────────────

interface AnalysisCardProps {
  item: AnalysisItem;
  index: number;
  isActive: boolean;
  trainingMode: boolean;
  onCorrectGuess: () => void;
  onWrongGuess: () => void;
  debiasEnabled: boolean;
}

const AnalysisCard: React.FC<AnalysisCardProps> = ({
  item, index, isActive, trainingMode, onCorrectGuess, onWrongGuess, debiasEnabled
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showDeepDive, setShowDeepDive] = useState(false);
  const [quizState, setQuizState] = useState<'pending' | 'correct' | 'wrong'>('pending');
  const [quizChoices] = useState(() => getQuizChoices(item.type ?? ''));

  useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isActive]);

  const handleQuizAnswer = (answer: string) => {
    if (quizState !== 'pending') return;
    const correct = answer.toLowerCase() === (item.type ?? '').toLowerCase();
    if (correct) {
      setQuizState('correct');
      onCorrectGuess();
    } else {
      setQuizState('wrong');
      onWrongGuess();
    }
  };

  const isRevealed = !trainingMode || quizState !== 'pending';

  return (
    <div
      ref={cardRef}
      className={`analysis-card ${riskClass(item.risk)} ${isActive ? 'card-active' : ''} ${quizState === 'correct' ? 'quiz-flash-correct' : ''} ${quizState === 'wrong' ? 'quiz-flash-wrong' : ''}`}
      data-analysis-index={index}
    >
      {/* Header */}
      <div className="card-header">
        <span className="card-type">
          {isRevealed ? (item.type ?? 'Detected Pattern') : '❓ What type of manipulation?'}
        </span>
        <RiskBadge risk={item.risk} />
      </div>

      <RiskBar risk={item.risk} />

      {/* Original text */}
      <div className="card-section">
        <span className="card-label">Original</span>
        <p className="card-text card-original">"{item.original}"</p>
      </div>

      {/* Training quiz */}
      {trainingMode && quizState === 'pending' && (
        <div className="quiz-section">
          <span className="card-label">🎮 Identify the technique</span>
          <div className="quiz-buttons">
            {quizChoices.map(choice => (
              <button
                key={choice}
                className="quiz-btn"
                onClick={() => handleQuizAnswer(choice)}
              >
                {choice}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quiz result */}
      {trainingMode && quizState !== 'pending' && (
        <div className={`quiz-result ${quizState}`}>
          {quizState === 'correct' ? '✅ Correct! +10 pts' : `❌ It was: ${item.type}`}
        </div>
      )}

      {/* Explanation (hidden in training until answered) */}
      {isRevealed && item.explanation && (
        <div className="card-section">
          <span className="card-label">Why it's manipulative</span>
          <p className="card-text">{item.explanation}</p>
        </div>
      )}

      {/* Neutral */}
      {isRevealed && item.neutral && (
        <div className="card-section">
          <span className="card-label">Neutral version</span>
          <p className="card-text card-neutral">"{item.neutral}"</p>
        </div>
      )}

      {/* Badges row */}
      <div className="card-badges">
        {item.source === 'heuristic' && <span className="badge-heuristic">⚡ Heuristic</span>}
        {item.risk > 0.9 && <span className="badge-pause">🧘 Pause triggered</span>}
        {debiasEnabled && <span className="badge-debiased">🛡️ Neutralized</span>}
      </div>

      {/* Deep Dive toggle */}
      {isRevealed && (
        <>
          <button
            className="deep-dive-btn"
            onClick={() => setShowDeepDive(!showDeepDive)}
          >
            {showDeepDive ? '▾ Close Deep Dive' : '💬 Deep Dive'}
          </button>
          {showDeepDive && <DeepDiveChat item={item} />}
        </>
      )}
    </div>
  );
};

// ─── Site Scoreboard ─────────────────────────────────────────────────────────

const SiteScoreboard: React.FC = () => {
  const [stats, setStats] = useState<Record<string, SiteStats>>({});
  const [currentDomain, setCurrentDomain] = useState('');

  useEffect(() => {
    try {
      chrome.runtime.sendMessage({ action: 'getSiteStats' }, (res) => {
        if (res?.stats) setStats(res.stats);
      });
    } catch { /* permissions not available */ }

    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) {
          try { setCurrentDomain(new URL(tabs[0].url).hostname); } catch { }
        }
      });
    } catch { /* tabs permission not available */ }
  }, []);

  const sortedDomains = Object.entries(stats)
    .map(([domain, s]) => ({
      domain,
      density: s.totalElements > 0 ? s.manipulativeCount / s.totalElements : 0,
      ...s,
    }))
    .sort((a, b) => b.density - a.density);

  const currentSite = sortedDomains.find(s => s.domain === currentDomain);

  return (
    <div className="scoreboard">
      {/* Current site card */}
      {currentSite ? (
        <div className={`site-current ${trustClass(currentSite.density)}`}>
          <div className="site-current-header">
            <span className="site-domain-lg">{currentSite.domain}</span>
            <span className={`trust-badge ${trustClass(currentSite.density)}`}>
              {trustLabel(currentSite.density)}
            </span>
          </div>
          <div className="trust-meter">
            <div className="trust-meter-track">
              <div
                className={`trust-meter-fill ${trustClass(currentSite.density)}`}
                style={{ width: `${Math.round(currentSite.density * 100)}%` }}
              />
            </div>
            <span className="trust-meter-label">
              {Math.round(currentSite.density * 100)}% manipulation density
            </span>
          </div>
          <div className="site-stat-row">
            <span>{currentSite.manipulativeCount} patterns detected</span>
            <span>Last: {new Date(currentSite.lastVisit).toLocaleDateString()}</span>
          </div>
        </div>
      ) : (
        <div className="site-current empty">
          <span>No data for current site yet</span>
        </div>
      )}

      {/* All sites list */}
      <div className="site-list-header">All Tracked Sites</div>
      {sortedDomains.length === 0 ? (
        <div className="site-empty">Browse some pages to start tracking</div>
      ) : (
        <div className="site-list">
          {sortedDomains.map(s => (
            <div
              key={s.domain}
              className={`site-row ${s.domain === currentDomain ? 'current' : ''}`}
            >
              <span className="site-domain">{s.domain}</span>
              <div className="site-density-bar-wrap">
                <div className="site-density-bar">
                  <div
                    className={`site-density-fill ${trustClass(s.density)}`}
                    style={{ width: `${Math.round(s.density * 100)}%` }}
                  />
                </div>
                <span className={`site-density-pct ${trustClass(s.density)}`}>
                  {Math.round(s.density * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Side Panel ─────────────────────────────────────────────────────────

const SidePanel: React.FC = () => {
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [highlightCount, setHighlightCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'analysis' | 'scoreboard'>('analysis');

  // Feature: De-bias toggle
  const [debiasEnabled, setDebiasEnabled] = useState(false);

  // Feature: Training mode
  const [trainingMode, setTrainingMode] = useState(false);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);

  // Feature: Agent thought streaming & backend status
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [backendConnected, setBackendConnected] = useState(false);
  const thoughtsEndRef = useRef<HTMLDivElement>(null);

  // Load persisted state
  useEffect(() => {
    try {
      chrome.storage.local.get(['debiasEnabled', 'trainingPoints', 'trainingStreak'], (data) => {
        if (data.debiasEnabled) setDebiasEnabled(true);
        if (data.trainingPoints) setPoints(Number(data.trainingPoints));
        if (data.trainingStreak) setStreak(Number(data.trainingStreak));
      });
    } catch { /* storage permission not available */ }
  }, []);

  // De-bias sync
  const handleDebiasToggle = useCallback((enabled: boolean) => {
    setDebiasEnabled(enabled);
    chrome.storage.local.set({ debiasEnabled: enabled });
    chrome.runtime.sendMessage({ action: 'setDebiasMode', enabled }).catch(() => { });
  }, []);

  // Training scoring
  const handleCorrectGuess = useCallback(() => {
    setPoints(p => {
      const newP = p + 10;
      chrome.storage.local.set({ trainingPoints: newP });
      return newP;
    });
    setStreak(s => {
      const newS = s + 1;
      chrome.storage.local.set({ trainingStreak: newS });
      return newS;
    });
  }, []);

  const handleWrongGuess = useCallback(() => {
    setStreak(0);
    chrome.storage.local.set({ trainingStreak: 0 });
  }, []);

  const addItem = useCallback((item: AnalysisItem) => {
    setAnalyses(prev => {
      if (prev.some(a => a.original === item.original)) return prev;
      return [...prev, item];
    });
  }, []);

  // Auto-scroll thoughts
  useEffect(() => {
    thoughtsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thoughts]);

  // Message routing
  useEffect(() => {
    const listener = (msg: any) => {
      // Backend analysis results from the WebSocket pipeline
      if (msg.action === 'backendAnalysis' && msg.item) {
        addItem(msg.item);
        setStatus('done');
        return;
      }

      // Agent thought streaming (XAI transparency)
      if (msg.action === 'agentThought') {
        setThoughts(prev => {
          const next = [...prev, msg.content as string];
          return next.length > 50 ? next.slice(-50) : next; // cap at 50 lines
        });
        return;
      }

      // Scan started notification
      if (msg.action === 'scanStarted') {
        setStatus('scanning');
        return;
      }

      // Backend connection status
      if (msg.action === 'backendStatus') {
        setBackendConnected(!!msg.connected);
        return;
      }

      if (msg.action === 'highlightManipulativeContent') {
        const items: AnalysisItem[] = (msg.items ?? []).map((i: any) => ({ ...i, source: 'backend' }));
        setAnalyses(items);
        setStatus('done');
        return;
      }

      if (msg.action === 'highlightsApplied') {
        setHighlightCount(msg.count ?? 0);
        setStatus('done');
        return;
      }

      if (msg.action === 'scrollToAnalysis') {
        const idx = Number(msg.index);
        setActiveIndex(idx);
        setActiveTab('analysis');
        setTimeout(() => setActiveIndex(null), 2000);
        return;
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [addItem]);

  const clearAll = () => {
    setAnalyses([]);
    setThoughts([]);
    setHighlightCount(0);
    setStatus('idle');
    setActiveIndex(null);
    chrome.runtime.sendMessage({ action: 'clearHighlights' }).catch(() => { });
  };

  const patternCount = highlightCount || analyses.length;

  return (
    <div className="panel-root">
      {/* ── Header ── */}
      <header className="panel-header">
        <div className="panel-brand">
          <span className="panel-logo">🧠</span>
          <div>
            <h1 className="panel-title">MindArmor</h1>
            <p className="panel-subtitle">
              XAI Manipulation Detector
              <span className={`backend-dot ${backendConnected ? 'connected' : ''}`}
                title={backendConnected ? 'Backend connected' : 'Backend offline (using heuristics)'}
              />
            </p>
          </div>
          {/* Training points */}
          {trainingMode && (
            <div className="points-badge">
              🎯 {points} pts · 🔥 {streak}
            </div>
          )}
        </div>

        <div className="panel-status-row">
          <span className={`status-dot ${status}`} />
          <span className="status-label">
            {status === 'idle' && 'Monitoring page…'}
            {status === 'scanning' && 'Scanning content…'}
            {status === 'done' && `${patternCount} pattern${patternCount !== 1 ? 's' : ''} found`}
          </span>
        </div>

        {/* Toggles */}
        <div className="toggles-row">
          <ToggleSwitch
            checked={debiasEnabled}
            onChange={handleDebiasToggle}
            label="De-Bias Page"
            icon="🛡️"
          />
          <ToggleSwitch
            checked={trainingMode}
            onChange={setTrainingMode}
            label="Training Mode"
            icon="🎮"
          />
        </div>
      </header>

      {/* ── Theory banner ── */}
      <div className="theory-banner">
        <div className="theory-item">
          <span className="theory-icon">⚡</span>
          <span><strong>System 1</strong> — Fast, emotional</span>
        </div>
        <div className="theory-divider">vs</div>
        <div className="theory-item">
          <span className="theory-icon">🔍</span>
          <span><strong>System 2</strong> — Slow, logical</span>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          🔬 Analysis
        </button>
        <button
          className={`tab-btn ${activeTab === 'scoreboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('scoreboard')}
        >
          📊 Scoreboard
        </button>
      </div>

      {/* ── Agent Thought Stream ── */}
      {thoughts.length > 0 && status === 'scanning' && (
        <div className="thought-stream">
          <div className="thought-stream-header">🧠 Agent Reasoning</div>
          <div className="thought-stream-log">
            {thoughts.slice(-8).map((t, i) => (
              <div key={i} className="thought-line">{t}</div>
            ))}
            <div ref={thoughtsEndRef} />
          </div>
        </div>
      )}

      {/* ── Content area ── */}
      <div className="card-list">
        {activeTab === 'scoreboard' ? (
          <SiteScoreboard />
        ) : analyses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🛡️</div>
            <p>No manipulative content detected yet.</p>
            <p className="empty-hint">Browse any article or social feed — MindArmor analyzes content in real time.</p>
          </div>
        ) : (
          <>
            <div className="list-header">
              <span className="list-count">
                {analyses.length} pattern{analyses.length !== 1 ? 's' : ''} detected
              </span>
              <button className="btn-clear" onClick={clearAll}>Clear all</button>
            </div>
            {analyses.map((item, i) => (
              <AnalysisCard
                key={`${item.original.slice(0, 20)}-${i}`}
                item={item}
                index={i}
                isActive={activeIndex === i}
                trainingMode={trainingMode}
                onCorrectGuess={handleCorrectGuess}
                onWrongGuess={handleWrongGuess}
                debiasEnabled={debiasEnabled}
              />
            ))}
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="panel-footer">
        <span>Based on Dual Process Theory</span>
        <span className="footer-sep">·</span>
        <span>Privacy-first · no data stored</span>
      </footer>
    </div>
  );
};

export default SidePanel;
// entrypoints/background.ts
import { defineBackground } from '#imports';

// ─── Types ───────────────────────────────────────────────────────────────────
interface SiteStats {
  totalElements: number;
  manipulativeCount: number;
  avgRisk: number;
  lastVisit: number;
}
type SiteStatsMap = Record<string, SiteStats>;

interface BackendResult {
  risk_score: number;
  type: string;
  explanation: string;
  neutralized: string;
}

// ─── Canned Deep Dive responses (stub — replace with real API later) ────────
const DEEP_DIVE_RESPONSES: Record<string, string> = {
  'fear appeal':
    'Fear appeals work by activating your amygdala — the brain\'s threat detection center. When you feel fear, your prefrontal cortex (responsible for critical thinking) gets temporarily suppressed. This is an evolutionary survival mechanism that manipulative content exploits. The key defense is to notice the fear response and deliberately slow down your reading.',
  'absolute language':
    'Words like "always," "never," "everyone," and "no one" are called universals. They feel authoritative but are almost never factually true. They work by preventing nuance — if something is "always" true, there\'s no room for exceptions or debate. When you spot these, ask yourself: "Can I think of even one exception?"',
  'urgency':
    'Urgency framing creates artificial time pressure. When you feel rushed, you skip System 2 deliberation and rely on gut reactions (System 1). Real urgency exists, but manipulative urgency is characterized by vague deadlines and emotional stakes rather than factual ones. Ask: "What actually happens if I wait 24 hours?"',
  'scarcity':
    'Scarcity triggers are based on loss aversion — we psychologically weight losses about 2x more than equivalent gains (Kahneman & Tversky, 1979). Phrases like "only 3 left" or "limited time" exploit this bias. Counter it by asking: "Would I want this if there were unlimited supply?"',
  'bandwagon':
    'Bandwagon effects exploit our tribal instincts. Humans evolved to follow group consensus for survival. When content says "everyone is doing X" or "millions agree," it bypasses your individual judgment. Defense: evaluate the claim on its own merits, regardless of popularity.',
  'emotional framing':
    'Emotional framing selects specific words to trigger emotional responses rather than rational evaluation. "Crisis" vs "challenge," "destroyed" vs "affected" — the facts may be identical, but the emotional weight is different. Notice which emotions a sentence makes you feel, then re-read just the facts.',
  'false dilemma':
    'A false dilemma presents only two options when more exist. "You\'re either with us or against us" ignores the vast middle ground. This forces premature commitment by eliminating nuance. Counter it by asking: "What are the other options not being mentioned?"',
  'default':
    'This manipulation technique works by targeting your System 1 (fast, intuitive) thinking. The key defense is to engage System 2 (slow, analytical) thinking: pause, identify the emotional trigger, separate facts from framing, and consider what information might be missing. Media literacy is a skill that improves with practice.',
};

function getDeepDiveResponse(type: string, question: string): string {
  const lower = (type || '').toLowerCase();
  for (const [key, response] of Object.entries(DEEP_DIVE_RESPONSES)) {
    if (key === 'default') continue;
    if (lower.includes(key) || question.toLowerCase().includes(key)) {
      return response;
    }
  }
  return DEEP_DIVE_RESPONSES['default'];
}

// ─── WebSocket Manager ──────────────────────────────────────────────────────

const WS_URL = 'ws://localhost:8001/ws';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// Pending analysis: maps original text → { tabId, elementId, results[] }
interface PendingAnalysis {
  tabId: number;
  elementId: string;
  originalText: string;
  results: BackendResult[];
}
let pendingAnalysis: PendingAnalysis | null = null;

function broadcastToExtension(message: any): void {
  chrome.runtime.sendMessage(message).catch(() => { });
}

function connectWebSocket(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    ws = new WebSocket(WS_URL);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('[MindArmor] Backend WebSocket connected');
    reconnectAttempts = 0;
    broadcastToExtension({ action: 'backendStatus', connected: true });
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === 'thought') {
        // Stream thought to sidepanel for real-time display
        broadcastToExtension({ action: 'agentThought', content: msg.content });
        return;
      }

      if (msg.type === 'result' && msg.data) {
        const result: BackendResult = msg.data;

        if (pendingAnalysis) {
          pendingAnalysis.results.push(result);

          // Build analysis item from backend result
          const item = {
            original: pendingAnalysis.originalText,
            risk: result.risk_score,
            type: result.type,
            explanation: result.explanation,
            neutral: result.neutralized,
            source: 'backend' as const,
          };

          // Send to content script for highlighting
          if (pendingAnalysis.tabId) {
            chrome.tabs.sendMessage(pendingAnalysis.tabId, {
              action: 'highlightManipulativeContent',
              items: [item],
            }).catch(() => { });
          }

          // Send to sidepanel for display
          broadcastToExtension({
            action: 'backendAnalysis',
            item,
          });

          pendingAnalysis = null;
        }
        return;
      }

      if (msg.type === 'error') {
        console.warn('[MindArmor] Backend error:', msg.content);
        broadcastToExtension({ action: 'agentThought', content: `⚠️ ${msg.content}` });
        pendingAnalysis = null;
        return;
      }

      if (msg.type === 'info') {
        broadcastToExtension({ action: 'agentThought', content: msg.content });
        pendingAnalysis = null;
        return;
      }

    } catch (err) {
      console.error('[MindArmor] Failed to parse backend message:', err);
    }
  };

  ws.onclose = () => {
    console.log('[MindArmor] Backend WebSocket disconnected');
    ws = null;
    broadcastToExtension({ action: 'backendStatus', connected: false });
    scheduleReconnect();
  };

  ws.onerror = () => {
    // onclose will also fire after onerror, which handles reconnect
    ws?.close();
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts), RECONNECT_MAX_MS);
  reconnectAttempts++;
  console.log(`[MindArmor] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWebSocket();
  }, delay);
}

function sendToBackend(text: string, tabId: number, elementId: string): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false; // Backend not available
  }

  pendingAnalysis = {
    tabId,
    elementId,
    originalText: text.length > 120 ? text.slice(0, 120) + '…' : text,
    results: [],
  };

  ws.send(JSON.stringify({ text }));
  broadcastToExtension({ action: 'agentThought', content: '🔌 Sending to backend for deep analysis...' });
  return true;
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Start backend connection
  connectWebSocket();

  // ── Tab change: optional cleanup ──────────────────────────────────────────
  chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    // Could send clearHighlights to old tab here
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      // Could auto-open side panel for high-risk sites later
    }
  });

  // ── Message relay hub ─────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // ── Content script → Backend analysis ───────────────────────────────────
    if (message.type === 'analyze' && sender.tab?.id) {
      const text: string = message.text ?? '';
      const tabId = sender.tab.id;
      const elementId = message.elementId ?? '';

      // Notify sidepanel that scanning started
      broadcastToExtension({ action: 'scanStarted' });

      // Try sending to backend; fallback to heuristic if unavailable
      const sent = sendToBackend(text, tabId, elementId);

      if (!sent) {
        // Fallback: basic heuristic (same as before)
        broadcastToExtension({
          action: 'agentThought',
          content: '⚡ Backend offline — using local heuristic analysis',
        });
        const neutral = text
          .replace(/urgent|crisis/gi, 'reported')
          .replace(/disgusting|outrageous/gi, 'concerning');
        broadcastToExtension({
          action: 'backendAnalysis',
          item: {
            original: text.length > 120 ? text.slice(0, 120) + '…' : text,
            risk: 0.65,
            type: 'Emotional framing',
            explanation: 'Uses emotionally charged language that may trigger System 1 (fast, reactive) thinking.',
            neutral,
            source: 'heuristic',
          },
        });
      }

      sendResponse({ ok: true });
      return true;
    }

    // ── Side panel → Content script relay (setDebiasMode, clearHighlights) ──
    if (message.action === 'setDebiasMode' || message.action === 'clearHighlights') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, message)
            .then(res => sendResponse(res))
            .catch(() => sendResponse({ ok: false }));
        } else {
          sendResponse({ ok: false });
        }
      });
      return true; // async sendResponse
    }

    // ── Side panel → Content script relay (highlightManipulativeContent) ─────
    if (message.action === 'highlightManipulativeContent' && !sender.tab) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, message)
            .then(res => sendResponse(res))
            .catch(() => sendResponse({ ok: false }));
        }
      });
      return true;
    }

    // ── Site stats: update on highlightsApplied ─────────────────────────────
    if (message.action === 'highlightsApplied' && message.url) {
      try {
        const domain = new URL(message.url).hostname;
        chrome.storage.local.get('siteStats', (data) => {
          const stats: SiteStatsMap = (data.siteStats ?? {}) as SiteStatsMap;
          const existing = stats[domain] ?? { totalElements: 0, manipulativeCount: 0, avgRisk: 0, lastVisit: 0 };

          existing.manipulativeCount += (message.count ?? 0);
          existing.totalElements += Math.max(message.count ?? 0, 1);
          existing.avgRisk = existing.manipulativeCount / Math.max(existing.totalElements, 1);
          existing.lastVisit = Date.now();

          stats[domain] = existing;
          chrome.storage.local.set({ siteStats: stats });
        });
      } catch { }
      return false;
    }

    // ── getSiteStats: return all site stats to side panel ────────────────────
    if (message.action === 'getSiteStats') {
      chrome.storage.local.get('siteStats', (data) => {
        sendResponse({ stats: (data.siteStats ?? {}) as SiteStatsMap });
      });
      return true;
    }

    // ── Manual re-connect to backend ────────────────────────────────────────
    if (message.action === 'reconnectBackend') {
      connectWebSocket();
      sendResponse({ ok: true });
      return true;
    }

    // ── Deep Dive Chat (stubbed) ────────────────────────────────────────────
    if (message.action === 'deepDiveChat') {
      const response = getDeepDiveResponse(
        message.context?.type ?? '',
        message.question ?? ''
      );
      setTimeout(() => {
        sendResponse({ reply: response });
      }, 800 + Math.random() * 700);
      return true;
    }

    return false;
  });
});

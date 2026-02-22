import { defineContentScript } from '#imports';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnalysisItem {
  original: string;
  risk: number;
  type?: string;
  explanation: string;
  neutral: string;
}

// ─── Module-level state ──────────────────────────────────────────────────────
let _lastItems: AnalysisItem[] = [];
let _isDebiasMode = false;

export default defineContentScript({
  matches: ['<all_urls>'],

  main() {
    console.log('[MindArmor] Content script active on:', location.href);

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION A: Injected page-level stylesheet
    // ──────────────────────────────────────────────────────────────────────────
    function injectStyles(): void {
      if (document.getElementById('mindarmor-styles')) return;

      const style = document.createElement('style');
      style.id = 'mindarmor-styles';
      style.textContent = `
        /* ── Highlight base ─────────────────────────────── */
        .mindarmor-highlight {
          cursor: help !important;
          border-radius: 3px !important;
          padding: 1px 3px !important;
          transition: all 0.2s ease !important;
          display: inline !important;
          position: relative;
        }
        .mindarmor-highlight:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 0 6px rgba(0, 0, 0, 0.25) !important;
          z-index: 9999;
        }

        /* ── Click pulse ────────────────────────────────── */
        @keyframes mindarmor-pulse {
          0%   { box-shadow: 0 0 0 0px rgba(0, 123, 255, 0.6); }
          50%  { box-shadow: 0 0 0 5px rgba(0, 123, 255, 0.25); }
          100% { box-shadow: 0 0 0 0px rgba(0, 123, 255, 0); }
        }
        .mindarmor-pulse {
          animation: mindarmor-pulse 0.6s ease-out 2 !important;
        }

        /* ── De-biased state ────────────────────────────── */
        .mindarmor-highlight.debiased {
          background: rgba(76, 175, 80, 0.18) !important;
          border-bottom: 2px solid rgba(76, 175, 80, 0.5) !important;
          font-style: italic !important;
        }
        .mindarmor-highlight.debiased::after {
          content: '🛡️';
          font-size: 10px;
          margin-left: 2px;
          font-style: normal;
        }

        /* ── Cognitive Pause overlay ────────────────────── */
        .mindarmor-pause-overlay {
          position: absolute;
          inset: -8px -6px;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
          background: rgba(15, 15, 19, 0.80) !important;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 10001;
          gap: 6px;
          padding: 12px 16px;
          transition: opacity 0.5s ease;
          border: 1px solid rgba(124, 58, 237, 0.3);
          box-shadow: 0 0 20px rgba(124, 58, 237, 0.15);
        }
        .mindarmor-pause-overlay .pause-icon {
          font-size: 22px;
          line-height: 1;
        }
        .mindarmor-pause-overlay .pause-message {
          color: #e0e0f0;
          font-size: 12px;
          text-align: center;
          line-height: 1.5;
          font-family: system-ui, sans-serif;
          max-width: 320px;
        }
        .mindarmor-pause-overlay .pause-timer {
          color: #c084fc;
          font-size: 20px;
          font-weight: 700;
          font-family: system-ui, sans-serif;
        }
        .mindarmor-pause-overlay .pause-skip {
          color: #9494b0;
          font-size: 11px;
          cursor: pointer;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 4px;
          padding: 2px 10px;
          background: transparent;
          font-family: system-ui, sans-serif;
          transition: color 0.2s, border-color 0.2s;
        }
        .mindarmor-pause-overlay .pause-skip:hover {
          color: #f0f0fa;
          border-color: rgba(255,255,255,0.3);
        }
        @keyframes mindarmor-countdown-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.15); }
        }
        .mindarmor-pause-overlay .pause-timer {
          animation: mindarmor-countdown-pulse 1s ease-in-out infinite;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    injectStyles();

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION B: Heuristic detection (fast-path fallback)
    // ──────────────────────────────────────────────────────────────────────────
    const manipulativeKeywords: Record<string, string[]> = {
      fear: ['crisis', 'disaster', 'urgent', 'warning', 'danger', 'collapse'],
      outrage: ['outrageous', 'disgusting', 'shameful', 'betrayal', 'attack'],
      absolute: ['always', 'never', 'everyone', 'no one', 'all', 'none'],
    };

    function isManipulative(text: string): { type: string; score: number } | null {
      const lower = text.toLowerCase();
      for (const [type, words] of Object.entries(manipulativeKeywords)) {
        if (words.some(w => lower.includes(w))) {
          return { type, score: 0.6 + Math.random() * 0.3 };
        }
      }
      return null;
    }

    function heuristicHighlight(el: HTMLElement, info: { type: string; score: number }): void {
      el.style.backgroundColor = 'rgba(255, 193, 7, 0.2)';
      el.style.border = '1px solid rgba(255, 193, 7, 0.5)';
      el.title = `[MindArmor Heuristic] ${info.type}: ${Math.round(info.score * 100)}% risk`;
      el.dataset.mindarmorRisk = String(info.score);
    }

    function processElement(el: HTMLElement): void {
      if (el.dataset.mindarmorProcessed) return;
      el.dataset.mindarmorProcessed = 'true';

      const text = el.innerText?.trim() ?? '';
      if (text.length < 40) return;

      const risk = isManipulative(text);
      if (risk) {
        heuristicHighlight(el, risk);
        chrome.runtime.sendMessage({
          type: 'analyze',
          text,
          elementId: el.id || `el-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        }).catch(() => { });
      }
    }

    const heuristicSelector =
      'p, div, article, span, li, h1, h2, h3, [class*="post"], [class*="comment"], [role="article"]';

    // Initial heuristic scan
    document.querySelectorAll<HTMLElement>(heuristicSelector).forEach(processElement);

    // MutationObserver: heuristic + re-apply backend highlights
    const observer = new MutationObserver((mutations) => {
      let shouldReapply = false;

      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const el = node as HTMLElement;
          if (el.matches?.(heuristicSelector)) processElement(el);
          el.querySelectorAll<HTMLElement>(heuristicSelector).forEach(processElement);
          shouldReapply = true;
        });
      }

      if (shouldReapply && _lastItems.length > 0) {
        clearTimeout((observer as any)._reapplyTimer);
        (observer as any)._reapplyTimer = setTimeout(() => {
          applyHighlights(_lastItems, false);
        }, 300);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION C: Backend-driven highlighting
    // ──────────────────────────────────────────────────────────────────────────

    function riskColor(risk: number): string {
      if (risk > 0.7) return 'rgba(244, 67, 54, 0.35)';
      if (risk > 0.35) return 'rgba(255, 193, 7, 0.35)';
      return 'rgba(76, 175, 80, 0.25)';
    }

    function buildTooltip(item: AnalysisItem): string {
      const pct = Math.round(item.risk * 100);
      const type = item.type ?? 'manipulative';
      return [
        `Risk: ${pct}% (${type})`,
        `Explanation: ${item.explanation}`,
        `Neutral: ${item.neutral}`,
      ].join('\n\n');
    }

    function cleanupHighlights(): void {
      // Remove pause overlays first
      document.querySelectorAll('.mindarmor-pause-overlay').forEach(el => el.remove());

      document.querySelectorAll<HTMLElement>('.mindarmor-highlight').forEach(span => {
        const parent = span.parentNode;
        if (!parent) return;
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION C.1: Cognitive Pause overlay for extreme risk
    // ──────────────────────────────────────────────────────────────────────────
    function applyCognitivePause(span: HTMLElement): void {
      // Need the span's parent to be position:relative for absolute overlay
      const parent = span.parentElement;
      if (parent) {
        const parentPos = getComputedStyle(parent).position;
        if (parentPos === 'static') parent.style.position = 'relative';
      }
      span.style.position = 'relative';

      const overlay = document.createElement('div');
      overlay.className = 'mindarmor-pause-overlay';

      let seconds = 5;
      overlay.innerHTML = `
        <span class="pause-icon">🧘</span>
        <span class="pause-message">
          <strong>System 2 Breach Protection</strong><br>
          High-intensity emotional trigger detected.<br>
          Take a breath — engage your logical mind.
        </span>
        <span class="pause-timer">${seconds}</span>
        <button class="pause-skip">Skip</button>
      `;

      span.appendChild(overlay);

      const timerEl = overlay.querySelector('.pause-timer')!;
      const skipBtn = overlay.querySelector('.pause-skip')!;

      const countdown = setInterval(() => {
        seconds--;
        timerEl.textContent = String(seconds);
        if (seconds <= 0) {
          clearInterval(countdown);
          dismissOverlay();
        }
      }, 1000);

      function dismissOverlay(): void {
        clearInterval(countdown);
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);
      }

      skipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissOverlay();
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION C.2: Highlight a single item
    // ──────────────────────────────────────────────────────────────────────────
    function highlightItem(item: AnalysisItem, index: number): boolean {
      const textToFind = item.original.trim();
      if (!textToFind) return false;

      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            if (node.parentElement?.closest('.mindarmor-highlight')) return NodeFilter.FILTER_REJECT;
            if (node.parentElement?.closest('.mindarmor-pause-overlay')) return NodeFilter.FILTER_REJECT;
            const tag = node.parentElement?.tagName ?? '';
            if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(tag)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        const content = node.textContent ?? '';
        const startIdx = content.indexOf(textToFind);
        if (startIdx === -1) continue;

        const parent = node.parentNode;
        if (!parent) continue;

        // Before fragment
        if (startIdx > 0) {
          parent.insertBefore(document.createTextNode(content.slice(0, startIdx)), node);
        }

        // Highlight span
        const span = document.createElement('span');
        span.className = 'mindarmor-highlight';
        span.dataset.mindarmorIndex = String(index);
        span.dataset.mindarmorRisk = String(item.risk);
        span.dataset.mindarmorOriginal = textToFind;
        span.dataset.mindarmorNeutral = item.neutral || textToFind;
        span.style.backgroundColor = riskColor(item.risk);
        span.title = buildTooltip(item);

        // De-bias: show neutral text if mode is on
        if (_isDebiasMode && item.neutral) {
          span.textContent = item.neutral;
          span.classList.add('debiased');
        } else {
          span.textContent = textToFind;
        }

        parent.insertBefore(span, node);

        // After fragment
        const endIdx = startIdx + textToFind.length;
        if (endIdx < content.length) {
          parent.insertBefore(document.createTextNode(content.slice(endIdx)), node);
        }

        parent.removeChild(node);

        // Cognitive Pause: trigger overlay for extreme risk
        if (item.risk > 0.9) {
          applyCognitivePause(span);
        }

        return true;
      }

      return false;
    }

    function applyHighlights(items: AnalysisItem[], doCleanup = true): number {
      if (doCleanup) cleanupHighlights();

      let matched = 0;
      items.forEach((item, i) => {
        if (highlightItem(item, i)) matched++;
      });
      return matched;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION D: De-bias toggle
    // ──────────────────────────────────────────────────────────────────────────
    function toggleDebias(enabled: boolean): void {
      _isDebiasMode = enabled;

      document.querySelectorAll<HTMLElement>('.mindarmor-highlight').forEach(span => {
        const original = span.dataset.mindarmorOriginal ?? '';
        const neutral = span.dataset.mindarmorNeutral ?? original;

        if (enabled) {
          span.textContent = neutral;
          span.classList.add('debiased');
          span.style.backgroundColor = 'rgba(76, 175, 80, 0.18)';
        } else {
          span.textContent = original;
          span.classList.remove('debiased');
          const risk = parseFloat(span.dataset.mindarmorRisk ?? '0');
          span.style.backgroundColor = riskColor(risk);
        }
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION E: Click handler
    // ──────────────────────────────────────────────────────────────────────────
    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('.mindarmor-highlight');
      if (!target) return;

      const index = target.dataset.mindarmorIndex;
      if (index === undefined) return;

      chrome.runtime.sendMessage({
        action: 'scrollToAnalysis',
        index: Number(index),
      }).catch(() => { });

      target.classList.add('mindarmor-pulse');
      setTimeout(() => target.classList.remove('mindarmor-pulse'), 1300);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SECTION F: Message listener
    // ──────────────────────────────────────────────────────────────────────────
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

      // Backend highlights
      if (message.action === 'highlightManipulativeContent') {
        const items: AnalysisItem[] = message.items ?? [];
        if (items.length === 0) {
          sendResponse({ action: 'highlightsApplied', count: 0, url: location.href });
          return true;
        }

        _lastItems = items;
        const count = applyHighlights(items);

        sendResponse({ action: 'highlightsApplied', count, url: location.href });

        chrome.runtime.sendMessage({
          action: 'highlightsApplied',
          count,
          url: location.href,
        }).catch(() => { });

        return true;
      }

      // De-bias toggle
      if (message.action === 'setDebiasMode') {
        toggleDebias(!!message.enabled);
        sendResponse({ ok: true });
        return true;
      }

      // Clear all
      if (message.action === 'clearHighlights') {
        cleanupHighlights();
        _lastItems = [];
        sendResponse({ ok: true });
        return true;
      }

      return false;
    });
  },
});
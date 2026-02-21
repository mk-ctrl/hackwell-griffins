// entrypoints/sidepanel/index.tsx or entrypoints/content.ts

export default defineContentScript({
  matches: ['<all_urls>'],

  main() {
    console.log('MindArmor monitoring:', location.href);

    // Simple heuristic-based detection (expand with backend later)
    const manipulativeKeywords = {
      fear: ['crisis', 'disaster', 'urgent', 'warning', 'danger', 'collapse'],
      outrage: ['outrageous', 'disgusting', 'shameful', 'betrayal', 'attack'],
      absolute: ['always', 'never', 'everyone', 'no one', 'all', 'none'],
    };

    function isManipulative(text: string) {
      const lower = text.toLowerCase();
      for (const [type, words] of Object.entries(manipulativeKeywords)) {
        if (words.some(w => lower.includes(w))) {
          return { type, score: 0.6 + Math.random() * 0.3 }; // dummy score
        }
      }
      return null;
    }

    function highlightElement(el: HTMLElement, info: any) {
      el.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
      el.style.border = '1px solid orange';
      el.title = `Manipulative (${info.type}): ${Math.round(info.score * 100)}% risk\nClick for neutral version`;
      el.dataset.mindarmorRisk = info.score.toString();
    }

    const observer = new MutationObserver(() => {
      const candidates = document.querySelectorAll<HTMLElement>(
        'p, div, article, span, li, h1, h2, h3, [class*="post"], [class*="comment"], [role="article"]'
      );

      candidates.forEach(el => {
        if (el.dataset.mindarmorProcessed) return;
        el.dataset.mindarmorProcessed = 'true';

        const text = el.innerText.trim();
        if (text.length < 40) return;

        const risk = isManipulative(text);
        if (risk) {
          highlightElement(el, risk);

          // Send to side panel for detailed explanation
          chrome.runtime.sendMessage({
            type: 'analyze',
            text,
            elementId: el.id || `el-${Date.now()}-${Math.random().toString(36).slice(2)}`, // unique ref
          });
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    // Initial scan
    document.querySelectorAll<HTMLElement>('p, article, div').forEach(el => {
      // same logic as above
    });
  },
});
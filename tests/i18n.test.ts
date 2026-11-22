import { describe, expect, it } from 'vitest';
import { TIPS } from '../src/data/handbook';
import { hasTranslation, setLang, tr, trHtml } from '../src/ui/i18n';
import { VI, VI_TIPS } from '../src/ui/vi';
import { harvest } from './harvest';

// i18n.setLang touches document.documentElement; give it a minimal stand-in in Node
(globalThis as unknown as { document: unknown }).document ??= { documentElement: { lang: 'en' } };

describe('Vietnamese translation', () => {
  it('covers at least 95% of the strings seen while playing every chapter (PRD Phase 2)', () => {
    const { html, canvas } = harvest();
    let total = 0;
    let ok = 0;
    const missing = new Map<string, number>();
    for (const raw of [...html, ...canvas]) {
      const whole = raw.trim();
      const parts = hasTranslation(whole) ? [whole] : whole.split(/\s*·\s*/);
      for (const p of parts) {
        if (!p.trim()) continue;
        total += 1;
        if (hasTranslation(p)) ok += 1;
        else missing.set(p, (missing.get(p) ?? 0) + 1);
      }
    }
    const coverage = ok / total;
    if (coverage < 0.95) console.log([...missing.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30));
    expect(total).toBeGreaterThan(10000);
    expect(coverage).toBeGreaterThanOrEqual(0.95);
  }, 120000);

  it('every mentor tip has a Vietnamese version', () => {
    for (const id of Object.keys(TIPS)) {
      expect(VI_TIPS[id], id).toBeDefined();
      expect(VI_TIPS[id]!.title.length).toBeGreaterThan(5);
    }
  });

  it('puts numbers and names back in order, and leaves English untouched when off', () => {
    setLang('vi');
    expect(tr('Mr. Watanabe opened cartons and checked 80 polos: 3 defective (maximum allowed: 2).')).toBe(
      'Mr. Watanabe mở thùng và kiểm 80 áo polo: 3 chiếc lỗi (tối đa cho phép: 2).',
    );
    expect(tr('Hoa · 28/h')).toBe('Hoa · 28/giờ');
    expect(tr('Collar 92%')).toBe('Cổ áo 92%');
    expect(tr('Something nobody translated')).toBe('Something nobody translated');
    setLang('en');
    expect(tr('Collar 92%')).toBe('Collar 92%');
  });

  it('translates HTML text and labels but keeps the markup and entities', () => {
    setLang('vi');
    const out = trHtml('<button aria-label="Pause" data-action="speed">Buttons &amp; hem</button><b>Hire</b>');
    expect(out).toBe('<button aria-label="Tạm dừng" data-action="speed">Đính nút &amp; lên lai</button><b>Tuyển</b>');
    setLang('en');
  });

  it('has no empty translations', () => {
    for (const [k, v] of Object.entries(VI)) expect(v.trim().length, k).toBeGreaterThan(0);
  });
});

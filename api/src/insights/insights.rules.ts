/**
 * Pure insight-detection rules — no DB, no framework. Given the current/previous KPI values and
 * the workspace's products, decide which insights to surface. Kept side-effect-free so the core
 * recommendation logic is unit-testable in isolation (see insights.rules.spec.ts).
 */

export type Signal = {
  type: 'revenue' | 'ads' | 'product' | 'inventory' | 'churn';
  title: string;
  body: string;
  confidence: number;
  tag: string;
  cta: string;
};

export type ProductLike = { name: string; stock: number; aiScore: number | null };

const money = (v: number) => `$${(v / 1000).toFixed(1)}k`;
const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : 0);

/** `products` should be sorted by revenue descending (index 0 = top product). */
export function detectSignals(
  cur: Map<string, number>,
  prev: Map<string, number>,
  products: ProductLike[],
): Signal[] {
  const signals: Signal[] = [];

  // 1. Revenue movement (always surfaced)
  if (cur.has('revenue')) {
    const c = cur.get('revenue')!;
    const p = prev.get('revenue') ?? c;
    const d = pct(c, p);
    const top = products[0]?.name ?? 'your top product';
    signals.push(
      d >= 0
        ? {
            type: 'revenue', tag: 'Revenue',
            title: `Revenue up ${d}% this week`,
            body: `Revenue reached ${money(c)} (+${d}% vs. ${money(p)} last period), led by ${top}.`,
            confidence: Math.min(95, 78 + Math.abs(d)), cta: 'See breakdown',
          }
        : {
            type: 'revenue', tag: 'Revenue',
            title: `Revenue down ${Math.abs(d)}% this week`,
            body: `Revenue slipped to ${money(c)} (${d}% vs. ${money(p)}). Investigate the drop before it compounds.`,
            confidence: Math.min(95, 78 + Math.abs(d)), cta: 'Diagnose drop',
          },
    );
  }

  // 2. ROAS decline (defensive — only when it actually dropped)
  if (cur.has('roas')) {
    const c = cur.get('roas')!;
    const p = prev.get('roas') ?? c;
    const d = pct(c, p);
    if (d < 0) {
      signals.push({
        type: 'ads', tag: 'Ads',
        title: `ROAS dropped ${Math.abs(d)}%`,
        body: `Blended ROAS fell to ${c}x (${d}% vs. ${p}x). Refresh fatiguing creative and shift budget to your best channel.`,
        confidence: Math.min(92, 74 + Math.abs(d)), cta: 'Fix campaigns',
      });
    }
  }

  // 3. Trending product (high AI score + healthy stock)
  const trending = products.find((p) => (p.aiScore ?? 0) >= 0.75 && p.stock > 50);
  if (trending) {
    signals.push({
      type: 'product', tag: 'Product',
      title: `${trending.name} is trending`,
      body: `${trending.name} scores ${Math.round((trending.aiScore ?? 0) * 100)}/100 with ${trending.stock} units in stock. Raise ad budget while momentum lasts.`,
      confidence: 88, cta: 'Scale product',
    });
  }

  // 4. Low-stock risk (lowest-stock product under the threshold)
  const lowStock = products.filter((p) => p.stock > 0 && p.stock < 20).sort((a, b) => a.stock - b.stock)[0];
  if (lowStock) {
    signals.push({
      type: 'inventory', tag: 'Inventory',
      title: `Restock ${lowStock.name}`,
      body: `Only ${lowStock.stock} units of ${lowStock.name} left. Projected stockout soon at current velocity — raise a PO now.`,
      confidence: 90, cta: 'Create PO',
    });
  }

  return signals;
}

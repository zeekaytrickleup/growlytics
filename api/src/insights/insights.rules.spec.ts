import { detectSignals, ProductLike } from './insights.rules';

const kpis = (entries: Record<string, number>) => new Map(Object.entries(entries));

const PRODUCTS: ProductLike[] = [
  { name: 'Aurora Wireless Buds', stock: 340, aiScore: 0.9 }, // trending
  { name: 'Nimbus Hoodie', stock: 88, aiScore: 0.8 },
  { name: 'Flux Smart Bottle', stock: 12, aiScore: 0.2 }, // low stock
];

describe('detectSignals', () => {
  it('flags a revenue increase with an "up" title', () => {
    const s = detectSignals(kpis({ revenue: 81200 }), kpis({ revenue: 68814 }), []);
    const rev = s.find((x) => x.type === 'revenue')!;
    expect(rev.title).toContain('Revenue up 18%');
    expect(rev.confidence).toBeGreaterThan(78);
  });

  it('flags a revenue drop with a "down" title', () => {
    const s = detectSignals(kpis({ revenue: 60000 }), kpis({ revenue: 80000 }), []);
    const rev = s.find((x) => x.type === 'revenue')!;
    expect(rev.title).toContain('down');
    expect(rev.cta).toBe('Diagnose drop');
  });

  it('only surfaces a ROAS insight when ROAS declined', () => {
    const dropped = detectSignals(kpis({ roas: 3.8 }), kpis({ roas: 4.32 }), []);
    expect(dropped.some((x) => x.type === 'ads')).toBe(true);

    const rose = detectSignals(kpis({ roas: 5.1 }), kpis({ roas: 4.6 }), []);
    expect(rose.some((x) => x.type === 'ads')).toBe(false);
  });

  it('detects a trending product and a low-stock risk from products', () => {
    const s = detectSignals(kpis({}), kpis({}), PRODUCTS);
    const trending = s.find((x) => x.type === 'product');
    const inventory = s.find((x) => x.type === 'inventory');
    expect(trending?.title).toContain('Aurora Wireless Buds is trending');
    expect(inventory?.title).toContain('Restock Flux Smart Bottle');
    expect(inventory?.body).toContain('12 units');
  });

  it('returns no signals for empty inputs', () => {
    expect(detectSignals(kpis({}), kpis({}), [])).toHaveLength(0);
  });
});

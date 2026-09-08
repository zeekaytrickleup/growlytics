import { AiService } from './ai.service';

describe('AiService (mock mode)', () => {
  let svc: AiService;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY; // force mock mode — no network calls
    delete process.env.GEMINI_API_KEY;
    svc = new AiService();
  });

  it('is disabled without an API key', () => {
    expect(svc.enabled).toBe(false);
  });

  it('returns a grounded canned answer for a known question', async () => {
    const a = await svc.answer('What should I do this week?', {});
    expect(a.source).toBe('mock');
    expect(a.actions.length).toBeGreaterThanOrEqual(2);
    expect(typeof a.confidence).toBe('number');
    expect(a.analysis.toLowerCase()).toContain('highest-leverage');
  });

  it('returns a valid structured shape for unknown free-text questions', async () => {
    const a = await svc.answer('anything about widgets', {});
    expect(a).toEqual(
      expect.objectContaining({
        analysis: expect.any(String),
        reason: expect.any(String),
        impact: expect.any(String),
        confidence: expect.any(Number),
      }),
    );
    expect(Array.isArray(a.actions)).toBe(true);
    expect(a.source).toBe('mock');
  });
});

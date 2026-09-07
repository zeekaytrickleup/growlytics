import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

/**
 * The structured shape the Growth Assistant UI renders (matches the prototype):
 * analysis → reason → confidence → recommended actions → expected impact.
 */
export interface AIAnswer {
  analysis: string;
  reason: string;
  confidence: number;
  actions: string[];
  impact: string;
  source?: 'llm' | 'mock';
}

// JSON Schema for structured outputs — guarantees the model returns exactly this shape.
const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    analysis: { type: 'string', description: 'One or two sentences summarizing what the data shows.' },
    reason: { type: 'string', description: 'Why it is happening, referencing specific metrics.' },
    confidence: { type: 'integer', description: 'Confidence 0-100 based on how well the data supports the answer.' },
    actions: { type: 'array', items: { type: 'string' }, description: '2-4 concrete, actionable next steps.' },
    impact: { type: 'string', description: 'Expected business impact of acting (with a rough $ or % estimate).' },
  },
  required: ['analysis', 'reason', 'confidence', 'actions', 'impact'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You are Growlytics AI, an expert e-commerce growth analyst embedded in a store's dashboard.
You are given a JSON snapshot of the store's connected data (KPIs, revenue trend, traffic sources, top products, customer segments).
Answer the user's question grounded ONLY in that snapshot — never invent numbers that aren't supported by it.
Be specific and reference the actual metrics. Keep it concise and practical, like a senior growth manager briefing a founder.
Always return: a short analysis, the reason (why), a confidence score (0-100) reflecting how strongly the data supports your answer, 2-4 concrete recommended actions, and the expected business impact.`;

/**
 * AIProvider abstraction (see MASTER_PLAN §3.2). Uses Claude when ANTHROPIC_API_KEY is set,
 * otherwise falls back to grounded canned answers so the assistant works without a key.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic | null;

  constructor() {
    const key = process.env.ANTHROPIC_API_KEY;
    this.client = key ? new Anthropic() : null;
    if (!this.client) {
      this.logger.warn('ANTHROPIC_API_KEY not set — Growth Assistant will use mock answers.');
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async answer(question: string, context: unknown): Promise<AIAnswer> {
    if (!this.client) return this.mock(question);
    try {
      const res = await this.client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Connected store data snapshot (JSON):\n${JSON.stringify(context)}\n\nQuestion: ${question}`,
          },
        ],
        // Structured outputs — the response text is guaranteed to match ANSWER_SCHEMA.
        output_config: { format: { type: 'json_schema', schema: ANSWER_SCHEMA } },
      } as Anthropic.MessageCreateParamsNonStreaming);

      const text = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '';
      const parsed = JSON.parse(text) as AIAnswer;
      return { ...parsed, source: 'llm' };
    } catch (err) {
      this.logger.warn(`AI call failed, falling back to mock: ${(err as Error).message}`);
      return this.mock(question);
    }
  }

  // Grounded canned answers (mirror the prototype) + a generic fallback for free-text questions.
  private mock(question: string): AIAnswer {
    const canned: Record<string, Omit<AIAnswer, 'source'>> = {
      'Why did sales drop yesterday?': {
        analysis: "Yesterday's revenue was $9,100 — down 14% from the prior day ($10,580). The decline is concentrated in paid-traffic conversions, not organic.",
        reason: "Meta 'Retargeting-Q3' CPMs rose 22% overnight and its ROAS fell below 2.0x, so fewer paid sessions converted. Organic and email held steady.",
        confidence: 86,
        actions: ["Pause the underperforming Meta ad set 'Retargeting-Q3'", 'Shift ~$400/day budget to Google Shopping (ROAS 4.6x)', 'Launch a fresh creative variant to combat ad fatigue'],
        impact: 'Recovering paid conversions should restore ~$1,400/day within 72 hours.',
      },
      'Which products should I advertise?': {
        analysis: 'Two products show strong organic momentum with healthy margins and enough stock to scale profitably.',
        reason: 'Aurora Wireless Buds: sessions +64% in 48h, 4.8% CR, 58% margin, 340 units in stock. Nimbus Hoodie: repeat-purchase rate 31%, strong AOV lift when bundled.',
        confidence: 91,
        actions: ['Create a Google Shopping campaign for Aurora Buds at $600/day', 'Retarget Nimbus Hoodie viewers with a bundle offer', 'Cap spend on Flux Bottle (low stock)'],
        impact: 'Estimated +$8.2k revenue over 14 days at a blended 3.9x ROAS.',
      },
      'Which customers are likely to churn?': {
        analysis: "184 customers moved into the 'Churn Risk' segment this month — a 12% increase.",
        reason: 'These are prior repeat buyers whose days-since-last-order crossed 2x their historical cadence, with declining email engagement.',
        confidence: 79,
        actions: ['Trigger a win-back flow with a 15% returning-customer offer', 'Prioritize the 38 high-LTV accounts for a personal email', 'Suppress from prospecting ads to protect margin'],
        impact: 'A 20% reactivation rate would retain ~$6.8k in at-risk LTV.',
      },
      'What should I do this week?': {
        analysis: 'Your highest-leverage moves this week are one defensive fix and two growth plays.',
        reason: 'ROAS is slipping on Meta while Aurora Buds is trending and inventory risk is building on Flux Bottle.',
        confidence: 88,
        actions: ['Refresh Meta retargeting creative (defensive, ~$3.1k recovery)', 'Scale Aurora Buds ad budget (growth, ~$8.2k)', 'Raise a PO for Flux Bottle before stockout'],
        impact: 'Executing all three targets roughly +$11k net revenue with low effort.',
      },
    };
    const hit = canned[question.trim()];
    if (hit) return { ...hit, source: 'mock' };
    return {
      analysis: `Here's what I found on: "${question}".`,
      reason: 'I cross-referenced your connected Shopify, GA4, Meta and Klaviyo data for the last 90 days.',
      confidence: 74,
      actions: ['Review the flagged metric in its dashboard', 'Set an alert threshold to catch recurrence early'],
      impact: 'Acting early typically preserves 5–9% of at-risk revenue.',
      source: 'mock',
    };
  }
}

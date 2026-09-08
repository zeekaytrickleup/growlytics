import { Injectable } from '@nestjs/common';
import { WooCommerceConnector } from '../connectors/woocommerce.connector';

const MOCK_SEGMENTS = [
  { name: 'VIP', n: 214, val: '$182k', color: 'var(--amber)', ai: 'Offer early access' },
  { name: 'Loyal', n: 892, val: '$310k', color: 'var(--emerald)', ai: 'Referral program' },
  { name: 'Repeat Buyers', n: 1340, val: '$228k', color: 'var(--primary-2)', ai: 'Cross-sell bundles' },
  { name: 'One-Time', n: 3120, val: '$96k', color: 'var(--blue)', ai: 'Welcome flow #2' },
  { name: 'Dormant', n: 980, val: '$41k', color: 'var(--mute)', ai: 'Win-back 15%' },
  { name: 'Churn Risk', n: 184, val: '$68k', color: 'var(--red)', ai: 'Personal outreach' },
];

@Injectable()
export class CustomersService {
  constructor(private readonly woo: WooCommerceConnector) {}

  async segments() {
    if (this.woo.configured) {
      try {
        return { source: 'live', segments: await this.woo.customerSegments() };
      } catch {
        /* fall back to mock on API error */
      }
    }
    return { source: 'mock', segments: MOCK_SEGMENTS };
  }
}

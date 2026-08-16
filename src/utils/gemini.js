// The CharityFlow AI agent.
//
// If `VITE_GEMINI_API_KEY` is configured, the agent calls the Google Gemini
// API to reason over the crisis feed and produce structured payout params.
// Otherwise it falls back to a deterministic, rule-based simulated agent so
// the whole flow works out of the box.

import { CONFIG } from '../config';

// Predefined disaster scenarios shown in the Crisis Simulator.
export const SCENARIOS = [
  {
    id: 'earthquake_turkiye',
    label: 'Earthquake — Region A',
    crisisType: 'earthquake',
    severity: 92,
    region: 'Region A',
    text: 'A 7.4 magnitude earthquake struck Region A this morning. 2,300 people displaced, hospitals overwhelmed, urgent need for shelter, water and medical supplies.',
  },
  {
    id: 'flood_bangladesh',
    label: 'Flood — Region B',
    crisisType: 'flood',
    severity: 84,
    region: 'Region B',
    text: 'Heavy monsoon rains caused severe flooding across Region B. Roads cut off, 1,400 families stranded, food and clean drinking water critically needed.',
  },
  {
    id: 'drought_africa',
    label: 'Drought — Region C',
    crisisType: 'drought',
    severity: 71,
    region: 'Region C',
    text: 'Prolonged drought in Region C has destroyed crops and livestock. Food insecurity is rising sharply, with malnutrition expected within weeks.',
  },
  {
    id: 'cyclone_pacific',
    label: 'Cyclone — Region D',
    crisisType: 'cyclone',
    severity: 88,
    region: 'Region D',
    text: 'Category 4 cyclone made landfall in Region D. Widespread power outages, damaged infrastructure and 900 people in temporary shelters.',
  },
  {
    id: 'conflict_sudan',
    label: 'Conflict Displacement — Region E',
    crisisType: 'conflict',
    severity: 79,
    region: 'Region E',
    text: 'Renewed violence in Region E forced 5,000 civilians to flee. Emergency relief convoys required for food, medicine and temporary housing.',
  },
];

const SEVERITY_KEYWORDS = [
  { keywords: ['magnitude', '7.', 'category 4', 'catastrophic', 'deadly'], score: 90 },
  { keywords: ['displaced', 'flee', 'stranded', 'critically', 'overwhelmed'], score: 85 },
  { keywords: ['flood', 'drought', 'cyclone', 'earthquake', 'conflict', 'quake'], score: 78 },
  { keywords: ['urgent', 'emergency', 'severe', 'crisis', 'aid'], score: 70 },
  { keywords: ['water', 'food', 'shelter', 'medical', 'medicine'], score: 60 },
];

const AMOUNT_BUDGETS = {
  earthquake: 5000,
  flood: 4000,
  cyclone: 4500,
  drought: 2500,
  conflict: 3000,
  default: 2000,
};

export function buildAgentPrompt(crisisText, ctx) {
  return [
    'You are the CharityFlow AI aid-allocation agent on the Stellar blockchain.',
    'Analyze the news/crisis feed below and decide an aid disbursement.',
    'Constraints:',
    `- Escrow XLM balance available: ${ctx.escrowBalance?.toLocaleString() ?? 'unknown'}`,
    `- Preferred NGO recipient wallet: ${ctx.ngoWallet}`,
    '- reason (symbol) must be <= 32 chars, snake_case',
    '- amount must be a positive integer (whole XLM), and MUST NOT exceed the escrow balance',
    '- If escrow balance is 0, amount must be 0 (no disbursement possible).',
    '',
    'Crisis feed:',
    `"""${crisisText}"""`,
    '',
    'Respond ONLY with valid JSON matching this schema:',
    JSON.stringify(
      {
        reasoning: 'explain why aid is needed and how you chose the amount',
        crisisType: 'earthquake|flood|drought|cyclone|conflict|other',
        region: 'region mentioned or unknown',
        severity: 0,
        amount: 0,
        recipient: 'NGO wallet address',
        reason: 'snake_case symbol',
      },
      null,
      2
    ),
  ].join('\n');
}

function parseJsonResponse(text) {
  const match = String(text)
    .replace(/```json|```/g, '')
    .match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in model output');
  return JSON.parse(match[0]);
}

async function runGemini(crisisText, ctx) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: buildAgentPrompt(crisisText, ctx) }],
        },
      ],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response.');
  return parseJsonResponse(text);
}

export function simulateAgent(crisisText, ctx) {
  const lower = crisisText.toLowerCase();
  const escrowBalance = Number(ctx.escrowBalance) || 0;

  // Crisis type
  const typeMatch = Object.keys(AMOUNT_BUDGETS).find((t) =>
    lower.includes(t === 'default' ? '__none__' : t)
  );
  const crisisType =
    typeMatch ||
    (lower.includes('earthquake') || lower.includes('quake') || lower.includes('magnitude')
      ? 'earthquake'
      : 'other');

  // Severity score
  let severity = 55;
  for (const tier of SEVERITY_KEYWORDS) {
    if (tier.keywords.some((k) => lower.includes(k))) {
      severity = Math.max(severity, tier.score);
    }
  }

  // Region
  const regionMatch = crisisText.match(/[Rr]egion\s+[A-Za-z0-9]+/);
  const region = regionMatch ? regionMatch[0] : 'Region unknown';

  // Amount — bounded by the escrow balance.
  const budget = AMOUNT_BUDGETS[crisisType] || AMOUNT_BUDGETS.default;
  const severityFactor = severity / 100;
  const proposed = Math.floor(budget * severityFactor);
  const amount = Math.min(proposed, Math.max(0, Math.floor(escrowBalance)));

  const reasoning = [
    `Detected a ${crisisType} event (${region}) with severity ${severity}/100.`,
    `Estimated ${Math.round(severityFactor * 100)}% of the standard ${budget} XLM response budget is warranted.`,
    escrowBalance <= 0
      ? 'The escrow currently holds 0 XLM — no disbursement is possible until donors contribute.'
      : `Proposing ${amount} XLM against an escrow balance of ${Math.floor(escrowBalance)} XLM.`,
    `Disbursing to the registered NGO wallet ${ctx.ngoWallet}.`,
  ].join(' ');

  return {
    reasoning,
    crisisType,
    region,
    severity,
    amount,
    recipient: ctx.ngoWallet,
    reason: crisisType,
  };
}

/**
 * Runs the AI agent over a crisis feed and returns structured payout params.
 * Falls back to the simulated agent if Gemini is unavailable or fails.
 *
 * @returns {Promise<{source: 'gemini'|'simulated', reasoning: string, params: object}>}
 */
export async function runAIAgent(crisisText, ctx) {
  if (CONFIG.geminiApiKey) {
    try {
      const raw = await runGemini(crisisText, ctx);
      return {
        source: 'gemini',
        reasoning: raw.reasoning || '',
        params: {
          crisisType: raw.crisisType || 'other',
          region: raw.region || 'Region unknown',
          severity: Number(raw.severity) || 0,
          amount: Math.max(0, Math.trunc(Number(raw.amount) || 0)),
          recipient: raw.recipient || ctx.ngoWallet,
          reason: String(raw.reason || 'aid').slice(0, 32),
        },
      };
    } catch (err) {
      const fallback = simulateAgent(crisisText, ctx);
      return {
        source: 'simulated',
        fallbackReason: `Gemini unavailable (${err.message}); used the rule-based agent.`,
        reasoning: fallback.reasoning,
        params: fallback,
      };
    }
  }

  const fallback = simulateAgent(crisisText, ctx);
  return {
    source: 'simulated',
    reasoning: fallback.reasoning,
    params: fallback,
  };
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_MAX_REQUESTS_PER_SCAN = Number(process.env.GEMINI_MAX_REQUESTS_PER_SCAN || 25);
const GEMINI_CONCURRENCY = Math.max(1, Number(process.env.GEMINI_CONCURRENCY || 2));
const GEMINI_RETRY_ATTEMPTS = Math.max(1, Number(process.env.GEMINI_RETRY_ATTEMPTS || 3));
const GEMINI_BACKOFF_MS = Math.max(100, Number(process.env.GEMINI_BACKOFF_MS || 1200));

const SEVERITY_SCORE = {
  critical: 90,
  high: 75,
  medium: 55,
  low: 30,
};

const ENABLED_SEVERITIES = new Set(
  String(process.env.GEMINI_MIN_SEVERITY || 'medium')
    .toLowerCase() === 'critical'
    ? ['critical']
    : String(process.env.GEMINI_MIN_SEVERITY || 'medium').toLowerCase() === 'high'
      ? ['critical', 'high']
      : String(process.env.GEMINI_MIN_SEVERITY || 'medium').toLowerCase() === 'medium'
        ? ['critical', 'high', 'medium']
        : ['critical', 'high', 'medium', 'low']
);

function severityToScore(severity) {
  const normalized = String(severity || '').toLowerCase();
  return SEVERITY_SCORE[normalized] || 30;
}

function heuristicExplanation(finding) {
  const vuln = String(finding?.vulnerability || '').toLowerCase();

  if (vuln.includes('sql injection')) {
    return 'The endpoint behavior indicates possible unsafe query construction or weak server-side input handling for database operations.';
  }
  if (vuln.includes('authentication') || vuln.includes('token')) {
    return 'Authentication controls appear inconsistent under mutated credentials or token replay behavior.';
  }
  if (vuln.includes('idor') || vuln.includes('bola')) {
    return 'Object-level authorization checks may be missing or weak, allowing access patterns outside the expected user scope.';
  }
  if (vuln.includes('rate')) {
    return 'Sustained burst traffic completed without clear throttling signals, suggesting weak rate-limit enforcement.';
  }

  return 'Observed response differences suggest inconsistent validation or control behavior that should be reviewed.';
}

function heuristicRecommendation(finding) {
  const vuln = String(finding?.vulnerability || '').toLowerCase();

  if (vuln.includes('sql injection')) {
    return 'Use parameterized queries and strict server-side input validation; never build SQL from user-controlled strings.';
  }
  if (vuln.includes('authentication') || vuln.includes('token')) {
    return 'Enforce strict token validation, short token lifetimes, and explicit authorization checks on all protected routes.';
  }
  if (vuln.includes('idor') || vuln.includes('bola')) {
    return 'Implement object-level authorization checks for every resource access using authenticated user context.';
  }
  if (vuln.includes('rate')) {
    return 'Add per-user and per-IP throttling with 429 responses and Retry-After headers on burst traffic.';
  }

  return 'Harden request validation, apply least-privilege access controls, and monitor for anomalous traffic patterns.';
}

function stripCodeFence(text) {
  const value = String(text || '').trim();
  return value.replace(/^```[a-zA-Z]*\s*/m, '').replace(/```$/m, '').trim();
}

function parseGeminiText(rawText, finding) {
  const text = stripCodeFence(rawText);
  if (!text) {
    return {
      risk_score: severityToScore(finding.severity),
      explanation: heuristicExplanation(finding),
      recommended_fix: heuristicRecommendation(finding),
    };
  }

  const scoreMatch = text.match(/risk\s*score\s*:\s*(\d{1,3})/i);
  const explanationMatch = text.match(/explanation\s*:\s*(.+)/i);
  const fixMatch = text.match(/recommended\s*fix\s*:\s*(.+)/i);

  const riskScore = scoreMatch ? Number(scoreMatch[1]) : severityToScore(finding.severity);
  const explanation = explanationMatch?.[1]?.trim() || text.split('\n')[0]?.trim() || heuristicExplanation(finding);
  const recommendedFix = fixMatch?.[1]?.trim() || heuristicRecommendation(finding);

  return {
    risk_score: Math.max(0, Math.min(100, Number.isFinite(riskScore) ? Math.round(riskScore) : severityToScore(finding.severity))),
    explanation,
    recommended_fix: recommendedFix,
  };
}

function shouldCallGemini(finding) {
  const sev = String(finding?.severity || '').toLowerCase();
  return ENABLED_SEVERITIES.has(sev);
}

function buildFindingSignature(finding) {
  const vuln = String(finding?.vulnerability || '').trim();
  const sev = String(finding?.severity || '').trim();
  const evidencePrefix = String(finding?.evidence || '').trim().slice(0, 140);
  return `${vuln}|${sev}|${evidencePrefix}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestGemini(finding) {
  const apiKey = process.env.GEMINI_API_KEY;
  const prompt = [
    'You are a security assistant.',
    'Respond with plain text only using exactly these 3 lines:',
    'Risk Score: <0-100 integer>',
    'Explanation: <1 sentence>',
    'Recommended Fix: <1 sentence>',
    `Finding: ${JSON.stringify({ vulnerability: finding.vulnerability, severity: finding.severity, evidence: finding.evidence || '' })}`,
  ].join('\n');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  for (let attempt = 1; attempt <= GEMINI_RETRY_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: 220,
        },
      }),
    });

    if (response.ok) {
      const body = await response.json();
      const text = body?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return parseGeminiText(text, finding);
    }

    if ((response.status === 429 || response.status >= 500) && attempt < GEMINI_RETRY_ATTEMPTS) {
      await sleep(GEMINI_BACKOFF_MS * attempt);
      continue;
    }

    throw new Error(`Gemini HTTP ${response.status}`);
  }

  throw new Error('Gemini request failed');
}

async function getExplanationAndFix(finding, enabled, hasKey) {
  const fallback = {
    risk_score: severityToScore(finding.severity),
    explanation: heuristicExplanation(finding),
    recommended_fix: heuristicRecommendation(finding),
  };

  if (!enabled || !hasKey || !shouldCallGemini(finding)) {
    return fallback;
  }

  try {
    return await requestGemini(finding);
  } catch (_err) {
    return fallback;
  }
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runner());
  await Promise.all(workers);
  return results;
}

async function enrichFindings(findings = []) {
  const enabled = String(process.env.GEMINI_ENABLED || 'false').toLowerCase() === 'true';
  const hasKey = Boolean(process.env.GEMINI_API_KEY);

  const uniqueSignatures = [];
  const signatureToRepresentative = new Map();

  for (const finding of findings) {
    const signature = buildFindingSignature(finding);
    if (!signatureToRepresentative.has(signature) && uniqueSignatures.length < GEMINI_MAX_REQUESTS_PER_SCAN) {
      signatureToRepresentative.set(signature, finding);
      uniqueSignatures.push(signature);
    }
  }

  const signatureToEnrichment = new Map();
  await runWithConcurrency(uniqueSignatures, GEMINI_CONCURRENCY, async (signature) => {
    const representative = signatureToRepresentative.get(signature);
    const enrichment = await getExplanationAndFix(representative, enabled, hasKey);
    signatureToEnrichment.set(signature, enrichment);
  });

  return findings.map((finding) => {
    const signature = buildFindingSignature(finding);
    const enrichment = signatureToEnrichment.get(signature) || {
      risk_score: severityToScore(finding.severity),
      explanation: heuristicExplanation(finding),
      recommended_fix: heuristicRecommendation(finding),
    };

    return {
      ...finding,
      details: {
        ...(finding.details || {}),
        risk_score: enrichment.risk_score,
        explanation: enrichment.explanation,
        recommended_fix: enrichment.recommended_fix,
      },
    };
  });
}

module.exports = {
  enrichFindings,
};

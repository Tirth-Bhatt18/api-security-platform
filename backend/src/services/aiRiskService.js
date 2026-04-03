const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function severityToScore(severity) {
  const normalized = String(severity || '').toLowerCase();
  if (normalized === 'critical') return 90;
  if (normalized === 'high') return 75;
  if (normalized === 'medium') return 55;
  return 30;
}

function heuristicRecommendation(finding) {
  const vuln = String(finding?.vulnerability || '').toLowerCase();

  if (vuln.includes('sql injection')) {
    return 'Use parameterized queries and strict server-side input validation; never build SQL from user-controlled strings.';
  }
  if (vuln.includes('authentication') || vuln.includes('token')) {
    return 'Enforce strict token validation, short token lifetimes, and proper auth checks on all protected routes.';
  }
  if (vuln.includes('idor') || vuln.includes('bola')) {
    return 'Implement object-level authorization checks for every resource access using authenticated user context.';
  }
  if (vuln.includes('rate')) {
    return 'Add per-user and per-IP throttling with 429 responses and Retry-After headers on burst traffic.';
  }

  return 'Harden request validation, apply least-privilege access controls, and monitor for anomalous traffic patterns.';
}

async function getGeminiSuggestion(finding) {
  const apiKey = process.env.GEMINI_API_KEY;
  const enabled = String(process.env.GEMINI_ENABLED || 'false').toLowerCase() === 'true';

  if (!enabled || !apiKey) {
    return {
      risk_score: severityToScore(finding.severity),
      recommendation: heuristicRecommendation(finding),
      source: 'heuristic',
    };
  }

  const prompt = [
    'You are a security assistant.',
    'Given this API vulnerability finding, return strict JSON with keys risk_score (0-100 int) and recommendation (short actionable string).',
    `Finding: ${JSON.stringify({ vulnerability: finding.vulnerability, severity: finding.severity, evidence: finding.evidence || '' })}`,
    'Return JSON only.',
  ].join('\n');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;
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
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}`);
    }

    const body = await response.json();
    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(text);

    const score = Number(parsed?.risk_score);
    return {
      risk_score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : severityToScore(finding.severity),
      recommendation: parsed?.recommendation || heuristicRecommendation(finding),
      source: 'gemini',
    };
  } catch (err) {
    return {
      risk_score: severityToScore(finding.severity),
      recommendation: heuristicRecommendation(finding),
      source: 'heuristic_fallback',
      error: err.message,
    };
  }
}

async function enrichFindings(findings = []) {
  const enriched = [];
  for (const finding of findings) {
    const ai = await getGeminiSuggestion(finding);
    enriched.push({
      ...finding,
      details: {
        ...(finding.details || {}),
        ai,
      },
    });
  }
  return enriched;
}

module.exports = {
  enrichFindings,
};

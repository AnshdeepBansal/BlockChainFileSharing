import type { TelemetryEvent } from '@/lib/server/storage';

export type RiskAssessment = {
  score: number;
  action: 'allow' | 'allow_with_alert' | 'soft_block';
  reasons: string[];
};

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function scoreTelemetry(events: TelemetryEvent[]): RiskAssessment {
  let score = 0;
  const reasons: string[] = [];

  const uploads = events.filter((e) => e.event === 'upload');
  if (uploads.length > 50) {
    score += 30;
    reasons.push('high upload burst');
  } else if (uploads.length > 20) {
    score += 15;
    reasons.push('medium upload burst');
  }

  const churn = events.filter((e) => e.event === 'grant' || e.event === 'revoke').length;
  const churnRatio = events.length ? churn / events.length : 0;
  if (churnRatio > 0.5 && churn > 10) {
    score += 20;
    reasons.push('grant/revoke churn pattern');
  }

  const uploadSizes = uploads
    .map((u) => Number(u.context.fileSize ?? 0))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (uploadSizes.length >= 5) {
    const avg = uploadSizes.reduce((a, b) => a + b, 0) / uploadSizes.length;
    const sd = stdDev(uploadSizes);
    if (sd > 0) {
      const outliers = uploadSizes.filter((s) => Math.abs(s - avg) > 3 * sd).length;
      if (outliers >= Math.ceil(uploadSizes.length * 0.3)) {
        score += 15;
        reasons.push('abnormal upload size variance');
      }
    }
  }

  const failures = events.filter((e) => e.event === 'failed_auth' || e.event === 'failed_decrypt').length;
  if (failures > 5) {
    score += 25;
    reasons.push('repeated auth/decrypt failures');
  }

  if (score >= 70) {
    return { score: Math.min(score, 100), action: 'soft_block', reasons };
  }
  if (score >= 30) {
    return { score: Math.min(score, 100), action: 'allow_with_alert', reasons };
  }
  return { score: Math.min(score, 100), action: 'allow', reasons };
}

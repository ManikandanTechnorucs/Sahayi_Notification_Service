import { SpanStatusCode, trace } from '@opentelemetry/api';
import { SERVICE_NAME } from '../constants/service.constants';
import { isTelemetryEnabled } from './azure-monitor';

export type FailedApiRequestDetails = {
  serviceName: string;
  endpoint: string;
  method: string;
  statusCode: number;
  errorMessage: string;
  errorName?: string;
  occurredAt: string;
  durationMs?: number;
  traceId?: string;
  correlationId?: string;
  error?: Error;
};

const tracer = trace.getTracer(SERVICE_NAME);

/**
 * Records a failed API request as an OpenTelemetry error span for Azure Monitor.
 * No-ops when Application Insights is not configured.
 */
export function recordFailedApiRequest(details: FailedApiRequestDetails): void {
  if (!isTelemetryEnabled()) {
    return;
  }

  const span = tracer.startSpan('api.request.error');
  const activeTraceId = span.spanContext().traceId;
  const traceId = details.traceId || activeTraceId || undefined;
  const correlationId = details.correlationId || details.traceId || activeTraceId || undefined;

  span.setAttributes({
    'service.name': details.serviceName,
    'http.route': details.endpoint,
    'http.method': details.method,
    'http.status_code': details.statusCode,
    'error.message': details.errorMessage,
    'error.occurred_at': details.occurredAt,
    ...(details.errorName ? { 'error.name': details.errorName, 'error.type': details.errorName } : {}),
    ...(details.durationMs !== undefined ? { 'http.duration_ms': details.durationMs } : {}),
    ...(traceId ? { 'trace.id': traceId } : {}),
    ...(correlationId ? { 'correlation.id': correlationId } : {}),
  });

  if (details.error) {
    span.recordException(details.error);
  }

  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: details.errorMessage,
  });
  span.end();
}

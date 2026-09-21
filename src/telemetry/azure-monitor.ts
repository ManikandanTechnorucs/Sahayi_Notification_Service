import { shutdownAzureMonitor, useAzureMonitor } from '@azure/monitor-opentelemetry';
import { config } from '../../libs/config/src/config';
import { logger } from '../../libs/logger/src/logger';

const connectionString = config.APPLICATIONINSIGHTS_CONNECTION_STRING;

/**
 * Initializes Azure Monitor OpenTelemetry when a connection string is configured.
 * HTTP auto-instrumentation is disabled so only manually recorded failures are exported.
 */
export function initAzureMonitor(): void {
  if (!connectionString) {
    logger.warn(
      'APPLICATIONINSIGHTS_CONNECTION_STRING is not set; Azure Monitor telemetry is disabled.',
    );
    return;
  }

  useAzureMonitor({
    azureMonitorExporterOptions: { connectionString },
    enableLiveMetrics: true,
    enableStandardMetrics: true,
    instrumentationOptions: {
      http: { enabled: false },
      azureSdk: { enabled: false },
      mongoDb: { enabled: false },
      mySql: { enabled: false },
      redis: { enabled: false },
      postgreSql: { enabled: false },
    },
  });

  logger.info({ service: 'notification-service' }, 'Azure Monitor OpenTelemetry initialized');
}

/**
 * Flushes and shuts down Azure Monitor exporters. Safe to call when telemetry was never started.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!connectionString) {
    return;
  }

  await shutdownAzureMonitor();
}

/** True when Application Insights connection string is present. */
export function isTelemetryEnabled(): boolean {
  return Boolean(connectionString);
}

initAzureMonitor();

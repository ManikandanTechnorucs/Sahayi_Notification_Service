# Generic Azure Service Bus Messaging Infrastructure

Reusable, business-agnostic messaging layer for the Sahayi Enterprise monorepo.

## What this library does

| Capability | Component |
|------------|-----------|
| Connection lifecycle | `AzureServiceBusManager` |
| Publish / batch publish | `GenericMessagePublisher` |
| Schedule / cancel | `SchedulerService` |
| Consume with injected handlers | `GenericConsumerFramework` |
| Dead-letter processing | `DeadLetterProcessor` |
| Worker registration | `WorkerRegistry` |
| Bootstrap / DI | `createMessagingInfrastructure()` |

The framework never knows about reminders, emails, SMS, or notifications — only envelopes, queues, and settlement (complete / abandon / dead-letter).

---

## Folder structure

```
libs/messaging/
├── README.md
├── examples/
│   └── worker-registration.example.ts
└── src/
    ├── index.ts
    ├── messaging.bootstrap.ts
    ├── config/
    │   └── messaging.config.ts
    ├── core/
    │   ├── azure-service-bus.manager.ts
    │   ├── generic-message.publisher.ts
    │   ├── generic-consumer.framework.ts
    │   ├── scheduler.service.ts
    │   └── dead-letter.processor.ts
    ├── registry/
    │   └── worker.registry.ts
    ├── types/
    │   ├── message-envelope.ts
    │   ├── message-handler.ts
    │   └── worker-registration.ts
    ├── errors/
    │   └── messaging.errors.ts
    ├── utils/
    │   ├── validate-envelope.ts
    │   └── mask-secrets.ts
    └── observability/
        ├── messaging-metrics.ts
        └── health-check.ts
```

---

## Installation

```bash
npm install
```

Dependency: `@azure/service-bus` (already listed in root `package.json`).

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AZURE_SERVICE_BUS_CONNECTION_STRING` | Yes* | Service Bus connection string |
| `MESSAGING_DISABLED` | No | `true` to skip client init (tests) |
| `MESSAGING_SOURCE_SYSTEM` | No | Envelope `sourceSystem` (default: `SERVICE_NAME`) |
| `MESSAGING_DEFAULT_WORKER_CONCURRENCY` | No | Default `5` |
| `MESSAGING_DEFAULT_MAX_AUTO_LOCK_RENEWAL_MS` | No | Default `300000` |
| `MESSAGING_DEFAULT_MAX_DELIVERY_COUNT` | No | Default `10` |
| `MESSAGING_DEFAULT_RETRY_DELAY_MS` | No | Default `1000` |
| `MESSAGING_SHUTDOWN_TIMEOUT_MS` | No | Default `30000` |
| `MESSAGING_DLQ_MAX_MESSAGES_PER_RUN` | No | Default `50` |
| `MESSAGING_DLQ_REPROCESS_ENABLED` | No | `true` to republish DLQ to main queue |
| `MESSAGING_LOG_PAYLOAD` | No | `true` to log payloads (dev only) |
\* Not required when `MESSAGING_DISABLED=true`

**Queue names are never hardcoded in this library.** Each app/worker sets queue names via env, e.g. `REMINDER_QUEUE_NAME`, `EMAIL_QUEUE_NAME`.

---

## Message envelope

```json
{
  "messageId": "uuid",
  "correlationId": "uuid",
  "eventType": "reminder.dispatch",
  "queueName": "reminders",
  "payload": { },
  "metadata": { "tenantId": "1" },
  "createdAt": "2026-06-01T12:00:00.000Z",
  "scheduledAt": "2026-06-01T12:05:00.000Z",
  "sourceSystem": "reminder-service",
  "retryCount": 0
}
```

`payload` is generic (`unknown` / your type in handlers).

---

## Quick start

### 1. Create a handler (in your app, not in `libs/messaging`)

```typescript
import type { MessageHandler, MessageHandlerContext, MessageHandlerResult } from '../../../libs/messaging/src/index';

export class ReminderDispatchHandler implements MessageHandler<{ reminderId: number }> {
  readonly name = 'reminder-dispatch-handler';
  readonly supportedEventTypes = ['reminder.dispatch'];

  async handle(context: MessageHandlerContext): Promise<MessageHandlerResult> {
    const { reminderId } = context.envelope.payload as { reminderId: number };
    // ... business logic ...
    return { complete: true };
  }
}
```

### 2. Register worker and start

```typescript
import { createMessagingInfrastructure } from '../../../libs/messaging/src/index';

const messaging = createMessagingInfrastructure();

messaging.workerRegistry.register({
  queueName: process.env.REMINDER_QUEUE_NAME!,
  handler: new ReminderDispatchHandler(),
  concurrency: 5,
});

await messaging.initialize();
await messaging.startWorkers();

process.on('SIGTERM', () => messaging.shutdown());
```

### 3. Publish from any service

```typescript
await messaging.publisher.publish({
  queueName: process.env.REMINDER_QUEUE_NAME!,
  eventType: 'reminder.dispatch',
  payload: { reminderId: 42 },
  options: { correlationId: requestId },
});
```

### 4. Schedule a message

```typescript
const ref = await messaging.scheduler.schedule({
  queueName: process.env.REMINDER_QUEUE_NAME!,
  eventType: 'reminder.dispatch',
  payload: { reminderId: 42 },
  scheduledEnqueueTime: new Date(Date.now() + 60_000),
});

// Later: cancel
await messaging.scheduler.cancelScheduled(ref.queueName, ref.sequenceNumber);
```

---

## Worker registration pattern

```
WorkerRegistry
    ↓
QueueWorkerConfig (queueName from env + handler instance)
    ↓
GenericConsumerFramework.startWorker()
    ↓
MessageHandler.handle()
```

Adding a new workflow:

1. Implement `MessageHandler`.
2. `workerRegistry.register({ queueName, handler })`.
3. Configure Azure queue + env var.
4. No changes to `libs/messaging` core.

---

## Settlement semantics

Handlers return optional `MessageHandlerResult`:

| Result | Behavior |
|--------|----------|
| `{ complete: true }` or void | Complete message |
| `{ abandon: true }` | Abandon for retry |
| `{ deadLetter: true, deadLetterReason }` | Dead-letter |

On uncaught errors: abandon until `maxDeliveryCount`, then dead-letter.

---

## Dead-letter processor

```typescript
const result = await messaging.deadLetterProcessor.processDeadLetters({
  queueName: process.env.REMINDER_QUEUE_NAME!,
  handler: optionalHandlerForDiagnostics,
  maxMessages: 50,
  reprocessToMainQueue: true,
});
```

---

## Health check

```typescript
const health = messaging.getHealth();
// { status, messagingEnabled, clientInitialized, activeProcessors, registeredWorkers, metrics }
```

---

## Observability

- Structured logging via shared `libs/logger` (pino)
- Correlation IDs on every envelope
- In-process metrics: `messagingMetrics.getSnapshot()`
- Processing duration per queue

---

## Security

- Connection string from env only
- `maskSensitiveData()` for logs
- `validateMessagingConfig()` at startup
- Logger redacts tokens/passwords (see `libs/logger`)

---

## Horizontal scaling

- Run multiple worker processes with the same queue name
- Azure Service Bus distributes messages across competing consumers
- Tune `concurrency` / `maxConcurrentCalls` per worker via `QueueWorkerConfig` or env

---

## Disable for local dev / tests

```env
MESSAGING_DISABLED=true
```

Publish/consume calls require `initialize()`; workers are skipped when disabled.

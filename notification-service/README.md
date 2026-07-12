# Sahayi Push Notification Service

Standalone Node.js microservice that receives scheduled notification events from Azure Service Bus, delivers push notifications via Firebase Cloud Messaging (FCM), tracks per-device delivery, and handles retries for failed devices.

## Architecture

```
Child Reminder Scheduler
        |
Azure Service Bus (scheduled messages)
        |
Azure Function (Service Bus Trigger)
        |
Node.js Push Notification Service
        |
Firebase Cloud Messaging
        |
User Mobile Devices
```

## Features

- **Idempotent processing** — `MessageId` stored in `notificationlog` prevents duplicate pushes
- **Multi-device support** — sends to all active FCM tokens for a user
- **Per-device delivery tracking** — `notificationdelivery` records SENT / FAILED / INVALID_TOKEN
- **Partial success rule** — if any device succeeds, the reminder is marked complete and remaining phases are cancelled; failed devices are retried separately
- **Retry queue** — temporary FCM failures retried up to 3 times via Azure Service Bus retry queue
- **Invalid token cleanup** — permanently invalid tokens are deactivated in `userdevicetoken`

## Project Structure

```
notification-service/
├── src/
│   ├── functions/
│   │   └── serviceBusTrigger.ts    # Thin Azure Function handlers
│   ├── services/
│   │   ├── notification.service.ts # Core business logic
│   │   ├── fcm.service.ts
│   │   ├── device.service.ts
│   │   └── retry-queue.service.ts
│   ├── repositories/
│   │   ├── notification.repository.ts
│   │   └── device.repository.ts
│   ├── firebase/
│   │   └── firebase.config.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── client.ts
│   ├── types/
│   └── utils/
├── host.json
├── local.settings.json
└── package.json
```

## Prerequisites

- Node.js 18+
- MySQL database with existing Sahayi tables (`userdevicetoken`, `notificationlog`, `childreminder`, `childremindernotificationschedule`)
- Azure Service Bus queues: `notification-dispatch` and `notification-retry`
- Firebase service account JSON
- [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local) v4

## Setup

1. **Install dependencies**

   ```bash
   cd notification-service
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and update `local.settings.json`:

   | Variable | Description |
   |----------|-------------|
   | `DATABASE_URL` | MySQL connection string |
   | `SERVICE_BUS_CONNECTION_STRING` | Azure Service Bus connection |
   | `SERVICE_BUS_QUEUE_NAME` | Primary dispatch queue |
   | `SERVICE_BUS_RETRY_QUEUE_NAME` | Retry queue for failed devices |
   | `FIREBASE_PROJECT_ID` | Firebase project ID (`sahayipushnotification`) |
   | `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to Firebase Admin service account JSON |
   | `MAX_RETRY_COUNT` | Max retry attempts (default: 3) |

3. **Generate Prisma client**

   ```bash
   npm run prisma:generate
   ```

   Run `npm run prisma:push` only if you need to create the new `notificationdelivery` table. Existing tables should already be present in the Sahayi database.

4. **Configure Firebase**

   Values extracted from `../google-services.json`:

   | Variable | Value |
   |----------|-------|
   | `FIREBASE_PROJECT_ID` | `sahayipushnotification` |
   | `FIREBASE_PROJECT_NUMBER` | `27324304081` |
   | `FIREBASE_STORAGE_BUCKET` | `sahayipushnotification.firebasestorage.app` |
   | `FIREBASE_ANDROID_PACKAGE_NAME` | `com.sahayi.mobile` |
   | `FIREBASE_ANDROID_APP_ID` | `1:27324304081:android:cfbc09eb40f750224013f0` |

   **Important:** `google-services.json` is for the Android mobile app only. The push notification service needs a separate **Firebase Admin service account** JSON with a `private_key`.

   1. Open [Firebase Console](https://console.firebase.google.com/) → project **sahayipushnotification**
   2. Go to **Project Settings** → **Service accounts**
   3. Click **Generate new private key**
   4. Save the downloaded file as `notification-service/firebase-service-account.json`
   5. Use `firebase-service-account.example.json` as a reference for the expected format

   The `api_key` inside `google-services.json` is **not** used by this server-side service.

5. **Build and run locally**

   ```bash
   npm run build
   npm start
   ```

## Message Formats

### Dispatch message (primary queue)

```json
{
  "messageId": "2ea47ef8-ced4-47db-81f7-e3041a4ef431",
  "eventType": "notification.dispatch",
  "payload": {
    "module": "reminder",
    "eventType": "reminder.before",
    "userId": "7",
    "title": "Tomorrow testing release",
    "body": "Upcoming: Release sahayii demo app",
    "channels": ["push"],
    "data": {
      "childReminderId": "4",
      "phase": "before"
    }
  },
  "retryCount": 0
}
```

### Retry message (retry queue)

```json
{
  "originalMessageId": "2ea47ef8-ced4-47db-81f7-e3041a4ef431",
  "retryCount": 1,
  "failedDevices": [
    { "userDeviceTokenId": "15", "fcmToken": "xxxx" }
  ],
  "payload": {
    "title": "...",
    "body": "...",
    "data": {}
  }
}
```

## Processing Flow

1. Validate incoming message (Zod schemas)
2. Check `notificationlog` by `MessageId` — skip if duplicate
3. For reminders, check `childreminder.NotificationCompleted` — skip if already done
4. Create `notificationlog` record
5. Fetch active devices from `userdevicetoken`
6. Send FCM to all devices; record per-device status in `notificationdelivery`
7. If **any** device succeeds → mark reminder phase complete, cancel future schedules
8. Enqueue retry for temporarily failed devices (not invalid tokens)
9. Deactivate permanently invalid FCM tokens

## Reminder Phases

| Phase | `payload.eventType` | DB field updated |
|-------|-------------------|------------------|
| 5 min before | `reminder.before` | `BeforeNotificationSent` |
| On time | `reminder.on-time` | `OnTimeNotificationSent` |
| 5 min after | `reminder.after` | `AfterNotificationSent` |

When any phase succeeds: `NotificationCompleted = true` and all `childremindernotificationschedule` rows are cancelled.

## Testing

```bash
npm test
```

## Deployment

Deploy as an Azure Function App (Node.js 18+, v4 programming model). Ensure application settings mirror `local.settings.json` values and the `notificationdelivery` table exists in production MySQL.

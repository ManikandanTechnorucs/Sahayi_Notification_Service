import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

let initialized = false;

interface FirebaseProjectConfig {
  projectId: string;
  projectNumber?: string;
  storageBucket?: string;
}

function loadProjectConfig(): FirebaseProjectConfig | null {
  const configPath = path.join(__dirname, 'project.config.json');

  if (!fs.existsSync(configPath)) {
    return null;
  }

  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
    projectId?: string;
    projectNumber?: string;
    storageBucket?: string;
  };

  if (!raw.projectId) {
    return null;
  }

  return {
    projectId: raw.projectId,
    projectNumber: raw.projectNumber,
    storageBucket: raw.storageBucket,
  };
}

function resolveProjectId(serviceAccount: { project_id?: string }): string {
  const fromEnv = process.env.FIREBASE_PROJECT_ID;
  const fromServiceAccount = serviceAccount.project_id;
  const fromProjectConfig = loadProjectConfig()?.projectId;

  const projectId = fromEnv ?? fromServiceAccount ?? fromProjectConfig;

  if (!projectId) {
    throw new Error(
      'Firebase project ID not found. Set FIREBASE_PROJECT_ID or use a service account with project_id.'
    );
  }

  if (fromEnv && fromServiceAccount && fromEnv !== fromServiceAccount) {
    throw new Error(
      `Firebase project ID mismatch: FIREBASE_PROJECT_ID=${fromEnv}, service account project_id=${fromServiceAccount}`
    );
  }

  return projectId;
}

export function initializeFirebase(): admin.app.App {
  if (initialized && admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
    path.join(process.cwd(), 'firebase-service-account.json');

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      `Firebase service account file not found at: ${serviceAccountPath}. ` +
        'Download it from Firebase Console → Project Settings → Service Accounts → Generate new private key. ' +
        'See firebase-service-account.example.json for the expected format.'
    );
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8')) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  if (!serviceAccount.private_key || serviceAccount.private_key.includes('REPLACE_WITH_VALUE')) {
    throw new Error(
      'Invalid Firebase service account file. Replace placeholder values in firebase-service-account.json ' +
        'with credentials downloaded from Firebase Console.'
    );
  }

  const projectId = resolveProjectId(serviceAccount);
  const projectConfig = loadProjectConfig();

  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? projectConfig?.storageBucket,
  });

  initialized = true;
  logger.info('Firebase Admin SDK initialized', {
    projectId,
    clientEmail: serviceAccount.client_email,
    androidPackage: process.env.FIREBASE_ANDROID_PACKAGE_NAME,
  });

  return app;
}

export function getMessaging(): admin.messaging.Messaging {
  initializeFirebase();
  return admin.messaging();
}

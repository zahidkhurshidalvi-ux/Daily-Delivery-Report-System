import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PostOffice, DailyReport, TriggerConfig, WhatsAppConfig, GoogleSheetsConfig } from '../types';
import { cleanAndFilterPostOffices, cleanAndFilterReports } from '../utils/calculations';

const POST_OFFICES_COL = 'postOffices';
const DAILY_REPORTS_COL = 'dailyReports';
const APP_CONFIG_COL = 'appConfig';

/**
 * Generate a deterministic Firestore document ID for a Post Office
 */
export function getPostOfficeDocId(office: PostOffice | { id?: string; name: string }): string {
  if (office.id && office.id.trim().length > 0) {
    return office.id.replace(/[^a-zA-Z0-9_.-]/g, '_');
  }
  return `po-${(office.name || '').toLowerCase().trim().replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
}

/**
 * Subscribe to Realtime Post Offices across all devices
 */
export function subscribeToPostOffices(
  onUpdate: (offices: PostOffice[]) => void,
  onError?: (err: any) => void
) {
  const colRef = collection(db, POST_OFFICES_COL);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const offices: PostOffice[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.name) {
          offices.push({
            id: docSnap.id,
            name: data.name,
            postmasterName: data.postmasterName || 'Postmaster',
            mobileNumber: data.mobileNumber || '',
            status: data.status || 'ACTIVE',
            initialBalance: typeof data.initialBalance === 'number' ? data.initialBalance : 0,
          });
        }
      });
      onUpdate(cleanAndFilterPostOffices(offices));
    },
    (error) => {
      console.error('Realtime Post Offices error:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, POST_OFFICES_COL);
    }
  );
}

/**
 * Fetch all daily reports once directly from Firestore server
 */
export async function fetchAllDailyReportsFromCloud(): Promise<DailyReport[]> {
  try {
    const colRef = collection(db, DAILY_REPORTS_COL);
    const snapshot = await getDocs(colRef);
    const reports: DailyReport[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.date && (data.officeName || data.postOfficeName)) {
        reports.push({
          id: docSnap.id,
          date: data.date,
          officeName: data.officeName || data.postOfficeName,
          postmasterName: data.postmasterName || 'Postmaster',
          lastBalance: Number(data.lastBalance) || 0,
          receivedToday: Number(data.receivedToday ?? data.received) || 0,
          delivered: Number(data.delivered) || 0,
          returnedToSender: Number(data.returnedToSender ?? data.returned) || 0,
          missent: Number(data.missent) || 0,
          deposit: Number(data.deposit) || 0,
          closingBalance: Number(data.closingBalance) || 0,
          remarks: data.remarks || '',
          submittedAt: data.submittedAt || new Date().toISOString(),
          submittedBy: data.submittedBy || 'Postmaster',
        });
      }
    });
    return cleanAndFilterReports(reports);
  } catch (error) {
    console.error('Error fetching reports from Firestore server:', error);
    return [];
  }
}

/**
 * Subscribe to Realtime Daily Reports across all devices
 */
export function subscribeToDailyReports(
  onUpdate: (reports: DailyReport[]) => void,
  onError?: (err: any) => void
) {
  const colRef = collection(db, DAILY_REPORTS_COL);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const reports: DailyReport[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.date && (data.officeName || data.postOfficeName)) {
          reports.push({
            id: docSnap.id,
            date: data.date,
            officeName: data.officeName || data.postOfficeName,
            postmasterName: data.postmasterName || 'Postmaster',
            lastBalance: Number(data.lastBalance) || 0,
            receivedToday: Number(data.receivedToday ?? data.received) || 0,
            delivered: Number(data.delivered) || 0,
            returnedToSender: Number(data.returnedToSender ?? data.returned) || 0,
            missent: Number(data.missent) || 0,
            deposit: Number(data.deposit) || 0,
            closingBalance: Number(data.closingBalance) || 0,
            remarks: data.remarks || '',
            submittedAt: data.submittedAt || new Date().toISOString(),
            submittedBy: data.submittedBy || 'Postmaster',
          });
        }
      });
      onUpdate(cleanAndFilterReports(reports));
    },
    (error) => {
      console.error('Realtime Daily Reports error:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, DAILY_REPORTS_COL);
    }
  );
}

/**
 * Save / Update a Single Post Office in Cloud Firestore
 */
export async function savePostOfficeToCloud(office: PostOffice): Promise<void> {
  const docId = getPostOfficeDocId(office);
  const docRef = doc(db, POST_OFFICES_COL, docId);
  try {
    await setDoc(
      docRef,
      {
        id: docId,
        name: office.name,
        postmasterName: office.postmasterName || 'Postmaster',
        mobileNumber: office.mobileNumber || '',
        status: office.status || 'ACTIVE',
        initialBalance: Number(office.initialBalance) || 0,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${POST_OFFICES_COL}/${docId}`);
  }
}

/**
 * Delete a Single Post Office from Cloud Firestore
 */
export async function deletePostOfficeFromCloud(officeId: string): Promise<void> {
  const safeDocId = officeId.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const docRef = doc(db, POST_OFFICES_COL, safeDocId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${POST_OFFICES_COL}/${safeDocId}`);
  }
}

/**
 * Batch Sync/Seed multiple Post Offices to Cloud Firestore
 */
export async function syncAllOfficesToCloud(offices: PostOffice[]): Promise<void> {
  if (!offices || offices.length === 0) return;
  try {
    const batch = writeBatch(db);
    offices.forEach((po) => {
      const docId = getPostOfficeDocId(po);
      const docRef = doc(db, POST_OFFICES_COL, docId);
      batch.set(
        docRef,
        {
          id: docId,
          name: po.name,
          postmasterName: po.postmasterName || 'Postmaster',
          mobileNumber: po.mobileNumber || '',
          status: po.status || 'ACTIVE',
          initialBalance: Number(po.initialBalance) || 0,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, POST_OFFICES_COL);
  }
}

/**
 * Save / Submit a Daily Report to Cloud Firestore
 * Guaranteed to save with both officeName and postOfficeName, receivedToday and received
 */
export async function saveDailyReportToCloud(report: DailyReport): Promise<void> {
  const officeNameSafe = (report.officeName || 'office').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const docId = report.id ? report.id.replace(/[^a-zA-Z0-9_.-]/g, '_') : `rep-${report.date}-${officeNameSafe}`;
  const docRef = doc(db, DAILY_REPORTS_COL, docId);
  try {
    await setDoc(
      docRef,
      {
        ...report,
        id: docId,
        officeName: report.officeName,
        postOfficeName: report.officeName, // Backwards and forwards compatibility
        received: report.receivedToday,
        receivedToday: report.receivedToday,
        returned: report.returnedToSender,
        returnedToSender: report.returnedToSender,
        submittedAt: report.submittedAt || new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${DAILY_REPORTS_COL}/${docId}`);
  }
}

/**
 * Delete a Daily Report from Cloud Firestore
 */
export async function deleteDailyReportFromCloud(reportId: string): Promise<void> {
  const safeDocId = reportId.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const docRef = doc(db, DAILY_REPORTS_COL, safeDocId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${DAILY_REPORTS_COL}/${safeDocId}`);
  }
}

/**
 * Save App Configurations to Cloud Firestore
 */
export async function saveAppConfigToCloud(configs: {
  whatsAppConfig?: WhatsAppConfig;
  triggerConfig?: TriggerConfig;
  googleSheetsConfig?: GoogleSheetsConfig;
}): Promise<void> {
  const docRef = doc(db, APP_CONFIG_COL, 'global_settings');
  try {
    await setDoc(
      docRef,
      {
        ...configs,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${APP_CONFIG_COL}/global_settings`);
  }
}

/**
 * Subscribe to App Configurations
 */
export function subscribeToAppConfig(
  onUpdate: (config: {
    whatsAppConfig?: WhatsAppConfig;
    triggerConfig?: TriggerConfig;
    googleSheetsConfig?: GoogleSheetsConfig;
  }) => void
) {
  const docRef = doc(db, APP_CONFIG_COL, 'global_settings');
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as any);
      }
    },
    (error) => {
      console.warn('AppConfig listener error:', error);
    }
  );
}

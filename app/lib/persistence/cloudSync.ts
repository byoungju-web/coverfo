/*
 * 대화 목록 기기 간 연동 (데스크탑 ↔ 스마트폰)
 *
 * - 대화는 지금처럼 각 기기의 브라우저 저장소(IndexedDB)에 먼저 저장합니다.
 * - 로그인한 사용자는 저장할 때마다(3초 모아서) Supabase 의 cf_chats 표에도 올립니다.
 * - 사이드바를 열거나 화면으로 돌아올 때 Supabase 에서 받아와 이 기기에 없는 대화를 채워 넣습니다.
 * - 대화를 지우면 Supabase 에는 "지움" 표시만 남겨서, 다른 기기에서도 지워지게 합니다.
 * - 로그인하지 않았거나 인터넷 오류가 나면 조용히 넘어갑니다 (기존처럼 이 기기에서만 동작).
 */
import type { Message } from 'ai';
import { supabase } from '~/lib/supabaseClient';
import { getAll, getNextId, getUrlId, type IChatMetadata } from './db';

const TABLE = 'cf_chats';
const PUSH_DELAY_MS = 3000;
const PENDING_DELETES_KEY = 'cf-cloud-deleted';

export interface CloudChatRecord {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
  metadata?: IChatMetadata;
  cloudKey?: string;
  cloudSyncedAt?: string;
}

interface CloudRow {
  cloud_key: string;
  url_id: string | null;
  description: string | null;
  messages: Message[] | null;
  metadata: IChatMetadata | null;
  chat_time: string | null;
  deleted: boolean;
  updated_at: string;
}

export function newCloudKey(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // 아래 방법으로 만듭니다
  }

  return `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getUserId(): Promise<string | undefined> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id;
  } catch {
    return undefined;
  }
}

/* ---------- 이 기기 저장소(IndexedDB)에 직접 쓰기 (다시 올리기를 일으키지 않음) ---------- */

function rawPut(db: IDBDatabase, record: CloudChatRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chats', 'readwrite');
    const req = tx.objectStore('chats').put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function rawGet(db: IDBDatabase, id: string): Promise<CloudChatRecord | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chats', 'readonly');
    const req = tx.objectStore('chats').get(id);
    req.onsuccess = () => resolve(req.result as CloudChatRecord | undefined);
    req.onerror = () => reject(req.error);
  });
}

function rawDelete(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stores = db.objectStoreNames.contains('snapshots') ? ['chats', 'snapshots'] : ['chats'];
    const tx = db.transaction(stores, 'readwrite');
    tx.objectStore('chats').delete(id);

    if (stores.length > 1) {
      tx.objectStore('snapshots').delete(id);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------- 올리기 (3초 모아서 한 번) ---------- */

const pendingPush = new Map<string, { db: IDBDatabase; record: CloudChatRecord }>();
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function pushNow(key: string) {
  const item = pendingPush.get(key);
  pendingPush.delete(key);
  pushTimers.delete(key);

  if (!item) {
    return;
  }

  const userId = await getUserId();

  if (!userId) {
    return;
  }

  const { db, record } = item;
  const updatedAt = new Date().toISOString();

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      cloud_key: key,
      url_id: record.urlId ?? null,
      description: record.description ?? null,
      messages: record.messages ?? [],
      metadata: record.metadata ?? null,
      chat_time: record.timestamp,
      deleted: false,
      updated_at: updatedAt,
    },
    { onConflict: 'user_id,cloud_key' },
  );

  if (error) {
    console.warn('[cloudSync] 올리기 실패:', error.message);
    return;
  }

  // 올린 시각을 이 기기 기록에 남겨서, 받아올 때 같은 내용을 다시 덮어쓰지 않게 합니다
  try {
    const current = await rawGet(db, record.id);

    if (current && current.cloudKey === key) {
      await rawPut(db, { ...current, cloudSyncedAt: updatedAt });
    }
  } catch {
    // 기록을 못 남겨도 다음 동기화 때 다시 맞춰집니다
  }
}

/** 대화가 저장될 때마다 호출합니다. 3초 동안 모았다가 마지막 내용만 올립니다. */
export function scheduleCloudPush(db: IDBDatabase, record: CloudChatRecord, delayMs = PUSH_DELAY_MS) {
  const key = record.cloudKey;

  if (!key || typeof window === 'undefined') {
    return;
  }

  pendingPush.set(key, { db, record });

  const old = pushTimers.get(key);

  if (old) {
    clearTimeout(old);
  }

  pushTimers.set(
    key,
    setTimeout(() => {
      pushNow(key).catch((e) => console.warn('[cloudSync] 올리기 오류:', e));
    }, delayMs),
  );
}

/* ---------- 지운 대화 알리기 ---------- */

function readPendingDeletes(): string[] {
  try {
    const raw = window.localStorage.getItem(PENDING_DELETES_KEY);
    const list = raw ? JSON.parse(raw) : [];

    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writePendingDeletes(list: string[]) {
  try {
    window.localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(list));
  } catch {
    // 저장이 안 되면 다음에 다시 시도됩니다
  }
}

async function flushPendingDeletes(userId: string) {
  const keys = readPendingDeletes();

  if (keys.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from(TABLE).upsert(
    keys.map((key) => ({
      user_id: userId,
      cloud_key: key,
      messages: [],
      deleted: true,
      updated_at: now,
    })),
    { onConflict: 'user_id,cloud_key' },
  );

  if (!error) {
    const left = readPendingDeletes().filter((k) => !keys.includes(k));
    writePendingDeletes(left);
  }
}

/** 이 기기에서 대화를 지웠을 때 호출합니다. 다른 기기에서도 지워지게 표시합니다. */
export function markCloudDeleted(cloudKey: string | undefined) {
  if (!cloudKey || typeof window === 'undefined') {
    return;
  }

  const list = readPendingDeletes();

  if (!list.includes(cloudKey)) {
    list.push(cloudKey);
    writePendingDeletes(list);
  }

  const timer = pushTimers.get(cloudKey);

  if (timer) {
    clearTimeout(timer);
    pushTimers.delete(cloudKey);
  }

  pendingPush.delete(cloudKey);

  getUserId()
    .then((userId) => (userId ? flushPendingDeletes(userId) : undefined))
    .catch(() => undefined);
}

/* ---------- 받아오기 ---------- */

let syncing = false;

/**
 * Supabase 와 이 기기의 대화 목록을 맞춥니다.
 * 이 기기의 목록이 바뀌었으면 true 를 돌려줍니다 (사이드바를 다시 그리는 데 씁니다).
 */
export async function syncChatsFromCloud(db: IDBDatabase): Promise<boolean> {
  if (syncing || typeof window === 'undefined') {
    return false;
  }

  syncing = true;

  try {
    const userId = await getUserId();

    if (!userId) {
      return false;
    }

    await flushPendingDeletes(userId);

    const { data, error } = await supabase
      .from(TABLE)
      .select('cloud_key,url_id,description,messages,metadata,chat_time,deleted,updated_at')
      .eq('user_id', userId);

    if (error || !data) {
      if (error) {
        console.warn('[cloudSync] 받아오기 실패:', error.message);
      }

      return false;
    }

    const rows = data as CloudRow[];
    const locals = (await getAll(db)) as unknown as CloudChatRecord[];
    const byKey = new Map<string, CloudChatRecord>();

    locals.forEach((c) => {
      if (c.cloudKey) {
        byKey.set(c.cloudKey, c);
      }
    });

    let changed = false;

    for (const row of rows) {
      const local = byKey.get(row.cloud_key);

      if (row.deleted) {
        if (local) {
          await rawDelete(db, local.id);
          changed = true;
        }

        continue;
      }

      if (!local) {
        // 다른 기기에서 만든 대화 → 이 기기에 새로 넣습니다
        const id = await getNextId(db);
        const urlId = await getUrlId(db, row.url_id || id);

        await rawPut(db, {
          id,
          urlId,
          description: row.description ?? undefined,
          messages: row.messages ?? [],
          timestamp: row.chat_time || row.updated_at,
          metadata: row.metadata ?? undefined,
          cloudKey: row.cloud_key,
          cloudSyncedAt: row.updated_at,
        });
        changed = true;
        continue;
      }

      if (!local.cloudSyncedAt) {
        // 이 기기에서 올리던 중이던 대화 → 이 기기 내용을 다시 올립니다
        scheduleCloudPush(db, local, 0);
        continue;
      }

      if (Date.parse(row.updated_at) > Date.parse(local.cloudSyncedAt)) {
        // 다른 기기에서 더 나중에 바뀐 대화 → 받아온 내용으로 바꿉니다
        await rawPut(db, {
          ...local,
          description: row.description ?? local.description,
          messages: row.messages ?? local.messages,
          metadata: row.metadata ?? local.metadata,
          timestamp: row.chat_time || local.timestamp,
          cloudSyncedAt: row.updated_at,
        });
        changed = true;
      }
    }

    // 아직 한 번도 올리지 않은 이 기기의 대화 → 올립니다
    const remoteKeys = new Set(rows.map((r) => r.cloud_key));

    for (const local of locals) {
      if (!local.messages || local.messages.length === 0) {
        continue;
      }

      if (local.cloudKey && remoteKeys.has(local.cloudKey)) {
        continue;
      }

      let record = local;

      if (!record.cloudKey) {
        record = { ...local, cloudKey: newCloudKey() };
        await rawPut(db, record);
      }

      scheduleCloudPush(db, record, 0);
    }

    return changed;
  } catch (e) {
    console.warn('[cloudSync] 동기화 오류:', e);
    return false;
  } finally {
    syncing = false;
  }
}

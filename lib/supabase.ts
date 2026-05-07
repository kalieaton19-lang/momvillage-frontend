import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const missingConfig = !url || !anonKey || url.includes('your-project-ref') || anonKey.includes('your-anon-public-key');

// Fail loudly if env vars are missing (never use stub)
if (missingConfig) {
  throw new Error(
    'Supabase environment variables are missing!\n' +
    'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
  );
}
const isBrowser = typeof window !== 'undefined';

type Store = {
  getItem: (key: string) => string | null;
  setItem: (key: string, val: string) => void;
  removeItem: (key: string) => void;
};

const store: Store = (() => {
  if (isBrowser && typeof window !== 'undefined' && (window as any).localStorage) {
    return (window as any).localStorage as Store;
  }
  const globalKey = '__localStorageData__';
  const g: any = globalThis as any;
  if (!g[globalKey]) g[globalKey] = {};
  const data = g[globalKey];
  return {
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, val: string) => { data[key] = val; },
    removeItem: (key: string) => { delete data[key]; },
  } as Store;
})();

const USERS_KEY = 'mv_users';
const SESSION_KEY = 'mv_session';

function readJSON<T>(key: string): T | null {
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: any) {
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {}
}

function findUserByEmail(email: string): any | null {
  const users = readJSON<any[]>(USERS_KEY) || [];
  return users.find((u: any) => u.email === email) || null;
}

function findUserById(id: string): any | null {
  const users = readJSON<any[]>(USERS_KEY) || [];
  return users.find((u: any) => u.id === id) || null;
}

function upsertUser(user: any) {
  const users = readJSON<any[]>(USERS_KEY) || [];
  const idx = users.findIndex((u: any) => u.id === user.id);
  if (idx >= 0) users[idx] = user; else users.push(user);
  writeJSON(USERS_KEY, users);
}

function setSession(user: any) {
  const session = { user };
  writeJSON(SESSION_KEY, session);
  return session;
}

function getSessionValue(): any | null {
  return readJSON<any>(SESSION_KEY);
}

const supabaseStub = {
  auth: {
    getSession: async () => ({ data: { session: getSessionValue() }, error: null }),
    getUser: async () => ({ data: { user: getSessionValue()?.user || null }, error: null }),
    signUp: async (args: any) => {
      const { email, password } = args || {};
      if (!email || !password) return { data: null, error: new Error('email and password required') };
      const existing = findUserByEmail(email);
      if (existing) return { data: null, error: new Error('User already exists') };
      const user = { id: `local_${Date.now()}`, email, user_metadata: {}, password };
      upsertUser(user);
      const session = setSession({ id: user.id, email: user.email, user_metadata: user.user_metadata });
      return { data: { user: session.user, session }, error: null };
    },
    signInWithPassword: async (args: any) => {
      const { email, password } = args || {};
      const user = email ? findUserByEmail(email) : null;
      if (!user || user.password !== password) return { data: null, error: new Error('Invalid email or password') };
      const session = setSession({ id: user.id, email: user.email, user_metadata: user.user_metadata });
      return { data: { user: session.user, session }, error: null };
    },
    signOut: async () => { store.removeItem(SESSION_KEY); return { error: null }; },
    updateUser: async (args: any) => {
      const session = getSessionValue();
      if (!session?.user) return { data: null, error: new Error('No user in session') };
      const user = findUserById(session.user.id);
      if (!user) return { data: null, error: new Error('User not found') };
      user.user_metadata = { ...(user.user_metadata || {}), ...(args || {}) };
      upsertUser(user);
      const newSession = setSession({ id: user.id, email: user.email, user_metadata: user.user_metadata });
      return { data: { user: newSession.user }, error: null };
    },
    admin: {
      listUsers: async () => {
        const users = readJSON<any[]>(USERS_KEY) || [];
        return { data: { users }, error: null };
      },
      getUserById: async (id: string) => {
        const user = findUserById(id);
        return { data: { user }, error: null };
      },
    },
  },
  storage: {
    from: (_bucket: string) => ({
      upload: async (_path: string, _file: any, _opts?: any) => ({ data: null, error: new Error('storage upload disabled in local stub mode') }),
      getPublicUrl: (_path: string) => ({ data: { publicUrl: '' } }),
    }),
  },
} as const;

export const supabase = createClient(url, anonKey);

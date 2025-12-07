import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

type User = { email: string; passwordHash: string };

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readUsers(): User[] {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    return [];
  }
}

function writeUsers(users: User[]) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}


export function findUser(email: string) {
  const users = readUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export function addUser(email: string, passwordHash: string) {
  const users = readUsers();
  const exists = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (exists) return false;
  users.push({ email, passwordHash });
  writeUsers(users);
  return true;
}

export function clearUsers() {
  writeUsers([]);
}

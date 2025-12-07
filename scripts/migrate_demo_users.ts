#!/usr/bin/env node
/*
  Migration script: read .data/users.json and create users in Supabase via Admin API.
  WARNING: This creates users with a temporary password. You should inform users to reset their password.
  Usage:
    SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate_demo_users.js
*/
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const DATA_FILE = path.join(process.cwd(), '.data', 'users.json');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SERVICE_ROLE) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY env var');
  process.exit(1);
}

if (!fs.existsSync(DATA_FILE)) {
  console.error('No demo users file found at .data/users.json');
  process.exit(1);
}

const raw = fs.readFileSync(DATA_FILE, 'utf-8');
const users = JSON.parse(raw || '[]');

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

(async function migrate() {
  for (const u of users) {
    try {
      const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: tempPassword,
        email_confirm: true,
      });
      if (error) {
        console.error('Failed:', u.email, error.message || error);
      } else {
        console.log('Created', u.email, 'temporary password:', tempPassword);
      }
    } catch (err) {
      console.error('Error migrating', u.email, err);
    }
  }
})();

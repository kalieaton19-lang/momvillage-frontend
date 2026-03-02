// test-edge.js
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
require('dotenv').config();

const token = process.env.TOKEN; // Set this to a valid JWT
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').split('https://')[1]?.split('.')[0];
const FUNCTION_URL = 'https://tsnnpeddaydwrfhwjicu.functions.supabase.co/send_message'; // Update if needed

if (!token) {
  console.error('Set TOKEN env var');
  process.exit(1);
}

(async () => {
  const payload = {
    sender_id: 'test-sender-id',
    recipient_id: 'test-recipient-id',
    content: 'Hello from test-edge.js!',
    match_id: 'test-match-id',
  };

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'apikey': anonKey,
      'x-project-ref': projectRef,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', text);
})();

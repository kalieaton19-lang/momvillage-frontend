// test-send-message.js
// Directly test your Supabase Edge Function for sending messages

const fetch = require('node-fetch');
require('dotenv').config();


const EDGE_FUNCTION_URL = (process.env.SUPABASE_EDGE_FUNCTION_URL || (process.env.SUPABASE_URL || '').replace(/\/$/, '') + '/functions/v1/send_message');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function main() {

  // Example payload - update these values to valid UUIDs and message
  const payload = {
    match_uuid: 'REPLACE_WITH_CONVERSATION_UUID',
    match_id: 'REPLACE_WITH_MATCH_ID',
    sender_id: 'REPLACE_WITH_SENDER_UUID',
    receiver_id: 'REPLACE_WITH_RECEIVER_UUID',
    message_text: 'Hello from test script!',
    created_at: new Date().toISOString(),
    metadata: {}
  };

  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SUPABASE_ANON_KEY ? { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('Function call failed', res.status, errText);
      throw new Error(`Edge function error: ${res.status}`);
    }
    const data = await res.json();
    console.log('Function response:', data);
    return data;
  } catch (err) {
    console.error('Error:', err);
  }
}

main();

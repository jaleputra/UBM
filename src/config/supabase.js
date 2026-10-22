const { createClient } = require('@supabase/supabase-js');

const DEFAULT_SUPABASE_URL = 'https://aefhdgktpmneqbhaoily.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_i-LZ_maZ8S0VaRM8lEWtXg_Mc0L5bIL';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log(`⚡ [Supabase] Terhubung ke project Supabase: ${SUPABASE_URL}`);
  } catch (err) {
    console.error('⚠️ [Supabase] Gagal menginisialisasi client Supabase:', err.message);
  }
}

module.exports = supabase;

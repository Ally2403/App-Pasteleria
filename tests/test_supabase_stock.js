import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Leer .env manualmente
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach((line) => {
  const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan variables de entorno en el .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('Consultando perfiles...');
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
  if (pError) console.error('Error perfiles:', pError);
  else console.log('Perfiles obtenidos:', profiles);

  console.log('Consultando ingredientes...');
  const { data: ingredients, error: iError } = await supabase.from('ingredients').select('id, name');
  if (iError) {
    console.error('Error ingredientes:', iError);
    return;
  }
  console.log(`Encontrados ${ingredients.length} ingredientes.`);

  if (ingredients.length === 0) return;

  const firstIng = ingredients[0];
  console.log(`Probando lectura de inventario para ${firstIng.name} (${firstIng.id})...`);
  const { data: inv, error: invError } = await supabase
    .from('inventory')
    .select('*')
    .eq('ingredient_id', firstIng.id);

  if (invError) console.error('Error inv:', invError);
  else console.log('Inventario actual:', inv);

  if (inv && inv.length > 0) {
    const currentStock = inv[0].current_stock;
    console.log(`Intentando actualizar stock a ${currentStock + 10}...`);
    const { data: updateData, error: upError } = await supabase
      .from('inventory')
      .update({ current_stock: currentStock + 10 })
      .eq('ingredient_id', firstIng.id)
      .select();

    if (upError) console.error('Error al actualizar:', upError);
    else console.log('Resultado del update:', updateData);
  }
}

runTest();

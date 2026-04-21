/**
 * Crea el primer usuario administrador en la base de datos.
 *
 * Uso:
 *   npx tsx scripts/seed-admin.ts [email] [password]
 *
 * Ejemplos:
 *   npx tsx scripts/seed-admin.ts
 *   npx tsx scripts/seed-admin.ts admin@miempresa.com MiPassword123!
 *
 * Requiere DATABASE_URL en el entorno (carga .env automáticamente).
 */
import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const email = process.argv[2] ?? 'admin@localxpress.com';
const password = process.argv[3] ?? 'Admin_LX_2024!';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no está definida. Crea un archivo .env primero.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    await pool.query('SELECT 1');
    console.log('✅ Conexión a base de datos OK');

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log(`⚠️  El usuario ${email} ya existe. Nada que hacer.`);
      return;
    }

    const hash = await bcrypt.hash(password, 12);

    const {
      rows: [user],
    } = await pool.query<{ id: string }>(
      'INSERT INTO users (email, password_hash, is_active) VALUES ($1, $2, true) RETURNING id',
      [email, hash]
    );

    await pool.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [user.id, 'admin']);

    await pool.query("UPDATE profiles SET full_name = 'Administrador', is_active = true WHERE user_id = $1", [
      user.id,
    ]);

    console.log('');
    console.log('✅ Usuario admin creado correctamente');
    console.log('─────────────────────────────────────');
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   User ID:  ${user.id}`);
    console.log('─────────────────────────────────────');
    console.log('⚠️  Cambia la contraseña tras el primer login en producción.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

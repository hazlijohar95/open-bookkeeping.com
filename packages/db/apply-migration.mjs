import postgres from 'postgres';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  try {
    const migrationsDir = join(__dirname, 'migrations');
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files: ${files.join(', ')}\n`);

    for (const file of files) {
      console.log(`\n========== Processing ${file} ==========`);
      const migrationPath = join(migrationsDir, file);
      const migrationSql = readFileSync(migrationPath, 'utf-8');

      // Split by statement breakpoint
      const statements = migrationSql.split('--> statement-breakpoint');

      console.log(`Found ${statements.length} statements`);

      let successCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim();
        if (!stmt) continue;

        const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
        process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);

        try {
          await sql.unsafe(stmt);
          console.log('✓');
          successCount++;
        } catch (err) {
          // Handle common "already exists" errors gracefully
          if (
            err.message.includes('already exists') ||
            err.message.includes('duplicate key') ||
            err.message.includes('relation') && err.message.includes('already exists')
          ) {
            console.log('⚠ (skipped - already exists)');
            skippedCount++;
          } else {
            console.log(`✗ ${err.message}`);
            errorCount++;
          }
        }
      }

      console.log(`\n  Summary: ${successCount} succeeded, ${skippedCount} skipped, ${errorCount} errors`);
    }

    // Mark migrations as complete in drizzle journal
    console.log('\n========== Marking migrations as complete ==========');

    // Ensure schema exists
    await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;

    // Create migrations table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `;

    // Insert migration records
    for (const file of files) {
      const tag = file.replace('.sql', '');
      try {
        await sql`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          SELECT ${tag}, ${Date.now()}
          WHERE NOT EXISTS (
            SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${tag}
          )
        `;
        console.log(`  Marked ${tag} as complete`);
      } catch (err) {
        console.log(`  ${tag}: ${err.message}`);
      }
    }

    console.log('\n✓ All migrations processed!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();

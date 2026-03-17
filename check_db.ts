import Database from 'better-sqlite3';
const db = new Database('app.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables);
for (const table of tables) {
  const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
  console.log(`Table ${table.name} count:`, count.count);
}

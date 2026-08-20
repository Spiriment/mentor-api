import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../src/common';

// How many days of daily backups to keep on disk before deleting the oldest.
// Keeps disk usage bounded on shared hosting instead of growing forever.
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 14);

const backupDir = path.join(process.cwd(), 'backups');

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`Created backup directory: ${backupDir}`);
}

// Generate backup filename with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const backupFile = path.join(backupDir, `backup-${timestamp}.sql.gz`);

// Get database credentials from config
const host = Config.database.host;
const port = Config.database.port;
const username = Config.database.username;
const password = Config.database.password;
const database = Config.database.name;

console.log('Starting database backup...');
console.log(`Database: ${database}`);
console.log(`Backup file: ${backupFile}`);

try {
  // Build mysqldump command, piped through gzip to keep backups small on
  // shared-hosting disk quotas. Password passed via MYSQL_PWD, never on the
  // command line, so it doesn't show up in `ps`/shell history.
  // --no-tablespaces: Avoids "Access denied" error for tablespaces (requires PROCESS privilege)
  const command = `mysqldump -h ${host} -P ${port} -u ${username} --no-tablespaces ${database} | gzip`;

  const output = execSync(command, {
    shell: '/bin/bash',
    env: { ...process.env, MYSQL_PWD: password },
    maxBuffer: 1024 * 1024 * 200, // 200MB buffer for large databases
  });

  fs.writeFileSync(backupFile, output);

  // Get file size
  const stats = fs.statSync(backupFile);
  const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('✅ Backup completed successfully!');
  console.log(`📁 File: ${backupFile}`);
  console.log(`📊 Size: ${fileSizeInMB} MB`);
  console.log('');
  console.log('To restore this backup, run:');
  console.log(`gunzip -c ${backupFile} | mysql -h ${host} -P ${port} -u ${username} -p ${database}`);

  // Delete backups older than the retention window
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const removed: string[] = [];
  for (const name of fs.readdirSync(backupDir)) {
    if (!name.startsWith('backup-') || !name.endsWith('.sql.gz')) continue;
    const filePath = path.join(backupDir, name);
    const mtime = fs.statSync(filePath).mtimeMs;
    if (mtime < cutoff) {
      fs.unlinkSync(filePath);
      removed.push(name);
    }
  }
  if (removed.length > 0) {
    console.log(`🧹 Removed ${removed.length} backup(s) older than ${RETENTION_DAYS} days.`);
  }
} catch (error: any) {
  console.error('❌ Backup failed:', error.message);

  // Clean up partial backup file if it exists
  if (fs.existsSync(backupFile)) {
    fs.unlinkSync(backupFile);
  }

  process.exit(1);
}

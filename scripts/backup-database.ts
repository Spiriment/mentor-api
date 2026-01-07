import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../src/common';

const backupDir = path.join(process.cwd(), 'backups');

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`Created backup directory: ${backupDir}`);
}

// Generate backup filename with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

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
  // Build mysqldump command
  // Note: Using MYSQL_PWD environment variable to pass password securely
  // --no-tablespaces: Avoids "Access denied" error for tablespaces (requires PROCESS privilege)
  const command = `mysqldump -h ${host} -P ${port} -u ${username} --no-tablespaces ${database}`;

  // Execute mysqldump and save to file
  const output = execSync(command, {
    env: { ...process.env, MYSQL_PWD: password },
    maxBuffer: 1024 * 1024 * 100, // 100MB buffer for large databases
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
  console.log(`mysql -h ${host} -P ${port} -u ${username} -p ${database} < ${backupFile}`);
} catch (error: any) {
  console.error('❌ Backup failed:', error.message);

  // Clean up partial backup file if it exists
  if (fs.existsSync(backupFile)) {
    fs.unlinkSync(backupFile);
  }

  process.exit(1);
}

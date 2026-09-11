import fs from 'node:fs';
import path from 'node:path';

/**
 * Update keys in .env, preserving every other line and the file's comments.
 *
 * Written in place rather than appended: re-running a setup CLI should replace
 * the value it set last time, not leave two lines for the same key where the
 * later one silently wins.
 */
export function updateEnv(values: Record<string, string>): string {
  const envPath = path.join(process.cwd(), '.env');

  let contents = '';
  if (fs.existsSync(envPath)) {
    contents = fs.readFileSync(envPath, 'utf8');
  } else if (fs.existsSync('.env.example')) {
    contents = fs.readFileSync('.env.example', 'utf8');
  }

  const lines = contents.split('\n');

  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`);
    const index = lines.findIndex((l) => pattern.test(l));
    if (index >= 0) {
      lines[index] = line;
    } else {
      lines.push(line);
    }
  }

  fs.writeFileSync(envPath, lines.join('\n'), { mode: 0o600 });
  try {
    // .env holds API secrets; don't leave it world-readable.
    fs.chmodSync(envPath, 0o600);
  } catch {
    // Windows and some mounted filesystems don't support this; not fatal.
  }
  return envPath;
}

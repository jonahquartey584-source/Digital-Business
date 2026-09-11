import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import { stdin, stdout } from 'node:process';
import { hashPassword } from '../core/auth.js';

/**
 * Turns a password you type into the scrypt hash for ADMIN_PASSWORD_HASH.
 *
 * The password itself is never written anywhere -- not to .env, not to the
 * database, and not to your shell history, because it is read from the
 * terminal rather than taken as a command-line argument.
 *
 *   npm run set-password            print the hash to paste yourself
 *   npm run set-password -- --write save it into .env directly
 */

/** Passes prompts through to the terminal but swallows the echo of typing. */
function mutedOutput(): Writable & { muted: boolean } {
  const out = new Writable({
    write(chunk, _encoding, callback) {
      if (!out.muted) stdout.write(chunk);
      callback();
    },
  }) as Writable & { muted: boolean };
  out.muted = false;
  return out;
}

/**
 * Read the whole of a piped stdin and take the first two lines.
 *
 * readline is the wrong tool when input isn't a terminal: the stream hits EOF
 * and emits 'close' as soon as it's drained, which can happen before a second
 * question() is registered -- leaving that promise unsettled forever. Reading
 * the buffer directly is deterministic.
 */
async function readPipedLines(): Promise<{ first: string; second: string }> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(Buffer.from(chunk));
  const lines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
  return { first: (lines[0] ?? '').trim(), second: (lines[1] ?? '').trim() };
}

/**
 * Both interactive prompts share one readline interface, since a second one
 * over the same stdin would contend with the first.
 */
async function askPasswordTwice(): Promise<{ first: string; second: string }> {
  if (!stdin.isTTY) return readPipedLines();

  const output = mutedOutput();
  const rl = readline.createInterface({ input: stdin, output, terminal: true });

  const ask = async (question: string): Promise<string> => {
    output.muted = false;
    const pending = rl.question(question);
    output.muted = true;
    const answer = await pending;
    stdout.write('\n');
    return answer.trim();
  };

  try {
    const first = await ask('  New password: ');
    const second = await ask('  Confirm:      ');
    return { first, second };
  } finally {
    rl.close();
  }
}

const writeEnv = process.argv.includes('--write');
const envPath = path.join(process.cwd(), '.env');

/**
 * Replace any existing ADMIN_PASSWORD_HASH line in .env and preserve
 * everything else, so re-running this never clobbers your API tokens.
 */
function updateEnvFile(hash: string): void {
  const line = `ADMIN_PASSWORD_HASH=${hash}`;

  let contents = '';
  if (fs.existsSync(envPath)) {
    contents = fs.readFileSync(envPath, 'utf8');
  } else if (fs.existsSync('.env.example')) {
    contents = fs.readFileSync('.env.example', 'utf8');
  }

  const lines = contents.split('\n');
  const index = lines.findIndex((l) => /^\s*ADMIN_PASSWORD_HASH\s*=/.test(l));
  if (index >= 0) {
    lines[index] = line;
  } else {
    lines.push(line);
  }

  fs.writeFileSync(envPath, lines.join('\n'), { mode: 0o600 });
  try {
    // The hash isn't a password, but .env sits next to your API tokens.
    fs.chmodSync(envPath, 0o600);
  } catch {
    // Windows and some mounted filesystems don't support this; not fatal.
  }
}

const { first, second } = await askPasswordTwice();

if (first.length < 10) {
  console.error('\n  Use at least 10 characters — this is the only thing between');
  console.error('  the internet and your marketplace sessions.\n');
  process.exit(1);
}
if (first !== second) {
  console.error('\n  Those did not match.\n');
  process.exit(1);
}

const hash = hashPassword(first);

if (writeEnv) {
  updateEnvFile(hash);
  console.log(`\n  Saved to ${envPath}`);
  console.log('  Restart the app and sign in with that password.\n');
} else {
  console.log('\n  Add this line to your .env, replacing any existing one:\n');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('\n  (Or re-run with --write to have it saved for you.)\n');
}

console.log('  Changing the password does not sign out devices already signed in.');
console.log('  To force a fresh sign-in everywhere:');
console.log('    sqlite3 data/reseller.db "DELETE FROM sessions;"\n');

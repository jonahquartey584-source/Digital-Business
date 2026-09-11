import readline from 'node:readline';
import { Writable } from 'node:stream';
import { stdin, stdout } from 'node:process';
import { hashPassword } from '../core/auth.js';

/**
 * Turns a password you type into the scrypt hash for ADMIN_PASSWORD_HASH.
 *
 * The password itself is never written anywhere -- not to .env, not to the
 * database, and not to your shell history, because it is read from the
 * terminal rather than taken as a command-line argument.
 */

/** Passes the prompt through but swallows the echo of what's typed. */
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

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const output = mutedOutput();
    const rl = readline.createInterface({ input: stdin, output, terminal: true });

    rl.question(question, (answer) => {
      rl.close();
      stdout.write('\n');
      resolve(answer);
    });
    output.muted = true;
  });
}

const first = await askHidden('  New password: ');
if (first.length < 10) {
  console.error('\n  Use at least 10 characters — this is the only thing between');
  console.error('  the internet and your marketplace sessions.\n');
  process.exit(1);
}

const second = await askHidden('  Confirm:      ');
if (first !== second) {
  console.error('\n  Those did not match.\n');
  process.exit(1);
}

console.log('\n  Add this line to your .env, replacing any existing one:\n');
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(first)}`);
console.log('\n  Then restart the app.\n');
console.log('  Changing the password does not sign out existing devices.');
console.log('  To force everyone to sign in again, clear the sessions table:');
console.log('    sqlite3 data/reseller.db "DELETE FROM sessions;"\n');

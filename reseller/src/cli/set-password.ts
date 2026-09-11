import { hashPassword } from '../core/auth.js';
import { askSecret, closePrompts } from './prompt.js';
import { updateEnv } from './env-file.js';

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

const writeEnv = process.argv.includes('--write');

const first = await askSecret('  New password: ');
if (first.length < 10) {
  console.error('\n  Use at least 10 characters — this is the only thing between');
  console.error('  the internet and your marketplace sessions.\n');
  closePrompts();
  process.exit(1);
}

const second = await askSecret('  Confirm:      ');
if (first !== second) {
  console.error('\n  Those did not match.\n');
  closePrompts();
  process.exit(1);
}

const hash = hashPassword(first);

if (writeEnv) {
  const envPath = updateEnv({ ADMIN_PASSWORD_HASH: hash });
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

closePrompts();

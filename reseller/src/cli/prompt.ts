import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import { stdin, stdout } from 'node:process';

/**
 * Terminal prompts shared by the setup CLIs.
 *
 * One readline interface is created lazily and reused, because a second
 * interface over the same stdin contends with the first. When stdin is a pipe
 * we read the stream directly instead: readline hits EOF and emits 'close' as
 * soon as it drains, which can happen before a later question() registers and
 * leaves that promise unsettled forever.
 */

let piped: string[] | null = null;
let pipedIndex = 0;

async function nextPipedLine(): Promise<string> {
  if (piped === null) {
    const chunks: Buffer[] = [];
    for await (const chunk of stdin) chunks.push(Buffer.from(chunk));
    piped = Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
  }
  return (piped[pipedIndex++] ?? '').trim();
}

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

let rl: readline.Interface | null = null;
let output: (Writable & { muted: boolean }) | null = null;

function ensureInterface(): { rl: readline.Interface; output: Writable & { muted: boolean } } {
  if (!rl || !output) {
    output = mutedOutput();
    rl = readline.createInterface({ input: stdin, output, terminal: true });
  }
  return { rl, output };
}

/** Ask a question and echo what's typed. */
export async function ask(question: string, fallback = ''): Promise<string> {
  if (!stdin.isTTY) {
    const line = await nextPipedLine();
    return line || fallback;
  }
  const { rl: iface } = ensureInterface();
  const answer = (await iface.question(question)).trim();
  return answer || fallback;
}

/** Ask a question without echoing what's typed. */
export async function askSecret(question: string): Promise<string> {
  if (!stdin.isTTY) return nextPipedLine();

  const { rl: iface, output: out } = ensureInterface();
  out.muted = false;
  const pending = iface.question(question);
  out.muted = true;
  const answer = await pending;
  stdout.write('\n');
  return answer.trim();
}

/** Yes/no question. Empty answer takes `fallback`. */
export async function confirm(question: string, fallback = true): Promise<boolean> {
  const hint = fallback ? '[Y/n]' : '[y/N]';
  const answer = (await ask(`${question} ${hint} `)).toLowerCase();
  if (!answer) return fallback;
  return answer.startsWith('y');
}

/** Numbered menu. Returns the chosen item. */
export async function choose<T>(
  label: string,
  items: T[],
  render: (item: T) => string,
): Promise<T> {
  if (items.length === 1) {
    const only = items[0]!;
    console.log(`  ${label}: ${render(only)}`);
    return only;
  }

  console.log(`\n  ${label}:`);
  items.forEach((item, index) => console.log(`    ${index + 1}) ${render(item)}`));

  for (;;) {
    const raw = await ask(`  Pick 1-${items.length} [1]: `, '1');
    const index = Number(raw) - 1;
    if (Number.isInteger(index) && index >= 0 && index < items.length) return items[index]!;
    console.log('  Not one of the options.');
  }
}

export function closePrompts(): void {
  rl?.close();
  rl = null;
  output = null;
}

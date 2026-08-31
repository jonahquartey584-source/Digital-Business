// Minimal RFC4180-ish CSV parser — good enough for a straightforward
// contacts/leads export (quoted fields, escaped "" quotes, commas inside
// quotes). No external dependency for something this small.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Normalize line endings so \r\n and \r don't produce phantom blank rows.
  const input = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Final field/row (files don't always end with a trailing newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/**
 * Maps parsed CSV rows to lead records using the header row to find
 * first_name/last_name/email/phone columns by name (case-insensitive,
 * spaces/underscores ignored) rather than assuming a fixed column order.
 */
export function csvRowsToLeads(
  rows: string[][]
): { ok: Array<{ first_name: string; last_name: string | null; email: string | null; phone: string | null }>; errorCount: number } {
  if (rows.length === 0) return { ok: [], errorCount: 0 };

  const normalize = (s: string) => s.trim().toLowerCase().replace(/[\s_-]/g, "");
  const header = rows[0].map(normalize);

  const findCol = (...names: string[]) => {
    for (const name of names) {
      const idx = header.indexOf(name);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const firstNameIdx = findCol("firstname", "first", "name");
  const lastNameIdx = findCol("lastname", "last", "surname");
  const emailIdx = findCol("email", "emailaddress");
  const phoneIdx = findCol("phone", "phonenumber", "mobile", "tel");

  const ok: Array<{ first_name: string; last_name: string | null; email: string | null; phone: string | null }> = [];
  let errorCount = 0;

  for (const row of rows.slice(1)) {
    const firstName = firstNameIdx !== -1 ? row[firstNameIdx]?.trim() : "";
    if (!firstName) {
      errorCount++;
      continue;
    }
    ok.push({
      first_name: firstName,
      last_name: lastNameIdx !== -1 ? row[lastNameIdx]?.trim() || null : null,
      email: emailIdx !== -1 ? row[emailIdx]?.trim() || null : null,
      phone: phoneIdx !== -1 ? row[phoneIdx]?.trim() || null : null,
    });
  }

  return { ok, errorCount };
}

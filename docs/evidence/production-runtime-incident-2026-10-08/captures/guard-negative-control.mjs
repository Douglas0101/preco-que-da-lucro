// Negative control: reproduces the exact predicate at src/db/client.server.ts:64
// against candidate DATABASE_URL shapes. Read-only; no network, no credential.
const line64 = (connectionString) => {
  return !!connectionString; // true = passes the guard
};
const cases = [
  ["undefined (absent)", undefined, "absent"],
  ["empty string", "", "absent"],
  ["whitespace-only", "   ", "present"],
  ["literal 'undefined'", "undefined", "present"],
  ["literal 'null'", "null", "present"],
  ["valid-looking uri", "postgres://u:p@localhost:5432/db?sslmode=require", "present"],
  ["uri missing scheme", "localhost:5432/db", "present"],
];
for (const [label, value, truthy] of cases) {
  const passesGuard = !!value;
  const expectedPass = truthy === "present";
  console.log(
    [
      label.padEnd(24),
      "truthy=" + String(truthy).padEnd(8),
      "passesGuard(line64)=" + String(passesGuard).padEnd(6),
      passesGuard === expectedPass ? "AS-EXPECTED" : "MISMATCH",
    ].join(" | "),
  );
}

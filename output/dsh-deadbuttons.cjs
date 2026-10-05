/* Cross-check: DOM ids that exist in index.html but are never touched by the
   scripts, and ids the scripts ask for that do not exist. */
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const js = ["game.js", "flight-world.js", "boot.js", "preview.cjs", "server.mjs"]
  .map((f) => fs.readFileSync(f, "utf8")).join("\n");

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const jsIds = new Set([
  ...[...js.matchAll(/\$\("([^"]+)"\)/g)].map((m) => m[1]),
  ...[...js.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]),
  ...[...js.matchAll(/querySelector(?:All)?\("#([^" ,)]+)/g)].map((m) => m[1]),
]);

const neverTouched = [...htmlIds].filter((id) => !jsIds.has(id));
const missing = [...jsIds].filter((id) => !htmlIds.has(id));

// Interactive elements with no listener anywhere: look for the id near addEventListener.
const buttons = [...html.matchAll(/<button\b[^>]*?id="([^"]+)"[^>]*>/gs)].map((m) => m[1]);
const dead = buttons.filter((id) => {
  const re = new RegExp(`\\$\\("${id}"\\)\\s*\\.addEventListener`);
  return !re.test(js);
});

console.log("HTML ids never referenced by JS:\n  " + neverTouched.join("\n  "));
console.log("\nJS asks for ids that HTML does not have:\n  " + (missing.join("\n  ") || "(none)"));
console.log("\n<button id=...> with no addEventListener in any script:\n  " + (dead.join("\n  ") || "(none)"));

const controls = [...html.matchAll(/data-control="([^"]+)"/g)].map((m) => m[1]);
console.log("\ndata-control buttons in HTML:", controls.length ? controls.join(",") : "(none)");

// Stamps every script/style link with ?v=<timestamp> so browsers load the newest files after a publish.
// Run before each publish: node tools/bump-version.mjs
import fs from "node:fs";
const v = new Date().toISOString().replace(/\D/g, "").slice(0, 12);
const fix = (s) => s
  .replace(/(from\s+"\.\/[\w-]+\.js)(\?v=\d+)?"/g, `$1?v=${v}"`)
  .replace(/(src="assets\/js\/[\w-]+\.js)(\?v=\d+)?"/g, `$1?v=${v}"`)
  .replace(/(href="assets\/css\/[\w-]+\.css)(\?v=\d+)?"/g, `$1?v=${v}"`);
for (const f of ["index.html", ...fs.readdirSync("assets/js").filter((x) => x.endsWith(".js")).map((x) => "assets/js/" + x)]) {
  const s = fs.readFileSync(f, "utf8"), t = fix(s);
  if (s !== t) fs.writeFileSync(f, t);
}
console.log("version", v);

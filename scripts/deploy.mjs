// Publica el build (dist/) en la rama gh-pages del mismo repo → GitHub Pages.
// Uso: npm run deploy
import { execSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

const run = (cmd, opts = {}) => execSync(cmd, { stdio: "inherit", ...opts });
const remote = execSync("git remote get-url origin").toString().trim();
const sha = execSync("git rev-parse --short HEAD").toString().trim();

run("npm test -- --run");
run("npm run build");
writeFileSync("dist/.nojekyll", "");
rmSync("dist/.git", { recursive: true, force: true });
run("git init -q -b gh-pages", { cwd: "dist" });
run("git add -A", { cwd: "dist" });
run(`git commit -q -m "deploy ${sha}"`, { cwd: "dist" });
run(`git push -q -f ${remote} gh-pages`, { cwd: "dist" });
rmSync("dist/.git", { recursive: true, force: true });
console.log(`\n✓ Publicado ${sha} en gh-pages`);

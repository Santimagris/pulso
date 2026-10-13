import { ArrowUpRight, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { checkRepo, explainError, type Connection } from "@/sync/github";
import { useApp } from "@/sync/store";
import { TextInput, Field } from "@/ui/form";
import { GitHubMark, Logo } from "@/ui/Logo";
import { Button, Card } from "@/ui/primitives";

export const DEFAULT_OWNER = "Santimagris";
export const DEFAULT_REPO = "pulso-data";

/** Link que abre el formulario de token de GitHub ya completado (falta elegir el repo). */
export function tokenUrl(owner: string) {
  const p = new URLSearchParams({
    name: "Pulso",
    description: "Pulso: leer y guardar data.json en el repo de datos",
    target_name: owner,
    expires_in: "none",
    contents: "write",
  });
  return `https://github.com/settings/personal-access-tokens/new?${p.toString()}`;
}

export function Setup() {
  const connect = useApp((s) => s.connect);
  const [repoFull, setRepoFull] = useState(`${DEFAULT_OWNER}/${DEFAULT_REPO}`);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [owner, repo] = repoFull.trim().split("/");

  async function onConnect() {
    setError(null);
    if (!owner || !repo) return setError("Escribí el repo como usuario/nombre.");
    if (token.trim().length < 20) return setError("Pegá el token completo (empieza con github_pat_).");
    const conn: Connection = { owner, repo, path: "data.json", branch: "main", token: token.trim() };
    setBusy(true);
    try {
      const info = await checkRepo(conn);
      if (!info.private) {
        setBusy(false);
        return setError("Ese repo es público: cualquiera vería tus datos. Usá un repo privado.");
      }
      await connect({ ...conn, branch: info.defaultBranch });
    } catch (e) {
      setError(explainError(e));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col justify-center px-5 py-10">
      <div className="animate-rise">
        <Logo className="size-14" />
        <h1 className="mt-6 text-[34px] leading-[1.05] font-semibold tracking-[-0.035em]">
          Tu plata,
          <br />
          <span className="text-brand">semana a semana.</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Pulso guarda tus datos en un repo <span className="text-ink-2">privado</span> de tu GitHub: cada cambio queda como
          un commit, con historial y backup. No se pausa nunca y nadie más los ve.
        </p>
      </div>

      <Card className="mt-8 animate-rise p-5 [animation-delay:80ms]">
        <ol className="grid gap-5">
          <li className="flex gap-3.5">
            <StepNum n={1} />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-ink">Creá un token para Pulso</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                El link abre GitHub con todo completo. Solo elegí <b className="text-ink-2">Only select repositories</b> →{" "}
                <b className="text-ink-2">{repo || DEFAULT_REPO}</b>, generalo y copialo.
              </p>
              <a href={tokenUrl(owner || DEFAULT_OWNER)} target="_blank" rel="noreferrer" className="mt-3 inline-flex">
                <Button size="sm" variant="secondary" icon={<GitHubMark className="size-4" />}>
                  Abrir GitHub <ArrowUpRight className="size-3.5 text-muted" />
                </Button>
              </a>
            </div>
          </li>
          <li className="flex gap-3.5">
            <StepNum n={2} />
            <div className="grid min-w-0 flex-1 gap-3">
              <div className="font-medium text-ink">Pegalo acá</div>
              <Field label="Repo de datos" htmlFor="repo">
                <TextInput id="repo" value={repoFull} onChange={(e) => setRepoFull(e.target.value)} spellCheck={false} autoCapitalize="off" />
              </Field>
              <Field label="Token" htmlFor="token" error={error}>
                <TextInput
                  id="token"
                  type="password"
                  placeholder="github_pat_…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void onConnect()}
                  spellCheck={false}
                  autoCapitalize="off"
                />
              </Field>
              <Button variant="primary" size="lg" block loading={busy} onClick={() => void onConnect()} icon={<KeyRound className="size-4" />}>
                Conectar
              </Button>
            </div>
          </li>
        </ol>
      </Card>

      <div className="mt-5 grid gap-2 px-1 text-[13px] text-faint">
        <p className="flex items-start gap-2">
          <Lock className="mt-0.5 size-3.5 shrink-0" /> El token queda guardado solo en este dispositivo. En el celu lo pegás una vez.
        </p>
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> Solo tiene acceso a ese repo. Lo podés revocar cuando quieras desde GitHub.
        </p>
      </div>
    </div>
  );
}

function StepNum({ n }: { n: number }) {
  return (
    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/12 text-[13px] font-semibold text-brand">{n}</div>
  );
}

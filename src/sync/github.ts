import { normalizeData } from "@/domain/defaults";
import type { Data } from "@/domain/types";

/**
 * "Base de datos" = un archivo JSON en un repo privado de GitHub, vía la API de contenidos.
 * Cada guardado es un commit: historial completo y backup gratis, nunca se pausa.
 * El token (fine-grained, solo ese repo, Contents: read & write) vive en el dispositivo.
 */

export interface Connection {
  owner: string;
  repo: string;
  path: string;
  branch: string;
  token: string;
}

export class GitHubError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const API = "https://api.github.com";

function headers(conn: Connection): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${conn.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

const contentsUrl = (c: Connection) =>
  `${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${c.path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function fromBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function fail(res: Response): Promise<never> {
  let msg = res.statusText;
  try {
    const body = (await res.json()) as { message?: string };
    if (body?.message) msg = body.message;
  } catch {
    /* sin cuerpo */
  }
  throw new GitHubError(res.status, msg);
}

export function explainError(e: unknown): string {
  if (e instanceof GitHubError) {
    if (e.status === 401) return "El token no es válido o venció. Cargá uno nuevo en Ajustes.";
    if (e.status === 403) return "El token no tiene permiso de escritura (Contents: Read and write).";
    if (e.status === 404) return "No encuentro el repo. Revisá el nombre y que el token tenga acceso a ese repo.";
    if (e.status === 409 || e.status === 422) return "Hubo un cambio desde otro dispositivo. Reintentando…";
    return `GitHub respondió ${e.status}: ${e.message}`;
  }
  if (e instanceof TypeError) return "Sin conexión. Los cambios quedan guardados en este dispositivo y se suben solos.";
  return e instanceof Error ? e.message : String(e);
}

/** Verifica que el token puede leer el repo. */
export async function checkRepo(conn: Connection): Promise<{ private: boolean; defaultBranch: string }> {
  const res = await fetch(`${API}/repos/${encodeURIComponent(conn.owner)}/${encodeURIComponent(conn.repo)}`, {
    headers: headers(conn),
    cache: "no-store",
  });
  if (!res.ok) await fail(res);
  const body = (await res.json()) as { private: boolean; default_branch: string };
  return { private: body.private, defaultBranch: body.default_branch };
}

/** Lee el documento. `null` si el archivo todavía no existe. */
export async function readData(conn: Connection): Promise<{ data: Data; sha: string } | null> {
  const res = await fetch(`${contentsUrl(conn)}?ref=${encodeURIComponent(conn.branch)}`, {
    headers: headers(conn),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) await fail(res);
  const body = (await res.json()) as { sha: string; content?: string; encoding?: string; download_url?: string };
  let text: string;
  if (body.content && body.encoding === "base64") {
    text = fromBase64Utf8(body.content);
  } else {
    // Archivos de más de 1 MB: pedir el contenido crudo.
    const raw = await fetch(`${contentsUrl(conn)}?ref=${encodeURIComponent(conn.branch)}`, {
      headers: { ...headers(conn), Accept: "application/vnd.github.raw+json" },
      cache: "no-store",
    });
    if (!raw.ok) await fail(raw);
    text = await raw.text();
  }
  return { data: normalizeData(JSON.parse(text)), sha: body.sha };
}

/** Escribe el documento (un commit). Devuelve el sha nuevo. Falla con 409/422 si `sha` quedó viejo. */
export async function writeData(conn: Connection, data: Data, sha: string | null, message: string): Promise<string> {
  const res = await fetch(contentsUrl(conn), {
    method: "PUT",
    headers: { ...headers(conn), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: toBase64Utf8(`${JSON.stringify(data, null, 2)}\n`),
      branch: conn.branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) await fail(res);
  const body = (await res.json()) as { content: { sha: string } };
  return body.content.sha;
}

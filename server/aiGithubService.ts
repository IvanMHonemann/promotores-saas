import type { AiAttachment } from "../shared/aiAttachments";

const GITHUB_API = "https://api.github.com";
const OWNER = process.env.GITHUB_REPO_OWNER || "IvanMHonemann";
const REPO = process.env.GITHUB_REPO_NAME || "promotores-saas";
const BRANCH = process.env.GITHUB_REPO_BRANCH || "main";
const REPO_LABEL = `${OWNER}/${REPO}`;

/** Arquivos sempre disponíveis para a IA (configuração geral do site). */
const baseFiles = [
  "client/src/App.tsx",
  "client/src/index.css",
];
/** Fora do código da aplicação, só estes arquivos podem ser alterados. */
const extraEditableFiles = ["package.json", "vercel.json", "client/src/components/AIChatBox.tsx"];
const MAX_SELECTED_FILES = 6;
const MAX_FILE_CHARS = 150_000;
const MAX_CONTEXT_CHARS = 600_000;

type GithubRef = { object: { sha: string } };
type GithubCommit = { tree: { sha: string } };
type GithubFile = { sha: string; content: string; encoding: string };
type GithubTree = { tree: Array<{ path: string; type: string; size?: number }>; truncated?: boolean };
type GeminiChange = { path: string; content: string; reason?: string };
type ChatMessage = { role: "user" | "assistant"; content: string };

/** Erro do GitHub já explicado em português simples para quem usa o chat. */
export class GithubSetupError extends Error {}

export function explainGithubError(status: number, message: string) {
  const msg = (message || "").toLowerCase();
  if (status === 401) return `O GitHub recusou a chave de acesso (GITHUB_TOKEN inválido, apagado ou vencido). Gere um novo token no GitHub e atualize a variável GITHUB_TOKEN na Vercel.`;
  if (status === 403 && msg.includes("rate limit")) return `O GitHub limitou as consultas sem chave de acesso. Configure a variável GITHUB_TOKEN na Vercel ou tente de novo em 1 hora.`;
  if (status === 403) return `A chave do GitHub (GITHUB_TOKEN) não tem permissão suficiente. Ela precisa de acesso ao repositório ${REPO_LABEL} com "Contents: Read and write" e "Pull requests: Read and write".`;
  if (status === 404) return `O GitHub não encontrou o repositório ${REPO_LABEL} com essa chave. Confira se o token dá acesso a esse repositório (em "Repository access").`;
  if (status === 422) return `O GitHub não aceitou a alteração (${message || "dados inválidos"}).`;
  return `O GitHub respondeu com erro ${status}: ${message || "erro desconhecido"}.`;
}

export function hasGithubToken() {
  return Boolean(process.env.GITHUB_TOKEN);
}

async function github(path: string, init: RequestInit = {}, { requireToken = true } = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token && requireToken) {
    throw new GithubSetupError(`A IA ainda não está conectada ao GitHub: falta a variável GITHUB_TOKEN na Vercel. Sem ela eu consigo conversar e analisar, mas não consigo abrir a correção (Pull Request) no repositório ${REPO_LABEL}.`);
  }
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await response.text();
  let parsed: any = null;
  try { parsed = JSON.parse(body); } catch { parsed = { message: body.slice(0, 500) }; }
  if (!response.ok) throw new GithubSetupError(explainGithubError(response.status, parsed?.message || ""));
  return parsed;
}

export function buildAiBranchName(now: Date = new Date()) {
  const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `ai/suporte-${stamp}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Caminhos do repositório que a IA pode ler e propor alterações (nunca segredos, testes ou o núcleo de autenticação). */
export function isAiEditablePath(path: string) {
  if (extraEditableFiles.includes(path)) return true;
  if (!/^(client\/src|server|shared)\//.test(path)) return false;
  if (!/\.(tsx?|css)$/.test(path)) return false;
  if (/\.test\.tsx?$/.test(path)) return false;
  if (/^server\/_core\//.test(path)) return false;
  if (/(^|\/)\.env/i.test(path) || /secret|credential/i.test(path)) return false;
  if (/\/_archived\//.test(path)) return false;
  return true;
}

/** Pedido de alteração (vai abrir um Pull Request). */
export function asksForChange(prompt: string) {
  if (/\bn[ãa]o\s+(altere|mude|modifique|mexa|aplique|fa[çc]a\s+altera)/i.test(prompt)) return false;
  return /\b(altere|alterar|mude|mudar|modifique|modificar|adicione|adicionar|remova|remover|crie|criar|corrija|corrigir|conserte|consertar|arrume|arrumar|implemente|implementar|troque|trocar|aplique|aplicar|fa[çc]a|fazer|coloque|colocar|insira|inserir|inclua|incluir|disponibilize|disponibilizar|reative|reativar|restaure|restaurar|atualize|atualizar)\b/i.test(prompt);
}

/** Pedido que precisa olhar o código (análise ou alteração). */
export function needsCode(prompt: string, hasAttachments: boolean) {
  return hasAttachments || asksForChange(prompt) || /\b(erros?|bugs?|c[oó]digo|varredura|escane|scan|analis|revis|layout|design|tela|p[aá]gina|arquivo|obsolet|quebrad|funcion)/i.test(prompt);
}

async function readFile(path: string, ref: string) {
  const file = await github(`/repos/${OWNER}/${REPO}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`, {}, { requireToken: false }) as GithubFile;
  return { path, sha: file.sha, content: Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8") };
}

async function listRepoFiles(commitSha: string) {
  const commit = await github(`/repos/${OWNER}/${REPO}/git/commits/${commitSha}`, {}, { requireToken: false }) as GithubCommit;
  const tree = await github(`/repos/${OWNER}/${REPO}/git/trees/${commit.tree.sha}?recursive=1`, {}, { requireToken: false }) as GithubTree;
  return tree.tree.filter((item) => item.type === "blob" && isAiEditablePath(item.path) && (item.size ?? 0) <= MAX_FILE_CHARS).map((item) => item.path);
}

function geminiKey() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não está configurada na Vercel.");
  return apiKey;
}

let cachedModels: { at: number; models: string[] } | null = null;
async function geminiModels(apiKey: string) {
  if (cachedModels && Date.now() - cachedModels.at < 10 * 60_000) return cachedModels.models;
  const modelListResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
  const modelList = modelListResponse.ok ? await modelListResponse.json() as any : null;
  const preferredModels = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
  const availableModels = (modelList?.models || [])
    .filter((model: any) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model: any) => String(model.name || "").replace(/^models\//, ""));
  const models = preferredModels.filter((model) => availableModels.length === 0 || availableModels.includes(model));
  const result = models.length ? models : ["gemini-3.8-flash"];
  cachedModels = { at: Date.now(), models: result };
  return result;
}

async function callGemini(requestBody: unknown): Promise<string> {
  const apiKey = geminiKey();
  let response: Response | null = null;
  let body: any = null;
  let lastError = "resposta inválida";
  for (const model of await geminiModels(apiKey)) {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    body = await response.json() as any;
    if (response.ok) break;
    lastError = `${model}: ${body.error?.message || `HTTP ${response.status}`}`;
  }
  if (!response?.ok) throw new Error(`Gemini indisponível: ${lastError}`);
  return body.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
}

/** Partes da mensagem do usuário: texto + anexos (fotos e PDFs como imagem/arquivo para o modelo, textos como texto). */
export function buildUserParts(prompt: string, attachments: AiAttachment[] = []) {
  const parts: any[] = [{ text: prompt }];
  for (const file of attachments) {
    if (file.kind === "text") parts.push({ text: `\n--- Arquivo anexado pelo usuário: ${file.name} ---\n${file.data}` });
    else parts.push({ text: `\n(Anexo: ${file.name})` }, { inlineData: { mimeType: file.kind === "pdf" ? "application/pdf" : file.mimeType, data: file.data } });
  }
  return parts;
}

function historyText(history: ChatMessage[]) {
  return history.slice(-12).map((message) => `${message.role === "user" ? "Usuário" : "Assistente"}: ${message.content}`).join("\n");
}

/** 1ª etapa: a IA escolhe quais arquivos do repositório precisa ler para atender o pedido. */
async function pickFiles(prompt: string, attachments: AiAttachment[], history: ChatMessage[], repoFiles: string[]) {
  const system = `Você ajuda a escolher arquivos de código do sistema GondUp (React + tRPC). Com base no pedido do usuário, no histórico e nos anexos (prints de tela, arquivos), escolha no máximo ${MAX_SELECTED_FILES} arquivos da lista que precisam ser lidos para entender ou corrigir o problema. Prefira as páginas em client/src/pages e componentes citados. Responda só JSON {"paths":["..."]}.\n\nHistórico:\n${historyText(history) || "(primeira mensagem)"}\n\nArquivos disponíveis:\n${repoFiles.join("\n")}`;
  const text = await callGemini({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: buildUserParts(prompt, attachments) }],
    generationConfig: { temperature: 0, maxOutputTokens: 1024, responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { paths: { type: "ARRAY", items: { type: "STRING" } } }, required: ["paths"] } },
  });
  try {
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
    const set = new Set(repoFiles);
    return (Array.isArray(parsed.paths) ? parsed.paths : []).filter((p: unknown): p is string => typeof p === "string" && set.has(p)).slice(0, MAX_SELECTED_FILES);
  } catch { return []; }
}

async function askGemini(prompt: string, files: Array<{ path: string; content: string }>, history: ChatMessage[], attachments: AiAttachment[], canOpenPr: boolean, codeNote: string) {
  const editable = files.map((file) => file.path);
  const context = files.length ? files.map((file) => `\n--- ${file.path} ---\n${file.content}`).join("\n") : `(${codeNote || "nenhum arquivo precisa ser consultado para esta conversa"})`;
  const changeRules = canOpenPr && editable.length
    ? `Você pode propor alterações SOMENTE nestes arquivos (os que foram carregados abaixo): ${editable.join(", ")}.\nSó inclua changes quando o usuário pedir explicitamente uma alteração. Quando for solicitada uma alteração, devolva o arquivo COMPLETO em changes, nunca um diff e nunca conteúdo parcial. No máximo 4 arquivos por vez. Não invente arquivos nem diga que publicou algo: o servidor abrirá um Pull Request para revisão humana; nada é publicado sem o merge de uma pessoa. Preserve o funcionamento existente, não remova recursos sem pedido explícito e mantenha o layout funcionando no celular (telas de 360 px).`
    : `Nesta conversa você NÃO pode alterar arquivos: retorne changes vazio. Se o usuário pedir uma alteração, explique o que mudaria e em quais arquivos.`;
  const system = `Você é o assistente de IA e engenheiro de software do GondUp. Converse naturalmente e responda em português brasileiro, sempre levando em conta exatamente o que o usuário escreveu, os anexos (prints de tela, fotos, PDFs e arquivos) e o histórico fornecido. Quando houver print de tela, descreva o que vê e relacione com o código. Você deve responder perguntas, explicar conceitos, procurar bugs, sugerir melhorias de layout e ajudar a atualizar código obsoleto.\n\n${changeRules}\n\nRetorne SOMENTE JSON válido no formato:\n{"reply":"resposta objetiva","changes":[{"path":"arquivo permitido","content":"conteúdo completo","reason":"motivo"}]}\n\nHistórico recente da conversa:\n${historyText(history) || "(primeira mensagem)"}\n\nCódigo atual:${context}`;
  const responseSchema = {
    type: "OBJECT",
    properties: {
      reply: { type: "STRING" },
      changes: { type: "ARRAY", items: { type: "OBJECT", properties: { path: { type: "STRING" }, content: { type: "STRING" }, reason: { type: "STRING" } }, required: ["path", "content"] } },
    },
    required: ["reply", "changes"],
  };
  const text = await callGemini({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: buildUserParts(prompt, attachments) }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 32768, responseMimeType: "application/json", responseSchema },
  });
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(cleaned) as { reply: string; changes: GeminiChange[] }; }
  catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)) as { reply: string; changes: GeminiChange[] }; } catch { /* tenta a resposta de fallback abaixo */ }
    }
    if (cleaned) return {
      reply: /^an error\b/i.test(cleaned)
        ? "O Gemini respondeu com uma mensagem de indisponibilidade temporária. Tente enviar novamente em alguns segundos."
        : cleaned,
      changes: [],
    };
    return { reply: "Não consegui interpretar a resposta do Gemini. Tente enviar a mensagem novamente.", changes: [] };
  }
}

/** Carrega o código relevante. Sem GITHUB_TOKEN ainda lê (repositório público), mas não abre PR. */
async function loadCode(prompt: string, attachments: AiAttachment[], history: ChatMessage[]) {
  const ref = await github(`/repos/${OWNER}/${REPO}/git/ref/heads/${encodeURIComponent(BRANCH)}`, {}, { requireToken: false }) as GithubRef;
  const repoFiles = await listRepoFiles(ref.object.sha);
  const picked = await pickFiles(prompt, attachments, history, repoFiles).catch(() => [] as string[]);
  const paths = Array.from(new Set([...picked, ...baseFiles])).filter((p) => repoFiles.includes(p) || extraEditableFiles.includes(p));
  const files: Array<{ path: string; content: string }> = [];
  let total = 0;
  for (const file of await Promise.all(paths.map((path) => readFile(path, ref.object.sha).catch(() => null)))) {
    if (!file || file.content.length > MAX_FILE_CHARS || total + file.content.length > MAX_CONTEXT_CHARS) continue;
    total += file.content.length;
    files.push({ path: file.path, content: file.content });
  }
  return { baseSha: ref.object.sha, files };
}

export async function runPersistentGemini(prompt: string, history: ChatMessage[] = [], attachments: AiAttachment[] = []) {
  const wantsChange = asksForChange(prompt);
  const canOpenPr = hasGithubToken();
  let code: { baseSha: string; files: Array<{ path: string; content: string }> } | null = null;
  let codeNote = "";
  let setupNotice = "";
  if (needsCode(prompt, attachments.length > 0)) {
    try { code = await loadCode(prompt, attachments, history); }
    catch (error) {
      if (!(error instanceof GithubSetupError)) throw error;
      codeNote = "não foi possível ler o código no GitHub agora";
      setupNotice = error.message;
    }
  }
  if (wantsChange && !canOpenPr && !setupNotice) {
    setupNotice = `Para eu abrir a correção como Pull Request, falta conectar o GitHub: configure a variável GITHUB_TOKEN na Vercel (token com acesso ao repositório ${REPO_LABEL}, "Contents" e "Pull requests" com leitura e escrita).`;
  }
  const result = await askGemini(prompt, code?.files ?? [], history, attachments, canOpenPr && Boolean(code), codeNote);
  const allowed = new Set((code?.files ?? []).map((file) => file.path));
  const changes = wantsChange ? (result.changes || []).filter((change) => allowed.has(change.path) && isAiEditablePath(change.path) && typeof change.content === "string") : [];
  const withNotice = (text: string) => (setupNotice ? `${text}\n\n⚠️ ${setupNotice}` : text);
  if (!changes.length || !code || !canOpenPr) return { reply: withNotice(result.reply || "Estou aqui para responder sua mensagem. O que você gostaria de saber?"), changed: false as const };
  if (changes.length > 4) return { reply: `${result.reply}\n\n⚠️ A solicitação gerou arquivos demais para uma única alteração segura. Peça uma parte de cada vez.`, changed: false as const };
  for (const change of changes) {
    if (change.content.length > 300_000) return { reply: `${result.reply}\n\n⚠️ O arquivo ${change.path} ficou grande demais para uma alteração segura.`, changed: false as const };
  }

  try {
    const baseCommitSha = code.baseSha;
    const baseCommit = await github(`/repos/${OWNER}/${REPO}/git/commits/${baseCommitSha}`) as GithubCommit;
    const treeEntries = [];
    for (const change of changes) {
      const blob = await github(`/repos/${OWNER}/${REPO}/git/blobs`, { method: "POST", body: JSON.stringify({ content: change.content, encoding: "utf-8" }) });
      treeEntries.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const tree = await github(`/repos/${OWNER}/${REPO}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }) });
    const summary = prompt.slice(0, 72).replace(/\n/g, " ").trim();
    const commit = await github(`/repos/${OWNER}/${REPO}/git/commits`, { method: "POST", body: JSON.stringify({ message: `feat(ai): ${summary}`, tree: tree.sha, parents: [baseCommitSha] }) });
    // NUNCA grava na branch principal: cria uma branch própria e abre um Pull Request para revisão e merge humano.
    const aiBranch = buildAiBranchName();
    if (aiBranch === BRANCH) throw new Error("Nome de branch inválido para a alteração da IA.");
    await github(`/repos/${OWNER}/${REPO}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${aiBranch}`, sha: commit.sha }) });
    const pr = await github(`/repos/${OWNER}/${REPO}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: `feat(ai): ${summary}`,
        head: aiBranch,
        base: BRANCH,
        body: `Alteração proposta pelo assistente de IA (suporte inteligente).\n\n**Pedido:** ${prompt.slice(0, 1000)}${attachments.length ? `\n\n**Anexos:** ${attachments.map((a) => a.name).join(", ")}` : ""}\n\n**Arquivos alterados:**\n${changes.map((change) => `- \`${change.path}\`${change.reason ? `: ${change.reason}` : ""}`).join("\n")}\n\n⚠️ Revise o código antes do merge. Nada é publicado até que uma pessoa faça o merge deste PR.`,
      }),
    });
    return {
      reply: `${result.reply || "Alteração preparada."}\n\nAbri um Pull Request para revisão: ${pr.html_url}. Nada foi publicado ainda; uma pessoa precisa revisar e fazer o merge.`,
      changed: true as const,
      commitSha: commit.sha,
      commitUrl: `https://github.com/${OWNER}/${REPO}/commit/${commit.sha}`,
      pullRequestUrl: pr.html_url as string,
      branch: aiBranch,
      files: changes.map((change) => change.path),
    };
  } catch (error) {
    if (error instanceof GithubSetupError) return { reply: `${result.reply}\n\n⚠️ Não consegui abrir o Pull Request: ${error.message}`, changed: false as const };
    throw error;
  }
}

const GITHUB_API = "https://api.github.com";
const OWNER = process.env.GITHUB_REPO_OWNER || "IvanMHonemann";
const REPO = process.env.GITHUB_REPO_NAME || "promotores-saas";
const BRANCH = process.env.GITHUB_REPO_BRANCH || "main";

const editableFiles = [
  "client/src/pages/platform/PlatformDashboard.tsx",
  "client/src/App.tsx",
  "client/src/index.css",
  "client/src/components/AIChatBox.tsx",
  "package.json",
  "vercel.json",
];

type GithubRef = { object: { sha: string } };
type GithubCommit = { tree: { sha: string } };
type GithubFile = { sha: string; content: string; encoding: string };
type GeminiChange = { path: string; content: string; reason?: string };
type ChatMessage = { role: "user" | "assistant"; content: string };

async function github(path: string, init: RequestInit = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN não está configurado na Vercel.");
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await response.text();
  let parsed: any = null;
  try { parsed = JSON.parse(body); } catch { parsed = { message: body.slice(0, 500) }; }
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${parsed.message || "erro desconhecido"}`);
  return parsed;
}

async function readFile(path: string, ref: string) {
  const file = await github(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`) as GithubFile;
  return { path, sha: file.sha, content: Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8") };
}

async function askGemini(prompt: string, files: Array<{ path: string; content: string }>, history: ChatMessage[] = []) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não está configurada na Vercel.");
  const context = files.map((file) => `\n--- ${file.path} ---\n${file.content}`).join("\n");
  const conversation = history.slice(-12).map((message) => `${message.role === "user" ? "Usuário" : "Assistente"}: ${message.content}`).join("\n");
  const system = `Você é o assistente de IA e engenheiro de software do Promotores SaaS. Converse naturalmente e responda em português brasileiro, sempre levando em conta exatamente o que o usuário escreveu e o histórico fornecido. Você deve responder perguntas, explicar conceitos, sugerir ideias e ajudar o usuário mesmo quando ele não pedir nenhuma alteração no código.\n\nVocê pode alterar SOMENTE estes arquivos: ${editableFiles.join(", ")}.\nSe o usuário estiver apenas conversando ou fazendo uma pergunta, retorne changes vazio e responda diretamente, sem dizer que alguma alteração foi feita. Só inclua changes quando o usuário pedir explicitamente uma alteração no site ou no código. Quando for solicitada uma alteração, devolva o arquivo COMPLETO em changes, nunca um diff e nunca conteúdo parcial. Não invente arquivos nem diga que publicou algo: o servidor criará um commit real depois de validar sua resposta. Preserve o funcionamento existente e não remova recursos sem pedido explícito.\n\nRetorne SOMENTE JSON válido no formato:\n{"reply":"resposta objetiva","changes":[{"path":"arquivo permitido","content":"conteúdo completo","reason":"motivo"}]}\n\nHistórico recente da conversa:\n${conversation || "(primeira mensagem)"}\n\nCódigo atual:${context}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    }),
  });
  const body = await response.json() as any;
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${body.error?.message || "resposta inválida"}`);
  const text = body.candidates?.[0]?.content?.parts?.map((part: any) => part.text || "").join("") || "";
  try { return JSON.parse(text) as { reply: string; changes: GeminiChange[] }; }
  catch { throw new Error("O Gemini retornou uma resposta que não pôde ser validada como JSON."); }
}

export async function runPersistentGemini(prompt: string, history: ChatMessage[] = []) {
  const ref = await github(`/repos/${OWNER}/${REPO}/git/ref/heads/${encodeURIComponent(BRANCH)}`) as GithubRef;
  const files = await Promise.all(editableFiles.map((path) => readFile(path, BRANCH)));
  const result = await askGemini(prompt, files, history);
  const changes = (result.changes || []).filter((change) => editableFiles.includes(change.path) && typeof change.content === "string");
  if (!changes.length) return { reply: result.reply || "Estou aqui para responder sua mensagem. O que você gostaria de saber?", changed: false as const };
  if (changes.length > 4) throw new Error("A solicitação gerou arquivos demais para uma única alteração segura.");
  for (const change of changes) {
    if (change.content.length > 300_000) throw new Error(`O arquivo ${change.path} excede o limite seguro.`);
  }

  const baseCommitSha = ref.object.sha;
  const baseCommit = await github(`/repos/${OWNER}/${REPO}/git/commits/${baseCommitSha}`) as GithubCommit;
  const treeEntries = [];
  for (const change of changes) {
    const blob = await github(`/repos/${OWNER}/${REPO}/git/blobs`, { method: "POST", body: JSON.stringify({ content: change.content, encoding: "utf-8" }) });
    treeEntries.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const tree = await github(`/repos/${OWNER}/${REPO}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }) });
  const commit = await github(`/repos/${OWNER}/${REPO}/git/commits`, { method: "POST", body: JSON.stringify({ message: `feat(ai): ${prompt.slice(0, 72).replace(/\n/g, " ")}`, tree: tree.sha, parents: [baseCommitSha] }) });
  await github(`/repos/${OWNER}/${REPO}/git/refs/heads/${encodeURIComponent(BRANCH)}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
  return {
    reply: `${result.reply || "Alteração preparada."}\n\nCommit criado com sucesso. A Vercel foi acionada para publicar a nova versão; confirme o resultado no site após o deployment concluir.`,
    changed: true as const,
    commitSha: commit.sha,
    commitUrl: `https://github.com/${OWNER}/${REPO}/commit/${commit.sha}`,
    files: changes.map((change) => change.path),
  };
}

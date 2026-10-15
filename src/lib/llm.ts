// llm.ts — capa agentica LLM SWAL
// Reusa ProviderRouter + Clavis + xavier-gpud de cores/swal-agent-runner/src/services/llm/
// El modelo de negocio no habla directo a OpenAI — pasa por este router con memoria RAG.

import { xavierSearch } from './xavier';

export type LLMRequest = { prompt: string; system?: string; model?: string; useMemory?: boolean; estimatedTokens?: number };
export type LLMResponse = { text: string; model: string; fromCache?: boolean; via?: 'local'|'cf' };

export async function llmComplete(req: LLMRequest): Promise<LLMResponse> {
  // Fallback local: RAG + stub (xavier-gpud / opencode en prod)
  let context = '';
  if (req.useMemory) {
    const mem = await xavierSearch(req.prompt, 3);
    context = (mem.memories ?? []).map((m: any) => m.content).join('\n---\n');
  }
  const system = req.system ? req.system + '\n' : '';
  const ctx = context ? `Context:\n${context}\n\n` : '';
  // PRIVACIDAD: no loguear el prompt. Puede contener el enunciado literal de
  // un item de examen o material de estudio, que docs/PISASTYLE_TELEMETRY.md
  // prohibe. Para depurar, meter un hash del prompt, nunca su contenido.
  console.log('[llm] complete', { model: req.model ?? 'auto', via: 'local', promptChars: req.prompt.length });
  return { text: `${system}${ctx}LLM local stub (sin CF): implementa ProviderRouter en src/lib/llm.ts (ver swal-agent-runner llm-provider-manager.ts)`, model: req.model ?? 'stub', via: 'local' };
}

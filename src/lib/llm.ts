// llm.ts — capa agentica LLM SWAL
// Reusa ProviderRouter + Clavis + xavier-gpud de cores/swal-agent-runner/src/services/llm/
// El modelo de negocio no habla directo a OpenAI — pasa por este router con memoria RAG.

import { xavierSearch } from './xavier';

export type LLMRequest = { prompt: string; system?: string; model?: string; useMemory?: boolean; estimatedTokens?: number };
export type LLMResponse = { text: string; model: string; fromCache?: boolean; via?: 'local'|'cf' };

function getLanguageModelFactory(): any {
  const w = globalThis as any;
  return w.LanguageModel ?? w.ai?.languageModel;
}

export async function llmComplete(req: LLMRequest): Promise<LLMResponse> {
  // Fallback local: RAG + stub (xavier-gpud / opencode en prod)
  let context = '';
  if (req.useMemory) {
    const mem = await xavierSearch(req.prompt, 3);
    context = (mem.memories ?? []).map((m: any) => m.content).join('\n---\n');
  }
  const system = req.system ? req.system + '\n' : '';
  const ctx = context ? `Context:\n${context}\n\n` : '';

  const fullPrompt = `${system}${ctx}${req.prompt}`;

  // Feature-detect Chrome built-in Prompt API
  try {
    const factory = getLanguageModelFactory();
    if (factory) {
      // Chrome's API can be capabilities().available or availability()
      const isAvailable = typeof factory.capabilities === 'function'
        ? (await factory.capabilities()).available !== 'no'
        : (typeof factory.availability === 'function' ? (await factory.availability()) !== 'no' : true);

      if (isAvailable) {
        const session = await factory.create();
        const text = await session.prompt(fullPrompt);

        console.log('[llm] complete', { model: 'browser-prompt-api', via: 'local', promptChars: req.prompt.length });
        return { text, model: 'browser-prompt-api', via: 'local' };
      }
    }
  } catch (error) {
    // Silently fall back si the model fails to create or prompt
    // We intentionally don't log the error string as it might contain prompt data internally,
    // though that's unlikely for setup errors. Just in case.
  }

  // PRIVACIDAD: no loguear el prompt. Puede contener el enunciado literal de
  // un item de examen o material de estudio, que docs/PISASTYLE_TELEMETRY.md
  // prohibe. Para depurar, meter un hash del prompt, nunca su contenido.
  console.log('[llm] complete', { model: req.model ?? 'auto', via: 'local', promptChars: req.prompt.length });
  return { text: `${system}${ctx}LLM local stub (sin CF): implementa ProviderRouter en src/lib/llm.ts (ver swal-agent-runner llm-provider-manager.ts)`, model: req.model ?? 'stub', via: 'local' };
}

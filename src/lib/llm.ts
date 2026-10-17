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
      // Determine availability. We only proceed if strictly "available" or "readily"
      let availabilityState = '';
      if (typeof factory.availability === 'function') {
        availabilityState = await factory.availability();
      } else if (typeof factory.capabilities === 'function') {
        const caps = await factory.capabilities();
        availabilityState = caps.available;
      }

      if (availabilityState === 'available' || availabilityState === 'readily') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        let session;
        try {
          session = await factory.create({ signal: controller.signal });
          const text = await session.prompt(fullPrompt, { signal: controller.signal });

          console.log('[llm] complete', { model: 'browser-prompt-api', via: 'local', promptChars: req.prompt.length });
          return { text, model: 'browser-prompt-api', via: 'local' };
        } finally {
          clearTimeout(timeoutId);
          if (session && typeof session.destroy === 'function') {
            session.destroy();
          }
        }
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

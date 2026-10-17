import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { llmComplete } from './llm';

describe('llmComplete browser built-in AI', () => {
  beforeEach(() => {
    vi.stubGlobal('LanguageModel', undefined);
    vi.stubGlobal('ai', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('falls back to stub when LanguageModel is completely absent', async () => {
    const res = await llmComplete({ prompt: 'hola' });
    expect(res.via).toBe('local');
    expect(res.model).toBe('stub');
    expect(res.text).toContain('LLM local stub (sin CF)');
  });

  it('uses browser prompt API when available via globalThis.LanguageModel', async () => {
    const mockSession = {
      prompt: vi.fn().mockResolvedValue('fake local response'),
      destroy: vi.fn(),
    };
    const mockFactory = {
      capabilities: vi.fn().mockResolvedValue({ available: 'available' }),
      create: vi.fn().mockResolvedValue(mockSession),
    };
    vi.stubGlobal('LanguageModel', mockFactory);

    const res = await llmComplete({ prompt: 'hola' });

    expect(res.via).toBe('local');
    expect(res.model).toBe('browser-prompt-api');
    expect(res.text).toBe('fake local response');
    expect(mockFactory.capabilities).toHaveBeenCalled();
    expect(mockFactory.create).toHaveBeenCalled();
    expect(mockSession.prompt).toHaveBeenCalledWith('hola', expect.any(Object));
    expect(mockSession.destroy).toHaveBeenCalled(); // Ensure destroy was called
  });

  it('uses browser prompt API when available via globalThis.ai.languageModel (legacy readily)', async () => {
    const mockSession = {
      prompt: vi.fn().mockResolvedValue('fake local response via ai'),
      destroy: vi.fn(),
    };
    const mockFactory = {
      availability: vi.fn().mockResolvedValue('readily'),
      create: vi.fn().mockResolvedValue(mockSession),
    };
    vi.stubGlobal('ai', { languageModel: mockFactory });

    const res = await llmComplete({ prompt: 'test' });

    expect(res.via).toBe('local');
    expect(res.model).toBe('browser-prompt-api');
    expect(res.text).toBe('fake local response via ai');
    expect(mockFactory.availability).toHaveBeenCalled();
    expect(mockFactory.create).toHaveBeenCalled();
    expect(mockSession.prompt).toHaveBeenCalledWith('test', expect.any(Object));
    expect(mockSession.destroy).toHaveBeenCalled();
  });

  it('falls back to stub when factory is present but availability is "no"', async () => {
    const mockFactory = {
      capabilities: vi.fn().mockResolvedValue({ available: 'no' }),
      create: vi.fn(),
    };
    vi.stubGlobal('LanguageModel', mockFactory);

    const res = await llmComplete({ prompt: 'hola' });

    expect(res.via).toBe('local');
    expect(res.model).toBe('stub');
    expect(res.text).toContain('LLM local stub (sin CF)');
    expect(mockFactory.create).not.toHaveBeenCalled();
  });

  it('falls back to stub when factory is present but availability is "downloadable"', async () => {
    const mockFactory = {
      capabilities: vi.fn().mockResolvedValue({ available: 'downloadable' }),
      create: vi.fn(),
    };
    vi.stubGlobal('LanguageModel', mockFactory);

    const res = await llmComplete({ prompt: 'hola' });

    expect(res.via).toBe('local');
    expect(res.model).toBe('stub');
    expect(mockFactory.create).not.toHaveBeenCalled(); // Must NOT download
  });

  it('falls back to stub when create() rejects gracefully', async () => {
    const mockFactory = {
      capabilities: vi.fn().mockResolvedValue({ available: 'available' }),
      create: vi.fn().mockRejectedValue(new Error('AbortError or NotAllowedError')),
    };
    vi.stubGlobal('LanguageModel', mockFactory);

    const res = await llmComplete({ prompt: 'hola' });

    expect(res.via).toBe('local');
    expect(res.model).toBe('stub');
    expect(res.text).toContain('LLM local stub (sin CF)');
  });

  it('falls back to stub when create() or prompt() times out (AbortError)', async () => {
    const mockSession = {
      prompt: vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError')),
      destroy: vi.fn(),
    };
    const mockFactory = {
      capabilities: vi.fn().mockResolvedValue({ available: 'available' }),
      create: vi.fn().mockResolvedValue(mockSession),
    };
    vi.stubGlobal('LanguageModel', mockFactory);

    const res = await llmComplete({ prompt: 'hola' });

    expect(res.via).toBe('local');
    expect(res.model).toBe('stub');
    expect(res.text).toContain('LLM local stub (sin CF)');
    expect(mockSession.destroy).toHaveBeenCalled();
  });

  it('never logs the prompt text to any console method', async () => {
    const consoleSpyLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleSpyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleSpyError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleSpyInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    const consoleSpyDebug = vi.spyOn(console, 'debug').mockImplementation(() => {});

    const mockSession = {
      prompt: vi.fn().mockResolvedValue('fake'),
      destroy: vi.fn(),
    };
    const mockFactory = {
      capabilities: vi.fn().mockResolvedValue({ available: 'available' }),
      create: vi.fn().mockResolvedValue(mockSession),
    };
    vi.stubGlobal('LanguageModel', mockFactory);

    const secretPrompt = 'super_secret_exam_item_text';
    await llmComplete({ prompt: secretPrompt });
    await llmComplete({ prompt: secretPrompt, useMemory: false });

    // Simulate a failure too to ensure no error logs leak the prompt
    mockFactory.create.mockRejectedValueOnce(new Error(`Failed prompt: ${secretPrompt}`));
    await llmComplete({ prompt: secretPrompt });

    const allCalls = [
      ...consoleSpyLog.mock.calls,
      ...consoleSpyWarn.mock.calls,
      ...consoleSpyError.mock.calls,
      ...consoleSpyInfo.mock.calls,
      ...consoleSpyDebug.mock.calls,
    ];

    for (const callArgs of allCalls) {
      for (const arg of callArgs) {
        if (typeof arg === 'string') {
          expect(arg).not.toContain(secretPrompt);
        } else if (typeof arg === 'object' && arg !== null) {
          expect(JSON.stringify(arg)).not.toContain(secretPrompt);
        }
      }
    }
  });
});

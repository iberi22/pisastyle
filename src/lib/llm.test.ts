import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { llmComplete } from './llm';

describe('llmComplete browser built-in AI', () => {
  beforeEach(() => {
    vi.stubGlobal('LanguageModel', undefined);
    vi.stubGlobal('ai', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    };
    const mockFactory = {
      capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
      create: vi.fn().mockResolvedValue(mockSession),
    };
    vi.stubGlobal('LanguageModel', mockFactory);

    const res = await llmComplete({ prompt: 'hola' });

    expect(res.via).toBe('local');
    expect(res.model).toBe('browser-prompt-api');
    expect(res.text).toBe('fake local response');
    expect(mockFactory.capabilities).toHaveBeenCalled();
    expect(mockFactory.create).toHaveBeenCalled();
    expect(mockSession.prompt).toHaveBeenCalledWith('hola');
  });

  it('uses browser prompt API when available via globalThis.ai.languageModel', async () => {
    const mockSession = {
      prompt: vi.fn().mockResolvedValue('fake local response via ai'),
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
    expect(mockSession.prompt).toHaveBeenCalledWith('test');
  });

  it('falls back to stub when factory is present but not available', async () => {
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

  it('falls back to stub when create() rejects gracefully', async () => {
    const mockFactory = {
      capabilities: vi.fn().mockResolvedValue({ available: 'readily' }),
      create: vi.fn().mockRejectedValue(new Error('AbortError or NotAllowedError')),
    };
    vi.stubGlobal('LanguageModel', mockFactory);

    const res = await llmComplete({ prompt: 'hola' });

    expect(res.via).toBe('local');
    expect(res.model).toBe('stub');
    expect(res.text).toContain('LLM local stub (sin CF)');
  });
});

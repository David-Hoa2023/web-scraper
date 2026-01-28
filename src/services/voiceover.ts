/**
 * AI Voiceover Service - Text-to-speech integration
 * FP-3: ElevenLabs and OpenAI TTS integration for tutorial narration
 */

import { RateLimiter } from '../utils/rateLimiter';
import { withRetry, APIError } from '../utils/retry';
import { getKeyVault } from '../utils/encryption';

/**
 * Supported TTS providers
 */
export type TTSProvider = 'elevenlabs' | 'openai';

/**
 * Voice configuration
 */
export interface VoiceConfig {
  provider: TTSProvider;
  voiceId: string;
  speed?: number; // 0.5 - 2.0
  stability?: number; // ElevenLabs only: 0 - 1
  similarityBoost?: number; // ElevenLabs only: 0 - 1
}

/**
 * Voiceover request
 */
export interface VoiceoverRequest {
  text: string;
  config?: Partial<VoiceConfig>;
}

/**
 * Voiceover result
 */
export interface VoiceoverResult {
  audioBlob: Blob;
  audioUrl: string;
  duration?: number;
  provider: TTSProvider;
  voiceId: string;
}

/**
 * Available voices per provider
 */
export const VOICES: Record<TTSProvider, Array<{ id: string; name: string; language: string }>> = {
  elevenlabs: [
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', language: 'en' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', language: 'en' },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', language: 'en' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', language: 'en' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', language: 'en' },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', language: 'en' },
  ],
  openai: [
    { id: 'alloy', name: 'Alloy', language: 'en' },
    { id: 'echo', name: 'Echo', language: 'en' },
    { id: 'fable', name: 'Fable', language: 'en' },
    { id: 'onyx', name: 'Onyx', language: 'en' },
    { id: 'nova', name: 'Nova', language: 'en' },
    { id: 'shimmer', name: 'Shimmer', language: 'en' },
  ],
};

/**
 * Default voice configurations
 */
const DEFAULT_CONFIGS: Record<TTSProvider, VoiceConfig> = {
  elevenlabs: {
    provider: 'elevenlabs',
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah
    speed: 1.0,
    stability: 0.5,
    similarityBoost: 0.75,
  },
  openai: {
    provider: 'openai',
    voiceId: 'nova',
    speed: 1.0,
  },
};

/**
 * Voiceover Service configuration
 */
export interface VoiceoverServiceConfig {
  defaultProvider: TTSProvider;
  rateLimitMs: number;
  maxTextLength: number;
}

const DEFAULT_SERVICE_CONFIG: VoiceoverServiceConfig = {
  defaultProvider: 'openai',
  rateLimitMs: 500,
  maxTextLength: 5000,
};

/**
 * Voiceover Service for generating audio from text
 */
export class VoiceoverService {
  private rateLimiter: RateLimiter;
  private config: VoiceoverServiceConfig;
  private apiKeys: Map<TTSProvider, string> = new Map();
  private audioUrls: string[] = []; // Track for cleanup

  constructor(config: Partial<VoiceoverServiceConfig> = {}) {
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config };
    this.rateLimiter = new RateLimiter({ minIntervalMs: this.config.rateLimitMs });
  }

  /**
   * Set API key for a provider
   */
  setApiKey(provider: TTSProvider, key: string): void {
    this.apiKeys.set(provider, key);
  }

  /**
   * Load API keys from encrypted storage
   */
  async loadKeysFromStorage(password: string): Promise<void> {
    const vault = getKeyVault();

    for (const provider of ['elevenlabs', 'openai'] as TTSProvider[]) {
      try {
        const key = await vault.retrieve(`tts_${provider}`, password);
        this.apiKeys.set(provider, key);
      } catch {
        // Key not found, skip
      }
    }
  }

  /**
   * Generate voiceover audio from text
   */
  async generateVoiceover(request: VoiceoverRequest): Promise<VoiceoverResult> {
    return this.rateLimiter.throttle(async () => {
      const provider = request.config?.provider || this.config.defaultProvider;
      const voiceConfig = {
        ...DEFAULT_CONFIGS[provider],
        ...request.config,
      };

      // Validate text length
      if (request.text.length > this.config.maxTextLength) {
        throw new Error(
          `Text exceeds maximum length of ${this.config.maxTextLength} characters`
        );
      }

      const apiKey = this.apiKeys.get(provider);
      if (!apiKey) {
        throw new Error(`No API key configured for ${provider}`);
      }

      let audioBlob: Blob;

      if (provider === 'elevenlabs') {
        audioBlob = await this.callElevenLabs(request.text, voiceConfig, apiKey);
      } else {
        audioBlob = await this.callOpenAI(request.text, voiceConfig, apiKey);
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      this.audioUrls.push(audioUrl);

      return {
        audioBlob,
        audioUrl,
        provider,
        voiceId: voiceConfig.voiceId,
      };
    });
  }

  /**
   * Generate voiceover for multiple text segments
   */
  async generateBatchVoiceover(
    segments: string[],
    config?: Partial<VoiceConfig>
  ): Promise<VoiceoverResult[]> {
    const results: VoiceoverResult[] = [];

    for (const text of segments) {
      const result = await this.generateVoiceover({ text, config });
      results.push(result);
    }

    return results;
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: TTSProvider): boolean {
    return this.apiKeys.has(provider);
  }

  /**
   * Get available voices for a provider
   */
  getVoices(provider: TTSProvider): typeof VOICES.elevenlabs {
    return VOICES[provider] || [];
  }

  /**
   * Cleanup created audio URLs
   */
  cleanup(): void {
    for (const url of this.audioUrls) {
      URL.revokeObjectURL(url);
    }
    this.audioUrls = [];
  }

  private async callElevenLabs(
    text: string,
    config: VoiceConfig,
    apiKey: string
  ): Promise<Blob> {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`;

    return withRetry(
      async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: config.stability ?? 0.5,
              similarity_boost: config.similarityBoost ?? 0.75,
            },
          }),
        });

        if (!response.ok) {
          throw await APIError.fromResponse(response);
        }

        return response.blob();
      },
      { maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 5000 }
    );
  }

  private async callOpenAI(
    text: string,
    config: VoiceConfig,
    apiKey: string
  ): Promise<Blob> {
    const url = 'https://api.openai.com/v1/audio/speech';

    return withRetry(
      async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'tts-1',
            voice: config.voiceId,
            input: text,
            speed: config.speed ?? 1.0,
          }),
        });

        if (!response.ok) {
          throw await APIError.fromResponse(response);
        }

        return response.blob();
      },
      { maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 5000 }
    );
  }
}

// Singleton instance
let voiceoverInstance: VoiceoverService | null = null;

/**
 * Get the global voiceover service instance
 */
export function getVoiceoverService(): VoiceoverService {
  if (!voiceoverInstance) {
    voiceoverInstance = new VoiceoverService();
  }
  return voiceoverInstance;
}

/**
 * Split long text into chunks for TTS processing
 */
export function splitTextForTTS(text: string, maxLength = 500): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * LLM-Enhanced Data Analysis Service
 * Uses configured LLM provider to generate insights from scraped data
 */

import { getLLMGateway, type LLMProvider, type LLMRequestOptions } from './llmGateway';

export interface LlmSettings {
  provider: '' | 'openai' | 'anthropic' | 'gemini' | 'deepseek';
  apiKey: string;
  model: string;
}

export interface DataAnalysisResult {
  insights: string[];
  recommendations: string[];
  summary: string;
  rawResponse?: string;
}

/**
 * Load LLM settings from Chrome storage
 */
export async function loadLlmSettings(): Promise<LlmSettings | null> {
  try {
    const result = await chrome.storage.local.get('llmSettings');
    const stored = result.llmSettings;

    if (!stored || !stored.provider) {
      return null;
    }

    // Get API key for the current provider from apiKeys map
    let apiKey = stored.apiKey || '';
    if (stored.apiKeys && stored.provider && stored.apiKeys[stored.provider]) {
      apiKey = stored.apiKeys[stored.provider];
    }

    if (!apiKey) {
      console.log('[LLM Analysis] No API key for provider:', stored.provider);
      return null;
    }

    return {
      provider: stored.provider,
      apiKey,
      model: stored.model || '',
    };
  } catch (err) {
    console.error('[LLM Analysis] Failed to load settings:', err);
    return null;
  }
}

/**
 * Format data for LLM analysis prompt
 */
function formatDataForAnalysis(data: Array<Record<string, unknown>>, maxItems: number = 20): string {
  const sampleData = data.slice(0, maxItems);

  // Get field names from first item
  const fields = sampleData.length > 0 ? Object.keys(sampleData[0]) : [];

  // Format as a readable table-like structure
  let formatted = `Dataset contains ${data.length} items with fields: ${fields.join(', ')}\n\n`;
  formatted += 'Sample data (first ' + sampleData.length + ' items):\n';

  sampleData.forEach((item, idx) => {
    formatted += `\n[Item ${idx + 1}]\n`;
    for (const [key, value] of Object.entries(item)) {
      const displayValue = typeof value === 'string' ? value.substring(0, 100) : JSON.stringify(value);
      formatted += `  ${key}: ${displayValue}\n`;
    }
  });

  return formatted;
}

/**
 * Create analysis prompt for LLM
 */
function createAnalysisPrompt(data: Array<Record<string, unknown>>): string {
  const formattedData = formatDataForAnalysis(data);

  return `Analyze this scraped product/item data and provide insights.

${formattedData}

Please provide:
1. KEY INSIGHTS (3-5 bullet points about patterns, trends, or notable findings in the data)
2. RECOMMENDATIONS (2-3 actionable suggestions based on the data)
3. SUMMARY (1-2 sentences summarizing the overall dataset)

Format your response exactly like this:
INSIGHTS:
- [insight 1]
- [insight 2]
- [insight 3]

RECOMMENDATIONS:
- [recommendation 1]
- [recommendation 2]

SUMMARY:
[Your summary here]`;
}

/**
 * Parse LLM response into structured result
 */
function parseAnalysisResponse(response: string): DataAnalysisResult {
  const insights: string[] = [];
  const recommendations: string[] = [];
  let summary = '';

  // Parse insights
  const insightsMatch = response.match(/INSIGHTS:\s*([\s\S]*?)(?=RECOMMENDATIONS:|SUMMARY:|$)/i);
  if (insightsMatch) {
    const insightLines = insightsMatch[1].split('\n').filter(line => line.trim().startsWith('-'));
    insights.push(...insightLines.map(line => line.replace(/^-\s*/, '').trim()).filter(Boolean));
  }

  // Parse recommendations
  const recsMatch = response.match(/RECOMMENDATIONS:\s*([\s\S]*?)(?=SUMMARY:|$)/i);
  if (recsMatch) {
    const recLines = recsMatch[1].split('\n').filter(line => line.trim().startsWith('-'));
    recommendations.push(...recLines.map(line => line.replace(/^-\s*/, '').trim()).filter(Boolean));
  }

  // Parse summary
  const summaryMatch = response.match(/SUMMARY:\s*([\s\S]*?)$/i);
  if (summaryMatch) {
    summary = summaryMatch[1].trim();
  }

  // Fallback if parsing failed
  if (insights.length === 0 && recommendations.length === 0 && !summary) {
    // Try to extract any bullet points as insights
    const bulletPoints = response.split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().match(/^\d+\./))
      .map(line => line.replace(/^[-\d.]+\s*/, '').trim())
      .filter(Boolean);

    if (bulletPoints.length > 0) {
      insights.push(...bulletPoints.slice(0, 5));
    }
    summary = 'Analysis completed. See insights for details.';
  }

  return {
    insights,
    recommendations,
    summary,
    rawResponse: response,
  };
}

/**
 * Analyze scraped data using configured LLM
 */
export async function analyzeWithLLM(data: Array<Record<string, unknown>>): Promise<DataAnalysisResult | null> {
  // Load settings
  const settings = await loadLlmSettings();
  if (!settings) {
    console.log('[LLM Analysis] No LLM configured');
    return null;
  }

  if (data.length === 0) {
    return {
      insights: ['No data available for analysis'],
      recommendations: ['Scrape more data to get meaningful insights'],
      summary: 'The dataset is empty.',
    };
  }

  try {
    console.log(`[LLM Analysis] Analyzing ${data.length} items with ${settings.provider}/${settings.model}`);

    // Configure gateway with settings
    const gateway = getLLMGateway();
    gateway.setApiKey(settings.provider as LLMProvider, settings.apiKey);

    // Create prompt
    const prompt = createAnalysisPrompt(data);

    // Call LLM
    const options: LLMRequestOptions = {
      model: settings.model,
      maxTokens: 1024,
      temperature: 0.7,
      systemPrompt: 'You are a data analyst expert. Analyze the provided scraped data and provide concise, actionable insights. Be specific and reference actual values from the data.',
    };

    const response = await gateway.completeWith(settings.provider as LLMProvider, prompt, options);
    console.log('[LLM Analysis] Response received:', response.content.substring(0, 200) + '...');

    // Parse response
    return parseAnalysisResponse(response.content);
  } catch (err) {
    console.error('[LLM Analysis] Error:', err);
    return {
      insights: [`Analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`],
      recommendations: ['Check your API key and try again'],
      summary: 'Unable to complete analysis due to an error.',
    };
  }
}

/**
 * Generate a quick summary of the data without full analysis
 */
export async function generateQuickSummary(data: Array<Record<string, unknown>>): Promise<string | null> {
  const settings = await loadLlmSettings();
  if (!settings) {
    return null;
  }

  try {
    const gateway = getLLMGateway();
    gateway.setApiKey(settings.provider as LLMProvider, settings.apiKey);

    const sampleData = data.slice(0, 10);
    const fields = sampleData.length > 0 ? Object.keys(sampleData[0]) : [];

    const prompt = `In 1-2 sentences, describe this dataset of ${data.length} items with fields: ${fields.join(', ')}. Sample item: ${JSON.stringify(sampleData[0])}`;

    const response = await gateway.completeWith(settings.provider as LLMProvider, prompt, {
      model: settings.model,
      maxTokens: 100,
      temperature: 0.5,
    });

    return response.content.trim();
  } catch {
    return null;
  }
}

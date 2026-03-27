/**
 * Bifrost Image Generation Adapter
 *
 * Uses OpenAI-compatible API format via Bifrost gateway.
 * Endpoint: {baseUrl}/v1/images/generations
 *
 * Supported models (format: provider/model):
 * - xai/grok-imagine-image
 * - xai/grok-imagine-image-pro
 * - google/gemini-2.0-flash-exp
 * - And other image generation models supported by Bifrost
 *
 * Authentication: Bearer token via Authorization header
 *
 * API docs: https://docs.getbifrost.ai/api-reference/image-generations/generate-image
 */

import type {
  ImageGenerationConfig,
  ImageGenerationOptions,
  ImageGenerationResult,
} from '../types';

const DEFAULT_BASE_URL = 'http://localhost:8080';

const SIZE_MAP: Record<string, string> = {
  '16:9': '1792x1024',
  '4:3': '1536x1024',
  '1:1': '1024x1024',
  '9:16': '1024x1792',
};

function mapAspectRatioToSize(aspectRatio?: string): string | undefined {
  if (!aspectRatio) return undefined;
  return SIZE_MAP[aspectRatio];
}

export async function testBifrostConnectivity(
  config: ImageGenerationConfig,
): Promise<{ success: boolean; message: string }> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  try {
    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'xai/grok-imagine-image',
        prompt: 'test',
        n: 1,
        size: '1024x1024',
      }),
    });
    if (response.status === 401 || response.status === 403) {
      const text = await response.text();
      return {
        success: false,
        message: `Bifrost auth failed (${response.status}): ${text}`,
      };
    }
    return { success: true, message: 'Connected to Bifrost' };
  } catch (err) {
    return { success: false, message: `Bifrost connectivity error: ${err}` };
  }
}

export async function generateWithBifrost(
  config: ImageGenerationConfig,
  options: ImageGenerationOptions,
): Promise<ImageGenerationResult> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;

  const size =
    options.width && options.height
      ? `${options.width}x${options.height}`
      : mapAspectRatioToSize(options.aspectRatio) || '1024x1024';

  const response = await fetch(`${baseUrl}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'xai/grok-imagine-image',
      prompt: options.prompt,
      n: 1,
      size,
      negative_prompt: options.negativePrompt,
      response_format: 'url',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bifrost image generation failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  const imageData = data.data?.[0];
  if (!imageData) {
    throw new Error('Bifrost returned empty image response');
  }

  const [width, height] = size.split('x').map(Number);

  return {
    url: imageData.url,
    base64: imageData.b64_json,
    width: options.width || width || 1024,
    height: options.height || height || 1024,
  };
}

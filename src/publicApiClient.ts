import { XMLParser } from 'fast-xml-parser';
import { getContestCredential } from './contestCredentials.js';

export interface PublicApiFetchResult<T> {
  ok: boolean;
  status?: number;
  url: string;
  data?: T;
  message: string;
}

export function firstConfiguredEnv(names: string[]): { name?: string; value?: string } {
  for (const name of names) {
    const value = getContestCredential(name);
    if (value) {
      return { name, value };
    }
  }
  return {};
}

export function describeFetchError(error: unknown, timeoutMs: number): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  if (error.name === 'AbortError') {
    return `timeout after ${timeoutMs}ms`;
  }
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    return `${error.message}; cause=${cause.name}: ${cause.message}`;
  }
  if (cause && typeof cause === 'object') {
    const causeRecord = cause as Record<string, unknown>;
    const parts = ['code', 'errno', 'syscall', 'hostname']
      .map((key) => (causeRecord[key] ? `${key}=${String(causeRecord[key])}` : undefined))
      .filter(Boolean);
    return parts.length > 0 ? `${error.message}; ${parts.join(', ')}` : error.message;
  }
  return error.message;
}

export async function fetchTextWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<PublicApiFetchResult<string>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        url,
        data: text,
        message: `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
      };
    }
    return { ok: true, status: response.status, url, data: text, message: 'OK' };
  } catch (error) {
    return {
      ok: false,
      url,
      message: describeFetchError(error, timeoutMs)
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function parseJsonOrXml(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed);
  }
  return new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(trimmed);
}

export async function fetchStructuredWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<PublicApiFetchResult<unknown>> {
  const textResult = await fetchTextWithTimeout(url, options, timeoutMs);
  if (!textResult.ok) {
    return textResult;
  }
  try {
    return {
      ok: true,
      status: textResult.status,
      url,
      data: parseJsonOrXml(textResult.data ?? ''),
      message: 'OK'
    };
  } catch (error) {
    return {
      ok: false,
      status: textResult.status,
      url,
      data: textResult.data,
      message: error instanceof Error ? `응답 파싱 실패: ${error.message}` : '응답 파싱 실패'
    };
  }
}

export function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function parseFiniteNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

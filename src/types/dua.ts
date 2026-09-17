export interface ValidatedInput {
  wishes: string[];
  wishCount: number;
  timestamp: string;
}

export interface GeneratedDua {
  text: string;
  matchedCategories: string[];
  referencesUsed: number;
}

export interface ApiResponse<T = GeneratedDua> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ValidationResult {
  isValid: boolean;
  /** Faults that make the dua unusable. */
  errors: string[];
  /** Quality problems worth another attempt, but not worth failing the request over. */
  warnings: string[];
}

export interface PreprocessingResult {
  success: boolean;
  data?: ValidatedInput;
  error?: string;
}

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

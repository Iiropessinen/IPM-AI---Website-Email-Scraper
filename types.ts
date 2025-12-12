export enum ExtractionStatus {
  IDLE = 'IDLE',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface WebsiteData {
  id: string;
  url: string;
  status: ExtractionStatus;
  emails: string[];
  error?: string;
  sourceUrl?: string; // The specific page where it might have been found, if available
}

export interface Stats {
  total: number;
  processed: number;
  found: number;
  successRate: number;
}

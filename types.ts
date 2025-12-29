
export enum Language {
  HINDI = 'Hindi',
  ENGLISH = 'English',
  BHOJPURI = 'Bhojpuri'
}

export enum Verdict {
  TRUE = 'Sahi (True)',
  FALSE = 'Galat (False)',
  MISLEADING = 'Bhramak (Misleading)',
  UNKNOWN = 'Asphasht (Unknown)'
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text?: string;
  image?: string;
  timestamp: Date;
  verdict?: Verdict;
  explanation?: string;
  sources?: GroundingSource[];
  isPending?: boolean;
  error?: {
    code: 'RATE_LIMIT' | 'NETWORK_ERROR' | 'API_ERROR' | 'UNKNOWN';
    message: string;
  };
}

export interface FactCheckResponse {
  verdict: Verdict;
  explanation: string;
  sources: GroundingSource[];
  error?: Message['error'];
}

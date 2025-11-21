export interface ImageState {
  dataUrl: string | null;
  mimeType: string | null;
  base64Data: string | null; // Raw base64 without prefix for API
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text?: string;
  image?: string; // Deprecated: Single image Data URL for backward compatibility
  images?: string[]; // Array of Data URLs
  timestamp: number;
  isError?: boolean;
}

export interface GenerationResult {
  imageUrl: string | null;
  text: string | null;
}

export interface AppSettings {
  temperature: number;
  style: string;
  aspectRatio: string;
  isFullBody: boolean;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  activeImage: ImageState | null;
  lastModified: number;
  settings: AppSettings;
}
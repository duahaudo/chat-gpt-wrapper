// Define the colors
export enum COLOR {
  reset = '\x1b[0m',
  red = '\x1b[31m',
  green = '\x1b[32m',
  yellow = '\x1b[33m',
  blue = '\x1b[34m',
  magenta = '\u001b[35m',
  cyan = '\u001b[36m',
}

export enum MODEL {
  'gpt-3.5-turbo' = 'gpt-3.5-turbo',
  'gpt-4o' = 'gpt-4o',
}

export interface IPhotoResponse {
  url?: string
  b64_json?: string
  revised_prompt: string
}

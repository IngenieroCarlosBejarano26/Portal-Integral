export interface Environment {
  production: boolean;
  environment: string;
  api?: {
    baseUrl: string;
    apiKey: string;
  };
  azure?: {
    staticWebApps: boolean;
    corsEnabled: boolean;
  };
}



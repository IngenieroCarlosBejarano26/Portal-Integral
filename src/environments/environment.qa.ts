import { Environment } from './environment.interface';

export const environment: Environment = {
  production: false,
  environment: 'qa',
  api: {
    baseUrl: 'https://localhost:7206',
    apiKey: 'V4l3r4s-4p1K3y-S3cur3-2024!'
  },
  azure: {
    staticWebApps: true,
    corsEnabled: true,
  },
};


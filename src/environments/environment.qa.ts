import { Environment } from './environment.interface';

export const environment: Environment = {
  production: false,
  environment: 'qa',
  api: {
    baseUrl: '192.168.10.20:7206',
    apiKey: 'V4l3r4s-4p1K3y-S3cur3-2024!'
  },
  azure: {
    staticWebApps: true,
    corsEnabled: true,
  },
};


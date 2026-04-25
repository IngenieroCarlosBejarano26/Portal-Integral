import { Environment } from './environment.interface';

export const environment: Environment = {
  production: false,
  environment: 'local',
  api: {
    // HTTP (no HTTPS) para evitar errores de certificado al probar desde el móvil.
    // El cert dev de .NET solo es válido para localhost.
    baseUrl: 'http://localhost:5161/',
    apiKey: 'V4l3r4s-4p1K3y-S3cur3-2024!'
  },
};


import { Environment } from './environment.interface';

/**
 * ⚠️ EDITA estos valores tras el aprovisionamiento de Azure:
 *  - baseUrl: URL del App Service del backend (ej: https://valeras-api.azurewebsites.net)
 *  - apiKey:  el secret rotado para producción (NO el del repo)
 *
 * NOTA: Si quieres mantener apiKey fuera del bundle JS, considera usar
 * Azure Static Web Apps > Configuration > Application settings y leer
 * `process.env.NG_APP_API_KEY` con angular-cli build replacements.
 */
export const environment: Environment = {
  production: true,
  environment: 'production',
  api: {
    baseUrl: 'https://valeras-api.azurewebsites.net',
    apiKey: 'ApiKeyProd24ead3683aa84c8a8da05743cecc60a6'
  },
  azure: {
    staticWebApps: true,
    corsEnabled: true
  }
};


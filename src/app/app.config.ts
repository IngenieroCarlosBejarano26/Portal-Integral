import {
  ApplicationConfig,
  provideZoneChangeDetection,
  importProvidersFrom,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { icons } from './icons-provider';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { es_ES, provideNzI18n } from 'ng-zorro-antd/i18n';
import { FormsModule } from '@angular/forms';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { registerSpanishLocale } from './core/config/locale.config';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { authInterceptor } from './core/interceptors/auth.Interceptor';
import { errorInterceptor } from './core/interceptors/error.Interceptor';
import { authGuard } from './core/guards/auth.guard';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([loadingInterceptor, authInterceptor, errorInterceptor])
    ),
    provideNzIcons(icons),
    provideNzI18n(es_ES),
    importProvidersFrom(FormsModule, NzModalModule),
    provideAnimationsAsync(),
  ],
};

registerSpanishLocale();

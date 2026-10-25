import { ApplicationConfig } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';

// À fusionner avec votre app.config.ts existant (le hash évite les 404 sur hébergement statique).
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes, withHashLocation())],
};

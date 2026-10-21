import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideFirebaseApp(() =>
      initializeApp({
        apiKey: 'AIzaSyBQO5U4JOuIPiBQ19nkXQvSG7wNat4jTDM',
        authDomain: 'crickettournament-48f75.firebaseapp.com',
        projectId: 'crickettournament-48f75',
        storageBucket: 'crickettournament-48f75.firebasestorage.app',
        messagingSenderId: '701996871504',
        appId: '1:701996871504:web:3641a3c0a610bbc2a78655',
        measurementId: 'G-3JXEX4SRT5',
      }),
    ),


    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
  ],
};

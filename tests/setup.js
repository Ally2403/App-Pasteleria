import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Realizar cleanup después de cada test de Testing Library
afterEach(() => {
  cleanup();
});

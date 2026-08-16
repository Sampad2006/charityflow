import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { simulation } from '../src/utils/simulation';

beforeEach(() => {
  localStorage.clear();
  simulation.reset();
});

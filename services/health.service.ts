import { apiFetch } from './apiClient';

export const healthService = {
  checkHealth: () => {
    return apiFetch<any>('/health', {
      method: 'GET',
    });
  }
};

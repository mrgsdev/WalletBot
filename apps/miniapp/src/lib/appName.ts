/**
 * Название приложения.
 *
 * Задаётся через VITE_APP_NAME, чтобы репозиторий не был привязан
 * к конкретному боту: у каждого развёртывания своё имя.
 */
export const APP_NAME = (import.meta.env.VITE_APP_NAME as string | undefined) || 'Бюджет';

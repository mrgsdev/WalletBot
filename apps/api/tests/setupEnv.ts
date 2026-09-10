// Тесты работают с отдельной базой, а не с dev.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  `postgresql://${process.env.USER ?? 'postgres'}@localhost:5432/budget_test?schema=public`;
process.env.NODE_ENV = 'test';

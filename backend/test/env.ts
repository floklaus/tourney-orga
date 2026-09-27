process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://app:app@localhost:5544/app_test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-123';
process.env.APP_URL = 'http://app.test';
process.env.API_PUBLIC_URL = 'http://api.test';
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.ADMIN_PASSWORD = 'admin-password-123';
process.env.ADMIN_FIRST_NAME = 'Ada';
process.env.ADMIN_LAST_NAME = 'Admin';
process.env.MAIL_AUTH_MODE = 'SMTP';
process.env.MAIL_USER = 'organizer@example.com';
process.env.SMTP_HOST = 'localhost';
process.env.SCHEDULER_ENABLED = 'false';

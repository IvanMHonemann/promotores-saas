export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  scheduleSecret: process.env.SCHEDULE_SECRET ?? "",
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL ?? "",
  asaasEnvironment: process.env.ASAAS_ENVIRONMENT ?? "mock",
  asaasApiUrl: process.env.ASAAS_API_URL ?? "https://api.asaas.com/v3",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Extinfy <onboarding@resend.dev>",
  adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL ?? "ivan.honemann@gmail.com",
  appPublicUrl: process.env.APP_PUBLIC_URL ?? "https://gestao-de-extintores-teste.vercel.app",
};

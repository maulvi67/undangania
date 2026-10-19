import { defineRailway, project, service, type BuildConfig } from "railway/iac";

const dockerfile = (dockerfilePath: string): BuildConfig => ({
  builder: "DOCKERFILE",
  dockerfilePath,
});

export default defineRailway((ctx) => {
  const customerWeb = service("customer-web", {
    build: dockerfile("Dockerfile"),
    deploy: {
      healthcheckPath: "/api/health",
      healthcheckTimeout: 100,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
  });

  const adminDashboard = service("admin-dashboard", {
    build: dockerfile("docker/admin-dashboard.Dockerfile"),
    deploy: {
      healthcheckPath: "/api/health",
      healthcheckTimeout: 100,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
    },
  });

  const backendApi = service("backend-api", {
    build: dockerfile("docker/backend-api.Dockerfile"),
    deploy: {
      healthcheckPath: "/health",
      healthcheckTimeout: 100,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
  });

  const backgroundWorker = service("background-worker", {
    build: dockerfile("docker/background-worker.Dockerfile"),
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
  });

  const notificationRelay = service("notification-relay", {
    build: dockerfile("docker/notification-relay.Dockerfile"),
    deploy: {
      healthcheckPath: "/health",
      healthcheckTimeout: 100,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10,
    },
  });

  return project(ctx.projectName ?? "undangania", {
    resources: [
      customerWeb,
      adminDashboard,
      backendApi,
      backgroundWorker,
      notificationRelay,
    ],
  });
});

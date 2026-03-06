import type { TsgInput } from "../../schemas/tsg.schema.js";

/**
 * Category-specific TSG templates with pre-filled structure.
 * Users can override any field; template provides a starting point.
 */
export const TSG_TEMPLATES: Record<string, Partial<TsgInput>> = {
  deployment: {
    tags: ["deployment", "rollout", "release"],
    symptoms: [
      "deployment failed",
      "pods not starting",
      "rollout stuck",
      "image pull error",
    ],
    relatedErrors: [
      "ImagePullBackOff",
      "CrashLoopBackOff",
      "ErrImagePull",
      "Deadline exceeded",
    ],
    prerequisites: {
      tools: [
        { name: "kubectl" },
        { name: "az", minVersion: "2.0" },
      ],
      permissions: ["cluster read access"],
      context: ["cluster name", "namespace", "deployment name"],
    },
    diagnostics: [
      {
        id: "check-rollout-status",
        name: "Check rollout status",
        command: {
          template: "kubectl rollout status deployment/{{deploymentName}} -n {{namespace}}",
          parameters: [
            { name: "deploymentName", required: true, description: "Name of the deployment" },
            { name: "namespace", required: true, default: "default", description: "Kubernetes namespace" },
          ],
        },
        analysis: {
          lookFor: [
            { pattern: "successfully rolled out", type: "literal", description: "Deployment succeeded" },
            { pattern: "Waiting for", type: "literal", indicatesRootCause: "rollout-stuck", severity: "high" },
          ],
        },
      },
      {
        id: "check-pod-events",
        name: "Check pod events",
        command: {
          template: "kubectl get events -n {{namespace}} --field-selector involvedObject.name={{deploymentName}} --sort-by='.lastTimestamp'",
          parameters: [
            { name: "deploymentName", required: true },
            { name: "namespace", required: true, default: "default" },
          ],
        },
      },
    ],
    resolutions: {},
    escalation: {
      timeout: "30m",
      contacts: [{ team: "Platform Engineering" }],
    },
  },

  database: {
    tags: ["database", "sql", "connectivity"],
    symptoms: [
      "connection timeout",
      "query slow",
      "database unreachable",
      "deadlock detected",
    ],
    relatedErrors: [
      "connection timed out",
      "too many connections",
      "deadlock detected",
      "login failed",
    ],
    prerequisites: {
      tools: [{ name: "sqlcmd" }],
      permissions: ["database read access"],
      context: ["server name", "database name"],
    },
    diagnostics: [
      {
        id: "check-connectivity",
        name: "Test database connectivity",
        command: {
          template: "sqlcmd -S {{serverName}} -d {{databaseName}} -Q \"SELECT 1\"",
          parameters: [
            { name: "serverName", required: true, description: "Database server hostname" },
            { name: "databaseName", required: true, description: "Database name" },
          ],
        },
        analysis: {
          lookFor: [
            { pattern: "Login failed", type: "literal", indicatesRootCause: "auth-failure", severity: "high" },
            { pattern: "timed out", type: "literal", indicatesRootCause: "connectivity", severity: "high" },
          ],
        },
      },
      {
        id: "check-active-connections",
        name: "Check active connections",
        command: {
          template: "sqlcmd -S {{serverName}} -d {{databaseName}} -Q \"SELECT COUNT(*) FROM sys.dm_exec_sessions WHERE is_user_process = 1\"",
          parameters: [
            { name: "serverName", required: true },
            { name: "databaseName", required: true },
          ],
        },
      },
    ],
    resolutions: {},
    escalation: {
      timeout: "15m",
      contacts: [{ team: "Database Engineering" }],
    },
  },

  networking: {
    tags: ["networking", "connectivity", "dns", "firewall"],
    symptoms: [
      "service unreachable",
      "connection refused",
      "DNS resolution failed",
      "high latency",
    ],
    relatedErrors: [
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ENOTFOUND",
      "getaddrinfo failed",
    ],
    prerequisites: {
      tools: [
        { name: "curl" },
        { name: "nslookup" },
      ],
      permissions: ["network read access"],
      context: ["target hostname", "port"],
    },
    diagnostics: [
      {
        id: "check-dns",
        name: "Check DNS resolution",
        command: {
          template: "nslookup {{hostname}}",
          parameters: [
            { name: "hostname", required: true, description: "Target hostname" },
          ],
        },
        analysis: {
          lookFor: [
            { pattern: "Non-existent domain", type: "literal", indicatesRootCause: "dns-failure", severity: "high" },
            { pattern: "can't find", type: "literal", indicatesRootCause: "dns-failure", severity: "high" },
          ],
        },
      },
      {
        id: "check-connectivity",
        name: "Test endpoint connectivity",
        command: {
          template: "curl -v --connect-timeout 10 {{hostname}}:{{port}}",
          parameters: [
            { name: "hostname", required: true },
            { name: "port", required: true, default: "443" },
          ],
        },
      },
    ],
    resolutions: {},
    escalation: {
      timeout: "20m",
      contacts: [{ team: "Network Engineering" }],
    },
  },

  authentication: {
    tags: ["authentication", "auth", "identity", "token"],
    symptoms: [
      "login failed",
      "token expired",
      "unauthorized access",
      "certificate error",
    ],
    relatedErrors: [
      "401 Unauthorized",
      "403 Forbidden",
      "token is expired",
      "certificate has expired",
    ],
    prerequisites: {
      tools: [{ name: "az" }],
      permissions: ["identity read access"],
      context: ["service principal or user identity", "resource being accessed"],
    },
    diagnostics: [
      {
        id: "check-token",
        name: "Validate current token",
        command: {
          template: "az account get-access-token --resource={{resource}}",
          parameters: [
            { name: "resource", required: true, description: "Target resource URL" },
          ],
        },
        analysis: {
          lookFor: [
            { pattern: "AADSTS", type: "regex", indicatesRootCause: "aad-error", severity: "high" },
            { pattern: "token is expired", type: "literal", indicatesRootCause: "token-expired", severity: "medium" },
          ],
        },
      },
    ],
    resolutions: {},
    escalation: {
      timeout: "15m",
      contacts: [{ team: "Identity & Access" }],
    },
  },

  performance: {
    tags: ["performance", "latency", "cpu", "memory"],
    symptoms: [
      "high latency",
      "service slow",
      "high CPU usage",
      "out of memory",
    ],
    relatedErrors: [
      "OOMKilled",
      "request timeout",
      "503 Service Unavailable",
      "resource quota exceeded",
    ],
    prerequisites: {
      tools: [{ name: "kubectl" }],
      permissions: ["cluster read access"],
      context: ["service name", "namespace", "time range"],
    },
    diagnostics: [
      {
        id: "check-resource-usage",
        name: "Check resource usage",
        command: {
          template: "kubectl top pods -n {{namespace}} -l app={{serviceName}}",
          parameters: [
            { name: "namespace", required: true, default: "default" },
            { name: "serviceName", required: true, description: "Service/app label" },
          ],
        },
        analysis: {
          lookFor: [
            { pattern: "OOMKilled", type: "literal", indicatesRootCause: "oom", severity: "critical" },
          ],
        },
      },
      {
        id: "check-pod-restarts",
        name: "Check pod restart count",
        command: {
          template: "kubectl get pods -n {{namespace}} -l app={{serviceName}} -o wide",
          parameters: [
            { name: "namespace", required: true, default: "default" },
            { name: "serviceName", required: true },
          ],
        },
      },
    ],
    resolutions: {},
    escalation: {
      timeout: "15m",
      contacts: [{ team: "SRE" }],
    },
  },
};

/**
 * Get a TSG template for the given category.
 * Returns undefined if no template exists for that category.
 */
export function getTsgTemplate(category: string): Partial<TsgInput> | undefined {
  return TSG_TEMPLATES[category];
}

/**
 * List available template category names.
 */
export function getTemplateCategories(): string[] {
  return Object.keys(TSG_TEMPLATES);
}

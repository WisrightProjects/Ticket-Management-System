// Shared color config — single source of truth for status/priority/type colors.
// CSS variables handle theming — defined in index.css
export const STATUS_CONFIG: Record<string, { dot: string; text: string; bg: string }> = {
  UN_ASSIGNED:        { dot: "var(--status-un-assigned-dot)",          text: "var(--status-un-assigned-text)",          bg: "var(--status-un-assigned-bg)"         },
  OPEN_NOT_STARTED:   { dot: "var(--status-open-not-started-dot)",     text: "var(--status-open-not-started-text)",     bg: "var(--status-open-not-started-bg)"    },
  OPEN_IN_PROGRESS:   { dot: "var(--status-open-in-progress-dot)",     text: "var(--status-open-in-progress-text)",     bg: "var(--status-open-in-progress-bg)"    },
  OPEN_QA:            { dot: "var(--status-open-qa-dot)",              text: "var(--status-open-qa-text)",              bg: "var(--status-open-qa-bg)"             },
  OPEN_DONE:          { dot: "var(--status-open-done-dot)",            text: "var(--status-open-done-text)",            bg: "var(--status-open-done-bg)"           },
  WAITING_FOR_CLIENT: { dot: "var(--status-waiting-for-client-dot)",   text: "var(--status-waiting-for-client-text)",   bg: "var(--status-waiting-for-client-bg)"  },
  CLOSED:             { dot: "var(--status-closed-dot)",               text: "var(--status-closed-text)",               bg: "var(--status-closed-bg)"              },
  SUBMITTED:          { dot: "var(--status-submitted-dot)",            text: "var(--status-submitted-text)",            bg: "var(--status-submitted-bg)"           },
  ADMIN_REVIEW:       { dot: "var(--status-admin-review-dot)",         text: "var(--status-admin-review-text)",         bg: "var(--status-admin-review-bg)"        },
  PLANNING:           { dot: "var(--status-planning-dot)",             text: "var(--status-planning-text)",             bg: "var(--status-planning-bg)"            },
  CUSTOMER_APPROVAL:  { dot: "var(--status-customer-approval-dot)",    text: "var(--status-customer-approval-text)",    bg: "var(--status-customer-approval-bg)"   },
  APPROVED:           { dot: "var(--status-approved-dot)",             text: "var(--status-approved-text)",             bg: "var(--status-approved-bg)"            },
  REOPENED:           { dot: "var(--status-reopened-dot)",             text: "var(--status-reopened-text)",             bg: "var(--status-reopened-bg)"            },
};

export const PRIORITY_CONFIG: Record<string, { dot: string; text: string; bg: string }> = {
  LOW:      { dot: "var(--priority-low-dot)",      text: "var(--priority-low-text)",      bg: "var(--priority-low-bg)"      },
  MEDIUM:   { dot: "var(--priority-medium-dot)",   text: "var(--priority-medium-text)",   bg: "var(--priority-medium-bg)"   },
  HIGH:     { dot: "var(--priority-high-dot)",     text: "var(--priority-high-text)",     bg: "var(--priority-high-bg)"     },
  CRITICAL: { dot: "var(--priority-critical-dot)", text: "var(--priority-critical-text)", bg: "var(--priority-critical-bg)" },
};

export const TYPE_CONFIG: Record<string, { dot: string; text: string; bg: string }> = {
  BUG:            { dot: "var(--type-bug-dot)",            text: "var(--type-bug-text)",            bg: "var(--type-bug-bg)"            },
  REQUIREMENT:    { dot: "var(--type-requirement-dot)",    text: "var(--type-requirement-text)",    bg: "var(--type-requirement-bg)"    },
  TASK:           { dot: "var(--type-task-dot)",           text: "var(--type-task-text)",           bg: "var(--type-task-bg)"           },
  SUPPORT:        { dot: "var(--type-support-dot)",        text: "var(--type-support-text)",        bg: "var(--type-support-bg)"        },
  EXPLANATION:    { dot: "var(--type-explanation-dot)",    text: "var(--type-explanation-text)",    bg: "var(--type-explanation-bg)"    },
  IMPLEMENTATION: { dot: "var(--type-implementation-dot)", text: "var(--type-implementation-text)", bg: "var(--type-implementation-bg)" },
};

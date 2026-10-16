/**
 * Minimal, i18n-ready string table.
 *
 * English is the only locale for now. All user-facing copy goes through `t()`
 * so a locale dictionary (and RTL layout) can be added later without touching
 * components. Placeholders use `{name}` syntax.
 */

const en = {
  appName: "Omivoid",
  tagline: "Local-first tasks — stored only on this device.",
  addTaskPlaceholder: "What needs to be done?",
  addTaskButton: "Add",
  taskTitleLabel: "Task title",
  emptyState: "No tasks yet. Add your first one above.",
  loadingTasks: "Loading tasks…",
  summaryTasks: "{total} tasks · {done} done",
  markComplete: "Mark “{title}” as complete",
  markIncomplete: "Mark “{title}” as incomplete",
  deleteTask: "Delete “{title}”",
  errorGeneric: "Something went wrong. Please try again.",
  errorEmptyTitle: "Please enter a task title.",
  viewInbox: "Inbox",
  viewToday: "Today",
  viewUpcoming: "Upcoming",
  viewOverdue: "Overdue",
  viewCompleted: "Completed",
  viewImportant: "Important",
  viewTrash: "Trash",
  projects: "Projects",
  noProjects: "No projects yet.",
  newProjectPlaceholder: "Project name",
  addProject: "Add project",
  addProjectAria: "Create project “{name}”",
  tags: "Tags",
  noTags: "No tags yet.",
  newTagPlaceholder: "Tag name",
  addTag: "Add tag",
  filterByTag: "Filter by tag “{name}”",
  clearTagFilter: "Clear tag filter",
  deleteTagAria: "Delete tag “{name}”",
  emptyViewInbox: "Inbox is clear. Enjoy the calm.",
  emptyViewToday: "Nothing due today.",
  emptyViewUpcoming: "Nothing coming up.",
  emptyViewOverdue: "Nothing overdue.",
  emptyViewCompleted: "Nothing completed yet.",
  emptyViewImportant: "No important tasks.",
  emptyViewTrash: "Trash is empty.",
  editTask: "Edit “{title}”",
  addSubtask: "Add subtask",
  expandSubtasks: "Show subtasks of “{title}”",
  collapseSubtasks: "Hide subtasks of “{title}”",
  restoreTask: "Restore “{title}”",
  deleteForever: "Permanently delete “{title}”",
  priorityLabel: "Priority",
  priorityNone: "No priority",
  priorityLow: "Low",
  priorityMedium: "Medium",
  priorityHigh: "High",
  dueLabel: "Due date",
  duePlaceholder: "No due date",
  projectLabel: "Project",
  projectInbox: "Inbox",
  optionalFields: "Show optional fields",
  hideOptionalFields: "Hide optional fields",
  statusLabel: "Status",
  statusTodo: "To do",
  statusInProgress: "In progress",
  statusDone: "Done",
  save: "Save",
  cancel: "Cancel",
  closeDialog: "Close",
  titleRequired: "A title is required.",
  subtaskTitleLabel: "Subtask title",
} as const;

export type MessageKey = keyof typeof en;

export function t(
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  let value: string = en[key];
  if (params) {
    for (const [name, replacement] of Object.entries(params)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
  }
  return value;
}

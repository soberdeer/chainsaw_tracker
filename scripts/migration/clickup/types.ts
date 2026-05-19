// Migration-only ClickUp response types for scripts/seed-openproject-from-clickup.ts.
// Runtime task data comes from OpenProject.
export type ClickUpTeam = {
  id: string;
  name: string;
  color?: string;
  avatar?: string;
  members?: Array<{ user: ClickUpUser }>;
};

export type ClickUpUser = {
  id: number | string;
  username?: string;
  email?: string;
  color?: string;
  profilePicture?: string;
};

export type ClickUpSpace = {
  id: string;
  name: string;
  private?: boolean;
  color?: string;
  statuses?: ClickUpStatus[];
};

export type ClickUpFolder = {
  id: string;
  name: string;
  hidden?: boolean;
  lists?: ClickUpList[];
  statuses?: ClickUpStatus[];
};

export type ClickUpList = {
  id: string;
  name: string;
  content?: string;
  status?: unknown;
  priority?: unknown;
  assignee?: unknown;
  task_count?: number;
  statuses?: ClickUpStatus[];
};

export type ClickUpStatus = {
  id?: string;
  status: string;
  color?: string;
  orderindex?: number;
  type?: string;
};

export type ClickUpPriority = {
  id?: string | number;
  priority?: string;
  color?: string;
};

export type ClickUpTag = {
  name: string;
  tag_fg?: string;
  tag_bg?: string;
};

export type ClickUpTask = {
  id: string;
  custom_id?: string | null;
  name: string;
  text_content?: string | null;
  description?: string | null;
  markdown_description?: string | null;
  status?: ClickUpStatus;
  priority?: ClickUpPriority | null;
  assignees?: ClickUpUser[];
  tags?: ClickUpTag[];
  url?: string;
  list?: { id: string; name?: string };
  folder?: { id: string; name?: string };
  space?: { id: string; name?: string };
  parent?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
  due_date?: string | null;
  start_date?: string | null;
  subtasks?: ClickUpTask[];
  dependencies?: unknown[];
  linked_tasks?: unknown[];
  checklists?: unknown[];
};

export type ClickUpComment = {
  id: string;
  comment_text?: string;
  date?: string;
  user?: ClickUpUser;
};

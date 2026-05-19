export type HalLink = {
  href: string | null;
  title?: string | null;
  method?: string;
};

export type HalCollection<T> = {
  total?: number;
  count?: number;
  pageSize?: number;
  offset?: number;
  _embedded?: {
    elements?: T[];
  };
  _links?: Record<string, HalLink>;
};

export type OpenProjectText = {
  format?: string;
  raw?: string;
  html?: string;
};

export type OpenProjectProject = {
  id: number;
  identifier: string;
  name: string;
  public?: boolean;
  _links: Record<string, HalLink | HalLink[]>;
};

export type OpenProjectStatus = {
  id: number;
  name: string;
  isClosed?: boolean;
  position?: number;
  _links: Record<string, HalLink>;
};

export type OpenProjectType = {
  id: number;
  name: string;
  _links: Record<string, HalLink>;
};

export type OpenProjectPriority = {
  id: number;
  name: string;
  _links: Record<string, HalLink>;
};

export type OpenProjectUser = {
  id: number;
  name: string;
  login?: string;
  email?: string;
  avatar?: string;
  _links: Record<string, HalLink>;
};

export type OpenProjectWorkPackage = {
  id: number;
  lockVersion: number;
  subject: string;
  description?: OpenProjectText;
  startDate?: string | null;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  _links: Record<string, HalLink>;
};

export type OpenProjectActivity = {
  id: number;
  comment?: OpenProjectText;
  details?: OpenProjectText[];
  createdAt: string;
  _links: Record<string, HalLink>;
};

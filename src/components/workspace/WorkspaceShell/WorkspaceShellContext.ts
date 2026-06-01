import { createContext, useContext } from 'react';
import type { CurrentUser } from '@/lib';
import type { useWorkspaceShellState } from './hooks/useWorkspaceShellState';

export type WorkspaceShellContextValue = ReturnType<typeof useWorkspaceShellState> & {
  currentUser: CurrentUser;
  onCurrentUserChange: (user: CurrentUser | null) => void;
};

const WorkspaceShellContext = createContext<WorkspaceShellContextValue | null>(null);

export const WorkspaceShellProvider = WorkspaceShellContext.Provider;

export function useWorkspaceShellContext() {
  const context = useContext(WorkspaceShellContext);
  if (!context) {
    throw new Error('useWorkspaceShellContext must be used inside WorkspaceShellProvider');
  }
  return context;
}

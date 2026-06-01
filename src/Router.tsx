import { Navigate, Route, Routes } from 'react-router-dom';
import { FirstRunSetupPage } from './components/auth/FirstRunSetupPage/FirstRunSetupPage';
import { LoginPage } from './components/auth/LoginPage/LoginPage';
import { AcceptInvitePage } from './components/team/AcceptInvitePage/AcceptInvitePage';
import { WorkspaceShell } from './components/workspace/WorkspaceShell/WorkspaceShell';
import { WorkspaceShellContent } from './components/workspace/WorkspaceShell/WorkspaceShellContent';
import type { AuthSetupStatus, CurrentUser } from './lib';

export interface AppRouterProps {
  user: CurrentUser | null;
  setupStatus: AuthSetupStatus | null;
  onCurrentUserChange: (user: CurrentUser | null) => void;
  onSetupCompleted: (user: CurrentUser) => void;
}

export function AppRouter({
  user,
  setupStatus,
  onCurrentUserChange,
  onSetupCompleted,
}: AppRouterProps) {
  const workspaceElement = user ? (
    <WorkspaceShell currentUser={user} onCurrentUserChange={onCurrentUserChange} />
  ) : setupStatus?.setupRequired ? (
    <FirstRunSetupPage status={setupStatus} onCreated={onSetupCompleted} />
  ) : (
    <LoginPage onLoggedIn={onCurrentUserChange} />
  );

  return (
    <Routes>
      <Route
        path="/accept-invite/:token"
        element={<AcceptInvitePage onAccepted={onCurrentUserChange} />}
      />
      <Route element={workspaceElement}>
        <Route index element={<WorkspaceShellContent />} />
        <Route path="tasks" element={<WorkspaceShellContent />} />
        <Route path="my-tasks" element={<WorkspaceShellContent />} />
        <Route path="space/:spaceId" element={<WorkspaceShellContent />} />
        <Route path="space/:spaceId/docs" element={<WorkspaceShellContent />} />
        <Route path="space/:spaceId/docs/:docId" element={<WorkspaceShellContent />} />
        <Route path="space/:spaceId/folder/:folderId" element={<WorkspaceShellContent />} />
        <Route
          path="space/:spaceId/folder/:folderId/task/:taskId"
          element={<WorkspaceShellContent />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

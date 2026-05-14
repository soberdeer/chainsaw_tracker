import { WorkspaceShell } from './components/workspace/WorkspaceShell/WorkspaceShell';
import { Route, Routes } from 'react-router-dom';
import { AcceptInvitePage } from './components/team/AcceptInvitePage/AcceptInvitePage';

export default function App() {
  return (
    <Routes>
      <Route path="/accept-invite/:token" element={<AcceptInvitePage />} />
      <Route path="*" element={<WorkspaceShell />} />
    </Routes>
  );
}

import { Loader } from '@mantine/core';
import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LoginPage } from './components/auth/LoginPage/LoginPage';
import { AcceptInvitePage } from './components/team/AcceptInvitePage/AcceptInvitePage';
import { WorkspaceShell } from './components/workspace/WorkspaceShell/WorkspaceShell';
import { getCurrentUser, type CurrentUser } from './lib';

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Loader m="xl" />;
  }

  if (!user) {
    return <LoginPage onLoggedIn={setUser} />;
  }

  return (
    <Routes>
      <Route path="/accept-invite/:token" element={<AcceptInvitePage />} />
      <Route
        path="*"
        element={<WorkspaceShell currentUser={user} onCurrentUserChange={setUser} />}
      />
    </Routes>
  );
}

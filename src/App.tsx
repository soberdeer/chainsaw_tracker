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

  return (
    <Routes>
      <Route path="/accept-invite/:token" element={<AcceptInvitePage onAccepted={setUser} />} />
      <Route
        path="*"
        element={
          user ? (
            <WorkspaceShell currentUser={user} onCurrentUserChange={setUser} />
          ) : (
            <LoginPage onLoggedIn={setUser} />
          )
        }
      />
    </Routes>
  );
}

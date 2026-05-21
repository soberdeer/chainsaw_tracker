import { Loader } from '@mantine/core';
import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { FirstRunSetupPage } from './components/auth/FirstRunSetupPage/FirstRunSetupPage';
import { LoginPage } from './components/auth/LoginPage/LoginPage';
import { AcceptInvitePage } from './components/team/AcceptInvitePage/AcceptInvitePage';
import { WorkspaceShell } from './components/workspace/WorkspaceShell/WorkspaceShell';
import { getCurrentUser, getSetupStatus, type AuthSetupStatus, type CurrentUser } from './lib';

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [setupStatus, setSetupStatus] = useState<AuthSetupStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const current = await getCurrentUser();
        if (!cancelled) {
          setUser(current);
          setSetupStatus(null);
        }
      } catch {
        if (cancelled) return;
        setUser(null);
        try {
          setSetupStatus(await getSetupStatus());
        } catch {
          setSetupStatus(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
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
          ) : setupStatus?.setupRequired ? (
            <FirstRunSetupPage
              status={setupStatus}
              onCreated={(createdUser) => {
                setUser(createdUser);
                setSetupStatus((current) =>
                  current ? { ...current, setupRequired: false, ownerCount: 1 } : current
                );
              }}
            />
          ) : (
            <LoginPage onLoggedIn={setUser} />
          )
        }
      />
    </Routes>
  );
}

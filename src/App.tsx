import { Loader } from '@mantine/core';
import { useEffect, useState } from 'react';
import { getCurrentUser, getSetupStatus, type AuthSetupStatus, type CurrentUser } from './lib';
import { AppRouter } from './Router';

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
    <AppRouter
      user={user}
      setupStatus={setupStatus}
      onCurrentUserChange={setUser}
      onSetupCompleted={(createdUser) => {
        setUser(createdUser);
        setSetupStatus((current) =>
          current ? { ...current, setupRequired: false, ownerCount: 1 } : current
        );
      }}
    />
  );
}

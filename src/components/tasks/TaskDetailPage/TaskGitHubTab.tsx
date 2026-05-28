import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconExternalLink, IconGitPullRequest, IconRefresh } from '@tabler/icons-react';
import { useState } from 'react';
import {
  getErrorMessage,
  getTask,
  linkTaskPullRequest,
  refreshTaskGitHub,
  unlinkTaskPullRequest,
  type GitHubRepository,
  type Task,
} from '@/lib';
import classes from './TaskDetailPage.module.css';

interface TaskGitHubTabProps {
  task: Task;
  repositories: GitHubRepository[];
  canWriteTasks: boolean;
  onSaved: (task: Task) => void;
  onError: (msg: string) => void;
}

export function TaskGitHubTab({
  task,
  repositories,
  canWriteTasks,
  onSaved,
  onError,
}: TaskGitHubTabProps) {
  const [busy, setBusy] = useState(false);
  const form = useForm({
    initialValues: {
      selectedRepositoryId: repositories[0]?.id || '',
      manualPr: '',
    },
  });

  const linkPr = async () => {
    try {
      setBusy(true);
      const trimmedPr = form.values.manualPr.trim();
      const number = /^\d+$/.test(trimmedPr) ? Number(trimmedPr) : undefined;
      await linkTaskPullRequest(task.id, {
        repositoryId: form.values.selectedRepositoryId,
        number,
        url: number ? undefined : trimmedPr,
      });
      form.setFieldValue('manualPr', '');
      onSaved(await getTask(task.id));
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const unlinkPr = async (prId: string) => {
    try {
      await unlinkTaskPullRequest(task.id, prId);
      onSaved(await getTask(task.id));
    } catch (error) {
      onError(getErrorMessage(error));
    }
  };

  const refreshGitHub = async () => {
    try {
      setBusy(true);
      await refreshTaskGitHub(task.id);
      onSaved(await getTask(task.id));
    } catch (error) {
      onError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper withBorder className={classes.relationshipPanel}>
      <Group justify="space-between" mb="md">
        <Title order={3}>GitHub</Title>
        <Tooltip label={`Development status: ${task.developmentStatus || 'NOT_STARTED'}`}>
          <Badge variant="light">{task.developmentStatus || 'NOT_STARTED'}</Badge>
        </Tooltip>
      </Group>
      <Stack>
        {(task.githubBranches || []).map((branch) => (
          <Group key={branch.id} justify="space-between" className={classes.relationshipRow}>
            <Group gap="xs">
              <Tooltip label="GitHub branch">
                <IconGitPullRequest size="1rem" />
              </Tooltip>
              <Text fw={700}>{branch.name}</Text>
            </Group>
            {branch.url && (
              <Button
                size="xs"
                variant="subtle"
                component="a"
                href={branch.url}
                target="_blank"
                leftSection={<IconExternalLink size="0.875rem" />}
              >
                Open
              </Button>
            )}
          </Group>
        ))}

        {(task.githubPullRequests || []).map((pr) => (
          <Paper key={pr.id} withBorder p="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={2}>
                <Text fw={800}>
                  #{pr.number} {pr.title}
                </Text>
                <Text size="sm" c="dimmed">
                  {pr.repository?.owner}/{pr.repository?.repo} • {pr.headBranch} → {pr.baseBranch}
                </Text>
                <Group gap="xs">
                  <Tooltip label={`PR state: ${pr.state}`}>
                    <Badge>{pr.state}</Badge>
                  </Tooltip>
                  <Tooltip label={`PR readiness: ${pr.draft ? 'Draft' : 'Ready'}`}>
                    <Badge color={pr.draft ? 'gray' : 'green'}>
                      {pr.draft ? 'Draft' : 'Ready'}
                    </Badge>
                  </Tooltip>
                  <Tooltip label={`Review status: ${pr.reviewStatus}`}>
                    <Badge
                      color={
                        pr.reviewStatus === 'CHANGES_REQUESTED'
                          ? 'red'
                          : pr.reviewStatus === 'APPROVED'
                            ? 'green'
                            : 'blue'
                      }
                    >
                      {pr.reviewStatus}
                    </Badge>
                  </Tooltip>
                  {pr.authorLogin && (
                    <Tooltip label={`Author: ${pr.authorLogin}`}>
                      <Badge variant="light">{pr.authorLogin}</Badge>
                    </Tooltip>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  Last sync: {pr.syncedAt ? new Date(pr.syncedAt).toLocaleString() : '-'}
                </Text>
              </Stack>
              <Group gap="xs">
                <Button
                  size="xs"
                  variant="subtle"
                  component="a"
                  href={pr.url}
                  target="_blank"
                  leftSection={<IconExternalLink size="0.875rem" />}
                >
                  Open
                </Button>
                <Button size="xs" variant="subtle" color="red" onClick={() => void unlinkPr(pr.id)}>
                  Unlink
                </Button>
              </Group>
            </Group>
          </Paper>
        ))}

        {!task.githubPullRequests?.length && !task.githubBranches?.length && (
          <Text c="dimmed">
            No linked GitHub branch or PR yet. Link a synced pull request or let the GitHub webhook
            match this work package by task key.
          </Text>
        )}

        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Select
            data-testid="github-repository-select"
            label="Repository"
            value={form.values.selectedRepositoryId}
            onChange={(value) => form.setFieldValue('selectedRepositoryId', value || '')}
            data={repositories.map((repo) => ({
              value: repo.id,
              label: `${repo.owner}/${repo.repo}`,
            }))}
            placeholder="Add repository in API first"
          />
          <TextInput
            data-testid="github-manual-pr-input"
            label="PR URL or number"
            {...form.getInputProps('manualPr')}
            placeholder="https://github.com/.../pull/12"
          />
          <Stack justify="flex-end">
            <Group gap="xs">
              <Button
                data-testid="github-link-pr-submit"
                leftSection={<IconGitPullRequest size="1rem" />}
                disabled={
                  !canWriteTasks ||
                  !form.values.selectedRepositoryId ||
                  !form.values.manualPr.trim()
                }
                loading={busy}
                onClick={() => void linkPr()}
              >
                Link PR
              </Button>
              <Tooltip label="Refresh GitHub status">
                <ActionIcon
                  data-testid="github-refresh-button"
                  variant="light"
                  aria-label="Refresh GitHub status"
                  loading={busy}
                  onClick={() => void refreshGitHub()}
                >
                  <IconRefresh size="1rem" />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Stack>
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}

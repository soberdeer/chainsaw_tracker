import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect, useMemo, useState } from 'react';
import { createSpace, getErrorMessage, type Space, type Workspace } from '@/lib';
import classes from './SpaceCreateModal.module.css';

export interface SpaceCreateModalProps {
  opened: boolean;
  workspace: Workspace;
  onClose: () => void;
  onCreated: () => void;
}

export function SpaceCreateModal({ opened, workspace, onClose, onCreated }: SpaceCreateModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const form = useForm({
    initialValues: {
      name: '',
      identifier: '',
      description: '',
      parentId: null as string | null,
      isPublic: false,
    },
    validate: {
      name: (value) => (value.trim().length ? null : 'Name is required'),
    },
  });

  useEffect(() => {
    if (!opened) return;
    form.reset();
    setError(null);
  }, [opened, form]);

  const projectOptions = useMemo(() => flattenSpaces(workspace.spaces), [workspace.spaces]);

  const submit = form.onSubmit(async (values) => {
    try {
      setSaving(true);
      setError(null);
      await createSpace({
        workspaceId: workspace.id,
        name: values.name,
        identifier: values.identifier || undefined,
        description: values.description || undefined,
        parentId: values.parentId || undefined,
        public: values.isPublic,
      });
      onCreated();
      onClose();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  });

  return (
    <Modal opened={opened} onClose={onClose} title="New OpenProject project" centered>
      <form onSubmit={submit}>
        <Stack>
          {error && (
            <Alert color="red" title="Could not create project">
              {error}
            </Alert>
          )}
          <TextInput label="Name" {...form.getInputProps('name')} />
          <TextInput
            label="Identifier"
            placeholder="auto-generated if empty"
            {...form.getInputProps('identifier')}
          />
          <Select
            label="Parent project"
            data={projectOptions}
            clearable
            searchable
            placeholder="Top-level project"
            {...form.getInputProps('parentId')}
          />
          <Textarea
            label="Description"
            autosize
            minRows={3}
            {...form.getInputProps('description')}
          />
          <Switch
            className={classes.publicSwitch}
            label="Public project"
            {...form.getInputProps('isPublic', { type: 'checkbox' })}
          />
          <Group className={classes.actions} justify="flex-end">
            <Button type="button" variant="light" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={saving} type="submit">
              Create project
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function flattenSpaces(spaces: Space[]) {
  return spaces.flatMap((space) => [
    { value: space.id, label: space.name },
    ...flattenFolders(space.folders || [], space.name),
  ]);
}

function flattenFolders(
  folders: Space['folders'],
  prefix: string
): Array<{ value: string; label: string }> {
  return folders.flatMap((folder) => {
    const projectList = folder.taskLists?.[0];
    const own = projectList ? [{ value: projectList.id, label: `${prefix} / ${folder.name}` }] : [];
    return [...own, ...flattenFolders(folder.folders || [], `${prefix} / ${folder.name}`)];
  });
}

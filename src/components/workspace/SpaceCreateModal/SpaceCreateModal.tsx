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
import { useEffect, useMemo, useRef, useState } from 'react';
import { createSpace, getErrorMessage, type Space, type Workspace } from '@/lib';
import classes from './SpaceCreateModal.module.css';

export interface SpaceCreateModalProps {
  opened: boolean;
  workspace: Workspace;
  /** When set, the modal opens pre-filled as a sub-project of this parent. */
  initialParentId?: string;
  onClose: () => void;
  onCreated: () => void;
}

export function SpaceCreateModal({
  opened,
  workspace,
  initialParentId,
  onClose,
  onCreated,
}: SpaceCreateModalProps) {
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
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    if (!opened) return;
    formRef.current.reset();
    if (initialParentId) {
      formRef.current.setFieldValue('parentId', initialParentId);
    }
    setError(null);
  }, [opened, initialParentId]);

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
    <Modal
      opened={opened}
      onClose={onClose}
      title={initialParentId ? 'New sub-project' : 'New OpenProject project'}
      centered
    >
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
  const items = spaces.flatMap((space) => [
    { value: space.id, label: space.name },
    ...flattenFolders(space.folders || [], space.name),
  ]);
  // Deduplicate by value — space IDs and task-list IDs share the same
  // OpenProject project ID namespace and can collide, which Mantine forbids.
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  });
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

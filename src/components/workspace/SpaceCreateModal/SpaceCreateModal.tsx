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
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setName('');
    setIdentifier('');
    setDescription('');
    setParentId(null);
    setIsPublic(false);
    setError(null);
  }, [opened]);

  const projectOptions = useMemo(() => flattenSpaces(workspace.spaces), [workspace.spaces]);

  const submit = async () => {
    try {
      setSaving(true);
      setError(null);
      await createSpace({
        workspaceId: workspace.id,
        name,
        identifier: identifier || undefined,
        description: description || undefined,
        parentId: parentId || undefined,
        public: isPublic,
      });
      onCreated();
      onClose();
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New OpenProject project" centered>
      <Stack>
        {error && (
          <Alert color="red" title="Could not create project">
            {error}
          </Alert>
        )}
        <TextInput label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <TextInput
          label="Identifier"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="auto-generated if empty"
        />
        <Select
          label="Parent project"
          value={parentId}
          onChange={setParentId}
          data={projectOptions}
          clearable
          searchable
          placeholder="Top-level project"
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          autosize
          minRows={3}
        />
        <Switch
          className={classes.publicSwitch}
          label="Public project"
          checked={isPublic}
          onChange={(event) => setIsPublic(event.currentTarget.checked)}
        />
        <Group className={classes.actions} justify="flex-end">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} disabled={!name.trim()} onClick={submit}>
            Create project
          </Button>
        </Group>
      </Stack>
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

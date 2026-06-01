import { Box, Button, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createMarkdownDoc, docPath, getErrorMessage, type DocumentItem } from '@/lib';
import { DocCard } from './DocCard';

export interface DocumentsPanelProps {
  documents: DocumentItem[];
  loading?: boolean;
  folderId: string;
  spaceId: string;
  onChanged: () => void;
  onError: (message: string) => void;
  canEdit?: boolean;
}

export function DocumentsPanel({
  documents,
  loading = false,
  folderId,
  spaceId,
  onChanged,
  onError,
  canEdit = false,
}: DocumentsPanelProps) {
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreate = () => {
    setCreating(true);
    createMarkdownDoc({ folderId, spaceId, title: 'New doc', markdown: `# New doc\n` })
      .then((doc: DocumentItem) => {
        onChanged();
        navigate(docPath(spaceId, doc.id));
      })
      .catch((error) => onError(getErrorMessage(error)))
      .finally(() => setCreating(false));
  };

  return (
    <Stack gap="md" data-testid="docs-panel">
      <Group justify="space-between" align="flex-end">
        <Box>
          <Title order={3}>Docs</Title>
        </Box>
        {canEdit && (
          <Button leftSection={<IconPlus size="1rem" />} onClick={handleCreate} loading={creating}>
            New doc
          </Button>
        )}
      </Group>

      {loading ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
        </Group>
      ) : documents.length === 0 ? (
        <Text c="dimmed" size="sm">
          No documents yet.{canEdit ? ' Click "New doc" to create the first one.' : ''}
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
          {documents.map((doc) => (
            <DocCard
              key={doc.id}
              doc={doc}
              spaceId={spaceId}
              canEdit={canEdit}
              onChanged={onChanged}
              onError={onError}
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

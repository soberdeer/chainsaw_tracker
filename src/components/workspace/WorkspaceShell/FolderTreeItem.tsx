import { Badge, Box, Tooltip, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconFolder } from '@tabler/icons-react';
import { firstTaskList, type Folder } from '@/lib';
import classes from './WorkspaceShell.module.css';

interface FolderTreeItemProps {
  spaceId: string;
  folder: Folder;
  depth?: number;
  activeFolder: Folder | undefined;
  expandedFolderIds: Set<string>;
  onOpenFolder: (spaceId: string, folder: Folder) => void;
  onToggleFolder: (id: string) => void;
}

export function FolderTreeItem({
  spaceId,
  folder,
  depth = 0,
  activeFolder,
  expandedFolderIds,
  onOpenFolder,
  onToggleFolder,
}: FolderTreeItemProps) {
  const isExpanded = expandedFolderIds.has(folder.id);
  const hasChildren = Boolean(folder.folders?.length);
  const list = firstTaskList(folder);
  const taskCount = list?._count?.tasks ?? list?.tasks?.length ?? 0;
  const isActive = folder.id === activeFolder?.id;

  return (
    <Box>
      <UnstyledButton
        data-testid="folder-row"
        data-folder-id={folder.id}
        className={isActive ? `${classes.folderTreeRow} ${classes.active}` : classes.folderTreeRow}
        style={{ paddingLeft: `${0.5 + depth * 1.1}rem` }}
        onClick={() => {
          if (list) onOpenFolder(spaceId, folder);
          else onToggleFolder(folder.id);
        }}
      >
        <span className={classes.treeCaret}>
          {hasChildren ? (
            isExpanded ? (
              <IconChevronDown size="0.875rem" />
            ) : (
              <IconChevronRight size="0.875rem" />
            )
          ) : (
            <IconFolder size="0.875rem" />
          )}
        </span>
        <span style={{ flex: 1 }}>{folder.name}</span>
        {taskCount > 0 && (
          <Tooltip label={`${taskCount} tasks`}>
            <Badge variant="light" size="xs" style={{ marginRight: 4 }}>
              {taskCount}
            </Badge>
          </Tooltip>
        )}
      </UnstyledButton>
      {isExpanded &&
        folder.folders?.map((child) => (
          <FolderTreeItem
            key={child.id}
            spaceId={spaceId}
            folder={child}
            depth={depth + 1}
            activeFolder={activeFolder}
            expandedFolderIds={expandedFolderIds}
            onOpenFolder={onOpenFolder}
            onToggleFolder={onToggleFolder}
          />
        ))}
    </Box>
  );
}

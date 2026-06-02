import { Badge, Box, Tooltip, UnstyledButton } from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconFolder,
  IconFileDescription,
} from '@tabler/icons-react';
import { firstTaskList, type Folder } from '@/lib';
import { useWorkspaceShellContext } from './WorkspaceShellContext';
import classes from './WorkspaceShell.module.css';

interface FolderTreeItemProps {
  spaceId: string;
  folder: Folder;
  depth?: number;
}

export function FolderTreeItem({ spaceId, folder, depth = 0 }: FolderTreeItemProps) {
  const state = useWorkspaceShellContext();
  const isExpanded = state.expandedFolderIds.has(folder.id);
  const hasChildren = Boolean(folder.folders?.length);
  const isDocsFolder = folder.kind === 'DOCS';
  const list = firstTaskList(folder);
  const taskCount = list?._count?.tasks ?? list?.tasks?.length ?? 0;
  const isActive = folder.id === state.activeFolder?.id;

  return (
    <Box>
      <UnstyledButton
        data-testid="folder-row"
        data-folder-id={folder.id}
        className={isActive ? `${classes.folderTreeRow} ${classes.active}` : classes.folderTreeRow}
        style={{ paddingLeft: `${0.5 + depth * 1.1}rem` }}
        onClick={() => {
          if (isDocsFolder || list) {
            state.openFolder(spaceId, folder);
            state.closeMobileNav();
          } else state.toggleFolder(folder.id);
        }}
      >
        <span className={classes.treeCaret}>
          {isDocsFolder ? (
            <IconFileDescription size="0.875rem" />
          ) : hasChildren ? (
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
        {!isDocsFolder && taskCount > 0 && (
          <Tooltip label={`${taskCount} tasks`}>
            <Badge variant="light" size="xs" style={{ marginRight: 4 }}>
              {taskCount}
            </Badge>
          </Tooltip>
        )}
      </UnstyledButton>
      {!isDocsFolder &&
        isExpanded &&
        folder.folders?.map((child) => (
          <FolderTreeItem key={child.id} spaceId={spaceId} folder={child} depth={depth + 1} />
        ))}
    </Box>
  );
}

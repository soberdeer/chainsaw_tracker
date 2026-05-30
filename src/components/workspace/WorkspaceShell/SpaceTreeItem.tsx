import { ActionIcon, Box, Group, Menu, Tooltip, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconDots, IconPlus } from '@tabler/icons-react';
import { firstTaskFolder, type Folder, type Space } from '@/lib';
import { FolderTreeItem } from './FolderTreeItem';
import classes from './WorkspaceShell.module.css';

interface SpaceTreeItemProps {
  space: Space;
  activeSpace: Space | undefined;
  activeFolder: Folder | undefined;
  expandedSpaceIds: Set<string>;
  expandedFolderIds: Set<string>;
  onToggleSpace: (id: string) => void;
  onOpenFolder: (spaceId: string, folder: Folder) => void;
  onToggleFolder: (id: string) => void;
  onOpenProjectAccess: () => void;
}

export function SpaceTreeItem({
  space,
  activeSpace,
  activeFolder,
  expandedSpaceIds,
  expandedFolderIds,
  onToggleSpace,
  onOpenFolder,
  onToggleFolder,
  onOpenProjectAccess,
}: SpaceTreeItemProps) {
  const isActiveSpace = space.id === activeSpace?.id;
  const isExpanded = expandedSpaceIds.has(space.id);

  return (
    <Box className={classes.spaceTreeBlock}>
      <Group wrap="nowrap" gap={0}>
        <UnstyledButton
          data-testid="project-link"
          data-project-id={space.id}
          className={
            isActiveSpace ? `${classes.spaceTreeRow} ${classes.active}` : classes.spaceTreeRow
          }
          onClick={() => {
            onToggleSpace(space.id);
            if (!isActiveSpace) {
              const folder = firstTaskFolder(space) ?? space.folders[0];
              if (folder) onOpenFolder(space.id, folder);
            }
          }}
        >
          <span className={classes.treeCaret}>
            {isExpanded ? (
              <IconChevronDown size="0.875rem" />
            ) : (
              <IconChevronRight size="0.875rem" />
            )}
          </span>
          <span className={classes.spaceInitial} style={{ background: space.color }}>
            {space.initials || space.name.slice(0, 1)}
          </span>
          <span className={classes.spaceName}>{space.name}</span>
        </UnstyledButton>
        {isActiveSpace && (
          <Menu width="22rem" position="right-start">
            <Menu.Target>
              <Tooltip label="Space actions">
                <ActionIcon
                  component="div"
                  variant="subtle"
                  aria-label="Space actions"
                  className={classes.rowAction}
                >
                  <IconDots size="1.125rem" />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown
              className={classes.menuDropdown}
              onClick={(event) => event.stopPropagation()}
            >
              <Menu.Item disabled>Rename in OpenProject project settings</Menu.Item>
              <Menu.Item onClick={onOpenProjectAccess}>OpenProject access</Menu.Item>
              <Menu.Item
                onClick={() =>
                  navigator.clipboard?.writeText(`${window.location.origin}/space/${space.id}`)
                }
              >
                Copy link
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Create new</Menu.Label>
              <Menu.Item disabled>Folders are not available in OpenProject</Menu.Item>
              <Menu.Item disabled>Lists are not available in OpenProject</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
        {isActiveSpace && (
          <Tooltip label="OpenProject projects do not have folders">
            <ActionIcon
              variant="subtle"
              aria-label="Folders are not available in OpenProject"
              className={classes.rowAction}
              disabled
            >
              <IconPlus size="1.125rem" />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      {isExpanded && (
        <Box className={classes.folderTree}>
          {space.folders.map((folder) => (
            <FolderTreeItem
              key={folder.id}
              spaceId={space.id}
              folder={folder}
              activeFolder={activeFolder}
              expandedFolderIds={expandedFolderIds}
              onOpenFolder={onOpenFolder}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

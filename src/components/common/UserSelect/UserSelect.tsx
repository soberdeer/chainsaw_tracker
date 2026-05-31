import {
  ActionIcon,
  Combobox,
  Group,
  Loader,
  Pill,
  PillsInput,
  ScrollArea,
  Text,
  useCombobox,
} from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/common/UserAvatar';
import type { User } from '@/lib';

export interface UserSelectProps {
  users: User[];
  loading?: boolean;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  maxValues?: number;
  label?: string;
  placeholder?: string;
  'data-testid'?: string;
}

export function UserSelect({
  users,
  loading = false,
  value,
  onChange,
  disabled = false,
  maxValues,
  label,
  placeholder = 'Assignee / responsible',
  'data-testid': testId,
}: UserSelectProps) {
  const [search, setSearch] = useState('');
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      setSearch('');
    },
  });

  const isMaxReached = maxValues !== undefined && value.length >= maxValues;

  const selectedUsers = value
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is User => Boolean(u));

  const filteredUsers = users.filter(
    (u) => !value.includes(u.id) && u.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  const handleSelect = (userId: string) => {
    if (isMaxReached) return;
    onChange([...value, userId]);
    setSearch('');
  };

  const handleRemove = (userId: string) => {
    onChange(value.filter((id) => id !== userId));
  };

  const options = filteredUsers.map((user) => (
    <Combobox.Option value={user.id} key={user.id}>
      <Group gap="sm" wrap="nowrap">
        <UserAvatar
          user={user}
          withTooltip
          style={{ border: `1.2px solid var(--mantine-color-placeholder)` }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" truncate>
            {user.name.replace('ㅤ', '')}
          </Text>
          {user.email && (
            <Text size="xs" c="dimmed" truncate>
              {user.email}
            </Text>
          )}
        </div>
      </Group>
    </Combobox.Option>
  ));

  return (
    <Combobox store={combobox} onOptionSubmit={handleSelect} withinPortal>
      <Combobox.DropdownTarget>
        <PillsInput
          label={label}
          disabled={disabled}
          data-testid={testId}
          onClick={() => !disabled && combobox.openDropdown()}
          rightSection={loading ? <Loader size="xs" /> : null}
        >
          <Pill.Group>
            {selectedUsers.map((user) => (
              <Pill
                key={user.id}
                styles={{
                  root: { position: 'relative', background: 'none' },
                  label: { display: 'flex', alignItems: 'center', gap: 4 },
                }}
              >
                <ActionIcon
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 5,
                    zIndex: 2,
                    border: `1.2px solid var(--mantine-color-placeholder)`,
                  }}
                  size={12}
                  onClick={() => handleRemove(user.id)}
                  color="gray"
                >
                  <IconX size={7} />
                </ActionIcon>
                <UserAvatar
                  user={user}
                  withTooltip
                  size={22}
                  style={{ border: `1.2px solid var(--mantine-color-placeholder)` }}
                />
              </Pill>
            ))}
            <Combobox.EventsTarget>
              <PillsInput.Field
                placeholder={selectedUsers.length === 0 ? placeholder : undefined}
                value={search}
                onChange={(e) => {
                  setSearch(e.currentTarget.value);
                  combobox.openDropdown();
                  combobox.updateSelectedOptionIndex();
                }}
                onFocus={() => combobox.openDropdown()}
                onBlur={() => combobox.closeDropdown()}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && search.length === 0 && value.length > 0) {
                    handleRemove(value[value.length - 1]);
                  }
                }}
                disabled={disabled}
              />
            </Combobox.EventsTarget>
          </Pill.Group>
        </PillsInput>
      </Combobox.DropdownTarget>

      <Combobox.Dropdown>
        <Combobox.Options>
          <ScrollArea.Autosize mah={220} type="scroll">
            {loading ? (
              <Combobox.Empty>Loading…</Combobox.Empty>
            ) : options.length > 0 ? (
              options
            ) : (
              <Combobox.Empty>No users found</Combobox.Empty>
            )}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}

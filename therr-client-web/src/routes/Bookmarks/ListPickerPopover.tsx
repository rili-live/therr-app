import React, {
    useCallback, useEffect, useMemo, useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ContentActions } from 'therr-react/redux/actions';
import {
    Button,
    Checkbox,
    Divider,
    Group,
    Popover,
    ScrollArea,
    Stack,
    Text,
    TextInput,
} from '@mantine/core';
import useTranslation from '../../hooks/useTranslation';

interface IListPickerPopoverProps {
    spaceId: string;
    // Rendered trigger (e.g. bookmark icon). The popover opens on click.
    children: React.ReactElement;
    // Optional callback after any change
    onChange?: () => void;
}

// A small popover that lets the user toggle a space in/out of their lists.
// Multi-select (a space can be in multiple lists, Google Maps-style).
// forwardRef so wrapping parents (e.g. Mantine `Tooltip`) can attach a ref
// to the trigger element without triggering React's function-component-ref warning.
const ListPickerPopover = React.forwardRef<HTMLElement, IListPickerPopoverProps>(({ spaceId, children, onChange }, forwardedRef) => {
    const { t: translate } = useTranslation();
    const dispatch = useDispatch();
    const userLists = useSelector((state: any) => state.content?.userLists || []);
    const [opened, setOpened] = useState(false);
    const [memberListIds, setMemberListIds] = useState<Set<string>>(new Set());
    const [isCreating, setIsCreating] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [pendingListId, setPendingListId] = useState<string | null>(null);

    const loadInitial = useCallback(async () => {
        // Make sure the user's lists are loaded
        if (!userLists.length) {
            try { await dispatch(ContentActions.fetchUserLists(false) as any); } catch (_e) { /* noop */ }
        }
        try {
            const data: any = await dispatch(ContentActions.getListsForSpace(spaceId) as any);
            const ids: Set<string> = new Set((data?.lists || []).map((l: any) => l.id));
            setMemberListIds(ids);
        } catch (_e) {
            // non-fatal
        }
    }, [dispatch, spaceId, userLists.length]);

    useEffect(() => {
        if (opened) loadInitial();
    }, [opened, loadInitial]);

    const handleToggle = useCallback(async (listId: string, nextChecked: boolean) => {
        setPendingListId(listId);
        try {
            if (nextChecked) {
                await dispatch(ContentActions.addSpaceToList(listId, spaceId) as any);
                setMemberListIds((prev) => {
                    const copy = new Set(prev);
                    copy.add(listId);
                    return copy;
                });
            } else {
                await dispatch(ContentActions.removeSpaceFromList(listId, spaceId) as any);
                setMemberListIds((prev) => {
                    const copy = new Set(prev);
                    copy.delete(listId);
                    return copy;
                });
            }
            if (onChange) onChange();
        } catch (_e) {
            // non-fatal
        } finally {
            setPendingListId(null);
        }
    }, [dispatch, spaceId, onChange]);

    const handleCreate = useCallback(async () => {
        const name = newListName.trim();
        if (!name) return;
        try {
            const created: any = await dispatch(ContentActions.createUserList({ name }) as any);
            if (created?.id) {
                await handleToggle(created.id, true);
            }
            setNewListName('');
            setIsCreating(false);
        } catch (_e) {
            // non-fatal
        }
    }, [newListName, dispatch, handleToggle]);

    const sortedLists = useMemo(() => {
        const copy = [...userLists];
        copy.sort((a: any, b: any) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return String(a.name).localeCompare(String(b.name));
        });
        return copy;
    }, [userLists]);

    // The trigger is whatever the caller passed in. We clone it to inject onClick
    // and forward any external ref (e.g. from a wrapping Mantine Tooltip) onto
    // the cloned child so positioning and hover behavior work correctly.
    const trigger = React.cloneElement(children, {
        ref: forwardedRef,
        onClick: (e: any) => {
            if (children.props.onClick) children.props.onClick(e);
            setOpened((o) => !o);
        },
    });

    return (
        <Popover
            opened={opened}
            onChange={setOpened}
            position="bottom-end"
            width={280}
            withArrow
            shadow="md"
        >
            <Popover.Target>{trigger}</Popover.Target>
            <Popover.Dropdown p="sm">
                <Text fw={600} size="sm" mb="xs">
                    {translate('pages.bookmarks.lists.addToList')}
                </Text>
                <ScrollArea.Autosize mah={260} type="auto">
                    <Stack gap="xs">
                        {sortedLists.length === 0 && (
                            <Text size="sm" c="dimmed">
                                {translate('pages.bookmarks.lists.noListsYet')}
                            </Text>
                        )}
                        {sortedLists.map((list: any) => (
                            <Checkbox
                                key={list.id}
                                label={list.isDefault
                                    ? `${list.name} (${translate('pages.bookmarks.lists.default')})`
                                    : list.name}
                                checked={memberListIds.has(list.id)}
                                disabled={pendingListId === list.id}
                                onChange={(e) => handleToggle(list.id, e.currentTarget.checked)}
                            />
                        ))}
                    </Stack>
                </ScrollArea.Autosize>

                <Divider my="sm" />

                {!isCreating && (
                    <Button
                        variant="light"
                        size="xs"
                        fullWidth
                        onClick={() => setIsCreating(true)}
                    >
                        {translate('pages.bookmarks.lists.newList')}
                    </Button>
                )}

                {isCreating && (
                    <Stack gap="xs">
                        <TextInput
                            size="xs"
                            placeholder={translate('pages.bookmarks.lists.newListPlaceholder')}
                            value={newListName}
                            onChange={(e) => setNewListName(e.currentTarget.value)}
                            autoFocus
                            maxLength={120}
                        />
                        <Group gap="xs" justify="flex-end">
                            <Button
                                size="xs"
                                variant="subtle"
                                onClick={() => { setIsCreating(false); setNewListName(''); }}
                            >
                                {translate('pages.bookmarks.lists.cancel')}
                            </Button>
                            <Button
                                size="xs"
                                onClick={handleCreate}
                                disabled={!newListName.trim()}
                            >
                                {translate('pages.bookmarks.lists.createList')}
                            </Button>
                        </Group>
                    </Stack>
                )}
            </Popover.Dropdown>
        </Popover>
    );
});

ListPickerPopover.displayName = 'ListPickerPopover';

export default ListPickerPopover;

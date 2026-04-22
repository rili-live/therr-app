import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import ActionSheet, { SheetManager, SheetProps } from 'react-native-actions-sheet';
import { useDispatch, useSelector } from 'react-redux';
import { ContentActions } from 'therr-react/redux/actions';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { Button } from '../BaseButton';
import spacingStyles from '../../styles/layouts/spacing';
import { bottomSafeAreaInset } from '../../styles/navigation/buttonMenu';
import { ITherrThemeColors } from '../../styles/themes';

export type IListPickerSheetPayload = {
    spaceId: string;
    translate: (key: string, params?: any) => string;
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
    onChange?: () => void;
};

const ListPickerSheet = (props: SheetProps<'list-picker-sheet'>) => {
    const payload = props.payload as IListPickerSheetPayload | undefined;
    const dispatch = useDispatch();
    const userLists: any[] = useSelector((state: any) => state.content?.userLists || []);
    const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [pendingId, setPendingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!payload?.spaceId) return;
        setIsLoading(true);
        try {
            if (!userLists.length) {
                await dispatch(ContentActions.fetchUserLists(false) as any);
            }
            const data: any = await dispatch(ContentActions.getListsForSpace(payload.spaceId) as any);
            const ids: Set<string> = new Set((data?.lists || []).map((l: any) => l.id));
            setMemberIds(ids);
        } catch {
            // noop
        } finally {
            setIsLoading(false);
        }
    }, [dispatch, payload?.spaceId, userLists.length]);

    useEffect(() => {
        load();
    }, [load]);

    const handleToggle = useCallback(async (listId: string, nextChecked: boolean) => {
        if (!payload?.spaceId) return;
        setPendingId(listId);
        try {
            if (nextChecked) {
                await dispatch(ContentActions.addSpaceToList(listId, payload.spaceId) as any);
                setMemberIds((prev) => {
                    const copy = new Set(prev);
                    copy.add(listId);
                    return copy;
                });
            } else {
                await dispatch(ContentActions.removeSpaceFromList(listId, payload.spaceId) as any);
                setMemberIds((prev) => {
                    const copy = new Set(prev);
                    copy.delete(listId);
                    return copy;
                });
            }
            if (payload.onChange) payload.onChange();
        } catch {
            // noop
        } finally {
            setPendingId(null);
        }
    }, [dispatch, payload]);

    const handleCreate = useCallback(async () => {
        const name = newName.trim();
        if (!name) return;
        const translateFn = payload?.translate || ((k: string) => k);
        try {
            const created: any = await dispatch(ContentActions.createUserList({ name }) as any);
            if (created?.id) {
                await handleToggle(created.id, true);
            }
            setNewName('');
            setIsCreating(false);
        } catch (err: any) {
            if (__DEV__) {
                // eslint-disable-next-line no-console
                console.warn('[ListPickerSheet] createUserList failed', err?.response?.status, err?.response?.data || err?.message);
            }
            const isConflict = Number(err?.response?.status) === 409;
            Alert.alert(
                translateFn('pages.bookmarks.lists.createFailedTitle'),
                translateFn(isConflict ? 'pages.bookmarks.lists.nameTakenBody' : 'pages.bookmarks.lists.createFailedBody'),
            );
        }
    }, [newName, dispatch, handleToggle, payload?.translate]);

    const translate = payload?.translate || ((k: string) => k);
    const themeStyles = payload?.themeForms?.styles || {};

    const sortedLists = [...userLists].sort((a: any, b: any) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return String(a.name).localeCompare(String(b.name));
    });

    return (
        <ActionSheet id={props.sheetId}>
            <View style={[
                spacingStyles.fullWidth,
                spacingStyles.alignStart,
                spacingStyles.marginTopMd,
                spacingStyles.marginBotLg,
                spacingStyles.padHorizMd,
                { paddingBottom: bottomSafeAreaInset },
            ]}>
                <Text style={localStyles.title}>
                    {translate('pages.bookmarks.lists.addToList')}
                </Text>

                {isLoading && (
                    <ActivityIndicator style={{ marginVertical: 16 }} />
                )}

                {!isLoading && (
                    <FlatList
                        data={sortedLists}
                        keyExtractor={(item) => item.id}
                        style={{ width: '100%', maxHeight: 260 }}
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={() => (
                            <Text style={localStyles.emptyText}>
                                {translate('pages.bookmarks.lists.noListsYet')}
                            </Text>
                        )}
                        renderItem={({ item }) => {
                            const checked = memberIds.has(item.id);
                            const disabled = pendingId === item.id;
                            const label = item.isDefault
                                ? `${item.name} (${translate('pages.bookmarks.lists.default')})`
                                : item.name;
                            return (
                                <Pressable
                                    style={localStyles.row}
                                    disabled={disabled}
                                    onPress={() => handleToggle(item.id, !checked)}
                                    hitSlop={8}
                                >
                                    <MaterialIcon
                                        name={checked ? 'check-box' : 'check-box-outline-blank'}
                                        size={24}
                                        color={checked ? '#26a69a' : '#999'}
                                    />
                                    <Text style={localStyles.rowLabel}>{label}</Text>
                                </Pressable>
                            );
                        }}
                    />
                )}

                <View style={{ height: 12 }} />

                {!isCreating && (
                    <Button
                        containerStyle={spacingStyles.fullWidth}
                        buttonStyle={themeStyles.buttonRound}
                        titleStyle={themeStyles.buttonTitle}
                        title={translate('pages.bookmarks.lists.newList')}
                        onPress={() => setIsCreating(true)}
                        raised={false}
                    />
                )}

                {isCreating && (
                    <View style={spacingStyles.fullWidth}>
                        <TextInput
                            style={localStyles.input}
                            placeholder={translate('pages.bookmarks.lists.newListPlaceholder')}
                            value={newName}
                            onChangeText={setNewName}
                            maxLength={120}
                            autoFocus
                        />
                        <View style={localStyles.createRow}>
                            <Button
                                containerStyle={localStyles.createBtn}
                                buttonStyle={themeStyles.buttonRoundAlt || themeStyles.buttonRound}
                                titleStyle={themeStyles.buttonTitleAlt || themeStyles.buttonTitle}
                                title={translate('pages.bookmarks.lists.cancel')}
                                onPress={() => { setIsCreating(false); setNewName(''); }}
                                raised={false}
                            />
                            <Button
                                containerStyle={localStyles.createBtn}
                                buttonStyle={themeStyles.buttonRound}
                                titleStyle={themeStyles.buttonTitle}
                                title={translate('pages.bookmarks.lists.createList')}
                                onPress={handleCreate}
                                disabled={!newName.trim()}
                                raised={false}
                            />
                        </View>
                    </View>
                )}

                <Button
                    containerStyle={[spacingStyles.fullWidth, spacingStyles.marginTopMd]}
                    buttonStyle={themeStyles.buttonRoundAlt || themeStyles.buttonRound}
                    titleStyle={themeStyles.buttonTitleAlt || themeStyles.buttonTitle}
                    title={translate('pages.bookmarks.lists.done')}
                    onPress={() => SheetManager.hide('list-picker-sheet')}
                    raised={false}
                />
            </View>
        </ActionSheet>
    );
};

const localStyles = StyleSheet.create({
    title: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    rowLabel: {
        marginLeft: 10,
        fontSize: 15,
    },
    emptyText: {
        fontStyle: 'italic',
        color: '#888',
        paddingVertical: 12,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
    },
    createRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    createBtn: {
        flex: 1,
        marginHorizontal: 4,
    },
});

export default ListPickerSheet;

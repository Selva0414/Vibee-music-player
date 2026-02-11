import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    Modal,
    TextInput,
    Alert,
    Dimensions,
    Platform,
    ToastAndroid
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';
import * as FileSystem from 'expo-file-system';
import PlayerWidget from '../components/PlayerWidget';

const { width } = Dimensions.get('window');
// Handle web safely
const DOWNLOADS_DIR = Platform.OS === 'web' ? '' : FileSystem.documentDirectory + 'downloads/';
const METADATA_FILE = DOWNLOADS_DIR + 'metadata.json';

export default function DownloadScreen({
    onTrackSelect,
    currentLanguage,
    currentSong,
    isPlaying,
    isStartingPlayback,
    onPlayPause,
    onNext,
    onPrev,
    progress,
    onOpenFullPlayer,
    downloads = [],
    folders = [],
    onDownload,
    onDeleteDownload,
    onCreateFolder,
    onDeleteFolder,
    onAddToFolder,
    performSearch
}) {
    const [currentFolder, setCurrentFolder] = useState(null); // null = folder list, 'all' = virtual folder, {object} = custom folder

    // Modals
    const [createFolderVisible, setCreateFolderVisible] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [addToFolderVisible, setAddToFolderVisible] = useState(false);
    const [activeFolderForAdd, setActiveFolderForAdd] = useState(null); // Which folder we are adding songs TO
    const [selectedSongForFolder, setSelectedSongForFolder] = useState(null); // Single song selection (reverse add)
    const [headerSearchQuery, setHeaderSearchQuery] = useState('');
    const [modalSearchQuery, setModalSearchQuery] = useState('');
    const [isOnlineSearch, setIsOnlineSearch] = useState(false);
    const [onlineResults, setOnlineResults] = useState([]);
    const [isHeaderSearchVisible, setIsHeaderSearchVisible] = useState(false);
    const [isOnlineLoading, setIsOnlineLoading] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null); // { type: 'song' | 'folder', id: string, name: string }

    // Sync currentFolder name/song list when folders prop changes
    useEffect(() => {
        if (currentFolder) {
            const updated = folders.find(f => f.id === currentFolder.id);
            if (updated) setCurrentFolder(updated);
            else setCurrentFolder(null);
        }
    }, [folders]);

    // Folder Logic
    const createFolder = async () => {
        if (!newFolderName.trim()) return;
        await onCreateFolder(newFolderName.trim());
        setNewFolderName('');
        setCreateFolderVisible(false);
    };

    const deleteFolder = (folderId) => {
        const folder = folders.find(f => f.id === folderId);
        setItemToDelete({ type: 'folder', id: folderId, name: folder?.name || 'this folder' });
        setDeleteConfirmVisible(true);
    };

    const addSongToFolder = async (folderId) => {
        if (!selectedSongForFolder) return;
        await onAddToFolder(folderId, selectedSongForFolder.id);
        setAddToFolderVisible(false);
        setSelectedSongForFolder(null);
    };

    // New: Add multiple songs to current folder
    // Simplified: Just add multiple songs to folder via parent callback
    const addSongsToCurrentFolder = async (songIdsToAdd) => {
        if (!currentFolder) return;
        for (const id of songIdsToAdd) {
            await onAddToFolder(currentFolder.id, id);
        }
    };

    const searchTimeout = React.useRef(null);

    const handleSearchChange = (text) => {
        setModalSearchQuery(text);
        if (isOnlineSearch) {
            handleOnlineSearch(text);
        }
    };

    const handleOnlineSearch = (query) => {
        if (query.length < 2) {
            setOnlineResults([]);
            setIsOnlineLoading(false);
            return;
        }
        setIsOnlineLoading(true);

        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        searchTimeout.current = setTimeout(() => {
            performSearch(`${query} ${currentLanguage}`, (results) => {
                setOnlineResults(results);
                setIsOnlineLoading(false);
            });
        }, 500);
    };

    const handleDownloadAndAdd = async (song) => {
        const folderId = currentFolder === 'all' ? null : (currentFolder?.id || activeFolderForAdd?.id);
        // Start download and pass folderId to App.js which will handle the association
        await onDownload(song, folderId);
    };

    // Song Logic
    const deleteSong = (songId) => {
        const song = downloads.find(s => s.id === songId);
        setItemToDelete({ type: 'song', id: songId, name: song?.name || 'this song' });
        setDeleteConfirmVisible(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;

        if (itemToDelete.type === 'song') {
            await onDeleteDownload(itemToDelete.id);
            if (Platform.OS === 'android') {
                ToastAndroid.show("Song deleted", ToastAndroid.SHORT);
            }
        } else {
            await onDeleteFolder(itemToDelete.id);
            if (Platform.OS === 'android') {
                ToastAndroid.show("Folder deleted", ToastAndroid.SHORT);
            }
        }
        setDeleteConfirmVisible(false);
        setItemToDelete(null);
    };

    const renderSongItem = ({ item }) => {
        const isPlayingThis = currentSong?.id === item.id && isPlaying;
        return (
            <View style={styles.songItem}>
                <TouchableOpacity
                    style={styles.songMainClick}
                    onPress={() => onTrackSelect(item, downloads)} // Play song
                >
                    <Image source={{ uri: item.image?.[1]?.url || item.image }} style={styles.songImage} />
                    <View style={styles.songInfo}>
                        <Text style={[styles.songTitle, isPlayingThis && styles.activeText]} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.songArtist} numberOfLines={1}>{item.artist || item.artists?.primary?.[0]?.name}</Text>
                    </View>
                </TouchableOpacity>

                <View style={styles.songActions}>
                    <TouchableOpacity onPress={() => {
                        setSelectedSongForFolder(item);
                        setAddToFolderVisible(true);
                    }}>
                        <Icon name="folder-open" size={22} color="#B3B3B3" style={{ marginRight: 15 }} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteSong(item.id)}>
                        <Icon name="delete" size={22} color="#B3B3B3" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // Render Content
    const renderContent = () => {
        if (!currentFolder) {
            // Folder List (Unified: Virtual "All" + Custom Folders)
            const folderListData = [
                { id: 'all', name: 'All Downloads', count: downloads.length, virtual: true },
                ...folders
            ];

            return (
                <View style={{ flex: 1 }}>
                    <FlatList
                        data={folderListData}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.folderRow}
                                onPress={() => setCurrentFolder(item.virtual ? 'all' : item)}
                                onLongPress={() => !item.virtual && deleteFolder(item.id)}
                            >
                                <View style={styles.folderIconBox}>
                                    <Icon name={item.virtual ? "file-download" : "library-music"} size={28} color="#710decff" />
                                </View>
                                <View style={styles.folderInfo}>
                                    <Text style={styles.folderTitle}>{item.name}</Text>
                                    <View style={styles.folderSub}>
                                        <Text style={styles.folderDesc}>Folder • {item.count !== undefined ? item.count : (item.songIds?.length || 0)} songs</Text>
                                    </View>
                                </View>
                                <Icon name="chevron-right" size={20} color="#666" />
                            </TouchableOpacity>
                        )}
                        initialNumToRender={8}
                        maxToRenderPerBatch={10}
                        windowSize={5}
                        removeClippedSubviews={Platform.OS !== 'web'}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No downloads or folders.</Text>
                            </View>
                        }
                    />
                </View>
            );
        }

        // Inside Folder (Virtual "All" or Custom Folder)
        const isAll = currentFolder === 'all';
        const folderSongs = isAll
            ? downloads.filter(d =>
                d.name.toLowerCase().includes(headerSearchQuery.toLowerCase()) ||
                (d.artist || d.artists?.primary?.[0]?.name || '').toLowerCase().includes(headerSearchQuery.toLowerCase()))
            : downloads.filter(d =>
                currentFolder.songIds.includes(d.id) &&
                (d.name.toLowerCase().includes(headerSearchQuery.toLowerCase()) ||
                    (d.artist || d.artists?.primary?.[0]?.name || '').toLowerCase().includes(headerSearchQuery.toLowerCase()))
            );

        return (
            <View style={{ flex: 1 }}>
                <View style={styles.folderHeader}>
                    <TouchableOpacity onPress={() => setCurrentFolder(null)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Icon name="arrow-back" size={24} color="#FFF" />
                        <Text style={styles.folderHeaderTitle}>{isAll ? 'All Downloads' : currentFolder.name}</Text>
                    </TouchableOpacity>
                    {!isAll && (
                        <TouchableOpacity
                            onPress={() => setActiveFolderForAdd(currentFolder)}
                            style={styles.addSongBtn}
                        >
                            <Icon name="add" size={20} color="#000" />
                            <Text style={styles.addSongBtnText}>Add Songs</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <FlatList
                    data={folderSongs}
                    keyExtractor={item => item.id}
                    renderItem={renderSongItem}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS !== 'web'}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Icon name="file-download" size={64} color="#333" />
                            <Text style={styles.emptyText}>{isAll ? 'No downloaded songs yet.' : 'No songs in this folder.'}</Text>
                            {isAll && <Text style={styles.emptySubText}>Download songs from the player to listen offline.</Text>}
                        </View>
                    }
                />
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>

            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Downloads</Text>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity onPress={() => setIsHeaderSearchVisible(!isHeaderSearchVisible)} style={styles.headerIcon}>
                        <Icon name={isHeaderSearchVisible ? "close" : "search"} size={26} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCreateFolderVisible(true)} style={styles.headerIcon}>
                        <Icon name="add" size={32} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {isHeaderSearchVisible && (
                    <View style={styles.searchBar}>
                        <Icon name="search" size={20} color="#9CA3AF" />
                        <TextInput
                            style={styles.searchInputHeader}
                            placeholder="Search in downloads"
                            placeholderTextColor="#9CA3AF"
                            value={headerSearchQuery}
                            onChangeText={setHeaderSearchQuery}
                            autoFocus
                        />
                    </View>
                )}
            </View>

            {renderContent()}

            {/* Create Folder Modal */}
            <Modal visible={createFolderVisible} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New Folder</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Folder Name"
                            placeholderTextColor="#666"
                            value={newFolderName}
                            onChangeText={setNewFolderName}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setCreateFolderVisible(false)} style={styles.modalBtn}>
                                <Text style={styles.modalBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={createFolder} style={[styles.modalBtn, styles.primaryBtn]}>
                                <Text style={[styles.modalBtnText, { color: '#000' }]}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add to Folder Modal */}
            <Modal visible={addToFolderVisible} transparent={true} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                            <Text style={styles.modalTitle}>Add to Folder</Text>
                            <TouchableOpacity onPress={() => setAddToFolderVisible(false)}>
                                <Icon name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={folders}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.folderSelectRow}
                                    onPress={() => addSongToFolder(item.id)}
                                >
                                    <Icon name="folder-open" size={24} color="#9B5DE5" />
                                    <Text style={styles.folderSelectText}>{item.name}</Text>
                                    {item.songIds.includes(selectedSongForFolder?.id) && (
                                        <Icon name="check" size={20} color="#9B5DE5" style={{ marginLeft: 'auto' }} />
                                    )}
                                </TouchableOpacity>
                            )}
                            initialNumToRender={10}
                            removeClippedSubviews={Platform.OS !== 'web'}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>No custom folders created.</Text>
                            }
                        />
                    </View>
                </View>
            </Modal>

            {/* Select Songs for Folder Modal */}
            <Modal visible={!!activeFolderForAdd} transparent={false} animationType="slide">
                <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' }}>
                            <Text style={styles.modalTitle}>Add Songs to {activeFolderForAdd?.name}</Text>
                            <TouchableOpacity
                                style={{ padding: 4 }}
                                onPress={() => { setActiveFolderForAdd(null); setModalSearchQuery(''); setIsOnlineSearch(false); }}
                            >
                                <Icon name="close" size={28} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        {/* Search Mode Tabs */}
                        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333' }}>
                            <TouchableOpacity
                                style={[styles.modalTab, !isOnlineSearch && styles.activeModalTab]}
                                onPress={() => setIsOnlineSearch(false)}
                            >
                                <Text style={[styles.modalTabText, !isOnlineSearch && styles.activeModalTabText]}>Downloaded</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalTab, isOnlineSearch && styles.activeModalTab]}
                                onPress={() => setIsOnlineSearch(true)}
                            >
                                <Text style={[styles.modalTabText, isOnlineSearch && styles.activeModalTabText]}>Search Online</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <Icon name="search" size={20} color="#999" style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={isOnlineSearch ? "Search JioSaavn..." : "Search downloaded songs..."}
                                placeholderTextColor="#666"
                                value={modalSearchQuery}
                                onChangeText={handleSearchChange}
                            />
                        </View>

                        {isOnlineSearch ? (
                            <FlatList
                                contentContainerStyle={{ padding: 20 }}
                                data={onlineResults}
                                keyboardShouldPersistTaps="handled"
                                keyExtractor={item => item.id}
                                initialNumToRender={8}
                                maxToRenderPerBatch={10}
                                windowSize={5}
                                removeClippedSubviews={Platform.OS !== 'web'}
                                renderItem={({ item }) => {
                                    const isDownloaded = downloads.some(d => d.id === item.id);
                                    const inFolder = activeFolderForAdd?.songIds.includes(item.id);

                                    return (
                                        <View style={styles.songItem}>
                                            <TouchableOpacity
                                                style={styles.songMainClick}
                                                onPress={() => {
                                                    if (!isDownloaded) handleDownloadAndAdd(item);
                                                }}
                                            >
                                                <Image source={{ uri: item.image?.[1]?.url || item.image }} style={styles.songImage} />
                                                <View style={styles.songInfo}>
                                                    <Text style={styles.songTitle} numberOfLines={1}>{item.name}</Text>
                                                    <Text style={styles.songArtist} numberOfLines={1}>{item.artist || item.artists?.primary?.[0]?.name}</Text>
                                                </View>
                                            </TouchableOpacity>
                                            <View style={styles.songActions}>
                                                {inFolder ? (
                                                    <Icon name="check-circle" size={28} color="#9B5DE5" />
                                                ) : (
                                                    <>
                                                        <TouchableOpacity onPress={() => {
                                                            if (isDownloaded) {
                                                                addSongsToCurrentFolder([item.id]);
                                                            } else {
                                                                handleDownloadAndAdd(item);
                                                            }
                                                        }}>
                                                            <Icon
                                                                name={isDownloaded ? "folder" : "file-download"}
                                                                size={24}
                                                                color={isDownloaded ? "#FFF" : "#FFF"}
                                                                style={{ marginRight: isDownloaded ? 15 : 0 }}
                                                            />
                                                        </TouchableOpacity>
                                                        {isDownloaded && (
                                                            <TouchableOpacity onPress={() => deleteSong(item.id)}>
                                                                <Icon name="delete" size={24} color="#FFF" />
                                                            </TouchableOpacity>
                                                        )}
                                                    </>
                                                )}
                                            </View>
                                        </View>
                                    )
                                }}
                                ListEmptyComponent={
                                    <View style={{ alignItems: 'center', padding: 20 }}>
                                        {isOnlineLoading ? (
                                            <Text style={styles.emptyText}>Searching...</Text>
                                        ) : (
                                            <Text style={styles.emptyText}>Type to search online.</Text>
                                        )}
                                    </View>
                                }
                            />
                        ) : (
                            <FlatList
                                contentContainerStyle={{ padding: 20 }}
                                data={downloads.filter(d =>
                                    !activeFolderForAdd?.songIds.includes(d.id) &&
                                    (d.name.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
                                        d.artist?.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
                                        d.artists?.primary?.[0]?.name.toLowerCase().includes(modalSearchQuery.toLowerCase()))
                                )}
                                keyExtractor={item => item.id}
                                initialNumToRender={10}
                                maxToRenderPerBatch={10}
                                windowSize={5}
                                removeClippedSubviews={Platform.OS !== 'web'}
                                renderItem={({ item }) => (
                                    <View style={styles.songItem}>
                                        <View style={styles.songMainClick}>
                                            <Image source={{ uri: item.image?.[1]?.url || item.image }} style={styles.songImage} />
                                            <View style={styles.songInfo}>
                                                <Text style={styles.songTitle} numberOfLines={1}>{item.name}</Text>
                                                <Text style={styles.songArtist} numberOfLines={1}>{item.artist || item.artists?.primary?.[0]?.name}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.songActions}>
                                            <TouchableOpacity onPress={() => { addSongsToCurrentFolder([item.id]); setModalSearchQuery(''); }}>
                                                <Icon name="folder" size={24} color="#FFF" style={{ marginRight: 15 }} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => deleteSong(item.id)}>
                                                <Icon name="delete" size={24} color="#FFF" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                                ListEmptyComponent={
                                    <Text style={styles.emptyText}>
                                        {downloads.length === 0
                                            ? "No downloaded songs available."
                                            : "No matching songs found."}
                                    </Text>
                                }
                            />
                        )}
                        {currentSong && (
                            <PlayerWidget
                                currentSong={currentSong}
                                isPlaying={isPlaying}
                                isStartingPlayback={isStartingPlayback}
                                onPlayPause={onPlayPause}
                                onNext={onNext}
                                onPrev={onPrev}
                                progress={progress}
                                onOpenFullPlayer={onOpenFullPlayer}
                            />
                        )}
                    </View>
                </SafeAreaView>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal visible={deleteConfirmVisible} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Delete {itemToDelete?.type === 'song' ? 'Song' : 'Folder'}</Text>
                        <Text style={{ color: '#9CA3AF', marginBottom: 25, fontSize: 16 }}>
                            Are you sure you want to delete "{itemToDelete?.name}"?
                        </Text>
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setDeleteConfirmVisible(false)} style={styles.modalBtn}>
                                <Text style={styles.modalBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={confirmDelete} style={[styles.modalBtn, { backgroundColor: '#9B5DE5' }]}>
                                <Text style={[styles.modalBtnText, { color: '#000' }]}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        paddingTop: 16,
        paddingBottom: 8,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFF',
    },
    headerIcon: {
        padding: 4,
        marginLeft: 8,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 16,
        paddingHorizontal: 12,
        borderRadius: 12,
        height: 44,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    searchInputHeader: {
        flex: 1,
        marginLeft: 8,
        color: '#FFF',
        fontSize: 16,
    },
    filters: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 20,
        gap: 12,
    },
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#1E1E1E',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    activeChip: {
        backgroundColor: '#FFF',
    },
    chipText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },
    activeChipText: {
        color: '#000',
    },
    folderRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'center',
    },
    folderIconBox: {
        width: 64,
        height: 64,
        backgroundColor: '#282828',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        marginRight: 16,
    },
    folderInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    folderTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    folderSub: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    folderDesc: {
        color: '#B3B3B3',
        fontSize: 13,
    },
    songItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginBottom: 0,
        backgroundColor: 'transparent',
    },
    songMainClick: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    songImage: {
        width: 48,
        height: 48,
        borderRadius: 8,
    },
    songInfo: {
        marginLeft: 12,
        flex: 1,
    },
    songTitle: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    activeText: {
        color: '#9B5DE5',
    },
    songArtist: {
        color: '#9CA3AF',
        fontSize: 13,
        marginTop: 2,
    },
    songActions: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 10,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center',
    },
    emptySubText: {
        color: '#666',
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    folderHeader: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    folderHeaderTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#000000ff',
        borderRadius: 20,
        padding: 20,
    },
    modalTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    input: {
        backgroundColor: '#333',
        color: '#FFF',
        padding: 15,
        borderRadius: 10,
        fontSize: 16,
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    modalBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        marginLeft: 10,
        borderRadius: 8,
    },
    primaryBtn: {
        backgroundColor: '#9B5DE5',
    },
    modalBtnText: {
        color: '#FFF',
        fontWeight: '600',
    },
    folderSelectRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    folderSelectText: {
        color: '#FFF',
        fontSize: 16,
        marginLeft: 12,
    },
    addSongBtn: {
        backgroundColor: '#9B5DE5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center'
    },
    addSongBtnText: {
        color: '#000',
        fontWeight: '600',
        fontSize: 12,
        marginLeft: 4
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#000000ff',
        margin: 20,
        marginBottom: 0,
        paddingHorizontal: 15,
        borderRadius: 10,
        height: 50
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 16
    },
    modalTab: {
        flex: 1,
        paddingVertical: 15,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent'
    },
    activeModalTab: {
        borderBottomColor: '#9B5DE5'
    },
    modalTabText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '600'
    },
    activeModalTabText: {
        color: '#FFF'
    }
});

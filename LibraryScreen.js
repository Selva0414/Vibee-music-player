import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Modal, Image, ActivityIndicator, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '../components/Icon';

const API_BASE = 'https://music-api-xandra.vercel.app/api';

export default function LibraryScreen({ onNavigate, likedCount, playlists, onCreatePlaylist, followedArtists = [], onToggleFollowArtist, onArtistClick }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [activeFilter, setActiveFilter] = useState('playlists'); // 'playlists' or 'artists'
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchingAPI, setIsSearchingAPI] = useState(false);
    const searchTimeoutRef = useRef(null);
    const [artistDetails, setArtistDetails] = useState({}); // Store artist objects by name

    // Load artist details from AsyncStorage
    useEffect(() => {
        const loadArtistDetails = async () => {
            try {
                const stored = await AsyncStorage.getItem('@artist_details');
                if (stored) {
                    setArtistDetails(JSON.parse(stored));
                }
            } catch (error) {
                console.error('Failed to load artist details:', error);
            }
        };
        loadArtistDetails();
    }, []);

    const filteredPlaylists = playlists.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredArtists = followedArtists.filter(artist =>
        artist.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Debounced artist search
    useEffect(() => {
        if (activeFilter !== 'artists' || !searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Set new timeout for debounced search
        searchTimeoutRef.current = setTimeout(() => {
            searchArtistsAPI(searchQuery.trim());
        }, 500);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, activeFilter]);

    const searchArtistsAPI = async (query) => {
        if (!query) return;

        setIsSearchingAPI(true);
        try {
            const response = await fetch(`${API_BASE}/search/artists?query=${encodeURIComponent(query)}&limit=20`);
            const data = await response.json();

            let artists = [];
            if (data?.data?.results && Array.isArray(data.data.results)) {
                artists = data.data.results;
            } else if (data?.results && Array.isArray(data.results)) {
                artists = data.results;
            } else if (Array.isArray(data)) {
                artists = data;
            }

            // Store full artist objects with images
            const artistObjects = artists.map(artist => {
                if (typeof artist === 'string') {
                    return { name: artist, image: null };
                }
                return {
                    id: artist.id,
                    name: artist.name || artist.title || '',
                    image: artist.image || null,
                    role: artist.role || 'Artist',
                    url: artist.url
                };
            }).filter(artist => artist.name.trim() !== '');

            setSearchResults(artistObjects);
        } catch (error) {
            console.error('Artist search error:', error);
            setSearchResults([]);
        } finally {
            setIsSearchingAPI(false);
        }
    };

    const handleCreate = () => {
        if (newPlaylistName.trim()) {
            onCreatePlaylist(newPlaylistName.trim());
            setNewPlaylistName('');
            setCreateModalVisible(false);
        }
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerTop}>
                <Text style={styles.headerTitle}>Your Library</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                    onPress={() => {
                        if (isSearching) {
                            // Closing search
                            setIsSearching(false);
                            setSearchQuery('');
                            setSearchResults([]);
                        } else {
                            // Opening search
                            setIsSearching(true);
                        }
                    }}
                    style={styles.headerIcon}
                >
                    <Icon name={isSearching ? "close" : "search"} size={26} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCreateModalVisible(true)} style={styles.headerIcon}>
                    <Icon name="add" size={32} color="#FFF" />
                </TouchableOpacity>
            </View>

            {isSearching && (
                <View style={styles.searchBar}>
                    <Icon name="search" size={20} color="#9CA3AF" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={activeFilter === 'playlists' ? "Search in your library" : "Search artists"}
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoFocus
                    />
                </View>
            )}
        </View>
    );

    const handleFollowArtist = async (artistItem) => {
        // artistItem can be either a string (name) or an object (from search)
        const artistName = typeof artistItem === 'string' ? artistItem : artistItem.name;

        if (onToggleFollowArtist) {
            onToggleFollowArtist(artistName);

            // If following an artist from search (has full object with image), save the details
            if (typeof artistItem === 'object' && artistItem.image) {
                try {
                    const newDetails = {
                        ...artistDetails,
                        [artistName]: artistItem
                    };
                    setArtistDetails(newDetails);
                    await AsyncStorage.setItem('@artist_details', JSON.stringify(newDetails));
                } catch (error) {
                    console.error('Failed to save artist details:', error);
                }
            }

            // Clear search after following to allow searching for next artist
            setSearchQuery('');
            setSearchResults([]);
        }
    };

    const renderItem = ({ item }) => {
        // Handle Artists
        if (activeFilter === 'artists') {
            // Item can be either an artist object (from search) or a string (from followed list)
            const artistName = typeof item === 'string' ? item : item.name;

            // Get artist image from item or from stored details
            let artistImage = null;
            if (typeof item === 'object' && item.image) {
                artistImage = item.image;
            } else if (typeof item === 'string' && artistDetails[item]) {
                artistImage = artistDetails[item].image;
            }

            const isFollowed = followedArtists.includes(artistName);

            // Get the best quality image URL
            const getImageUrl = () => {
                if (!artistImage || !Array.isArray(artistImage)) return null;
                // Try to get 150x150 or 500x500, fallback to any available
                const mediumImg = artistImage.find(img => img.quality === '150x150');
                const largeImg = artistImage.find(img => img.quality === '500x500');
                return mediumImg?.url || largeImg?.url || artistImage[0]?.url || null;
            };

            const imageUrl = getImageUrl();

            return (
                <View style={styles.row}>
                    <TouchableOpacity
                        style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}
                        onPress={() => {
                            if (onArtistClick) {
                                onArtistClick({
                                    name: artistName,
                                    image: imageUrl // Pass the resolved URL string
                                });
                            }
                        }}
                        activeOpacity={0.7}
                    >
                        {imageUrl ? (
                            <Image
                                source={{ uri: imageUrl }}
                                style={[styles.likedBox, { borderRadius: 32 }]}
                            />
                        ) : (
                            <View style={[styles.likedBox, { borderRadius: 32, backgroundColor: isFollowed ? '#9B5DE5' : '#333' }]}>
                                <Icon name="person" size={32} color="#FFF" />
                            </View>
                        )}
                        <View style={styles.info}>
                            <Text style={styles.rowTitle}>{artistName}</Text>
                            <Text style={styles.rowDesc}>Artist</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.followBtn, isFollowed && styles.followingBtn]}
                        onPress={() => handleFollowArtist(item)}
                        activeOpacity={0.7}
                    >
                        <Icon
                            name={isFollowed ? "close" : "add"}
                            size={20}
                            color={isFollowed ? "#aa00ffff" : "#FFF"}
                        />
                    </TouchableOpacity>
                </View>
            );
        }

        // Handle Liked Songs Section
        if (item.type === 'liked') {
            return (
                <TouchableOpacity style={styles.row} onPress={() => onNavigate('liked')}>
                    <View style={styles.likedBox}>
                        <Icon name="favorite" size={28} color="#FFF" />
                    </View>
                    <View style={styles.info}>
                        <Text style={styles.rowTitle}>Liked Songs</Text>
                        <View style={styles.rowSub}>
                            <Icon name="push-pin" size={12} color="#aa00ffff" style={{ marginRight: 4 }} />
                            <Text style={styles.rowDesc}>Playlist • {likedCount} songs</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }

        // Handle Regular Playlists
        return (
            <TouchableOpacity style={styles.row} onPress={() => onNavigate(`playlist:${item.id}`)}>
                <View style={[styles.likedBox, { backgroundColor: '#282828' }]}>
                    <Icon name="library-music" size={28} color="#9d00ffff" />
                </View>
                <View style={styles.info}>
                    <Text style={styles.rowTitle}>{item.name}</Text>
                    <Text style={styles.rowDesc}>Library • {item.songs?.length || 0} songs</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const data = activeFilter === 'playlists'
        ? [{ id: 'liked', type: 'liked' }, ...filteredPlaylists]
        : searchQuery.trim() ? searchResults : filteredArtists;

    return (
        <View style={styles.container}>
            {renderHeader()}

            <View style={styles.filters}>
                <TouchableOpacity
                    style={[styles.chip, activeFilter === 'playlists' && styles.activeChip]}
                    onPress={() => setActiveFilter('playlists')}
                >
                    <Text style={[styles.chipText, activeFilter === 'playlists' && styles.activeChipText]}>Playlists</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.chip, activeFilter === 'artists' && styles.activeChip]}
                    onPress={() => setActiveFilter('artists')}
                >
                    <Text style={[styles.chipText, activeFilter === 'artists' && styles.activeChipText]}>Artists</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={data}
                keyExtractor={(item, index) => {
                    if (typeof item === 'string') return `artist-${item}-${index}`;
                    return item.id || `artist-${item.name}-${index}`;
                }}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 100 }}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={Platform.OS !== 'web'}
                ListHeaderComponent={() => (
                    isSearchingAPI && activeFilter === 'artists' ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#9B5DE5" />
                            <Text style={styles.loadingText}>Searching artists...</Text>
                        </View>
                    ) : null
                )}
                ListEmptyComponent={() => (
                    !isSearchingAPI && (
                        <View style={styles.emptyContainer}>
                            <Icon
                                name={activeFilter === 'playlists' ? "library-music" : "person-outline"}
                                size={64}
                                color="#333"
                            />
                            <Text style={{ color: '#9CA3AF', marginTop: 16 }}>
                                {activeFilter === 'playlists'
                                    ? "No libraries found."
                                    : searchQuery.trim()
                                        ? "No artists found."
                                        : "No artists followed yet."}
                            </Text>
                        </View>
                    )
                )}
            />

            {/* Create Playlist Modal */}
            <Modal visible={createModalVisible} transparent animationType="fade" onRequestClose={() => setCreateModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Give your library a name</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="My playlist #1"
                            placeholderTextColor="#666"
                            value={newPlaylistName}
                            onChangeText={setNewPlaylistName}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.modalBtn} onPress={() => setCreateModalVisible(false)}>
                                <Text style={[styles.modalBtnText, { color: '#9CA3AF' }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, styles.createBtn]} onPress={handleCreate}>
                                <Text style={[styles.modalBtnText, { color: '#000' }]}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#b700ffff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    avatarText: {
        color: '#000',
        fontWeight: 'bold'
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: '#FFF',
        letterSpacing: -1,
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
    searchInput: {
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
        backgroundColor: '#282828',
    },
    chipText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },
    activeChip: {
        backgroundColor: '#FFF',
    },
    activeChipText: {
        color: '#000',
    },
    row: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'center',
    },
    likedBox: {
        width: 64,
        height: 64,
        backgroundColor: '#4338CA',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        marginRight: 16,
    },
    info: {
        flex: 1,
        justifyContent: 'center',
    },
    rowTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    rowSub: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowDesc: {
        color: '#B3B3B3',
        fontSize: 13,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    loadingText: {
        color: '#9CA3AF',
        fontSize: 14,
    },
    followBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 2,
        borderColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    followingBtn: {
        backgroundColor: 'transparent',
        borderColor: '#b300ffff',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        padding: 32,
    },
    modalContent: {
        backgroundColor: '#282828',
        borderRadius: 12,
        padding: 24,
    },
    modalTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 24,
    },
    modalInput: {
        borderBottomWidth: 1,
        borderBottomColor: '#a600ffff',
        color: '#FFF',
        fontSize: 18,
        paddingVertical: 8,
        marginBottom: 32,
        textAlign: 'center',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 16,
    },
    modalBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    createBtn: {
        backgroundColor: '#a600ffff',
        borderRadius: 20,
        paddingHorizontal: 24,
    },
    modalBtnText: {
        fontSize: 16,
        fontWeight: '700',
    }
});

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Platform, Image, TouchableOpacity } from 'react-native';
import Icon from '../components/Icon';
import SongItem from '../components/SongItem';

export default function SearchScreen({
    onTrackSelect,
    currentSong,
    isPlaying,
    isStartingPlayback,
    startingSongId,
    onLike,
    likedSongs,
    onSearch,
    errorText,
    defaultSongs = [],
    targetPlaylist,
    onAddToPlaylist,
    onArtistSelect
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const abortRef = useRef(null);
    const skipAutoSearch = useRef(false);

    useEffect(() => {
        if (skipAutoSearch.current) {
            skipAutoSearch.current = false;
            return;
        }

        if (!query.trim()) {
            setResults([]);
            abortRef.current?.abort?.();
            abortRef.current = null;
            return;
        }

        const delayDebounceFn = setTimeout(() => {
            handleSearch(query.trim());
        }, 250);

        return () => clearTimeout(delayDebounceFn);
    }, [query]);

    const handleSearch = async (searchQuery) => {
        abortRef.current?.abort?.();
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        abortRef.current = controller;
        setSearching(true);
        await onSearch(searchQuery, setResults, { signal: controller?.signal });
        setSearching(false);
    };





    const renderHeader = () => {
        if (query.trim() !== '' || searching) return null;

        return (
            <View>

                {/* "Try these" Title for default songs */}
                {defaultSongs.length > 0 && (
                    <Text style={styles.browseTitle}>Try these</Text>
                )}
            </View>
        );
    };

    const displayData = query.trim() === '' ? defaultSongs : results;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Search</Text>
            </View>
            <View style={styles.searchBox}>
                <Icon name="search" size={20} color="#FFF" />
                <TextInput
                    style={styles.input}
                    placeholder="What do you want to listen to?"
                    placeholderTextColor="rgba(255, 255, 255, 0.6)"
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={() => handleSearch(query.trim())}
                    returnKeyType="search"
                />
            </View>

            {targetPlaylist && (
                <View style={styles.targetBanner}>
                    <Text style={styles.targetBannerText}>
                        Adding to <Text style={{ fontWeight: 'bold', color: '#9B5DE5' }}>{targetPlaylist.name}</Text>
                    </Text>
                </View>
            )}

            <FlatList
                data={displayData}
                ListHeaderComponent={renderHeader}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                    if (item.type === 'artist') {
                        // Render Artist Item
                        return (
                            <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12 }}>
                                    <View style={{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: '#333' }}>
                                        {item.image && (
                                            <React.Fragment>
                                                {/* Use img element for web to force layout if needed, or just Image */}
                                                <Image
                                                    source={{ uri: item.image }}
                                                    style={{ width: '100%', height: '100%' }}
                                                    resizeMode="cover"
                                                />
                                            </React.Fragment>
                                        )}
                                    </View>
                                    <View style={{ marginLeft: 16, flex: 1 }}>
                                        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>{item.name}</Text>
                                        <Text style={{ color: '#9B5DE5', fontSize: 12, marginTop: 4, fontWeight: '600', textTransform: 'uppercase' }}>Artist</Text>
                                    </View>
                                    <View style={{ backgroundColor: 'transparent', padding: 8 }}>
                                        <Icon name="chevron-right" size={24} color="#666" />
                                    </View>
                                    <Text
                                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                                        onPress={() => onArtistSelect && onArtistSelect(item)}
                                    />
                                </View>
                            </View>
                        );
                    }
                    return (
                        <SongItem
                            song={item}
                            isPlaying={currentSong?.id === item.id && isPlaying}
                            isStartingPlayback={isStartingPlayback}
                            startingSongId={startingSongId}
                            onPlay={(song) => onTrackSelect(song, displayData)}
                            onLike={onLike}
                            isLiked={likedSongs.some(s => s.id === item.id)}
                            onAdd={targetPlaylist ? onAddToPlaylist : null}
                        />
                    );
                }}
                contentContainerStyle={{ paddingBottom: 110, paddingTop: 16 }}
                initialNumToRender={8}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={Platform.OS !== 'web'}
                ListEmptyComponent={() => (
                    <View style={styles.empty}>
                        {searching ? (
                            <Text style={styles.emptyText}>Searching...</Text>
                        ) : errorText ? (
                            <Text style={styles.emptyText}>{errorText}</Text>
                        ) : null}
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? 40 : 20,
    },
    header: {
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: '#FFF',
        letterSpacing: -1,
    },
    searchBox: {
        marginHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)', // More transparent for glass effect
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        marginBottom: 16, // Added space below search bar
    },
    input: {
        flex: 1,
        marginLeft: 8,
        fontSize: 16,
        color: '#FFF', // White text for glass look
        fontWeight: '500',
    },
    browseTitle: {
        fontSize: 22, // Larger to match new styling
        fontWeight: '700',
        color: '#FFF',
        marginTop: 8,
        marginHorizontal: 16,
        marginBottom: 12,
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 16,
        fontWeight: '600',
    },
    targetBanner: {
        backgroundColor: '#282828',
        marginHorizontal: 16,
        marginTop: 8,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#9B5DE5',
        marginBottom: 16,
    },
    targetBannerText: {
        color: '#FFF',
        fontSize: 14,
        textAlign: 'center',
    }
});

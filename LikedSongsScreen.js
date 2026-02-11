import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import Icon from '../components/Icon';
import SongItem from '../components/SongItem';

export default function PlaylistScreen({
    title = "LIKED SONGS",
    likedSongs = [],
    onBack,
    onTrackSelect,
    currentSong,
    isPlaying,
    isStartingPlayback,
    startingSongId,
    onLike,
    isPlaylist = false,
    userFavorites = [], // New prop for checking status in custom playlists
    onSearchAndAdd
}) {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Icon name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.title}>{title.toUpperCase()}</Text>
                <View style={{ width: 40 }} />
            </View>

            {isPlaylist && (
                <TouchableOpacity style={styles.addMoreBtn} onPress={onSearchAndAdd}>
                    <Icon name="add-circle-outline" size={24} color="#9B5DE5" />
                    <Text style={styles.addMoreText}>Search and add songs</Text>
                </TouchableOpacity>
            )}

            <FlatList
                data={likedSongs}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <SongItem
                        song={item}
                        isPlaying={currentSong?.id === item.id && isPlaying}
                        isStartingPlayback={isStartingPlayback}
                        startingSongId={startingSongId}
                        onPlay={onTrackSelect}
                        onLike={onLike}
                        isLiked={isPlaylist ? userFavorites.some(fav => fav.id === item.id) : true}
                    />
                )}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Icon name="library-music" size={64} color="#333" />
                        <Text style={styles.emptyText}>
                            {isPlaylist ? "This library is empty." : "No liked songs yet."}
                        </Text>
                        {isPlaylist && (
                            <TouchableOpacity style={styles.emptyAddBtn} onPress={onSearchAndAdd}>
                                <Text style={styles.emptyAddBtnText}>Add Songs</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        justifyContent: 'space-between'
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 1,
    },
    addMoreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    addMoreText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
        marginLeft: 10,
    },
    emptyContainer: {
        padding: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 16,
        marginTop: 16,
        fontWeight: '600',
    },
    emptyAddBtn: {
        marginTop: 24,
        paddingHorizontal: 32,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderRadius: 24,
    },
    emptyAddBtnText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
    }
});

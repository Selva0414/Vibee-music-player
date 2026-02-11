import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Platform, Dimensions, StatusBar } from 'react-native';
import Icon from '../components/Icon';
import SongItem from '../components/SongItem';

const { width } = Dimensions.get('window');

export default function SectionScreen({
    title,
    songs,
    onBack,
    onTrackSelect,
    currentSong,
    isPlaying,
    isStartingPlayback,
    startingSongId,
    onLike,
    likedSongs,
    onAddToPlaylist
}) {
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Icon name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={{ width: 40 }} />
            </View>

            <FlatList
                data={songs}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <SongItem
                        song={item}
                        isPlaying={currentSong?.id === item.id && isPlaying}
                        isStartingPlayback={isStartingPlayback}
                        startingSongId={startingSongId}
                        onPlay={(song) => onTrackSelect(song, songs)}
                        onLike={onLike}
                        isLiked={likedSongs.some(s => s.id === item.id)}
                        onAdd={onAddToPlaylist}
                    />
                )}
                style={{ flex: 1 }}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={Platform.OS !== 'web'}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        height: Platform.OS === 'web' ? '100vh' : '100%', // Enforce full height constraint
        overflow: 'hidden', // prevent external scrolling
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 20) + 10 : 20, // Reduced top padding for non-android
        paddingBottom: 16,
        backgroundColor: '#000',
        zIndex: 10,
        elevation: 5,
        // Removed absolute positioning to rely on flex layout
    },
    backBtn: {
        padding: 8,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        textTransform: 'capitalize'
    },
    listContent: {
        paddingBottom: 120, // Space for player
    }
});

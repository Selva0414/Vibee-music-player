import React, { memo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from './Icon';

const SongItem = memo(({ song, isPlaying, isStartingPlayback = false, startingSongId = null, onPlay, onLike, isLiked, onAdd }) => {
    const isStartingThisSong = isStartingPlayback && startingSongId === song?.id;
    return (
        <TouchableOpacity
            style={styles.container}
            onPress={() => {
                if (isStartingPlayback) return;
                onPlay(song);
            }}
            disabled={isStartingPlayback}
        >
            <Image source={{ uri: song.image?.[2]?.url || song.image?.[1]?.url }} style={styles.thumb} />
            <View style={styles.info}>
                <Text numberOfLines={2} style={[styles.title, isPlaying && styles.activeTitle]}>
                    {song.name}
                </Text>
                <Text numberOfLines={1} style={styles.artist}>
                    {song.artists?.primary?.[0]?.name}
                </Text>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity
                    onPress={() => {
                        if (isStartingPlayback) return;
                        onLike(song);
                    }}
                    disabled={isStartingPlayback}
                    style={styles.actionBtn}
                >
                    <Icon
                        name={isLiked ? 'favorite' : 'favorite-border'}
                        size={24}
                        color={isLiked ? '#9B5DE5' : '#9CA3AF'}
                    />
                </TouchableOpacity>
                {onAdd && (
                    <TouchableOpacity
                        onPress={() => {
                            if (isStartingPlayback) return;
                            onAdd(song);
                        }}
                        disabled={isStartingPlayback}
                        style={styles.actionBtn}
                    >
                        {isStartingThisSong ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Icon name="add-circle-outline" size={24} color="#FFF" />
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );
});

export default SongItem;

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(255,255,255,0.08)', // Glass effect
        marginBottom: 8,
        borderRadius: 12,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    thumb: {
        width: 52,
        height: 52,
        borderRadius: 8,
        backgroundColor: '#1F2937',
    },
    info: {
        flex: 1,
        marginLeft: 14,
        justifyContent: 'center',
    },
    title: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    activeTitle: {
        color: '#9B5DE5',
    },
    artist: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
    },
    actionBtn: {
        padding: 8,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
    }
});

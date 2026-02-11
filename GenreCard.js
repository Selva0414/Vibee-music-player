import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import Icon from './Icon';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.35;

export default function GenreCard({ song, isPlaying, isStartingPlayback = false, startingSongId = null, onPlay }) {
    const isStartingThisSong = isStartingPlayback && startingSongId === song?.id;
    return (
        <TouchableOpacity
            style={styles.cardWrapper}
            onPress={() => {
                if (isStartingPlayback) return;
                onPlay(song);
            }}
            disabled={isStartingPlayback}
            activeOpacity={0.7}
        >
            <LinearGradient
                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                style={styles.container}
            >
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: song.image?.[2]?.url || song.image?.[1]?.url || song.image?.[0]?.url }}
                        style={styles.image}
                    />
                    {isPlaying && (
                        <View style={styles.playOverlay}>
                            <Icon name="pause" size={24} color="#9B5DE5" />
                        </View>
                    )}
                    <TouchableOpacity
                        style={styles.playBtn}
                        onPress={(e) => {
                            if (e?.stopPropagation) e.stopPropagation();
                            if (isStartingPlayback) return;
                            onPlay(song);
                        }}
                        disabled={isStartingPlayback}
                    >
                        <View style={styles.playBtnInner}>
                            {isStartingThisSong ? (
                                <ActivityIndicator size="small" color="#9B5DE5" />
                            ) : (
                                <Icon name={isPlaying ? "pause" : "play-arrow"} size={16} color="#9B5DE5" />
                            )}
                        </View>
                    </TouchableOpacity>
                </View>
                <Text numberOfLines={1} style={styles.title}>{song.name}</Text>
                <Text numberOfLines={1} style={styles.description}>
                    {song.artists?.primary?.[0]?.name || 'Various Artists'}
                </Text>
            </LinearGradient>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    cardWrapper: {
        width: CARD_WIDTH,
        marginRight: 12,
        marginBottom: 16,
    },
    container: {
        padding: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        width: '100%',
    },
    imageContainer: {
        position: 'relative',
        width: '100%',
        aspectRatio: 1,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#282828',
        marginBottom: 8,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playBtn: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        elevation: 5,
    },
    playBtnInner: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 2,
    },
    description: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 11,
        lineHeight: 14,
    }
});

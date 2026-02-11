import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from './Icon';
import { BlurView } from 'expo-blur';

export default function PlayerWidget({
    currentSong,
    isPlaying,
    isStartingPlayback = false,
    onPlayPause,
    onNext,
    onPrev,
    progress = 0,
    onOpenFullPlayer
}) {
    if (!currentSong) return null;

    return (
        <View style={styles.floatingWrapper}>
            <BlurView intensity={90} tint="dark" style={styles.glassContainer}>
                <TouchableOpacity
                    style={styles.container}
                    onPress={onOpenFullPlayer}
                    activeOpacity={0.9}
                >
                    {/* Song Artwork */}
                    <Image
                        source={{ uri: currentSong.image?.[2]?.url || currentSong.image?.[1]?.url }}
                        style={styles.thumb}
                    />

                    {/* Metadata */}
                    <View style={styles.info}>
                        <Text numberOfLines={1} style={styles.title}>{currentSong.name}</Text>
                        <Text numberOfLines={1} style={styles.artist}>{currentSong.artists?.primary?.[0]?.name}</Text>
                    </View>

                    {/* Controls Row */}
                    <View style={styles.controlsRow}>
                        <TouchableOpacity
                            onPress={(e) => { e.stopPropagation(); onPrev(); }}
                            style={styles.sideBtn}
                        >
                            <Icon name="skip-previous" size={24} color="#FFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation();
                                if (isStartingPlayback) return;
                                onPlayPause();
                            }}
                            disabled={isStartingPlayback}
                            style={styles.playBtn}
                        >
                            {isStartingPlayback ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Icon name={isPlaying ? 'pause' : 'play-arrow'} size={32} color="#FFF" />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={(e) => { e.stopPropagation(); onNext(); }}
                            style={styles.sideBtn}
                        >
                            <Icon name="skip-next" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>

                {/* Song Level Bar (Progress) */}
                <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                    </View>
                </View>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    floatingWrapper: {
        marginHorizontal: 12,
        marginBottom: 12,
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
    },
    glassContainer: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(15,15,15,0.4)',
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    thumb: {
        width: 52,
        height: 52,
        borderRadius: 12,
        backgroundColor: '#222',
    },
    info: {
        flex: 1,
        paddingLeft: 14,
        justifyContent: 'center',
    },
    title: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.3,
        marginBottom: 2,
    },
    artist: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontWeight: '500',
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 8,
    },
    sideBtn: {
        padding: 8,
        opacity: 0.9,
    },
    playBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 4,
    },
    progressContainer: {
        paddingHorizontal: 4,
        marginTop: 8,
    },
    progressBarBg: {
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.1)',
        width: '100%',
        borderRadius: 1.5,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#9B5DE5', // Matching app theme purple
        borderRadius: 1.5,
    }
});

import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Modal, Dimensions, ScrollView, Animated, ActivityIndicator, FlatList, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import Icon from './Icon';
import Slider from '@react-native-community/slider';

const { width, height } = Dimensions.get('window');

export default function FullScreenPlayer({
    visible,
    onClose,
    currentSong: song, // Alias currentSong to song for internal consistency
    isPlaying,
    isStartingPlayback = false,
    onPlayPause,
    onLike,
    isLiked,
    onNext,
    onPrev,
    onFetchLyrics,
    playlists = [],
    onAddToPlaylist, // Added missing prop
    followedArtists = [],
    onToggleFollow,
    playbackStatus = { position: 0, duration: 0, progress: 0 },
    onSeek,
    isShuffle,
    onToggleShuffle,
    isRepeat,
    onToggleRepeat,
    sleepTimer,
    sleepTimerActive,
    onSetSleepTimer,
    isAutoplay,
    onToggleAutoplay,
    isLyricsVisible: lyricsVisible,
    setIsLyricsVisible: setLyricsVisible,
    downloadFolders = [],
    onDownload,
    onAddToDownloadFolder
}) {
    const [menuVisible, setMenuVisible] = useState(false);
    const [barWidth, setBarWidth] = useState(0);
    // ...
    // (skipping unchanged lines for brevity in thought, but must be exact in tool)
    // Actually I'll target the props destructuring and start of component

    const [creditsVisible, setCreditsVisible] = useState(false);
    const [playlistsVisible, setPlaylistsVisible] = useState(false);
    const [downloadFoldersVisible, setDownloadFoldersVisible] = useState(false);
    const [sleepTimerVisible, setSleepTimerVisible] = useState(false);
    const [lyrics, setLyrics] = useState('');
    const [loadingLyrics, setLoadingLyrics] = useState(false);

    // Smooth Scrubbing State
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [localProgress, setLocalProgress] = useState(0);

    // Using a ref for the animation value
    const fadeAnim = useState(new Animated.Value(0))[0];

    useEffect(() => {
        if (!visible) {
            setLyricsVisible(false);
            setMenuVisible(false);
            setPlaylistsVisible(false);
            setDownloadFoldersVisible(false);
            setCreditsVisible(false);
        }
    }, [visible]);

    useEffect(() => {
        if (lyricsVisible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        } else {
            fadeAnim.setValue(0);
        }
    }, [lyricsVisible]);

    useEffect(() => {
        if (visible && lyricsVisible && song?.id) {
            handleFetchLyrics();
        }
    }, [song?.id]);

    if (!song) return null;

    const formatTime = (millis) => {
        if (!millis || millis < 0) return '0:00';
        const totalSeconds = millis / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const handleFetchLyrics = async () => {
        setMenuVisible(false);
        setLyricsVisible(true);
        setLoadingLyrics(true);
        // Don't clear lyrics immediately to prevent white flicker/jump
        // They will be replaced when cleanText/ LRCLIB text arrives

        try {
            // Try JioSaavn first
            const text = await onFetchLyrics(song);
            // Basic cleanup of HTML tags if present (common in Saavn API)
            const cleanText = text.replace(/<br\s*[\/]?>/gi, '\n').replace(/<[^>]+>/g, '');
            setLyrics(cleanText);
        } catch (e) {
            // Fallback to LRCLIB
            try {
                const artistName = song.artists?.primary?.[0]?.name || song.artist || '';
                const trackName = song.name || '';
                const duration = Math.floor((playbackStatus.duration || 0) / 1000); // Convert to seconds

                const response = await fetch(
                    `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artistName)}&track_name=${encodeURIComponent(trackName)}&duration=${duration}`
                );

                if (response.ok) {
                    const data = await response.json();
                    const lrcText = data.syncedLyrics || data.plainLyrics;

                    if (lrcText) {
                        setLyrics(lrcText);
                    } else {
                        setLyrics("Lyrics not available.");
                    }
                } else {
                    setLyrics("Lyrics not available.");
                }
            } catch (lrcError) {
                setLyrics("Lyrics not available.");
            }
        }

        setLoadingLyrics(false);
    };

    // Use local progress while scrubbing, otherwise use playback status
    const currentProgress = isScrubbing ? localProgress : playbackStatus.progress;

    const handleSlidingStart = () => {
        setIsScrubbing(true);
        setLocalProgress(playbackStatus.progress);
    };

    const handleSlidingComplete = (value) => {
        setIsScrubbing(false);
        if (playbackStatus && playbackStatus.duration > 0) {
            onSeek(Math.floor(value * playbackStatus.duration));
        }
    };

    const handleBackPress = () => {
        if (lyricsVisible) {
            setLyricsVisible(false);
        } else {
            onClose();
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleBackPress}>
            <View style={styles.container}>
                {/* Header (Down Arrow) */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBackPress} style={styles.downBtn}>
                        <Icon name="keyboard-arrow-down" size={32} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{lyricsVisible ? 'LYRICS' : 'PLAYING FROM PLAYLIST'}</Text>
                    <TouchableOpacity style={{ padding: 8 }} onPress={() => setMenuVisible(true)}>
                        <Icon name="more-vert" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Main View or Lyrics View */}
                {!lyricsVisible ? (
                    <View style={{ flex: 1 }}>
                        {/* Album Art - Tappable for Lyrics */}
                        <TouchableOpacity
                            style={styles.artContainer}
                            onPress={handleFetchLyrics}
                            activeOpacity={0.8}
                        >
                            <Image
                                source={{ uri: song.image?.[2]?.url || song.image?.[1]?.url }}
                                style={styles.art}
                            />
                        </TouchableOpacity>

                        {/* Info */}
                        <View style={styles.infoRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.title} numberOfLines={1}>{song.name}</Text>
                                <Text style={styles.artist}>{song.artists?.primary?.[0]?.name}</Text>
                            </View>
                            <TouchableOpacity onPress={() => onLike && onLike(song)} style={styles.heartBtn}>
                                <Icon name={isLiked ? "favorite" : "favorite-border"} size={32} color={isLiked ? "#9B5DE5" : "#FFF"} />
                            </TouchableOpacity>
                        </View>

                        {/* Progress Bar (Smooth Slider) */}
                        <View style={styles.progressContainer}>
                            <Slider
                                style={styles.slider}
                                minimumValue={0}
                                maximumValue={1}
                                value={currentProgress}
                                minimumTrackTintColor="#FFF"
                                maximumTrackTintColor="rgba(255,255,255,0.2)"
                                thumbTintColor="#FFF"
                                onSlidingStart={handleSlidingStart}
                                onSlidingComplete={handleSlidingComplete}
                                onValueChange={(val) => setLocalProgress(val)}
                            />
                            <View style={styles.timeRow}>
                                <Text style={styles.timeText}>
                                    {formatTime(isScrubbing ? localProgress * playbackStatus.duration : playbackStatus.position)}
                                </Text>
                                <Text style={styles.timeText}>{formatTime(playbackStatus.duration)}</Text>
                            </View>
                        </View>

                        {/* Controls */}
                        <View style={styles.controls}>
                            <TouchableOpacity onPress={onToggleShuffle}>
                                <Icon name="shuffle" size={24} color={isShuffle ? "#9B5DE5" : "#B3B3B3"} />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={onPrev}>
                                <Icon name="skip-previous" size={38} color="#FFF" />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={onPlayPause}>
                                <View style={styles.playBtnWrapper}>
                                    {isStartingPlayback ? (
                                        <ActivityIndicator size="large" color="#9B5DE5" />
                                    ) : (
                                        <Icon name={isPlaying ? "pause" : "play-arrow"} size={40} color="#9B5DE5" />
                                    )}
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={onNext}>
                                <Icon name="skip-next" size={38} color="#FFF" />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={onToggleRepeat}>
                                <Icon name="repeat" size={24} color={isRepeat ? "#9B5DE5" : "#B3B3B3"} />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        {/* Lyrics Display Area */}
                        <View style={styles.lyricsMainContainer}>
                            {/* Header removed as requested, now using main header */}

                            <LyricsView
                                lyrics={lyrics}
                                position={playbackStatus.position}
                                isLoading={loadingLyrics}
                            />
                        </View>
                        {/* Glassy Mini Player at Bottom of Lyrics */}
                        <BlurView intensity={80} tint="dark" style={styles.miniPlayerGlassContainer}>
                            <View style={styles.miniPlayerInner}>
                                {/* Song Info */}
                                <View style={styles.miniPlayerInfo}>
                                    <Image
                                        source={{ uri: song.image?.[1]?.url || song.image }}
                                        style={styles.miniPlayerArt}
                                    />
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.miniPlayerTitle} numberOfLines={1}>{song.name}</Text>
                                        <Text style={styles.miniPlayerArtist} numberOfLines={1}>
                                            {song.artists?.primary?.[0]?.name}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => onLike && onLike(song)} style={{ padding: 8 }}>
                                        <Icon name={isLiked ? "favorite" : "favorite-border"} size={24} color={isLiked ? "#9B5DE5" : "#FFF"} />
                                    </TouchableOpacity>
                                </View>

                                {/* Progress Bar */}
                                <View style={styles.miniProgressContainer}>
                                    <Slider
                                        style={{ width: '100%', height: 20 }}
                                        minimumValue={0}
                                        maximumValue={1}
                                        value={currentProgress}
                                        minimumTrackTintColor="#9B5DE5"
                                        maximumTrackTintColor="rgba(255,255,255,0.2)"
                                        thumbTintColor="#9B5DE5"
                                        onSlidingStart={handleSlidingStart}
                                        onSlidingComplete={handleSlidingComplete}
                                        onValueChange={(val) => setLocalProgress(val)}
                                    />
                                </View>

                                {/* Mini Controls */}
                                <View style={styles.miniControls}>
                                    <TouchableOpacity onPress={onToggleShuffle}>
                                        <Icon name="shuffle" size={20} color={isShuffle ? "#9B5DE5" : "#B3B3B3"} />
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={onPrev}>
                                        <Icon name="skip-previous" size={32} color="#FFF" />
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={onPlayPause} style={styles.miniPlayBtn}>
                                        {isStartingPlayback ? (
                                            <ActivityIndicator size="small" color="#000" />
                                        ) : (
                                            <Icon name={isPlaying ? "pause" : "play-arrow"} size={28} color="#000" />
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={onNext}>
                                        <Icon name="skip-next" size={32} color="#FFF" />
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={onToggleRepeat}>
                                        <Icon name="repeat" size={20} color={isRepeat ? "#9B5DE5" : "#B3B3B3"} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </BlurView>
                    </View>
                )}

                {/* Options Menu Modal */}
                <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                    <TouchableOpacity
                        style={styles.menuOverlay}
                        activeOpacity={1}
                        onPress={() => setMenuVisible(false)}
                    >
                        <View style={styles.menuContent}>
                            <View style={styles.menuHeader}>
                                <Image source={{ uri: song.image?.[1]?.url }} style={styles.menuThumb} />
                                <View style={styles.menuHeaderInfo}>
                                    <Text numberOfLines={1} style={styles.menuSongName}>{song.name}</Text>
                                    <Text numberOfLines={1} style={styles.menuArtistName}>{song.artists?.primary?.[0]?.name}</Text>
                                </View>
                            </View>

                            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); onLike(song); }}>
                                <Icon name={isLiked ? "favorite" : "favorite-border"} size={24} color={isLiked ? "#9B5DE5" : "#FFF"} />
                                <Text style={styles.menuItemText}>{isLiked ? "Remove from Liked" : "Add to Liked Songs"}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); onDownload(); }}>
                                <Icon name="file-download" size={24} color="#FFF" />
                                <Text style={styles.menuItemText}>Download</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setPlaylistsVisible(true); }}>
                                <Icon name="library-add" size={24} color="#FFF" />
                                <Text style={styles.menuItemText}>Add to Library</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setDownloadFoldersVisible(true); }}>
                                <Icon name="folder-open" size={24} color="#FFF" />
                                <Text style={styles.menuItemText}>Add to Download Folder</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setCreditsVisible(true); }}>
                                <Icon name="info-outline" size={24} color="#FFF" />
                                <Text style={styles.menuItemText}>Song Details</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setSleepTimerVisible(true); }}>
                                <Icon name="timer" size={24} color="#FFF" />
                                <View>
                                    <Text style={styles.menuItemText}>Sleep Timer</Text>
                                    {sleepTimerActive && <Text style={styles.menuItemSubText}>{sleepTimer} min left</Text>}
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuItem} onPress={handleFetchLyrics}>
                                <Icon name="description" size={24} color="#FFF" />
                                <Text style={styles.menuItemText}>View Lyrics</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); onToggleAutoplay(); }}>
                                <Icon name={isAutoplay ? "autoplay" : "play-circle-outline"} size={24} color={isAutoplay ? "#9B5DE5" : "#FFF"} />
                                <Text style={styles.menuItemText}>{isAutoplay ? "Autoplay On" : "Autoplay Off"}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
                                <Icon name="share" size={24} color="#FFF" />
                                <Text style={styles.menuItemText}>Share</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setMenuVisible(false)}>
                                <Text style={styles.cancelBtnText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Sleep Timer Modal */}
                <Modal visible={sleepTimerVisible} transparent animationType="slide" onRequestClose={() => setSleepTimerVisible(false)}>
                    <TouchableOpacity
                        style={styles.menuOverlay}
                        activeOpacity={1}
                        onPress={() => setSleepTimerVisible(false)}
                    >
                        <View style={styles.menuContent}>
                            <Text style={styles.modalSubTitle}>Stop audio in</Text>
                            {[15, 30, 45, 60].map(min => (
                                <TouchableOpacity
                                    key={min}
                                    style={styles.menuItem}
                                    onPress={() => {
                                        onSetSleepTimer(min);
                                        setSleepTimerVisible(false);
                                    }}
                                >
                                    <Icon name="access-time" size={24} color="#FFF" />
                                    <Text style={styles.menuItemText}>{min} minutes</Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => {
                                    onSetSleepTimer(null);
                                    setSleepTimerVisible(false);
                                }}
                            >
                                <Icon name="highlight-off" size={24} color="#FF4444" />
                                <Text style={[styles.menuItemText, { color: '#FF4444' }]}>Turn off timer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSleepTimerVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Playlists Picker Modal */}
                <Modal visible={playlistsVisible} transparent animationType="slide" onRequestClose={() => setPlaylistsVisible(false)}>
                    <TouchableOpacity
                        style={styles.menuOverlay}
                        activeOpacity={1}
                        onPress={() => setPlaylistsVisible(false)}
                    >
                        <View style={[styles.menuContent, { maxHeight: '60%' }]}>
                            <Text style={styles.modalSubTitle}>Add to Library</Text>
                            <ScrollView>
                                {playlists.length > 0 ? (
                                    playlists.map(p => (
                                        <TouchableOpacity
                                            key={p.id}
                                            style={styles.menuItem}
                                            onPress={() => {
                                                onAddToPlaylist(p.id, song);
                                                setPlaylistsVisible(false);
                                            }}
                                        >
                                            <Icon name="library-music" size={24} color="#9B5DE5" />
                                            <Text style={styles.menuItemText}>{p.name}</Text>
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <Text style={{ color: '#9CA3AF', textAlign: 'center', margin: 20 }}>No libraries created yet.</Text>
                                )}
                            </ScrollView>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setPlaylistsVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Download Folders Picker Modal */}
                <Modal visible={downloadFoldersVisible} transparent animationType="slide" onRequestClose={() => setDownloadFoldersVisible(false)}>
                    <TouchableOpacity
                        style={styles.menuOverlay}
                        activeOpacity={1}
                        onPress={() => setDownloadFoldersVisible(false)}
                    >
                        <View style={[styles.menuContent, { maxHeight: '60%' }]}>
                            <Text style={styles.modalSubTitle}>Add to Download Folder</Text>
                            <ScrollView>
                                {downloadFolders.length > 0 ? (
                                    downloadFolders.map(f => (
                                        <TouchableOpacity
                                            key={f.id}
                                            style={styles.menuItem}
                                            onPress={() => {
                                                onDownload(f.id);
                                                setDownloadFoldersVisible(false);
                                            }}
                                        >
                                            <Icon name="folder" size={24} color="#1DB954" />
                                            <Text style={styles.menuItemText}>{f.name}</Text>
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <Text style={{ color: '#9CA3AF', textAlign: 'center', margin: 20 }}>No download folders created yet.</Text>
                                )}
                            </ScrollView>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setDownloadFoldersVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Song Details (Credits) Modal */}
                <Modal visible={creditsVisible} animationType="slide" presentationStyle="overFullScreen" onRequestClose={() => setCreditsVisible(false)}>
                    <View style={[styles.container, { backgroundColor: '#121212' }]}>
                        <View style={styles.header}>
                            <TouchableOpacity onPress={() => setCreditsVisible(false)} style={styles.downBtn}>
                                <Icon name="keyboard-arrow-down" size={32} color="#FFF" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>SONG DETAILS</Text>
                            <View style={{ width: 40 }} />
                        </View>

                        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false} scrollEventThrottle={16} removeClippedSubviews={Platform.OS !== 'web'}>
                            {/* Artwork & Basic Info */}
                            <View style={{ alignItems: 'center', marginBottom: 32, marginTop: 20 }}>
                                <Image
                                    source={{ uri: song.image?.[2]?.url || song.image?.[1]?.url }}
                                    style={{ width: 200, height: 200, borderRadius: 12, elevation: 10 }}
                                />
                                <Text style={[styles.title, { fontSize: 24, textAlign: 'center', marginTop: 20, paddingHorizontal: 20 }]}>{song.name}</Text>
                                <Text style={[styles.artist, { fontSize: 16, textAlign: 'center' }]}>{song.artists?.primary?.[0]?.name}</Text>
                            </View>

                            <View style={styles.divider} />

                            {/* Additional Metadata */}
                            <View style={styles.metadataSection}>
                                <View style={styles.metadataRow}>
                                    <Text style={styles.metadataLabel}>Album</Text>
                                    <Text style={styles.metadataValue}>{song.album?.name || 'Unknown Album'}</Text>
                                </View>
                                <View style={styles.metadataRow}>
                                    <Text style={styles.metadataLabel}>Year</Text>
                                    <Text style={styles.metadataValue}>{song.year || 'Unknown'}</Text>
                                </View>
                                {song.label && (
                                    <View style={styles.metadataRow}>
                                        <Text style={styles.metadataLabel}>Label</Text>
                                        <Text style={styles.metadataValue}>{song.label}</Text>
                                    </View>
                                )}
                                {song.copyright && (
                                    <View style={styles.metadataRow}>
                                        <Text style={styles.metadataLabel}>Copyright</Text>
                                        <Text style={styles.metadataValue}>{song.copyright}</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.divider} />

                            {/* Credits / Artists */}
                            <View style={{ paddingHorizontal: 4 }}>
                                <Text style={[styles.creditsMainTitle, { marginBottom: 16, fontSize: 18, color: '#9B5DE5' }]}>Artists & Credits</Text>
                                {song.artists?.all?.map((artist, index) => {
                                    const isFollowed = followedArtists.includes(artist.name);
                                    return (
                                        <View key={index} style={[styles.artistCard, { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 12 }]}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.artistNameText}>{artist.name}</Text>
                                                <Text style={styles.artistRoleText}>{artist.role || 'Artist'}</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={[styles.followBtn, isFollowed && styles.unfollowBtn]}
                                                onPress={() => onToggleFollow(artist.name)}
                                            >
                                                <Text style={[styles.followBtnText, isFollowed && styles.unfollowBtnText]}>
                                                    {isFollowed ? 'Unfollow' : 'Follow'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>
                </Modal>
            </View>
        </Modal>
    );
}

// Synced Lyrics Component
const LyricsView = ({ lyrics, position, isLoading }) => {
    const [lines, setLines] = useState([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const flatListRef = React.useRef(null);

    // Parse LRC
    useEffect(() => {
        if (!lyrics) {
            setLines([]);
            return;
        }

        // Check if synced
        const isSynced = /\[\d{2,3}:\d{2}\.\d{2,3}\]/.test(lyrics);

        if (!isSynced) {
            // Treat as plain text, split by newlines
            const plainLines = lyrics.split('\n').map((line, index) => ({
                id: `plain-${index}`,
                time: -1,
                text: line.trim()
            })).filter(l => l.text);
            setLines(plainLines);
            setActiveIndex(-1);
            return;
        }

        const parsed = [];
        // Support [mm:ss.xx], [m:ss.xx], [mm:ss.xxx]
        const regex = /\[(\d{1,3}):(\d{2})\.(\d{2,3})\](.*)/g;
        let match;
        while ((match = regex.exec(lyrics)) !== null) {
            const min = parseInt(match[1]);
            const sec = parseInt(match[2]);
            const msStr = match[3];
            const ms = parseInt(msStr.length === 2 ? msStr + '0' : msStr);
            const time = (min * 60 * 1000) + (sec * 1000) + ms;
            const text = match[4].trim();
            if (text) {
                // Ensure unique ID by combining time and index
                parsed.push({ id: `${time}-${parsed.length}`, time, text });
            }
        }

        // Sort by time just in case the LRC file is out of order
        parsed.sort((a, b) => a.time - b.time);
        setLines(parsed);
    }, [lyrics]);

    // Find active line
    useEffect(() => {
        if (lines.length === 0 || lines[0].time === -1) return;

        // Find the last line where time <= current position + offset
        const syncOffset = 300; // Slightly reduced for more immediate feedback
        let index = -1;
        for (let i = 0; i < lines.length; i++) {
            if ((position + syncOffset) >= lines[i].time) {
                index = i;
            } else {
                break;
            }
        }

        // Only update and scroll if the index actually changed and is valid
        if (index !== -1 && index !== activeIndex) {
            setActiveIndex(index);
            if (flatListRef.current) {
                flatListRef.current.scrollToIndex({
                    index,
                    animated: true,
                    // viewPosition 0.3 puts it roughly 1/3 down the screen, 
                    // which is safe from the mini-player at the bottom.
                    viewPosition: 0.3
                });
            }
        }
    }, [position, lines, activeIndex]);

    if (isLoading && lines.length === 0) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}>
                <ActivityIndicator size="large" color="#9B5DE5" />
                <Text style={styles.lyricsLoading}>Looking for lyrics...</Text>
            </View>
        );
    }

    if (lines.length === 0) {
        return <Text style={[styles.lyricsText, { textAlign: 'center', marginTop: 100 }]}>Lyrics not found.</Text>;
    }

    if (lines[0].time === -1) {
        // Render plain text
        return (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.lyricsText}>{lyrics}</Text>
            </ScrollView>
        );
    }

    // Render Synced
    return (
        <FlatList
            ref={flatListRef}
            data={lines}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            // Add massive padding: Top padding to allow first line to center, 
            // bottom padding to ensure last line isn't hidden by mini-player.
            contentContainerStyle={{
                paddingTop: height * 0.3,
                paddingBottom: height * 0.6
            }}
            getItemLayout={(data, index) => ({
                length: 72,
                offset: 72 * index,
                index
            })}
            renderItem={({ item, index }) => {
                const isActive = index === activeIndex;

                return (
                    <TouchableOpacity
                        style={[styles.lyricLine, isActive && styles.activeLyricLine]}
                        activeOpacity={1}
                    >
                        <Text style={[
                            styles.lyricText,
                            isActive ? styles.activeLyricText : styles.inactiveLyricText
                        ]}>
                            {item.text}
                        </Text>
                    </TouchableOpacity>
                );
            }}
            onScrollToIndexFailed={info => {
                flatListRef.current?.scrollToOffset({
                    offset: 72 * info.index,
                    animated: true
                });
            }}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000', // Solid black for lyrics focus as per image
        paddingTop: 40,
        paddingHorizontal: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    headerTitle: {
        color: '#B3B3B3',
        fontSize: 11,
        letterSpacing: 1.5,
        fontWeight: '700',
    },
    downBtn: {
        padding: 4,
    },
    artContainer: {
        alignItems: 'center',
        marginBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 25,
        elevation: 25,
    },
    art: {
        width: width * 0.80,
        height: width * 0.80,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 28,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: '#FFF',
        marginBottom: 4,
    },
    artist: {
        fontSize: 18,
        color: '#B3B3B3',
        fontWeight: '500',
    },
    heartBtn: {
        padding: 4,
    },
    progressContainer: {
        marginBottom: 30,
    },
    slider: {
        width: '100%',
        height: 40,
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: -8,
    },
    timeText: {
        color: '#B3B3B3',
        fontSize: 12,
        fontWeight: '500',
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    playBtnWrapper: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    lyricsMainContainer: {
        flex: 1,
        paddingBottom: 0,
    },
    lyricsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    lyricsHeaderText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 1,
    },
    lyricsSongName: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        flex: 1,
        marginRight: 12,
    },
    lyricsText: {
        color: '#FFF',
        fontSize: 24,
        lineHeight: 38,
        fontWeight: '700',
        textAlign: 'left',
    },
    lyricsLoading: {
        color: '#9B5DE5',
        fontSize: 18,
        textAlign: 'center',
        marginTop: 100,
    },
    // Menu Modal Styles
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    menuContent: {
        backgroundColor: '#282828',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 24,
        paddingBottom: 40,
    },
    menuHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 32,
        paddingBottom: 16,
        borderBottomWidth: 0.5,
        borderBottomColor: '#404040',
    },
    menuThumb: {
        width: 50,
        height: 50,
        borderRadius: 4,
    },
    menuHeaderInfo: {
        marginLeft: 16,
        flex: 1,
    },
    // Synced Lyrics Styles
    lyricLine: {
        height: 72, // Explicitly match getItemLayout length
        justifyContent: 'center',
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    activeLyricLine: {
        // backgroundColor: 'rgba(155, 93, 229, 0.1)', // Optional background highlight
    },
    lyricText: {
        fontSize: 24,
        fontWeight: '700',
        lineHeight: 38,
        textAlign: 'left', // Align left for modern look
        paddingHorizontal: 10,
    },
    activeLyricText: {
        color: '#FFF', // Bright white for active
        fontSize: 32, // Significantly larger
        fontWeight: '900',
        opacity: 1,
    },
    inactiveLyricText: {
        color: 'rgba(255, 255, 255, 0.2)', // Very dim for non-active
        fontSize: 24,
        fontWeight: '700',
    },
    // Mini Player Styles (Glass Effect)
    miniPlayerGlassContainer: {
        position: 'absolute',
        bottom: 20,
        left: 12,
        right: 12,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        elevation: 10,
    },
    miniPlayerInner: {
        backgroundColor: 'rgba(20,20,20,0.4)', // Very transparent base
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 20,
    },
    miniPlayerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    miniPlayerArt: {
        width: 48,
        height: 48,
        borderRadius: 6,
    },
    miniPlayerTitle: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    miniPlayerArtist: {
        color: '#B3B3B3',
        fontSize: 12,
    },
    miniProgressContainer: {
        marginBottom: 8,
    },
    miniControls: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    miniPlayBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#9B5DE5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuSongName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    menuArtistName: {
        color: '#B3B3B3',
        fontSize: 14,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
    },
    menuItemText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 16,
    },
    cancelBtn: {
        marginTop: 16,
        alignItems: 'center',
        paddingVertical: 12,
    },
    cancelBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    modalSubTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        paddingBottom: 10,
    },
    // Credits Styles
    creditsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    creditsMainTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '700',
    },
    showAllText: {
        color: '#B3B3B3',
        fontSize: 14,
        fontWeight: '700',
    },
    artistCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        backgroundColor: '#1A1A1A',
        padding: 16,
        borderRadius: 12,
    },
    artistNameText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 2,
    },
    artistRoleText: {
        color: '#B3B3B3',
        fontSize: 14,
        fontWeight: '500',
    },
    followBtn: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#404040',
        marginLeft: 12,
    },
    unfollowBtn: {
        backgroundColor: 'transparent',
        borderColor: '#B3B3B3',
    },
    followBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
    unfollowBtnText: {
        color: '#FFF',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginVertical: 24,
    },
    metadataSection: {
        paddingHorizontal: 4,
    },
    metadataRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    metadataLabel: {
        color: '#B3B3B3',
        fontSize: 14,
        fontWeight: '600',
    },
    metadataValue: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        textAlign: 'right',
        marginLeft: 20,
    }
});

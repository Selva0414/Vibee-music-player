import React, { memo } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ScrollView, Dimensions, Platform } from 'react-native';
import Icon from '../components/Icon';
import GenreCard from '../components/GenreCard';
import SongItem from '../components/SongItem';

const { width } = Dimensions.get('window');

const VerticalSongItem = memo(({ song, isPlaying, isStartingPlayback, startingSongId, onPlay, onLike, isLiked }) => {
    return (
        <TouchableOpacity
            style={styles.verticalItemContainer}
            onPress={() => onPlay(song)}
            activeOpacity={0.7}
        >
            <View style={styles.verticalLeft}>
                <Image
                    source={{ uri: song.image?.[1]?.url || song.image?.[0]?.url }}
                    style={styles.verticalImage}
                />
                <View style={styles.verticalInfo}>
                    <Text style={styles.verticalTitle} numberOfLines={2}>{song.name}</Text>
                    <Text style={styles.verticalArtist} numberOfLines={1}>{song.artist || song.artists?.primary?.[0]?.name}</Text>
                </View>
            </View>
            <TouchableOpacity
                style={styles.likeButton}
                onPress={() => onLike(song)}
            >
                <Icon
                    name={isLiked ? "favorite" : "favorite-border"}
                    size={24}
                    color={isLiked ? "#9B5DE5" : "#B3B3B3"}
                />
            </TouchableOpacity>
        </TouchableOpacity>
    );
});

const VerticalSection = memo(({ title, data, currentSong, isPlaying, isStartingPlayback, startingSongId, onTrackSelect, onLike, likedSongs }) => {
    if (!data || data.length === 0) return null;

    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            <View style={styles.verticalListContainer}>
                {data.slice(0, 10).map((item) => (
                    <VerticalSongItem
                        key={item.id}
                        song={item}
                        isPlaying={currentSong?.id === item.id && isPlaying}
                        isStartingPlayback={isStartingPlayback}
                        startingSongId={startingSongId}
                        onPlay={(song) => onTrackSelect(song, data)}
                        onLike={onLike}
                        isLiked={likedSongs.some(s => s.id === item.id)}
                    />
                ))}
            </View>
        </View>
    );
});

const HorizontalSection = memo(({ title, data, currentSong, isPlaying, isStartingPlayback, startingSongId, onTrackSelect, onShowAll }) => {
    if (!data || data.length === 0) return null;

    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
                <TouchableOpacity onPress={() => onShowAll && onShowAll(title)}>
                    <Text style={styles.showAll}>Show all</Text>
                </TouchableOpacity>
            </View>
            <FlatList
                horizontal
                data={data}
                renderItem={({ item }) => (
                    <GenreCard
                        song={item}
                        isPlaying={currentSong?.id === item.id && isPlaying}
                        isStartingPlayback={isStartingPlayback}
                        startingSongId={startingSongId}
                        onPlay={(song) => onTrackSelect(song, data)}
                    />
                )}
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalListContent}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={3}
                removeClippedSubviews={Platform.OS !== 'web'}
            />
        </View>
    );
});

export default memo(function HomeScreen({
    onTrackSelect,
    currentSong,
    isPlaying,
    isStartingPlayback,
    startingSongId,
    onLike,
    likedSongs,
    sections,
    loading,
    errorText,
    currentLanguage,
    onLanguagePress,
    languages,
    onLanguageSelect,
    artists,
    onArtistSelect,
    onShowAll
}) {

    const renderLoading = () => (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.logoRow}>
                    <Text style={styles.headerTitle}>Vibee</Text>
                </View>
            </View>
            <View style={[styles.center, { flex: 1 }]}>
                <Icon name="library-music" size={48} color="#9B5DE5" />
                <Text style={{ color: '#9B5DE5', marginTop: 12, fontWeight: '600' }}>Loading your music...</Text>
            </View>
        </View>
    );

    if (loading && (!sections.trending || sections.trending.length === 0)) {
        return renderLoading();
    }

    if (!loading && (!sections.trending || sections.trending.length === 0) && errorText) {
        return (
            <View style={styles.container}>
                <View style={[styles.center, { flex: 1, paddingHorizontal: 24 }]}>
                    <Text style={{ color: '#FFF', fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
                        Couldn’t load songs
                    </Text>
                    <Text style={{ color: '#9CA3AF', fontWeight: '600', textAlign: 'center' }}>
                        {errorText}
                    </Text>
                </View>
            </View>
        );
    }

    // Empty State (No Error, but No Data)
    if (!loading && (!sections.trending || sections.trending.length === 0) && !errorText) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.logoRow}>
                        <Text style={styles.headerTitle}>Vibee</Text>
                    </View>
                </View>
                <View style={[styles.center, { flex: 1, paddingHorizontal: 24 }]}>
                    <Icon name="music-off" size={48} color="#333" />
                    <Text style={{ color: '#FFF', fontWeight: '700', marginTop: 16, marginBottom: 8, textAlign: 'center' }}>
                        No songs found
                    </Text>
                    <Text style={{ color: '#9CA3AF', textAlign: 'center' }}>
                        We couldn't find any songs for {languages.find(l => l.id === currentLanguage)?.name || 'this language'}.
                        Try switching languages.
                    </Text>

                    {/* Horizontal Language Pill Menu for quick switch */}
                    <View style={{ marginTop: 24, height: 50 }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {languages?.map((lang) => (
                                <TouchableOpacity
                                    key={lang.id}
                                    style={[styles.langChip, currentLanguage === lang.id && styles.activeLangChip, { marginHorizontal: 4 }]}
                                    onPress={() => onLanguageSelect(lang.id)}
                                >
                                    <Text style={[styles.langChipText, currentLanguage === lang.id && styles.activeLangChipText]}>{lang.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Professional Header */}
            <View style={styles.header}>
                <View style={styles.logoRow}>
                    <Text style={styles.headerTitle}>Vibee</Text>
                </View>
            </View>

            {/* Horizontal Language Pill Menu */}
            <View style={styles.languageMenuContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.languageChipsContent}
                >
                    {languages?.map((lang) => {
                        const isActive = currentLanguage === lang.id;
                        return (
                            <TouchableOpacity
                                key={lang.id}
                                style={[
                                    styles.langChip,
                                    isActive && styles.activeLangChip
                                ]}
                                onPress={() => onLanguageSelect(lang.id)}
                            >
                                <Text style={[
                                    styles.langChipText,
                                    isActive && styles.activeLangChipText
                                ]}>
                                    {lang.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <ScrollView
                style={styles.mainContent}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={Platform.OS !== 'web'}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingBottom: 80 }}
            >
                {/* 1. Trending Songs - Latest movie hits */}
                <HorizontalSection
                    title="Trending Songs"
                    data={sections.trending}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    isStartingPlayback={isStartingPlayback}
                    startingSongId={startingSongId}
                    onTrackSelect={onTrackSelect}
                    onShowAll={onShowAll}
                />

                {/* 2. Chill Songs - Calm & Relaxed */}
                <HorizontalSection
                    title="Chill Songs"
                    data={sections.chill}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    isStartingPlayback={isStartingPlayback}
                    startingSongId={startingSongId}
                    onTrackSelect={onTrackSelect}
                    onShowAll={onShowAll}
                />

                {/* 3. Item Songs - Party & Dance */}
                <HorizontalSection
                    title="Love Songs"
                    data={sections.item}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    isStartingPlayback={isStartingPlayback}
                    startingSongId={startingSongId}
                    onTrackSelect={onTrackSelect}
                    onShowAll={onShowAll}
                />

                {/* 4. Melody Songs - Emotional & Expressive */}
                <HorizontalSection
                    title="Melody Songs"
                    data={sections.melody}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    isStartingPlayback={isStartingPlayback}
                    startingSongId={startingSongId}
                    onTrackSelect={onTrackSelect}
                    onShowAll={onShowAll}
                />

                {/* 5. Songs for You - Personalized Mix */}
                <VerticalSection
                    title="Songs for You"
                    data={sections.songsForYou}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    isStartingPlayback={isStartingPlayback}
                    startingSongId={startingSongId}
                    onTrackSelect={onTrackSelect}
                    onLike={onLike}
                    likedSongs={likedSongs}
                />

                {/* Horizontal Artist Selection Menu */}
                <View style={{ marginTop: 24, marginBottom: 40 }}>
                    <Text style={{
                        color: '#FFF',
                        fontSize: 22,
                        fontWeight: 'bold',
                        paddingHorizontal: 20,
                        marginBottom: 16
                    }}>Explore Artists</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16 }}
                    >
                        {artists?.map((artist, idx) => (
                            <TouchableOpacity
                                key={idx}
                                activeOpacity={0.7}
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.06)',
                                    paddingHorizontal: 20,
                                    paddingVertical: 10,
                                    borderRadius: 30,
                                    marginHorizontal: 6,
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.1)'
                                }}
                                onPress={() => onArtistSelect(artist)}
                            >
                                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>{artist}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </ScrollView>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 10,
    },
    logoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#9B5DE5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        // Add a subtle shadow for a "professional" feel
        elevation: 4,
        shadowColor: '#9B5DE5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -1.5,
        textTransform: 'lowercase',
    },
    langButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    sectionContainer: {
        marginBottom: 32,
    },
    verticalListContainer: {
        paddingHorizontal: 16,
        gap: 12,
    },
    verticalItemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#121212',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    verticalLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    verticalImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
        marginRight: 16,
    },
    verticalInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    verticalTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    verticalArtist: {
        color: '#B3B3B3',
        fontSize: 13,
        fontWeight: '500',
    },
    likeButton: {
        padding: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    showAll: {
        color: '#B3B3B3',
        fontSize: 12,
        fontWeight: '600',
    },
    horizontalListContent: {
        paddingHorizontal: 16,
    },
    // Language Chips Styles
    languageMenuContainer: {
        paddingVertical: 12,
        marginBottom: 8,
    },
    languageChipsContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    langChip: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeLangChip: {
        backgroundColor: '#FFF',
    },
    langChipText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    activeLangChipText: {
        color: '#000',
    },
    errorContainer: {
        padding: 20,
        alignItems: 'center',
        marginTop: 20
    },
    errorText: {
        color: '#ff4444',
        textAlign: 'center',
        fontSize: 14
    },
    retryText: {
        color: '#9B5DE5',
        marginTop: 10,
        fontWeight: 'bold'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200
    },
    loadingText: {
        color: '#B3B3B3',
        marginTop: 10,
        fontSize: 12
    }
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';

export default function AiScreen({ onSmartSearch }) {
    const [searchText, setSearchText] = useState('');

    const MOODS = [
        { name: 'Pop', colors: ['#FF2D55', '#5856D6'] },
        { name: 'Hip-Hop', colors: ['#FF9500', '#FF2D55'] },
        { name: 'R&B', colors: ['#5856D6', '#007AFF'] },
        { name: 'Rock', colors: ['#FF3B30', '#FF9500'] },
        { name: 'EDM', colors: ['#34C759', '#007AFF'] },
        { name: 'Indie', colors: ['#AF52DE', '#FF2D55'] },
        { name: 'K-Pop', colors: ['#FF2D55', '#AF52DE'] },
        { name: 'Latin', colors: ['#FFCC00', '#FF9500'] },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Vibe Search</Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
                {/* AI Playlist Generation Section */}
                <View style={{ marginHorizontal: 16, marginBottom: 32, marginTop: 8 }}>
                    <LinearGradient
                        colors={['rgba(30, 41, 59, 0.7)', 'rgba(15, 23, 42, 0.8)']}
                        style={{
                            borderRadius: 24,
                            padding: 24,
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <LinearGradient
                                colors={['#9B5DE5', '#5856D6']}
                                style={{ width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 }}
                            >
                                <Icon name="search" size={20} color="#FFF" />
                            </LinearGradient>
                            <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '800' }}>Smart Playlist</Text>
                        </View>
                        <Text style={{ color: '#94A3B8', fontSize: 15, marginBottom: 20, lineHeight: 22 }}>
                            Describe your vibe, and we'll curate the perfect soundtrack for your moment.
                        </Text>
                        <View style={{
                            flexDirection: 'row',
                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                            borderRadius: 16,
                            paddingHorizontal: 15,
                            alignItems: 'center',
                            height: 56,
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.08)'
                        }}>
                            <Icon name="search" size={20} color="#94A3B8" />
                            <TextInput
                                style={{ flex: 1, color: '#FFF', marginLeft: 12, fontSize: 16, fontWeight: '500' }}
                                placeholder="E.g. Late night drive in Tokyo..."
                                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                                value={searchText}
                                onChangeText={setSearchText}
                                onSubmitEditing={() => {
                                    if (searchText.trim()) onSmartSearch(searchText);
                                }}
                            />
                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#9B5DE5',
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                                onPress={() => {
                                    if (searchText.trim()) onSmartSearch(searchText);
                                }}
                            >
                                <Icon name="arrow-forward" size={18} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </View>

                {/* Moods & Genres Grid */}
                <View style={{ marginHorizontal: 16, marginBottom: 24 }}>
                    <Text style={{ color: '#FFF', fontSize: 24, fontWeight: '800', marginBottom: 4 }}>Moods & Genres</Text>
                    <Text style={{ color: '#94A3B8', fontSize: 15, marginBottom: 20 }}>Tailored music for every emotion</Text>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                        {MOODS.map((mood) => (
                            <TouchableOpacity
                                key={mood.name}
                                activeOpacity={0.8}
                                style={{
                                    width: '48%',
                                    height: 110,
                                    marginBottom: 16,
                                }}
                                onPress={() => {
                                    onSmartSearch(`${mood.name} songs`);
                                }}
                            >
                                <LinearGradient
                                    colors={mood.colors}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={{
                                        flex: 1,
                                        borderRadius: 20,
                                        padding: 20,
                                        justifyContent: 'flex-end',
                                        shadowColor: mood.colors[0],
                                        shadowOffset: { width: 0, height: 8 },
                                        shadowOpacity: 0.4,
                                        shadowRadius: 10,
                                        elevation: 8,
                                    }}
                                >
                                    <Text style={{
                                        color: '#FFF',
                                        fontSize: 22,
                                        fontWeight: '900',
                                        letterSpacing: -0.5,
                                        textShadowColor: 'rgba(0,0,0,0.3)',
                                        textShadowOffset: { width: 0, height: 1 },
                                        textShadowRadius: 4
                                    }}>
                                        {mood.name}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        paddingTop: Platform.OS === 'android' ? 40 : 20,
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFF',
    },
});

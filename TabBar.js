import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from './Icon';

export default function TabBar({ activeTab, onTabChange }) {
    const tabs = [
        { id: 'home', icon: 'home', label: 'Home', library: 'MaterialIcons' },
        { id: 'vibe', icon: 'auto-awesome', label: 'Vibe', library: 'MaterialIcons' },
        { id: 'search', icon: 'search', label: 'Search', library: 'MaterialIcons' },
        { id: 'library', icon: 'library-music', label: 'Library', library: 'MaterialCommunityIcons' },
        { id: 'download', icon: 'save-alt', label: 'Downloads', library: 'MaterialIcons' },
    ];

    return (
        <View style={styles.container}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <TouchableOpacity
                        key={tab.id}
                        style={styles.tab}
                        onPress={() => onTabChange(tab.id)}
                    >
                        <Icon
                            name={tab.icon}
                            size={24}
                            color={isActive ? '#FFF' : '#9CA3AF'}
                        />
                        <Text style={[styles.label, isActive && styles.activeLabel]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: '#050505', // Very dark gray, almost black
        borderTopWidth: 0,
        paddingBottom: 4,
        paddingTop: 8,
        elevation: 8,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
    },
    label: {
        fontSize: 10,
        marginTop: 4,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    activeLabel: {
        color: '#FFF',
    },
});

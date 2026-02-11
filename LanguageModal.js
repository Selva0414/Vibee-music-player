import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';

export default function LanguageModal({ visible, onClose, onSelect, currentLanguage }) {
    const languages = ['Hindi', 'English', 'Punjabi', 'Telugu', 'Tamil', 'Kannada'];

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.content}>
                            {languages.map((lang) => (
                                <TouchableOpacity
                                    key={lang}
                                    style={[styles.item, currentLanguage === lang.toLowerCase() && styles.activeItem]}
                                    onPress={() => onSelect(lang.toLowerCase())}
                                >
                                    <Text style={[styles.text, currentLanguage === lang.toLowerCase() && styles.activeText]}>
                                        {lang}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', // Center vertically for the popup look
        alignItems: 'flex-end',
        paddingRight: 16,
        paddingTop: 60, // approximate position near the top right globe icon
        justifyContent: 'flex-start', // Align top
    },
    content: {
        backgroundColor: '#1F1F1F',
        borderRadius: 12,
        paddingVertical: 8,
        width: 160,
        elevation: 10,
    },
    item: {
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    activeItem: {
        backgroundColor: '#9B5DE5',
        marginHorizontal: 8,
        borderRadius: 20,
        paddingVertical: 10,
    },
    text: {
        color: '#9CA3AF',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center'
    },
    activeText: {
        color: '#FFFFFF', // White text on Purple background
        fontWeight: '700',
    }
});

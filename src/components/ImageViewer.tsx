import React from 'react';
import { StyleSheet, View, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ImageViewing from 'react-native-image-viewing';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useTheme } from '../contexts/ThemeContext';

interface ImageViewerProps {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
}

export default function ImageViewer({ visible, imageUrl, onClose }: ImageViewerProps) {
  const { colors } = useTheme();

  const handleSaveToGallery = async () => {
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to save images.');
        return;
      }

      // Download image to cache
      const filename = imageUrl.split('/').pop() || 'image.jpg';
      const localUri = `${FileSystem.cacheDirectory}${filename}`;
      
      const downloadResult = await FileSystem.downloadAsync(imageUrl, localUri);
      
      // Save to camera roll
      await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
      
      Alert.alert('Success', 'Image saved to gallery!');
    } catch (error) {
      console.error('Error saving image:', error);
      Alert.alert('Error', 'Failed to save image to gallery.');
    }
  };

  const handleShare = async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device.');
        return;
      }

      // Download image to cache
      const filename = imageUrl.split('/').pop() || 'image.jpg';
      const localUri = `${FileSystem.cacheDirectory}${filename}`;
      
      const downloadResult = await FileSystem.downloadAsync(imageUrl, localUri);
      
      await Sharing.shareAsync(downloadResult.uri);
    } catch (error) {
      console.error('Error sharing image:', error);
      Alert.alert('Error', 'Failed to share image.');
    }
  };

  const HeaderComponent = () => (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      <TouchableOpacity onPress={onClose} style={styles.headerButton}>
        <Ionicons name="close" size={28} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.headerActions}>
        <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
          <Ionicons name="share-outline" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSaveToGallery} style={styles.headerButton}>
          <Ionicons name="download-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ImageViewing
      images={[{ uri: imageUrl }]}
      imageIndex={0}
      visible={visible}
      onRequestClose={onClose}
      HeaderComponent={HeaderComponent}
      backgroundColor={colors.background}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 1,
  },
  headerButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
});


import React, { useState } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Text, TextInput, ScrollView, Dimensions, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ImagePreviewItem {
  uri: string;
  width?: number;
  height?: number;
  fileSize?: number;
}

interface ImagePreviewModalProps {
  visible: boolean;
  images: ImagePreviewItem[];
  onClose: () => void;
  onSend: (images: ImagePreviewItem[], caption?: string) => void;
  compressionQuality: 'high' | 'medium' | 'low';
  onCompressionChange: (quality: 'high' | 'medium' | 'low') => void;
}

export default function ImagePreviewModal({
  visible,
  images,
  onClose,
  onSend,
  compressionQuality,
  onCompressionChange,
}: ImagePreviewModalProps) {
  const { colors } = useTheme();
  const [caption, setCaption] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const getCompressionValue = (quality: 'high' | 'medium' | 'low'): number => {
    switch (quality) {
      case 'high': return 0.9;
      case 'medium': return 0.7;
      case 'low': return 0.5;
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const handleSend = async () => {
    setIsProcessing(true);
    try {
      // Apply compression to all images
      const compressedImages = await Promise.all(
        images.map(async (img) => {
          const result = await ImageManipulator.manipulateAsync(
            img.uri,
            [],
            {
              compress: getCompressionValue(compressionQuality),
              format: ImageManipulator.SaveFormat.JPEG,
            }
          );
          return {
            uri: result.uri,
            width: result.width,
            height: result.height,
          };
        })
      );

      onSend(compressedImages, caption.trim() || undefined);
      setCaption('');
    } catch (error) {
      console.error('Error processing images:', error);
      Alert.alert('Error', 'Failed to process images. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const _handleRemoveImage = (_index: number) => {
    if (images.length === 1) {
      onClose();
      return;
    }
    // Note: This would require passing a callback to modify the images array
    Alert.alert('Remove Image', 'This feature requires additional implementation.');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {images.length} {images.length === 1 ? 'Image' : 'Images'}
          </Text>
          <TouchableOpacity
            onPress={handleSend}
            style={[styles.sendButton, { backgroundColor: colors.primary }]}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Text style={styles.sendButtonText}>...</Text>
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Image Preview */}
        <View style={styles.imageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setSelectedIndex(index);
            }}
          >
            {images.map((img, index) => (
              <View key={index} style={styles.imagePage}>
                <Image
                  source={{ uri: img.uri }}
                  style={styles.image}
                  contentFit="contain"
                />
              </View>
            ))}
          </ScrollView>

          {/* Image Counter */}
          {images.length > 1 && (
            <View style={[styles.counter, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
              <Text style={styles.counterText}>
                {selectedIndex + 1} / {images.length}
              </Text>
            </View>
          )}
        </View>

        {/* Compression Quality Selector */}
        <View style={[styles.compressionContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Text style={[styles.compressionLabel, { color: colors.textSecondary }]}>
            Quality: {formatFileSize(images[selectedIndex]?.fileSize)}
          </Text>
          <View style={styles.compressionButtons}>
            {(['high', 'medium', 'low'] as const).map((quality) => (
              <TouchableOpacity
                key={quality}
                onPress={() => onCompressionChange(quality)}
                style={[
                  styles.compressionButton,
                  {
                    backgroundColor: compressionQuality === quality ? colors.primary : colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.compressionButtonText,
                    { color: compressionQuality === quality ? '#fff' : colors.text },
                  ]}
                >
                  {quality.charAt(0).toUpperCase() + quality.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Caption Input */}
        <View style={[styles.captionContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.captionInput, { color: colors.text, backgroundColor: colors.background }]}
            placeholder="Add a caption..."
            placeholderTextColor={colors.textSecondary}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={500}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 8,
    width: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  imagePage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  counter: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  compressionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  compressionLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  compressionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  compressionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  compressionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  captionInput: {
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});


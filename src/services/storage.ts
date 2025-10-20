import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadImage(
  uri: string,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    // Fetch the image as a blob
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // Create storage reference
    const storageRef = ref(storage, path);
    
    // Upload with progress tracking
    const uploadTask = uploadBytesResumable(storageRef, blob);
    
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          onProgress?.(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}


import { useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import type { User, Auth } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useStore } from '../state/store';

export function useAuth() {
  const { user, setUser, setIsLoading } = useStore();

  useEffect(() => {
    // Set a timeout to ensure loading state doesn't hang forever
    const timeout = setTimeout(() => {
      console.warn('Auth initialization timeout - setting loading to false');
      setIsLoading(false);
    }, 5000);

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        clearTimeout(timeout);
        try {
          if (firebaseUser) {
            setUser(firebaseUser);
            // Update last seen
            await updateUserPresence(firebaseUser.uid);
          } else {
            setUser(null);
          }
        } catch (error) {
          console.error('Auth state change error:', error);
        } finally {
          setIsLoading(false);
        }
      },
      (error) => {
        clearTimeout(timeout);
        console.error('Auth observer error:', error);
        setIsLoading(false);
      }
    );

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await updateUserPresence(result.user.uid);
      return result.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (email: string, password: string, displayName: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user document
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        email: result.user.email,
        displayName: displayName || email.split('@')[0],
        photoURL: null,
        lastSeen: serverTimestamp(),
        pushToken: null,
        createdAt: serverTimestamp()
      });
      
      return result.user;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (user) {
        await updateUserPresence(user.uid);
      }
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  return { user, login, signup, logout };
}

async function updateUserPresence(uid: string) {
  try {
    const { updateDoc, doc } = await import('firebase/firestore');
    await updateDoc(doc(db, 'users', uid), {
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating presence:', error);
  }
}


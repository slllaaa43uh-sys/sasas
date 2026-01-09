import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * ============================================
 * Capacitor Push Notifications Service
 * ============================================
 * SIMPLIFIED VERSION - Token Registration Only
 * 
 * This service ONLY handles:
 * 1. Creating notification channel (Android)
 * 2. Requesting permissions
 * 3. Registering device and getting FCM token
 * 
 * Notification DISPLAY is handled by Native Android layer
 * to fix FAILED BINDER TRANSACTION crash.
 */

// Store FCM token in memory
let fcmToken: string | null = null;

// Check if running on native platform (iOS/Android)
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Create Android Notification Channel
 * Must be called immediately when app launches.
 */
export const createNotificationChannel = async (): Promise<void> => {
  if (!isNativePlatform()) {
    console.log('ℹ️ Not on native platform, skipping channel creation');
    return;
  }

  try {
    await PushNotifications.createChannel({
      id: 'fcm_default_channel',
      name: 'General',
      importance: 5, // IMPORTANCE_HIGH
      description: 'General notifications',
      sound: 'notify', // Custom sound file: res/raw/notify.mp3
      visibility: 1, // VISIBILITY_PUBLIC
      vibration: true,
    });
    console.log('✅ Android notification channel created successfully');
  } catch (error) {
    console.error('❌ Error creating notification channel:', error);
  }
};

// Check notification permissions
export const checkPermissions = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  if (!isNativePlatform()) {
    if ('Notification' in window) {
      return Notification.permission as 'granted' | 'denied' | 'prompt';
    }
    return 'denied';
  }
  
  const result = await PushNotifications.checkPermissions();
  return result.receive;
};

// Request notification permissions
export const requestPermissions = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  if (!isNativePlatform()) {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission as 'granted' | 'denied' | 'prompt';
    }
    return 'denied';
  }
  
  const result = await PushNotifications.requestPermissions();
  return result.receive;
};

/**
 * Register for push notifications and get FCM token
 * This is the MAIN function - called ONCE on app start
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
  try {
    // Step 1: Check/Request permissions
    let permStatus = await checkPermissions();
    
    if (permStatus === 'prompt') {
      permStatus = await requestPermissions();
    }
    
    if (permStatus !== 'granted') {
      console.warn('⚠️ Push notification permission not granted');
      return null;
    }
    
    if (!isNativePlatform()) {
      console.warn('⚠️ Not running on native platform, skipping registration');
      return null;
    }
    
    // Step 2: Set up ONE-TIME listener for registration token
    // This listener will receive the FCM token after register() is called
    return new Promise((resolve) => {
      // Listener for successful registration
      PushNotifications.addListener('registration', (token) => {
        console.log('✅ FCM Token received:', token.value);
        fcmToken = token.value;
        localStorage.setItem('fcmToken', token.value);
        resolve(token.value);
      });
      
      // Listener for registration error
      PushNotifications.addListener('registrationError', (error) => {
        console.error('❌ Push registration error:', error);
        resolve(null);
      });
      
      // Step 3: Register device
      PushNotifications.register();
      
      // Timeout fallback - return stored token if available
      setTimeout(() => {
        if (!fcmToken) {
          const storedToken = localStorage.getItem('fcmToken');
          if (storedToken) {
            fcmToken = storedToken;
            resolve(storedToken);
          } else {
            resolve(null);
          }
        }
      }, 5000);
    });
  } catch (error) {
    console.error('❌ Error registering for push notifications:', error);
    return null;
  }
};

/**
 * Unregister from push notifications
 * Called when user disables notifications
 */
export const unregisterFromPushNotifications = async (): Promise<void> => {
  if (!isNativePlatform()) {
    console.log('ℹ️ Not on native platform, skipping unregister');
    return;
  }

  try {
    await PushNotifications.unregister();
    fcmToken = null;
    localStorage.removeItem('fcmToken');
    console.log('✅ Successfully unregistered from push notifications');
  } catch (error) {
    console.error('❌ Error unregistering from push notifications:', error);
  }
};

// Get stored FCM token
export const getStoredToken = (): string | null => {
  return fcmToken || localStorage.getItem('fcmToken');
};

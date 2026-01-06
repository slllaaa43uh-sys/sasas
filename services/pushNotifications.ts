import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * ============================================
 * Capacitor Push Notifications Service
 * ============================================
 * خدمة الإشعارات باستخدام Capacitor بدلاً من Firebase Web SDK
 * تعمل على iOS و Android عبر WebView
 */

// متغير لتخزين التوكن
let fcmToken: string | null = null;

// دالة للتحقق مما إذا كنا في بيئة native (iOS/Android)
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * CRITICAL FIX: Create Android Notification Channel
 * This fixes the issue where notifications are received but not shown on Android.
 * Must be called immediately when the app launches.
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
      importance: 5, // IMPORTANCE_HIGH - shows everywhere, makes noise and peeks
      description: 'General notifications',
      sound: 'default',
      visibility: 1, // VISIBILITY_PUBLIC
      vibration: true,
    });
    console.log('✅ Android notification channel created successfully');
  } catch (error) {
    console.error('❌ Error creating notification channel:', error);
  }
};

// دالة للتحقق من صلاحيات الإشعارات
export const checkPermissions = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  if (!isNativePlatform()) {
    // في بيئة الويب، استخدم Web Notification API
    if ('Notification' in window) {
      return Notification.permission as 'granted' | 'denied' | 'prompt';
    }
    return 'denied';
  }
  
  const result = await PushNotifications.checkPermissions();
  return result.receive;
};

// دالة لطلب صلاحيات الإشعارات
export const requestPermissions = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  if (!isNativePlatform()) {
    // في بيئة الويب
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission as 'granted' | 'denied' | 'prompt';
    }
    return 'denied';
  }
  
  const result = await PushNotifications.requestPermissions();
  return result.receive;
};

// دالة لتسجيل الجهاز للإشعارات والحصول على التوكن
export const registerForPushNotifications = async (): Promise<string | null> => {
  try {
    // التحقق من الصلاحيات أولاً
    let permStatus = await checkPermissions();
    
    if (permStatus === 'prompt') {
      permStatus = await requestPermissions();
    }
    
    if (permStatus !== 'granted') {
      console.warn('⚠️ Push notification permission not granted');
      return null;
    }
    
    if (!isNativePlatform()) {
      console.warn('⚠️ Not running on native platform, skipping Capacitor registration');
      return null;
    }
    
    // تسجيل الجهاز للإشعارات
    await PushNotifications.register();
    
    // إرجاع التوكن المخزن (سيتم تحديثه عبر listener)
    return fcmToken;
  } catch (error) {
    console.error('❌ Error registering for push notifications:', error);
    return null;
  }
};

/**
 * Unregister from push notifications
 * Called when user disables notifications via the bell icon
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

// دالة لإعداد مستمعي الإشعارات
export const setupPushNotificationListeners = (
  onTokenReceived: (token: string) => void,
  onNotificationReceived?: (notification: any) => void,
  onError?: (error: any) => void
): void => {
  if (!isNativePlatform()) {
    console.log('ℹ️ Not on native platform, skipping Capacitor listeners');
    return;
  }
  
  // مستمع لاستلام التوكن عند التسجيل الناجح
  PushNotifications.addListener('registration', (token) => {
    console.log('✅ Push registration success, token:', token.value);
    fcmToken = token.value;
    localStorage.setItem('fcmToken', token.value);
    onTokenReceived(token.value);
  });
  
  // مستمع لأخطاء التسجيل
  PushNotifications.addListener('registrationError', (error) => {
    console.error('❌ Push registration error:', error);
    if (onError) {
      onError(error);
    }
  });
  
  // مستمع لاستلام الإشعارات أثناء تشغيل التطبيق
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('📬 Push notification received:', notification);
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });
  
  // مستمع للنقر على الإشعار
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('👆 Push notification action performed:', action);
    // يمكن إضافة منطق التنقل هنا
  });
};

// دالة للحصول على التوكن المخزن
export const getStoredToken = (): string | null => {
  return fcmToken || localStorage.getItem('fcmToken');
};

// دالة لإزالة جميع المستمعين (للتنظيف)
export const removePushNotificationListeners = async (): Promise<void> => {
  if (isNativePlatform()) {
    await PushNotifications.removeAllListeners();
  }
};

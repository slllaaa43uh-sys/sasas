import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, ChevronLeft, Store, MapPin, Loader2, Megaphone, Bell, BellOff
} from 'lucide-react';
import PostCard from './PostCard';
import { Post } from '../types';
import { HARAJ_CATEGORIES } from '../data/categories';
import { API_BASE_URL } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { getDisplayLocation } from '../data/locations';
import { 
  registerForPushNotifications, 
  getStoredToken,
  requestPermissions
} from '../services/pushNotifications';

interface HarajViewProps {
  onFullScreenToggle: (isFull: boolean) => void;
  currentLocation: { country: string; city: string | null };
  onLocationClick: () => void;
  onReport: (type: 'post' | 'comment' | 'reply', id: string, name: string) => void;
  onProfileClick?: (userId: string) => void;
}

const HarajView: React.FC<HarajViewProps> = ({ onFullScreenToggle, currentLocation, onLocationClick, onReport, onProfileClick }) => {
  const { t, language } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ============================================
  // INDEPENDENT Notification State for Haraj
  // ============================================
  // Uses unique localStorage key 'notifications_haraj' to prevent conflicts
  const [harajNotificationsEnabled, setHarajNotificationsEnabled] = useState(() => 
    localStorage.getItem('notifications_haraj') === 'true'
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Show toast helper
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCategoryClick = (name: string) => {
    setLoading(true); 
    setActiveCategory(name);
    onFullScreenToggle(true);
  };

  const handleBack = () => {
    setActiveCategory(null);
    onFullScreenToggle(false);
    setPosts([]);
  };

  // ============================================
  // Haraj Topic Subscription Handler
  // ============================================
  const handleToggleHarajNotifications = async () => {
    try {
      if (!harajNotificationsEnabled) {
        // Currently Disabled -> Enable notifications
        const permission = await requestPermissions();
        if (permission !== 'granted') {
          showToast(language === 'ar' ? 'يرجى السماح بالإشعارات من الإعدادات' : 'Please enable notifications in settings');
          return;
        }
        
        let fcmToken = getStoredToken();
        const authToken = localStorage.getItem('token');
        
        if (!fcmToken) {
          try {
            fcmToken = await registerForPushNotifications();
          } catch (tokenError) {
            console.error('Error getting FCM token:', tokenError);
          }
        }
        
        if (!fcmToken) {
          showToast(language === 'ar' ? 'جارٍ تهيئة الإشعارات، حاول مرة أخرى' : 'Initializing notifications, try again');
          return;
        }
        
        if (!authToken) {
          showToast(language === 'ar' ? 'يرجى تسجيل الدخول أولاً' : 'Please login first');
          return;
        }
        
        // Subscribe to 'haraj' topic ONLY
        const response = await fetch(`${API_BASE_URL}/api/v1/fcm/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            deviceToken: fcmToken,
            topic: 'haraj'  // Only haraj topic
          })
        });
        
        if (response.ok) {
          setHarajNotificationsEnabled(true);
          localStorage.setItem('notifications_haraj', 'true');
          showToast(language === 'ar' ? 'تم تفعيل إشعارات الحراج ✅' : 'Haraj notifications enabled ✅');
          console.log('✅ Haraj notifications enabled');
        } else {
          showToast(language === 'ar' ? 'حدث خطأ، حاول مرة أخرى' : 'Error, try again');
        }
      } else {
        // Currently Enabled -> Disable notifications
        const authToken = localStorage.getItem('token');
        const fcmToken = getStoredToken();
        
        if (authToken && fcmToken) {
          try {
            await fetch(`${API_BASE_URL}/api/v1/fcm/unsubscribe`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                deviceToken: fcmToken,
                topic: 'haraj'
              })
            });
          } catch (error) {
            console.log('Unsubscribe request failed, continuing with local disable');
          }
        }
        
        setHarajNotificationsEnabled(false);
        localStorage.setItem('notifications_haraj', 'false');
        showToast(language === 'ar' ? 'تم إيقاف إشعارات الحراج 🔕' : 'Haraj notifications disabled 🔕');
        console.log('🔕 Haraj notifications disabled');
      }
    } catch (error) {
      console.error('❌ Error toggling haraj notifications:', error);
      showToast(language === 'ar' ? 'حدث خطأ' : 'Error occurred');
    }
  };

  const getLocationLabel = () => {
    const { countryDisplay, cityDisplay, flag } = getDisplayLocation(
      currentLocation.country, 
      currentLocation.city, 
      language as 'ar' | 'en'
    );
    const flagStr = flag ? `${flag} ` : '';
    if (cityDisplay) return `${flagStr}${countryDisplay} | ${cityDisplay}`;
    return `${flagStr}${countryDisplay}`;
  };

  // Helper for relative time
  const getRelativeTime = (dateStr: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const now = new Date();
      const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (seconds < 60) return language === 'ar' ? 'الآن' : 'Just now';
      
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return language === 'ar' ? `${minutes} د` : `${minutes}m`;
      
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return language === 'ar' ? `${hours} س` : `${hours}h`;
      
      const days = Math.floor(hours / 24);
      if (days < 30) return language === 'ar' ? `${days} يوم` : `${days}d`;
      
      const months = Math.floor(days / 30);
      if (months < 12) return language === 'ar' ? `${months} شهر` : `${months}mo`;
      
      const years = Math.floor(months / 12);
      return language === 'ar' ? `${years} سنة` : `${years}y`;
  };

  // Fetch posts when category or location changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    const currentUserId = localStorage.getItem('userId');

    if (activeCategory && token) {
      setLoading(true);

      const countryParam = currentLocation.country === 'عام' ? '' : encodeURIComponent(currentLocation.country);
      const cityParam = currentLocation.city ? encodeURIComponent(currentLocation.city) : '';
      const url = `${API_BASE_URL}/api/v1/posts?category=${encodeURIComponent(activeCategory)}&country=${countryParam}&city=${cityParam}`;
      
      fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => {
          if (!res.ok) throw new Error("Network response was not ok");
          return res.json();
        })
        .then(data => {
          const postsArray = data.posts || [];
          if (Array.isArray(postsArray) && postsArray.length > 0) {
            const filteredPosts = postsArray.filter((p: any) => {
                const postUserId = p.user?._id || p.user?.id || p.user;
                return postUserId !== currentUserId;
            });

            const mappedPosts: Post[] = filteredPosts.map((p: any) => {
              // Location mapping for individual post card
              let locationString = t('location_general');
              if (p.scope === 'local' && p.country) {
                 const postLoc = getDisplayLocation(p.country, p.city === 'كل المدن' ? null : p.city, language as 'ar'|'en');
                 locationString = postLoc.cityDisplay ? `${postLoc.countryDisplay} | ${postLoc.cityDisplay}` : postLoc.countryDisplay;
              }

              const reactions = p.reactions || [];
              const likesCount = reactions.filter((r: any) => !r.type || r.type === 'like').length;

              return {
                id: p._id || p.id || Math.random().toString(),
                user: {
                  id: p.user?._id || 'u_h',
                  _id: p.user?._id, 
                  name: p.user?.name || 'بائع',
                  avatar: p.user?.avatar ? (p.user.avatar.startsWith('http') ? p.user.avatar : `${API_BASE_URL}${p.user.avatar}`) : null,
                },
                timeAgo: p.createdAt ? getRelativeTime(p.createdAt) : '',
                content: p.text || p.content || '',
                image: p.media && p.media.length > 0 
                  ? (p.media[0].url.startsWith('http') 
                      ? p.media[0].url 
                      : `${API_BASE_URL}${p.media[0].url}`)
                  : undefined,
                media: p.media ? p.media.map((m: any) => ({
                  url: m.url.startsWith('http') ? m.url : `${API_BASE_URL}${m.url}`,
                  type: m.type,
                  thumbnail: m.thumbnail
                })) : [],
                likes: likesCount,
                comments: p.comments?.length || 0,
                shares: p.shares?.length || 0,
                location: locationString,
                category: p.category,
                isFeatured: p.isFeatured,
                title: p.title || undefined,
                contactPhone: p.contactPhone || '',
                contactEmail: p.contactEmail || '',
                contactMethods: p.contactMethods || [],
                repostsCount: p.repostsCount || 0,
                jobStatus: p.jobStatus || 'open',
                isLiked: reactions.some((r: any) => (r.user?._id || r.user) === currentUserId),
                reactions: reactions,
              };
            });
            
            mappedPosts.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
            setPosts(mappedPosts);
          } else {
             setPosts([]);
          }
        })
        .catch(err => {
          console.error("Error fetching haraj posts", err);
          setPosts([]);
        })
        .finally(() => setLoading(false));
    }
  }, [activeCategory, currentLocation, language, t]);

  const currentCategoryData = HARAJ_CATEGORIES.find(c => c.name === activeCategory);
  const CategoryIcon = currentCategoryData ? currentCategoryData.icon : Store;

  if (activeCategory) {
    return (
      <div className="bg-[#f0f2f5] dark:bg-black min-h-screen">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-gray-900 text-white px-4 py-2.5 rounded-full shadow-lg text-sm font-medium">
              {toastMessage}
            </div>
          </div>
        )}
        <div className="sticky top-0 z-50 bg-white dark:bg-[#121212] border-b border-gray-200 dark:border-gray-800 shadow-sm">
           <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleBack}
                className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowRight size={24} className={language === 'en' ? 'rotate-180' : ''} />
              </button>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${currentCategoryData?.lightColor || 'bg-gray-100'}`}>
                  <CategoryIcon size={20} className={currentCategoryData?.iconColor || 'text-gray-600'} />
                </div>
                <div>
                  <h2 className="font-bold text-lg text-gray-800 dark:text-white">{t(activeCategory)}</h2>
                  <p className="text-[10px] text-gray-500">{t('haraj_latest_offers')}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* --- BELL ICON IN SUB-PAGE --- */}
              <button 
                onClick={handleToggleHarajNotifications}
                className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${harajNotificationsEnabled ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500'}`}
                title={harajNotificationsEnabled ? (language === 'ar' ? 'إيقاف الإشعارات' : 'Disable notifications') : (language === 'ar' ? 'تفعيل الإشعارات' : 'Enable notifications')}
              >
                {harajNotificationsEnabled ? <Bell size={20} strokeWidth={2} /> : <BellOff size={20} strokeWidth={2} />}
              </button>

              <button 
                onClick={onLocationClick}
                className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 py-1.5 px-3 rounded-full transition-colors border border-gray-100"
              >
                <MapPin size={14} className="text-orange-600" />
                <span className="text-[10px] font-bold text-gray-700 truncate max-w-[100px]">
                  {getLocationLabel()}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 pb-10 pt-2 min-h-[80vh]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
               <Loader2 size={40} className="text-orange-600 animate-spin" />
            </div>
          ) : posts.length > 0 ? (
             <>
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} onReport={onReport} onProfileClick={onProfileClick} />
                ))}
                <div className="text-center py-8 text-gray-400 text-xs">
                  {t('end_of_results')} {t(activeCategory)}
                </div>
             </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-in fade-in zoom-in duration-300">
                <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center border border-orange-100 shadow-sm relative">
                   <Megaphone size={40} className="text-orange-500" strokeWidth={1.5} />
                   <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-sm border border-gray-100">
                     <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white">
                        <span className="text-lg font-bold leading-none mb-0.5">+</span>
                     </div>
                   </div>
                </div>
                <div className="text-center px-6">
                   <h3 className="font-bold text-xl text-gray-800 dark:text-gray-200 mb-2">{t('haraj_empty')}</h3>
                   <p className="text-gray-500 text-sm max-w-[240px] mx-auto leading-relaxed">
                      {t('be_first_to_post')} {t(activeCategory)}
                   </p>
                </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-gray-900 text-white px-4 py-2.5 rounded-full shadow-lg text-sm font-medium">
            {toastMessage}
          </div>
        </div>
      )}
      <div className="bg-white dark:bg-[#121212] sticky top-0 z-10 shadow-sm border-b border-gray-100 dark:border-gray-800">
        <div className="px-4 py-4 flex items-center justify-between bg-gradient-to-l from-orange-50 to-white dark:from-gray-900 dark:to-black">
           <div className="flex items-center gap-3">
             <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-xl">
               <Store size={24} className="text-orange-600 dark:text-orange-400" />
             </div>
             <div>
               <h2 className="text-xl font-bold text-gray-800 dark:text-white">{t('nav_haraj')}</h2>
               <p className="text-[10px] text-gray-500 font-medium">{t('haraj_subtitle')}</p>
             </div>
           </div>
           
           <div className="flex items-center gap-2">
             {/* --- BELL ICON IN MAIN HARAJ HEADER --- */}
             <button 
               onClick={handleToggleHarajNotifications}
               className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${harajNotificationsEnabled ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500'}`}
               title={harajNotificationsEnabled ? (language === 'ar' ? 'إيقاف إشعارات الحراج' : 'Disable haraj notifications') : (language === 'ar' ? 'تفعيل إشعارات الحراج' : 'Enable haraj notifications')}
             >
               {harajNotificationsEnabled ? <Bell size={20} strokeWidth={2} /> : <BellOff size={20} strokeWidth={2} />}
             </button>

             <button 
                onClick={onLocationClick}
                className="flex items-center gap-1.5 bg-white/80 dark:bg-gray-800 hover:bg-white dark:hover:bg-gray-700 py-1.5 px-3 rounded-full transition-colors border border-gray-100 dark:border-gray-700 shadow-sm"
              >
                <MapPin size={14} className="text-orange-600 dark:text-orange-400" />
                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate max-w-[100px]">
                  {getLocationLabel()}
                </span>
             </button>
           </div>
        </div>
      </div>

      <div className="flex flex-col gap-[1px] bg-gray-100 dark:bg-gray-800 mt-1">
        {HARAJ_CATEGORIES.map((cat, idx) => (
          <div 
            key={idx}
            onClick={() => handleCategoryClick(cat.name)}
            className="flex items-center justify-between p-3 bg-white dark:bg-[#121212] hover:bg-gray-50 dark:hover:bg-gray-900 active:bg-gray-100 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`${cat.color} p-2 rounded-lg shadow-sm dark:opacity-80`}>
                <cat.icon size={20} className="text-white" />
              </div>
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{t(cat.name)}</span>
            </div>
            <ChevronLeft size={18} className={`text-gray-300 ${language === 'en' ? 'rotate-180' : ''}`} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default HarajView;

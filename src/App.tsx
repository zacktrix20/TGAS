/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from './firebase';
import { doc, setDoc, getDoc, collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { UserProfile, Post, WeatherData } from './types';
import { cn, formatDate } from './lib/utils';
import { 
  Cloud, 
  Sun, 
  CloudRain, 
  Wind, 
  Droplets, 
  MessageSquare, 
  ThumbsUp, 
  Share2, 
  Plus, 
  Send, 
  User as UserIcon,
  LogOut,
  Bell,
  AlertTriangle,
  TrendingUp,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  ChevronRight,
  MapPin
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchWeatherData } from './services/weatherService';
import { getAgriculturalAdvice, getSpeechFromText } from './services/geminiService';
import { TANZANIA_REGIONS } from './constants';
import Markdown from 'react-markdown';

// --- Components ---

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Kuna tatizo limetokea. Tafadhali pakia upya ukurasa.";
      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error) {
            errorMessage = `Tatizo la Kanzidata: ${parsed.error}`;
          }
        }
      } catch (e) {
        // Not JSON, use default or error.message
        if (this.state.error?.message) errorMessage = this.state.error.message;
      }

      return (
        <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mb-6">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-red-900 mb-2">Oops! Hitilafu Imetokea</h2>
          <p className="text-red-700 mb-8 max-w-md">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition-all"
          >
            Jaribu Tena
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const Navbar = ({ user, onLogout }: { user: UserProfile; onLogout: () => void }) => (
  <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-green-100 px-4 py-3 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-green-200">
        T
      </div>
      <h1 className="font-bold text-xl text-green-900 hidden sm:block">TGAS</h1>
    </div>
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
        <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="Profile" className="w-6 h-6 rounded-full" />
        <span className="text-sm font-medium text-green-800">{user.displayName}</span>
      </div>
      <button 
        onClick={onLogout}
        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </div>
  </nav>
);

const WeatherCard = ({ weather, onRegionChange }: { weather: WeatherData | null; onRegionChange: (region: any) => void }) => {
  if (!weather) return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded mb-4"></div>
      <div className="h-12 w-24 bg-gray-200 rounded mb-4"></div>
      <div className="h-32 w-full bg-gray-200 rounded"></div>
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-1 text-gray-500 text-sm mb-1">
            <MapPin className="w-3 h-3 text-green-600" />
            <select 
              className="bg-transparent border-none p-0 text-xs font-bold text-gray-700 focus:ring-0 cursor-pointer"
              onChange={(e) => {
                const region = TANZANIA_REGIONS.find(r => r.name === e.target.value);
                if (region) onRegionChange(region);
              }}
            >
              {TANZANIA_REGIONS.map(r => (
                <option key={r.name} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">{weather.current.temp}°C</h2>
          <p className="text-gray-500 capitalize">{weather.current.description}</p>
        </div>
        <img 
          src={`https://openweathermap.org/img/wn/${weather.current.icon}@2x.png`} 
          alt="Weather Icon" 
          className="w-16 h-16"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 p-3 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-600">
            <Droplets className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Unyevu</p>
            <p className="font-bold text-blue-900">{weather.current.humidity}%</p>
          </div>
        </div>
        <div className="bg-orange-50 p-3 rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-orange-600">
            <Wind className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">Upepo</p>
            <p className="font-bold text-orange-900">{weather.current.windSpeed} m/s</p>
          </div>
        </div>
      </div>

      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weather.hourly}>
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              labelStyle={{ fontWeight: 'bold' }}
            />
            <Line type="monotone" dataKey="temp" stroke="#16a34a" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-[10px] text-gray-400 mt-2 uppercase tracking-widest font-bold">Mwenendo wa Joto (Saa 24)</p>
    </div>
  );
};

const AlertBanner = ({ alerts }: { alerts: WeatherData['alerts'] }) => {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      {alerts.map((alert, i) => (
        <div key={i} className="bg-red-50 border border-red-100 p-4 rounded-2xl flex gap-4 items-start animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-red-900">{alert.event}</h3>
            <p className="text-sm text-red-700">{alert.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const PostCard = ({ post, onLike, onComment }: { post: Post; onLike: () => void; onComment: () => void }) => (
  <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6 group">
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img 
          src={post.authorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorId}`} 
          alt="Author" 
          className="w-10 h-10 rounded-full border-2 border-green-50" 
        />
        <div>
          <h4 className="font-bold text-gray-900 text-sm">{post.authorName}</h4>
          <p className="text-[10px] text-gray-400 font-medium">{formatDate(post.createdAt)}</p>
        </div>
      </div>
      <div className={cn(
        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
        post.type === 'success' ? "bg-green-100 text-green-700" : 
        post.type === 'question' ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
      )}>
        {post.type === 'success' ? 'Mafanikio' : post.type === 'question' ? 'Swali' : 'Habari'}
      </div>
    </div>
    
    <div className="px-4 pb-4">
      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
    </div>

    {post.imageUrl && (
      <div className="px-4 pb-4">
        <img 
          src={post.imageUrl} 
          alt="Post" 
          className="w-full h-64 object-cover rounded-2xl"
          referrerPolicy="no-referrer"
        />
      </div>
    )}

    <div className="px-4 py-3 bg-gray-50/50 flex items-center gap-6 border-t border-gray-50">
      <button 
        onClick={onLike}
        className="flex items-center gap-1.5 text-gray-500 hover:text-green-600 transition-colors group/btn"
      >
        <ThumbsUp className="w-4 h-4 group-active/btn:scale-125 transition-transform" />
        <span className="text-xs font-bold">{post.likesCount}</span>
      </button>
      <button 
        onClick={onComment}
        className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors"
      >
        <MessageSquare className="w-4 h-4" />
        <span className="text-xs font-bold">{post.commentsCount}</span>
      </button>
      <button className="flex items-center gap-1.5 text-gray-500 hover:text-purple-600 transition-colors ml-auto">
        <Share2 className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const AIAdvisor = ({ user }: { user: UserProfile }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleAsk = async () => {
    if (!query.trim() && !image) return;
    setLoading(true);
    setResponse('');
    
    let base64 = '';
    let mime = '';
    if (image) {
      const parts = image.split(';');
      mime = parts[0].split(':')[1];
      base64 = parts[1].split(',')[1];
    }

    const advice = await getAgriculturalAdvice(query || "Nieleze nini kinaonekana kwenye picha hii na jinsi ya kukitibu.", base64, mime);
    setResponse(advice || 'Samahani, sijapata jibu.');
    setLoading(false);
  };

  const handleSpeak = async () => {
    if (!response || isSpeaking) return;
    setIsSpeaking(true);
    const audioBase64 = await getSpeechFromText(response);
    if (audioBase64) {
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      audio.onended = () => setIsSpeaking(false);
      audio.play();
    } else {
      setIsSpeaking(false);
    }
  };

  return (
    <div className="bg-green-900 rounded-3xl p-6 text-white shadow-xl shadow-green-200/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-800 rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Mshauri wa AI</h3>
            <p className="text-green-300 text-xs">Uliza au tuma picha</p>
          </div>
        </div>
        {response && (
          <button 
            onClick={handleSpeak}
            disabled={isSpeaking}
            className={cn(
              "p-2 rounded-xl transition-all",
              isSpeaking ? "bg-green-500 animate-pulse" : "bg-green-800 hover:bg-green-700"
            )}
          >
            <Wind className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {image && (
          <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-green-700">
            <img src={image} alt="Upload" className="w-full h-full object-cover" />
            <button onClick={() => setImage(null)} className="absolute top-2 right-2 bg-red-500/80 p-1 rounded-full"><Plus className="w-4 h-4 rotate-45" /></button>
          </div>
        )}

        {response && (
          <div className="bg-green-800/50 p-4 rounded-2xl text-sm leading-relaxed border border-green-700/50 animate-in fade-in zoom-in-95 duration-300">
            <div className="prose prose-invert prose-sm max-w-none">
              <Markdown>{response}</Markdown>
            </div>
          </div>
        )}

        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Uliza chochote..."
            className="w-full bg-green-800/30 border border-green-700 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 placeholder:text-green-600/50 resize-none h-24"
          />
          <div className="absolute bottom-3 right-3 flex gap-2">
            <label className="w-10 h-10 bg-green-800 hover:bg-green-700 rounded-xl flex items-center justify-center cursor-pointer transition-colors">
              <ImageIcon className="w-5 h-5 text-green-400" />
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            <button 
              onClick={handleAsk}
              disabled={loading}
              className="w-10 h-10 bg-green-500 hover:bg-green-400 disabled:bg-green-800 rounded-xl flex items-center justify-center transition-colors shadow-lg shadow-green-900/50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MarketPrices = () => {
  const prices = [
    { name: 'Mahindi', price: '750', trend: 'up', location: 'Kariakoo' },
    { name: 'Mpunga', price: '1200', trend: 'down', location: 'Mbeya' },
    { name: 'Maharage', price: '2100', trend: 'up', location: 'Arusha' },
    { name: 'Ulezi', price: '1800', trend: 'stable', location: 'Dodoma' },
  ];

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-green-600" />
        Bei za Masoko Leo
      </h3>
      <div className="space-y-3">
        {prices.map((item, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl hover:bg-green-50 transition-colors cursor-default">
            <div>
              <span className="font-bold text-sm text-gray-700">{item.name}</span>
              <p className="text-[10px] text-gray-400">{item.location}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-sm text-gray-900">TZS {item.price}/kg</p>
              <p className={cn(
                "text-[10px] font-bold uppercase", 
                item.trend === 'up' ? "text-green-600" : item.trend === 'down' ? "text-red-600" : "text-gray-400"
              )}>
                {item.trend === 'up' ? '↑ Inapanda' : item.trend === 'down' ? '↓ Inashuka' : '→ Tulivu'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PlantingCalendar = () => {
  const crops = [
    { name: 'Mahindi', planted: '2026-01-15', stage: 'Kupalilia', progress: 45 },
    { name: 'Maharage', planted: '2026-02-10', stage: 'Kuweka Mbolea', progress: 20 },
  ];

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Bell className="w-4 h-4 text-orange-500" />
        Kalenda ya Kilimo
      </h3>
      <div className="space-y-4">
        {crops.map((crop, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-700">{crop.name}</span>
              <span className="text-[10px] font-bold text-orange-600 uppercase">{crop.stage}</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div className="bg-orange-500 h-full transition-all" style={{ width: `${crop.progress}%` }} />
            </div>
            <p className="text-[10px] text-gray-400">Ilipandwa: {crop.planted}</p>
          </div>
        ))}
        <button className="w-full py-2 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 text-xs font-bold hover:border-green-300 hover:text-green-600 transition-all">
          + Ongeza Zao Jipya
        </button>
      </div>
    </div>
  );
};

const SoilDataInput = () => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Droplets className="w-4 h-4 text-blue-500" />
        Hali ya Udongo
      </h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-blue-50 rounded-2xl">
          <p className="text-[10px] text-blue-600 font-bold uppercase">pH ya Udongo</p>
          <p className="text-lg font-black text-blue-900">6.5</p>
        </div>
        <div className="p-3 bg-green-50 rounded-2xl">
          <p className="text-[10px] text-green-600 font-bold uppercase">Nitrogen</p>
          <p className="text-lg font-black text-green-900">Wastani</p>
        </div>
      </div>
      <button className="w-full bg-blue-600 text-white py-2 rounded-xl text-xs font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">
        Sasisha Vipimo
      </button>
    </div>
  );
};

const FarmMap = () => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-red-500" />
        Ramani ya Shamba
      </h3>
      <div className="relative w-full h-48 bg-gray-100 rounded-2xl overflow-hidden mb-4">
        <img 
          src="https://picsum.photos/seed/farm-map/800/600" 
          alt="Farm Map Placeholder" 
          className="w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white/90 backdrop-blur p-4 rounded-2xl shadow-xl text-center">
            <p className="text-xs font-bold text-gray-900 mb-1">Ukubwa wa Shamba</p>
            <p className="text-xl font-black text-green-600">Ekari 2.5</p>
          </div>
        </div>
      </div>
      <button className="w-full border-2 border-gray-100 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all">
        Chora Mipaka
      </button>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, loadingAuth] = useAuthState(auth);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [selectedRegion, setSelectedRegion] = useState(TANZANIA_REGIONS[0]);
  const [newPostContent, setNewPostContent] = useState('');
  const [postType, setPostType] = useState<'success' | 'question' | 'general'>('general');
  const [isPosting, setIsPosting] = useState(false);

  // Auth & Profile Sync
  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const path = `users/${user.uid}`;
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: user.uid,
              displayName: user.displayName || 'Mkulima',
              email: user.email || '',
              photoURL: user.photoURL || '',
              createdAt: new Date().toISOString(),
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      };
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [user]);

  // Weather Sync
  useEffect(() => {
    if (profile) {
      const updateWeather = async () => {
        const data = await fetchWeatherData(selectedRegion.lat, selectedRegion.lng);
        setWeather(data);
      };
      updateWeather();
      const interval = setInterval(updateWeather, 1000 * 60 * 30); // Every 30 mins
      return () => clearInterval(interval);
    }
  }, [profile, selectedRegion]);

  // Posts Sync
  useEffect(() => {
    if (user) {
      const path = 'posts';
      const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
        setPosts(postsData);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleCreatePost = async () => {
    if (!newPostContent.trim() || !user) return;
    setIsPosting(true);
    const path = 'posts';
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: user.displayName,
        authorPhoto: user.photoURL,
        content: newPostContent,
        type: postType,
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date().toISOString(),
      });
      setNewPostContent('');
      setPostType('general');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) return;
    const path = `posts/${postId}/likes/${user.uid}`;
    try {
      const likeRef = doc(db, 'posts', postId, 'likes', user.uid);
      const likeSnap = await getDoc(likeRef);
      
      if (likeSnap.exists()) {
        await deleteDoc(likeRef);
        await updateDoc(doc(db, 'posts', postId), { likesCount: increment(-1) });
      } else {
        await setDoc(likeRef, { userId: user.uid, createdAt: new Date().toISOString() });
        await updateDoc(doc(db, 'posts', postId), { likesCount: increment(1) });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 bg-green-600 rounded-[2rem] flex items-center justify-center text-white font-black text-4xl shadow-2xl shadow-green-200 mb-8 rotate-12">
          T
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-2 text-center">TGAS</h1>
        <p className="text-gray-500 mb-12 text-center max-w-xs font-medium">
          Mfumo wa Kilimo wa Kisasa kwa Wakulima wa Tanzania.
        </p>
        <button 
          onClick={loginWithGoogle}
          className="w-full max-w-sm bg-white border-2 border-gray-100 p-4 rounded-3xl flex items-center justify-center gap-4 hover:bg-gray-50 transition-all shadow-sm active:scale-95"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
          <span className="font-bold text-gray-700">Ingia na Google</span>
        </button>
        <p className="mt-8 text-[10px] text-gray-400 uppercase tracking-widest font-bold">Tanzania Green Agricultural System</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F8FAF9] pb-20">
        <Navbar user={profile || { uid: user.uid, displayName: user.displayName || 'Mkulima', email: user.email || '', createdAt: '' }} onLogout={logout} />
          <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Weather & AI */}
          <div className="lg:col-span-3 space-y-6">
            <WeatherCard weather={weather} onRegionChange={setSelectedRegion} />
            <AlertBanner alerts={weather?.alerts || []} />
            <AIAdvisor user={profile!} />
            <MarketPrices />
          </div>

          {/* Middle Column: Social Feed */}
          <div className="lg:col-span-6 space-y-6">
            {/* Create Post */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex gap-4 mb-4">
                <img 
                  src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                  alt="Me" 
                  className="w-10 h-10 rounded-full" 
                />
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="Shiriki mafanikio au uliza swali..."
                  className="flex-1 bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-green-500 resize-none h-24"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {(['general', 'success', 'question'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setPostType(type)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                        postType === type 
                          ? "bg-green-600 text-white shadow-lg shadow-green-200" 
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      {type === 'general' ? 'Habari' : type === 'success' ? 'Mafanikio' : 'Swali'}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={handleCreatePost}
                  disabled={isPosting || !newPostContent.trim()}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-200 text-white px-6 py-2 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-green-100"
                >
                  {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Chapisha
                </button>
              </div>
            </div>

            {/* Feed */}
            <div className="space-y-6">
              {posts.map(post => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  onLike={() => handleLike(post.id)} 
                  onComment={() => {}} 
                />
              ))}
            </div>
          </div>

          {/* Right Column: Farm Management */}
          <div className="lg:col-span-3 space-y-6">
            <PlantingCalendar />
            <SoilDataInput />
            <FarmMap />
            
            <div className="bg-gradient-to-br from-green-500 to-green-700 p-6 rounded-3xl text-white shadow-xl shadow-green-200">
              <h3 className="font-bold text-lg mb-2">Kidokezo cha Wiki</h3>
              <p className="text-sm text-green-100 leading-relaxed mb-4">
                "Kutumia mbolea ya asili (mboji) huongeza rutuba ya udongo kwa muda mrefu kuliko mbolea za chumvichumvi pekee."
              </p>
              <button className="w-full bg-white/20 hover:bg-white/30 py-2 rounded-xl text-xs font-bold transition-colors">
                Soma Zaidi
              </button>
            </div>
          </div>
        </main>

        {/* Mobile Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between lg:hidden z-50">
          <button className="p-2 text-green-600 bg-green-50 rounded-xl">
            <Sun className="w-6 h-6" />
          </button>
          <button className="p-2 text-gray-400">
            <MessageSquare className="w-6 h-6" />
          </button>
          <button className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-200 -mt-10 border-4 border-white">
            <Plus className="w-6 h-6" />
          </button>
          <button className="p-2 text-gray-400">
            <Bell className="w-6 h-6" />
          </button>
          <button className="p-2 text-gray-400">
            <UserIcon className="w-6 h-6" />
          </button>
        </div>
      </div>
    </ErrorBoundary>
  );
}

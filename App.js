import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
  LogBox,
  TouchableOpacity,
  BackHandler,
  ToastAndroid,
  Platform,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  Text,
  TextInput,
  Animated,
  ImageBackground,
  ScrollView,
  AppState
} from 'react-native';
import TrackPlayer, {
  Capability,
  State,
  usePlaybackState,
  useProgress,
  Event
} from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import * as FileSystem from 'expo-file-system';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// Screens
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import LibraryScreen from './screens/LibraryScreen';
import LikedSongsScreen from './screens/LikedSongsScreen';
import DownloadScreen from './screens/DownloadScreen';
import AiScreen from './screens/AiScreen';
import SectionScreen from './screens/SectionScreen'; // Imported

// Components
import TabBar from './components/TabBar';
import PlayerWidget from './components/PlayerWidget';
import LanguageModal from './components/LanguageModal';
import FullScreenPlayer from './components/FullScreenPlayer';
import ErrorBoundary from './components/ErrorBoundary';
import SongItem from './components/SongItem';
import { GeminiService } from './services/geminiService';

import Icon from './components/Icon';

// Keep the splash screen visible while we fetch resources (mobile only)
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {
    /* reloading the app might trigger some race conditions, ignore them */
  });
}

LogBox.ignoreAllLogs(true);

const API_BASE = 'https://music-api-xandra.vercel.app/api';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const cleanText = (str) => {
  if (!str) return '';
  if (typeof str !== 'string') return String(str); // Safety cast
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
};

const fetchJsonWithRetry = async (url, { retries = 3, timeoutMs = 15000, onRateLimit } = {}) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = setTimeout(() => controller?.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller?.signal,
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        if (res.status === 429 && attempt < retries) {
          const retryAfterHeader = res.headers?.get?.('retry-after');
          const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
          const backoffMs = Number.isFinite(retryAfterSeconds)
            ? retryAfterSeconds * 1000
            : 800 * Math.pow(2, attempt);
          const waitSeconds = Math.max(1, Math.round(backoffMs / 1000));
          console.warn(`[SaavnAPI] Rate limited (429). Waiting ${waitSeconds}s before retry. URL=${url}`);
          if (typeof onRateLimit === 'function') {
            onRateLimit({ waitSeconds, attempt, retries });
          }
          await sleep(backoffMs);
          continue;
        }
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${text ? `: ${text}` : ''}`);
      }

      return await res.json();
    } catch (e) {
      clearTimeout(timeout);
      lastError = e;
      if (attempt < retries) {
        await sleep(800 * Math.pow(2, attempt));
        continue;
      }
    }
  }
  throw lastError || new Error('Request failed');
};

LogBox.ignoreLogs(['Possible Unhandled Promise Rejection']);

// Utility to shuffle array
const shuffleArray = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

const formatSong = (item) => {
  try {
    if (!item) return null;

    // Handle different image formats (array or string)
    let imageUrl = '';
    if (Array.isArray(item.image)) {
      const imgObj = item.image[item.image.length - 1];
      imageUrl = typeof imgObj === 'string' ? imgObj : (imgObj?.link || imgObj?.url);
    } else if (typeof item.image === 'string') {
      imageUrl = item.image;
    }

    // Handle download URLs
    let downloadUrls = item.downloadUrl || item.media_url || [];

    // Extract artists
    const extractArtists = () => {
      let result = [];
      if (typeof item.primaryArtists === 'string') {
        item.primaryArtists.split(',').forEach(name => result.push({ name: name.trim(), role: 'Main Artist' }));
      } else if (Array.isArray(item.primaryArtists)) {
        item.primaryArtists.forEach(a => result.push({ name: a.name || a, role: 'Main Artist' }));
      } else if (item.artists?.primary) {
        item.artists.primary.forEach(a => result.push({ name: a.name, role: 'Main Artist' }));
      }
      if (result.length === 0) {
        result.push({ name: item.header_desc || item.artist || 'Unknown Artist', role: 'Main Artist' });
      }
      return result;
    };

    const allArtists = extractArtists().map(a => ({ ...a, name: cleanText(a.name) }));

    return {
      ...item,
      id: item.id || Math.random().toString(),
      name: cleanText(item.name || item.title || 'Unknown Title'),
      duration: parseInt(item.duration) || 0,
      albumName: cleanText(item.album?.name || (typeof item.album === 'string' ? item.album : '') || ''),
      image: [
        { url: imageUrl },
        { url: imageUrl },
        { url: imageUrl }
      ],
      downloadUrl: Array.isArray(downloadUrls) ? downloadUrls.map(d => ({ ...d, url: d.link || d.url })) : [{ url: downloadUrls }],
      artists: {
        primary: allArtists.filter(a => a.role === 'Main Artist'),
        all: allArtists
      }
    };
  } catch (err) {
    console.warn("[Vibee] Error formatting item:", err, item);
    return null;
  }
};

const LANGUAGES = [
  { id: 'tamil', name: 'Tamil' },
  { id: 'telugu', name: 'Telugu' },
  { id: 'hindi', name: 'Hindi' },
  { id: 'english', name: 'English' },
  { id: 'punjabi', name: 'Punjabi' },
  { id: 'malayalam', name: 'Malayalam' },
  { id: 'kannada', name: 'Kannada' },
];

const ARTISTS_BY_LANG = {
  tamil: ["S. P. Balasubrahmanyam", "T. M. Soundararajan", "K. J. Yesudas", "Malaysia Vasudevan", "P. B. Sreenivas", "Hariharan", "Shankar Mahadevan", "P. Susheela", "S. Janaki", "Vani Jairam", "L. R. Eswari", "K. S. Chithra", "Sujatha Mohan", "Sid Sriram", "Anirudh Ravichander", "Karthik", "Pradeep Kumar", "Vijay Yesudas", "Haricharan", "Benny Dayal", "Naresh Iyer", "Santhosh Narayanan", "M. S. Subbulakshmi", "D. K. Pattammal", "M. L. Vasanthakumari", "Sudha Ragunathan", "Nithyasree Mahadevan", "Sanjay Subrahmanyan", "T. M. Krishna", "Shreya Ghoshal", "Chinmayi Sripada", "Shakthisree Gopalan", "Jonita Gandhi", "Dhee", "Shweta Mohan", "Andrea Jeremiah", "Saindhavi"],
  telugu: ["Ghantasala Venkateswara Rao", "S. P. Balasubrahmanyam", "P. B. Sreenivas", "Mangalampalli Balamuralikrishna", "K. J. Yesudas", "P. Susheela", "S. Janaki", "Vani Jairam", "K. S. Chithra", "L. R. Eswari", "S. P. Sailaja", "Sid Sriram", "Anurag Kulkarni", "Karthik", "Ram Miriyala", "Hemachandra", "Vijay Prakash", "Kaala Bhairava", "L. V. Revanth", "Rahul Sipligunj", "Sri Krishna", "Sunitha Upadrashta", "Shreya Ghoshal", "Chinmayi Sripada", "Geetha Madhuri", "Mangli", "Sravana Bhargavi", "Shweta Mohan", "Dhee", "Saindhavi", "Indravathi Chauhan"],
  hindi: ["Mohammed Rafi", "Kishore Kumar", "Mukesh", "Manna Dey", "Mahendra Kapoor", "Kumar Sanu", "Udit Narayan", "Sonu Nigam", "Lata Mangeshkar", "Asha Bhosle", "Alka Yagnik", "Kavita Krishnamurthy", "Sadhana Sargam", "Anuradha Paudwal", "Arijit Singh", "Jubin Nautiyal", "Armaan Malik", "Atif Aslam", "Mohit Chauhan", "Lucky Ali", "Vishal Dadlani", "Benny Dayal", "Darshan Raval", "Sidhu Moose Wala", "Jagjit Singh", "Pankaj Udhas", "Hariharan", "Rahat Fateh Ali Khan", "Nusrat Fateh Ali Khan"],
  english: ["Michael Jackson", "Elvis Presley", "Freddie Mercury", "Madonna", "Whitney Houston", "Prince", "David Bowie", "Celine Dion", "Mariah Carey", "George Michael", "Ed Sheeran", "Bruno Mars", "The Weeknd", "Justin Bieber", "Harry Styles", "Post Malone", "Shawn Mendes", "Sam Smith", "Charlie Puth", "Drake", "Taylor Swift", "Adele", "BeyoncÃ©", "Rihanna", "Lady Gaga", "Ariana Grande", "Billie Eilish", "Dua Lipa", "SZA", "Olivia Rodrigo", "Amy Winehouse", "Norah Jones", "John Legend", "Alicia Keys", "Frank Sinatra", "Mick Jagger", "Paul McCartney", "Robert Plant", "Kurt Cobain", "Chris Martin", "Alex Turner", "Chester Bennington", "Lana Del Rey"],
  punjabi: ["Gurdas Maan", "Surinder Kaur", "Kuldeep Manak", "Amar Singh Chamkila", "Hans Raj Hans", "Sardool Sikander", "Diljit Dosanjh", "Sidhu Moose Wala", "Karan Aujla", "Ammy Virk", "Guru Randhawa", "Sharry Maan", "Jarry Sandhu", "AP Dhillon", "Amrit Maan", "Babbu Maan", "Nimrat Khaira", "Sunanda Sharma", "Jasmine Sandlas", "Kaur B", "Miss Pooja", "Anmol Gagan Maan", "Baani Sandhu", "Asees Kaur", "Satinder Sartaaj", "Wadali Brothers", "Kanwar Grewal", "Nooran Sisters", "Lakhwinder Wadali"],
  malayalam: ["K. J. Yesudas", "P. Jayachandran", "G. Venugopal", "M. G. Sreekumar", "K. P. Brahmanandan", "S. Janaki", "P. Susheela", "K. S. Chithra", "P. Leela", "Vani Jairam", "Vineeth Sreenivasan", "Vijay Yesudas", "Madhu Balakrishnan", "Najim Arshad", "Karthik", "Haricharan", "Job Kurian", "Sooraj Santhosh", "Sid Sriram", "Shahabaz Aman", "Sujatha Mohan", "Shweta Mohan", "Jyotsna Radhakrishnan", "Manjari", "Sithara Krishankumar", "K. S. Harisankar", "Shreya Ghoshal", "Sayanora Philip", "Mridula Warrier", "Anne Amie", "Suraj Mani", "Amrit Ramnath", "Gowry Lekshmi", "Pradeep Kumar"],
  kannada: ["P. B. Sreenivas", "Dr. Rajkumar", "S. P. Balasubrahmanyam", "C. Aswath", "P. Kalinga Rao", "S. Janaki", "P. Susheela", "Vani Jairam", "K. S. Chithra", "B. K. Sumitra", "Vijay Prakash", "Rajesh Krishnan", "Kunthal Jois", "Sanjith Hegde", "Naveen Sajju", "Chandan Shetty", "Anuradha Bhat", "Armaan Malik", "Santhosh Venky", "Kailash Kher", "Shreya Ghoshal", "Vani Harikrishna", "Indu Nagaraj", "Shamitha Malnad", "Archana Udupa", "Sangeetha Katti", "Ananya Bhat", "Apoorva Sridhar", "B. R. Chaya", "Shimoga Subbanna", "Mysore Ananthaswamy", "Gururaj Hoskote", "Manjula Gururaj"]
};

export default function App() {
  const fetchSection = useCallback(async (queryInput, l = 'tamil') => {
    try {
      const subQueries = queryInput.split(',').map(q => q.trim()).filter(q => q);
      if (subQueries.length === 0) return [];
      const formatQuery = (rawQ) => {
        const lowerQ = rawQ.toLowerCase();
        const lowerLang = (l || '').toLowerCase();
        if (!lowerQ.includes(lowerLang)) return `${l} songs ${rawQ}`;
        return rawQ;
      };
      const validQueries = subQueries.map(formatQuery);
      const promises = validQueries.map(q =>
        fetchJsonWithRetry(
          `${API_BASE}/search/songs?query=${encodeURIComponent(q)}&limit=15`,
          { retries: 2, timeoutMs: 10000 }
        ).catch(() => null)
      );
      const responses = await Promise.all(promises);
      let allResults = [];
      for (const data of responses) {
        let raw = data?.data?.results || data?.results || data?.data || data || [];
        if (Array.isArray(raw) && raw.length > 0) allResults.push(...raw);
      }
      if (allResults.length > 0) {
        const unique = [];
        const ids = new Set();
        for (const item of allResults) {
          if (item.id && !ids.has(item.id)) {
            ids.add(item.id);
            unique.push(item);
          }
        }
        return shuffleArray(unique.map(formatSong));
      }
      return [];
    } catch (e) {
      console.warn(`[Vibee] Failed to fetch section: ${queryInput}`, e);
      return [];
    }
  }, []);

  const fetchAiSection = useCallback(async (vibe, l = 'tamil', count = 10) => {
    try {
      const recommendations = await GeminiService.getSongRecommendations(`${vibe} songs`, l);
      const topRecs = (recommendations || []).slice(0, count);
      if (topRecs.length === 0) return [];
      const batchSize = 5;
      let allResolved = [];
      for (let i = 0; i < topRecs.length; i += batchSize) {
        const batch = topRecs.slice(i, i + batchSize);
        const resolvedBatch = await Promise.all(
          batch.map(async (rec) => {
            try {
              const searchQuery = `${rec.track} ${rec.artist}`;
              const data = await fetchJsonWithRetry(
                `${API_BASE}/search/songs?query=${encodeURIComponent(searchQuery)}&limit=1`,
                { retries: 1, timeoutMs: 8000 }
              );
              const song = data?.data?.results?.[0] || data?.results?.[0] || null;
              return song ? formatSong(song) : null;
            } catch (err) { return null; }
          })
        );
        allResolved.push(...resolvedBatch.filter(Boolean));
        if (i + batchSize < topRecs.length) await sleep(200);
      }
      return allResolved;
    } catch (e) {
      console.warn(`[Vibee] AI section fetch failed for ${vibe}`, e);
      return [];
    }
  }, []);

  const [activeTab, setActiveTab] = useState('home');
  const [libraryView, setLibraryView] = useState('main');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [likedSongs, setLikedSongs] = useState([]);
  const [likedIds, setLikedIds] = useState(new Set());
  const [currentLanguage, setCurrentLanguage] = useState('tamil');
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [targetPlaylistId, setTargetPlaylistId] = useState(null);
  const [appReady, setAppReady] = useState(false);

  const searchCacheRef = useRef(new Map());
  const sectionCacheRef = useRef(new Map());
  const [followedArtists, setFollowedArtists] = useState([]);
  const [expandedSection, setExpandedSection] = useState(null); // { title, songs, loading }

  // Home Screen Sections (5 mood-based sections)
  const [sections, setSections] = useState({
    trending: [],      // All languages - at top
    chill: [],         // Language-specific - calm/relaxed
    item: [],          // Language-specific - party/dance
    melody: [],        // Language-specific - emotional/expressive
    songsForYou: []    // Language-specific - personalized mix
  });

  // Artist Songs View State
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedArtistDetails, setSelectedArtistDetails] = useState(null);
  const [artistSongs, setArtistSongs] = useState([]);
  const [loadingArtistSongs, setLoadingArtistSongs] = useState(false);
  const [artistModalVisible, setArtistModalVisible] = useState(false);

  // Smart Playlist Modal State
  const [smartPlaylistModalVisible, setSmartPlaylistModalVisible] = useState(false);
  const [smartPlaylistTitle, setSmartPlaylistTitle] = useState('');
  const [smartPlaylistSongs, setSmartPlaylistSongs] = useState([]);
  const [smartPlaylistImage, setSmartPlaylistImage] = useState(null);
  const [loadingSmartPlaylist, setLoadingSmartPlaylist] = useState(false);

  // Download State
  const [downloadFolders, setDownloadFolders] = useState([]);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState(null);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isLyricsVisible, setIsLyricsVisible] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState([]);

  // Player State
  const [currentSong, setCurrentSong] = useState(null);
  const [currentQueue, setCurrentQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStartingPlayback, setIsStartingPlayback] = useState(false);
  const [startingSongId, setStartingSongId] = useState(null);
  const [fullPlayerVisible, setFullPlayerVisible] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState({
    position: 0,
    duration: 0,
    progress: 0
  });

  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isAutoplay, setIsAutoplay] = useState(true); // Default to true
  const [lastMoodContext, setLastMoodContext] = useState(null);

  // Download State (Remaining)
  const [downloads, setDownloads] = useState([]);

  const DOWNLOADS_DIR = Platform.OS === 'web' ? '' : FileSystem.documentDirectory + 'downloads/';
  const METADATA_FILE = DOWNLOADS_DIR + 'metadata.json';

  const currentSongRef = useRef(null);
  const playbackState = usePlaybackState();
  const progress = useProgress(100); // Super fast updates for lyrics sync
  const playRequestIdRef = useRef(0);
  const artistFetchInProgressRef = useRef(false);

  // Reset scroll to top when changing tabs or views (primarily for Web consistency)
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Use requestAnimationFrame to ensure we scroll after the render cycle
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        // Backup with timeout for slow renders
        setTimeout(() => window.scrollTo(0, 0), 0);
      });
    }
  }, [activeTab, libraryView, expandedSection, selectedArtist, smartPlaylistModalVisible]);

  // Sync TrackPlayer state with local app state
  useEffect(() => {
    try {
      if (!playbackState) {
        setIsPlaying(false);
        return;
      }

      // Handle both object format {state: State.Playing} and direct State.Playing
      const stateValue = typeof playbackState === 'object' && playbackState.state !== undefined
        ? playbackState.state
        : playbackState;

      setIsPlaying(stateValue === State.Playing);
    } catch (e) {
      console.warn('[Vibee] PlaybackState error:', e);
      setIsPlaying(false);
    }
  }, [playbackState]);

  useEffect(() => {
    if (progress.duration > 0) {
      setPlaybackStatus({
        position: progress.position * 1000,
        duration: progress.duration * 1000,
        progress: progress.position / progress.duration
      });
    }
  }, [progress.position, progress.duration]);

  // Handle track changes and completion from TrackPlayer events
  useEffect(() => {
    const listener = TrackPlayer.addEventListener(Event.PlaybackTrackChanged, async (event) => {
      const track = await TrackPlayer.getTrack(event.nextTrack);
      if (track) {
        setCurrentSong(track.originalSong);
        currentSongRef.current = track.originalSong;
      }

      // Check for infinite autoplay when reaching the end of the queue
      if (isAutoplay && event.nextTrack === undefined && event.track !== undefined) {
        // This usually means we finished the last track
        handleInfiniteAutoplay();
      }
    });

    return () => {
      listener.remove();
    };
  }, []);

  useEffect(() => {
    async function prepare() {
      console.log('[Vibee] Starting preparation...');
      try {
        console.log('[Vibee] Loading local data...');

        // 1. Parallelize local data loading for speed
        // TrackPlayer setup is robust enough to run alongside AsyncStorage
        const [savedLang] = await Promise.all([
          loadLiked(),
          loadPlaylists(),
          loadDownloadData(),
          setupAudio()
        ]);

        console.log('[Vibee] Local data loaded. Starting background fetch...');

        // 2. Non-blocking Network Check & Data Fetch
        // We do NOT wait for this to finish before showing the UI
        // The UI will show loading skeletons or cached data immediately
        fetchAllSections(savedLang).catch(e => {
          console.warn('[Vibee] Background fetch failed.', e);
        });

        // Assuming home is active
        setActiveTab('home');

        console.log('[Vibee] Preparation complete (UI ready).');

        setAppReady(true);
        if (Platform.OS !== 'web') {
          SplashScreen.hideAsync().catch(() => { });
        }
      } catch (e) {
        console.error('[Vibee] Startup preparation error:', e);
        setAppReady(true);
        if (Platform.OS !== 'web') {
          SplashScreen.hideAsync().catch(() => { });
        }
      }
    }

    prepare();
  }, []);

  // Handle AppState changes to re-show splash on resume
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground!
        console.log('[Vibee] App resumed');
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    // Already handled in prepare finally block for better timing
  }, []);

  // Android Back Button Handler
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let backPressCount = 0;
    let backPressTimer = null;

    const backAction = () => {
      // 1. If lyrics are visible in full screen player, hide them
      if (fullPlayerVisible && isLyricsVisible) {
        setIsLyricsVisible(false);
        return true;
      }

      // 2. If full screen player menu or other internal components are open (handled via modal visible props)
      // Note: menuVisible in FullScreenPlayer is internal, but onClose covers it if we close the modal.
      // However, we want the physical back button to close the player if no sub-menus are open.

      // 3. Close Modals in priority order
      if (playlistModalVisible) {
        if (isCreatingPlaylist) {
          setIsCreatingPlaylist(false);
        } else {
          setPlaylistModalVisible(false);
        }
        return true;
      }

      if (artistModalVisible) {
        setArtistModalVisible(false);
        return true;
      }

      if (langModalVisible) {
        setLangModalVisible(false);
        return true;
      }

      if (smartPlaylistModalVisible) {
        setSmartPlaylistModalVisible(false);
        return true;
      }

      // 4. Close Full Screen Player
      if (fullPlayerVisible) {
        setFullPlayerVisible(false);
        return true;
      }

      // 5. Navigate through History
      if (navigationHistory.length > 0) {
        const prev = navigationHistory[navigationHistory.length - 1];
        setNavigationHistory(prevStack => prevStack.slice(0, -1));

        // Use a flag to prevent this update from being pushed back into history
        const isHistoryNavigation = true;
        setActiveTab(prev.activeTab);
        setLibraryView(prev.libraryView);
        return true;
      }

      // 6. Navigate back from Library details to main if not in history
      if (activeTab === 'library' && libraryView !== 'main') {
        setLibraryView('main');
        return true;
      }

      // 7. If not on home tab, go to home
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }

      // 8. On home screen - double tap to exit
      if (backPressCount === 0) {
        backPressCount = 1;
        if (Platform.OS === 'android') {
          ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        }

        backPressTimer = setTimeout(() => {
          backPressCount = 0;
        }, 2000);

        return true;
      } else {
        clearTimeout(backPressTimer);
        BackHandler.exitApp();
        return false;
      }
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [fullPlayerVisible, isLyricsVisible, langModalVisible, artistModalVisible, playlistModalVisible, isCreatingPlaylist, activeTab, libraryView, navigationHistory, smartPlaylistModalVisible]);

  const pushToHistory = (newTab, newView) => {
    // Only push if something actually changed and it's not the same as top of stack
    const current = { activeTab, libraryView };
    const last = navigationHistory[navigationHistory.length - 1];

    if (last && last.activeTab === activeTab && last.libraryView === libraryView) {
      // Already at top, don't double push
      return;
    }

    if (newTab === activeTab && newView === libraryView) return;

    setNavigationHistory(prev => [...prev.slice(-10), { activeTab, libraryView }]);
  };

  const handleTabChange = (tabId) => {
    if (tabId === activeTab) return;
    pushToHistory(tabId, 'main');
    setActiveTab(tabId);
    if (tabId === 'library') setLibraryView('main');
    if (tabId === 'search') setTargetPlaylistId(null);
  };

  const setupAudio = async () => {
    try {
      const state = await TrackPlayer.getState().catch(() => null);
      if (state !== null) {
        console.log('[Vibee] TrackPlayer already setup, skipping.');
        return;
      }

      console.log('[Vibee] Initializing TrackPlayer...');
      await TrackPlayer.setupPlayer();
      await TrackPlayer.updateOptions({
        stopWithApp: false,
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.Stop,
          Capability.SeekTo,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.Stop,
        ],
        progressUpdateInterval: 100, // Sync with useProgress for ultra-precision
      });
      console.log('[Vibee] TrackPlayer setup successful.');
    } catch (e) {
      console.error('[Vibee] TrackPlayer setup failed', e);
    }
  };


  const loadLiked = async () => {
    try {
      const [liked, playlistData, followed, lang, autoplay] = await Promise.all([
        AsyncStorage.getItem('@liked_songs'),
        AsyncStorage.getItem('@playlists'),
        AsyncStorage.getItem('@followed_artists'),
        AsyncStorage.getItem('@current_language'),
        AsyncStorage.getItem('@is_autoplay')
      ]);
      if (liked) {
        const parsed = JSON.parse(liked) || [];
        setLikedSongs(parsed);
        setLikedIds(new Set(parsed.map(s => s.id)));
      }
      if (playlistData) setPlaylists(JSON.parse(playlistData) || []);
      if (followed) setFollowedArtists(JSON.parse(followed) || []);
      if (lang) setCurrentLanguage(lang);
      if (autoplay !== null) setIsAutoplay(JSON.parse(autoplay));
      return lang || 'tamil';
    } catch (e) {
      console.warn('Failed to load data', e);
      return 'tamil';
    }
  };

  const saveLiked = async (list) => {
    try {
      await AsyncStorage.setItem('@liked_songs', JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save liked songs', e);
    }
  };

  const toggleLike = (song) => {
    if (!song) return;
    const isLiked = likedIds.has(song.id);
    let newLiked;
    let newIds = new Set(likedIds);

    if (isLiked) {
      newLiked = likedSongs.filter(s => s.id !== song.id);
      newIds.delete(song.id);
    } else {
      newLiked = [song, ...likedSongs];
      newIds.add(song.id);
    }
    setLikedSongs(newLiked);
    setLikedIds(newIds);
    saveLiked(newLiked);
  };



  const loadPlaylists = async () => {
    try {
      const json = await AsyncStorage.getItem('@playlists');
      if (json) {
        const list = JSON.parse(json);
        setLikedSongs(list);
        setLikedIds(new Set(list.map(s => s.id)));
      }
    } catch (e) {
      // Silent
    }
  };

  const savePlaylists = async (list) => {
    try {
      await AsyncStorage.setItem('@playlists', JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save playlists', e);
    }
  };

  const createPlaylist = (name) => {
    const newPlaylist = {
      id: Math.random().toString(36).substr(2, 9),
      name: name,
      songs: [],
      createdAt: new Date().toISOString()
    };
    const newList = [...playlists, newPlaylist];
    setPlaylists(newList);
    savePlaylists(newList);
  };

  const addSongToPlaylist = (playlistId, song) => {
    const newList = playlists.map(p => {
      if (p.id === playlistId) {
        // Check if song already exists to avoid duplicates
        if (p.songs.some(s => s.id === song.id)) return p;
        return { ...p, songs: [song, ...p.songs] };
      }
      return p;
    });
    setPlaylists(newList);
    savePlaylists(newList);
  };

  const fetchAllSections = async (lang) => {
    const l = lang || 'tamil';

    // 1. Check Memory Cache First (Instant Switch)
    const cached = sectionCacheRef.current.get(l);
    if (cached) {
      setSections(cached);
      setApiError('');
      return; // Return immediately for instant UI response
    }

    // 2. Check Persistent Cache (AsyncStorage) with expiration
    try {
      const cacheKey = `@sections_cache_${l}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        const { sections: cachedSections, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        const twoHours = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

        // Use cached data if less than 2 hours old
        if (now - timestamp < twoHours) {
          console.log(`[Vibee] Using cached sections for ${l} (${Math.round((now - timestamp) / 60000)} minutes old)`);
          setSections(cachedSections);
          sectionCacheRef.current.set(l, cachedSections);
          setApiError('');
          setLoading(false);
          return;
        } else {
          console.log(`[Vibee] Cache expired for ${l}, fetching fresh data`);
        }
      }
    } catch (e) {
      console.warn('[Vibee] Failed to read cache:', e);
    }

    setLoading(true);
    setApiError('');
    try {
      const lValue = l; // for closure


      // --- STAGE 1: Fast Loading (Query-based) ---
      const [rTrending, rSongsForYouBase] = await Promise.all([
        fetchSection(`${l} songs 2021,2022,2024,2023,2025`),
        fetchSection(`${l} popular songs`)
      ]);

      // Artist Personalization
      let artistSpecificSongs = [];
      if (followedArtists.length > 0) {
        try {
          const results = await Promise.all(followedArtists.slice(0, 5).map(name =>
            fetchSection(`${name} ${l}`).then(results => results.slice(0, 3))
          ));
          artistSpecificSongs = results.flat();
        } catch (e) { }
      }

      const rSongsForYou = shuffleArray([...artistSpecificSongs, ...rSongsForYouBase]);

      const seenIds = new Set();
      const deduplicate = (list, limit = 15) => {
        if (!list || list.length === 0) return [];
        return list.filter(song => {
          if (!song || !song.id) return false;
          if (seenIds.has(song.id)) return false;
          seenIds.add(song.id);
          return true;
        }).slice(0, limit);
      };

      const trending = deduplicate(rTrending, 20);
      const songsForYouFinal = [];
      const localSeen = new Set();
      for (const song of rSongsForYou) {
        if (song && song.id && !localSeen.has(song.id)) {
          localSeen.add(song.id);
          songsForYouFinal.push(song);
        }
        if (songsForYouFinal.length >= 20) break;
      }

      // Initial state update with fast sections
      const initialSections = {
        trending,
        chill: [],
        item: [],
        melody: [],
        songsForYou: songsForYouFinal
      };

      setSections(initialSections);
      setLoading(false); // UI is now interactive!

      // --- STAGE 2: Background Loading (AI-based) ---
      const loadAiSection = async (vibe, key) => {
        const results = await fetchAiSection(vibe, lValue, 10);
        if (results && results.length > 0) {
          setSections(prev => {
            const updated = { ...prev, [key]: results };
            sectionCacheRef.current.set(lValue, updated);
            return updated;
          });
        }
      };

      // Run AI calls in parallel but they update UI independently
      Promise.all([
        loadAiSection("chill", "chill"),
        loadAiSection("love", "item"),
        loadAiSection("melody", "melody")
      ]).then(async () => {
        const finalSections = sectionCacheRef.current.get(lValue);
        if (finalSections) {
          try {
            const cacheKey = `@sections_cache_${lValue}`;
            await AsyncStorage.setItem(cacheKey, JSON.stringify({
              sections: finalSections,
              timestamp: Date.now()
            }));
          } catch (e) { }
        }
      });
    } catch (e) {
      console.error("[Vibee] Fetch All Error:", e);
      setApiError('Failed to load sections. Please try again.');
    } finally {
      setLoading(false);

      // Background Warm-up: If this is the first load, pre-cache common languages
      if (sectionCacheRef.current.size === 1) {
        const others = LANGUAGES.filter(lang => lang.id !== l).slice(0, 3);
        others.forEach((lang, index) => {
          setTimeout(() => {
            warmupLanguage(lang.id);
          }, 3000 * (index + 1));
        });
      }
    }
  };

  const warmupLanguage = async (l) => {
    try {
      if (sectionCacheRef.current.has(l)) return;

      // Pre-fetch fast sections
      const [rTrending, rSongsForYouBase] = await Promise.all([
        fetchSection(`${l} songs 2025`, l),
        fetchSection(`${l} popular songs`, l)
      ]);

      // Pre-fetch AI sections
      const [rChill, rItem, rMelody] = await Promise.all([
        fetchAiSection("chill", l, 10),
        fetchAiSection("love", l, 10),
        fetchAiSection("melody", l, 10)
      ]);

      const seenIds = new Set();
      const deduplicate = (list, limit = 15) => {
        return (list || []).filter(song => {
          if (!song || seenIds.has(song.id)) return false;
          seenIds.add(song.id);
          return true;
        }).slice(0, limit);
      };

      const sections = {
        trending: deduplicate(rTrending, 20),
        chill: deduplicate(rChill, 10),
        item: deduplicate(rItem, 10),
        melody: deduplicate(rMelody, 10),
        songsForYou: deduplicate(rSongsForYouBase, 20)
      };

      sectionCacheRef.current.set(l, sections);
      console.log(`[Vibee] Background warm-up successful for ${l}`);
    } catch (e) {
      console.log(`[Vibee] Warm-up failed for ${l}`);
    }
  };

  const toggleFollowArtist = async (name, artistInfo = null) => {
    try {
      let newFollowed = [...followedArtists];
      const isFollowing = newFollowed.includes(name);

      if (isFollowing) {
        newFollowed = newFollowed.filter(a => a !== name);
      } else {
        newFollowed.push(name);

        // Background: Fetch and save artist image if we're following
        // this ensures the artist image shows up in the Library/Followed list
        const saveArtistDetail = async () => {
          try {
            const stored = await AsyncStorage.getItem('@artist_details');
            const details = stored ? JSON.parse(stored) : {};

            if (!details[name] || !details[name].image) {
              let artistToSave = artistInfo;

              // If info not provided or missing image, fetch from API
              if (!artistToSave || !artistToSave.image) {
                const data = await fetchJsonWithRetry(
                  `${API_BASE}/search/artists?query=${encodeURIComponent(name)}&limit=1`,
                  { retries: 2 }
                );
                const results = data?.data?.results || data?.results || [];
                if (results.length > 0) {
                  artistToSave = { ...results[0], name: cleanText(results[0].name || results[0].artist) };
                }
              }

              if (artistToSave && artistToSave.image) {
                details[name] = artistToSave;
                await AsyncStorage.setItem('@artist_details', JSON.stringify(details));
              }
            }
          } catch (err) {
            console.warn('Failed to save artist detail:', err);
          }
        };

        saveArtistDetail();
      }

      setFollowedArtists(newFollowed);
      await AsyncStorage.setItem('@followed_artists', JSON.stringify(newFollowed));

      // Refresh home sections if needed or update UI
      if (Platform.OS === 'android') {
        ToastAndroid.show(newFollowed.includes(name) ? `Following ${name}` : `Unfollowed ${name}`, ToastAndroid.SHORT);
      }
    } catch (e) {
      console.error("Toggle Follow Error:", e);
    }
  };

  const handleArtistSelect = async (artistInfo) => {
    // Prevent duplicate opens using ref (more reliable than state)
    if (artistFetchInProgressRef.current || artistModalVisible) {
      return;
    }

    artistFetchInProgressRef.current = true;

    let artistName = '';

    // Check if artistInfo is full object or just name string
    if (typeof artistInfo === 'object' && artistInfo !== null) {
      artistName = cleanText(artistInfo.name);
      setSelectedArtistDetails({ ...artistInfo, name: artistName });
    } else {
      artistName = cleanText(artistInfo);
      setSelectedArtistDetails({ name: artistName, image: null });

      // Try to fetch artist details (image) in background if not provided
      const fetchArtistImage = async () => {
        try {
          const data = await fetchJsonWithRetry(
            `${API_BASE}/search/artists?query=${encodeURIComponent(artistName)}&limit=1`,
            { retries: 2 }
          );
          const artist = data?.data?.results?.[0] || data?.results?.[0] || data?.[0];
          if (artist && artist.image) {
            setSelectedArtistDetails({
              name: artistName,
              image: artist.image
            });
          }
        } catch (err) {
          // Silent fail
        }
      };
      fetchArtistImage();
    }

    setSelectedArtist(artistName);
    setLoadingArtistSongs(true);
    setArtistModalVisible(true);
    setArtistSongs([]);

    try {
      let data = await fetchJsonWithRetry(
        `${API_BASE}/search/songs?query=${encodeURIComponent(artistName + ' ' + currentLanguage)}&limit=40`,
        { retries: 3 }
      );

      let rawResults = [];
      const extractResults = (d) => {
        if (d?.data?.results && Array.isArray(d.data.results)) return d.data.results;
        if (d?.results && Array.isArray(d.results)) return d.results;
        if (d?.data && Array.isArray(d.data)) return d.data;
        if (Array.isArray(d)) return d;
        return [];
      };

      rawResults = extractResults(data);

      // Fallback: If no results for Name + Language, try just Name
      if (rawResults.length === 0) {
        data = await fetchJsonWithRetry(
          `${API_BASE}/search/songs?query=${encodeURIComponent(artistName)}&limit=40`,
          { retries: 2 }
        );
        rawResults = extractResults(data);
      }

      const formatted = rawResults.map(formatSong).filter(s => s !== null);
      setArtistSongs(formatted);
    } catch (err) {
      console.warn(`[Vibee] Error fetching artist songs:`, err);
    } finally {
      setLoadingArtistSongs(false);
      // Reset the ref after a longer delay to prevent rapid reopening
      setTimeout(() => {
        artistFetchInProgressRef.current = false;
      }, 1000);
    }
  };

  const handleArtistSongPlay = (song) => {
    // Wrapper to play song without triggering modal state changes
    playSong(song, artistSongs, 'artist');
  };

  const handleAddToLibraryFromArtist = (song) => {
    // Open playlist selection modal
    setSelectedSongForPlaylist(song);
    setPlaylistModalVisible(true);
  };

  const handlePlaylistSelectForSong = (playlistId) => {
    if (!selectedSongForPlaylist) return;

    if (playlistId === 'create_new') {
      setIsCreatingPlaylist(true);
      setNewPlaylistName('');
    } else {
      addSongToPlaylist(playlistId, selectedSongForPlaylist);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Added to playlist', ToastAndroid.SHORT);
      } else if (Platform.OS === 'web') {
        alert('Added to playlist');
      }
      setPlaylistModalVisible(false);
      setSelectedSongForPlaylist(null);
    }
  };

  const createNewPlaylistFromModal = () => {
    if (!newPlaylistName.trim()) {
      if (Platform.OS === 'web') alert('Please enter a name');
      else ToastAndroid.show('Please enter a name', ToastAndroid.SHORT);
      return;
    }

    const newId = Date.now().toString();
    const newName = newPlaylistName.trim();
    const newPlaylist = { id: newId, name: newName, songs: [] };

    // Optimistically update playlists with the new playlist AND the song added
    const playlistWithSong = { ...newPlaylist, songs: [selectedSongForPlaylist] };
    setPlaylists([playlistWithSong, ...playlists]);

    if (Platform.OS === 'android') {
      ToastAndroid.show(`Created ${newName} and added song`, ToastAndroid.SHORT);
    } else if (Platform.OS === 'web') {
      alert(`Created ${newName} and added song`);
    }

    setPlaylistModalVisible(false);
    setSelectedSongForPlaylist(null);
    setIsCreatingPlaylist(false);
    setNewPlaylistName('');
  };


  const performSearch = async (query, setResultsCallback, { signal } = {}) => {
    try {
      const cacheKey = query.trim().toLowerCase();

      // 1. Check memory cache
      const cached = searchCacheRef.current.get(cacheKey);
      if (cached) {
        setResultsCallback(cached);
        setApiError('');
        return;
      }

      // 2. Check persistent cache with expiration
      try {
        const persistentCacheKey = `@search_cache_${cacheKey}`;
        const cachedData = await AsyncStorage.getItem(persistentCacheKey);
        if (cachedData) {
          const { results, timestamp } = JSON.parse(cachedData);
          const now = Date.now();
          const oneHour = 60 * 60 * 1000; // 1 hour

          if (now - timestamp < oneHour) {
            console.log(`[Vibee] Using cached search for "${query}"`);
            searchCacheRef.current.set(cacheKey, results);
            setResultsCallback(results);
            setApiError('');
            return;
          }
        }
      } catch (e) {
        console.warn('[Vibee] Failed to read search cache:', e);
      }

      // 3. Fetch fresh data - Parallel Fetch: Artists + Songs
      const [songData, artistData] = await Promise.all([
        fetchJsonWithRetry(
          `${API_BASE}/search/songs?query=${encodeURIComponent(query)}&limit=25`,
          { retries: 2, onRateLimit: ({ waitSeconds }) => setApiError(`Server busy. Wait ${waitSeconds}s.`) }
        ).catch(() => ({ results: [] })),
        fetchJsonWithRetry(
          `${API_BASE}/search/artists?query=${encodeURIComponent(query)}&limit=4`,
          { retries: 1 }
        ).catch(() => ({ results: [] }))
      ]);

      if (signal?.aborted) return;

      // Extract & Format Songs
      let rawSongs = [];
      if (songData?.data?.results) rawSongs = songData.data.results;
      else if (songData?.results) rawSongs = songData.results;
      else if (songData?.data) rawSongs = songData.data;

      const formattedSongs = rawSongs.map(formatSong).filter(Boolean);

      // Extract & Format Artists
      let rawArtists = [];
      if (artistData?.data?.results) rawArtists = artistData.data.results;
      else if (artistData?.results) rawArtists = artistData.results;
      else if (artistData?.data) rawArtists = artistData.data;

      const formattedArtists = rawArtists.map(a => {
        let imageUrl = '';
        if (typeof a.image === 'string') {
          // Upgrade low-res string images
          imageUrl = a.image.replace('150x150', '500x500').replace('50x50', '500x500');
        } else if (Array.isArray(a.image)) {
          const img = a.image.find(i => i.quality === '500x500') || a.image[a.image.length - 1];
          imageUrl = img?.url || img?.link;
        }

        return {
          id: a.id,
          name: cleanText(a.name || a.title),
          image: imageUrl,
          rawImage: a.image, // Keep raw for the modal logic to use later
          type: 'artist',
          role: a.role || 'Artist'
        };
      }).filter(Boolean);

      const combinedResults = [...formattedArtists, ...formattedSongs];

      if (combinedResults.length > 0) {
        searchCacheRef.current.set(cacheKey, combinedResults);

        // Save to persistent cache
        try {
          const persistentCacheKey = `@search_cache_${cacheKey}`;
          await AsyncStorage.setItem(persistentCacheKey, JSON.stringify({
            results: combinedResults,
            timestamp: Date.now()
          }));
        } catch (e) {
          console.warn('[Vibee] Failed to save search cache:', e);
        }

        setResultsCallback(combinedResults);
        setApiError('');
      } else {
        setResultsCallback([]);
        setApiError('No results found.');
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setResultsCallback([]);
      setApiError('Search failed.');
    }
  };



  // Helper to clean HTML tags and excessive whitespace from lyrics
  const sanitizeLyrics = (text) => {
    if (!text) return "";
    return text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .trim();
  };

  const fetchLyrics = async (song) => {
    if (!song) return "No song selected.";

    // Helper to clean song titles for better search results
    const cleanQuery = (text) => {
      return text
        .replace(/\(From.*?\)/gi, '')
        .replace(/\(Original.*?\)/gi, '')
        .replace(/\(Official.*?\)/gi, '')
        .replace(/\(Remix.*?\)/gi, '')
        .replace(/\[.*?\]/g, '')
        .replace(/- Movie/gi, '')
        .trim();
    };

    const title = cleanQuery(song.name || "");
    const artist = cleanQuery(song.artists?.primary?.[0]?.name || song.artist || "");
    const duration = song.duration || 0;

    // 1. Try primary API first (legacy/id-based)
    try {
      const data = await fetchJsonWithRetry(`${API_BASE}/songs/${song.id}/lyrics`, { retries: 1, timeoutMs: 5000 });
      if (data?.success && (data?.data?.lyrics || data?.lyrics)) {
        return sanitizeLyrics(data.data?.lyrics || data.lyrics);
      }
    } catch (e) {
      console.log("[Lyrics] Primary API failed");
    }

    // 2. Fallback: LRCLIB (Exact Match)
    try {
      const queryParams = `artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}${duration ? `&duration=${duration}` : ''}`;
      const res = await fetch(`https://lrclib.net/api/get?${queryParams}`);
      if (res.ok) {
        const lrcData = await res.json();
        return lrcData.syncedLyrics || lrcData.plainLyrics || null;
      }
    } catch (e) {
      console.log("[Lyrics] LRCLIB Exact failed");
    }

    // 3. Fallback: LRCLIB (Search Match - Higher success rate for slight metadata mismatches)
    try {
      const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(`${title} ${artist}`)}`);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData && searchData.length > 0) {
          // Find the best match (first result)
          const bestMatch = searchData[0];
          return bestMatch.syncedLyrics || bestMatch.plainLyrics || null;
        }
      }
    } catch (e) {
      console.warn("[Lyrics] Search fallback error", e);
    }

    return "Lyrics not available for this song.";
  };

  const handleLanguageSelect = async (lang) => {
    if (loading) return;
    setCurrentLanguage(lang);
    setLangModalVisible(false);
    await AsyncStorage.setItem('@current_language', lang);
    fetchAllSections(lang);
  };

  // Sleep Timer State
  const [sleepTimer, setSleepTimer] = useState(null); // Minutes
  const [sleepTimerActive, setSleepTimerActive] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (sleepTimerActive && sleepTimer > 0) {
      timerRef.current = setTimeout(() => {
        setSleepTimer(prev => {
          if (prev <= 1) {
            // Timer finished
            TrackPlayer.pause();
            setIsPlaying(false);
            setSleepTimerActive(false);
            return null;
          }
          return prev - 1;
        });
      }, 60000); // Check every minute
    }
    return () => clearTimeout(timerRef.current);
  }, [sleepTimer, sleepTimerActive]);

  const handleSetSleepTimer = (minutes) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (minutes === null) {
      setSleepTimer(null);
      setSleepTimerActive(false);
    } else {
      setSleepTimer(minutes);
      setSleepTimerActive(true);
      if (Platform.OS === 'android') {
        ToastAndroid.show(`Sleep timer set for ${minutes} minutes`, ToastAndroid.SHORT);
      } else if (Platform.OS === 'web') {
        alert(`Sleep timer set for ${minutes} minutes`);
      }
    }
  };

  const detectMood = (song, playlistName = '') => {
    const text = (song.name + ' ' + (song.album?.name || '') + ' ' + playlistName).toLowerCase();

    if (text.includes('melody') || text.includes('love') || text.includes('romantic') || text.includes('feeling')) return 'melody';
    if (text.includes('item') || text.includes('party') || text.includes('dance') || text.includes('beat')) return 'item';
    if (text.includes('chill') || text.includes('slow') || text.includes('relax') || text.includes('sad')) return 'chill';
    if (text.includes('trending') || text.includes('hit') || text.includes('top')) return 'trending';

    return 'popular';
  };

  const fetchSimilarSongs = async (song, mood) => {
    try {
      console.log(`[Vibee] Fetching recommendations for mood: ${mood}`);
      let query = `${currentLanguage} ${mood} songs`;

      // If we have a specific mood like melody, add romantic keywords
      if (mood === 'melody') query = `${currentLanguage} love romantic songs`;
      else if (mood === 'item') query = `${currentLanguage} dance party songs`;
      else if (mood === 'chill') query = `${currentLanguage} chill slow songs`;

      // 1. Try suggestions endpoint if available (id-based)
      try {
        const data = await fetchJsonWithRetry(`${API_BASE}/songs/${song.id}/suggestions?limit=10`, { retries: 1 });
        const results = data?.data || data?.results || data || [];
        if (results.length > 5) {
          return results.map(formatSong).filter(Boolean);
        }
      } catch (e) {
        console.log("[Vibee] Suggestions ID endpoint failed, using search fallback");
      }

      // 2. Search Fallback
      const data = await fetchJsonWithRetry(
        `${API_BASE}/search/songs?query=${encodeURIComponent(query)}&limit=15`,
        { retries: 1 }
      );
      const raw = data?.data?.results || data?.results || data || [];
      return shuffleArray(raw.map(formatSong).filter(Boolean)).slice(0, 10);
    } catch (e) {
      console.warn("[Vibee] Failed to fetch similar songs", e);
      return [];
    }
  };

  const handleInfiniteAutoplay = async () => {
    if (!currentSongRef.current) return;

    const mood = lastMoodContext || detectMood(currentSongRef.current);
    const recommendations = await fetchSimilarSongs(currentSongRef.current, mood);

    if (recommendations.length > 0) {
      const tracks = recommendations.map(s => ({
        id: s.id,
        url: s.downloadUrl?.[0]?.url || s.media_url,
        title: s.name,
        artist: s.artists?.primary?.[0]?.name || s.artist || 'Unknown Artist',
        artwork: s.image?.[2]?.url || s.image?.[1]?.url,
        duration: s.duration,
        originalSong: s,
      })).filter(t => t.url);

      if (tracks.length > 0) {
        await TrackPlayer.add(tracks);
        // Play the first new song added
        const queue = await TrackPlayer.getQueue();
        const lastIndex = queue.length - tracks.length;
        if (lastIndex >= 0) {
          await TrackPlayer.skip(lastIndex);
          await TrackPlayer.play();
          if (Platform.OS === 'android') {
            ToastAndroid.show('Playing recommended songs', ToastAndroid.SHORT);
          }
        }
      }
    }
  };

  const playSong = async (song, playlist, context = null) => {
    if (!song) return;

    if (context) setLastMoodContext(context);
    else setLastMoodContext(detectMood(song));

    const getStreamUrl = (song) => {
      if (song.localUri) return song.localUri; // Priority to local file

      if (!song.downloadUrl || !Array.isArray(song.downloadUrl) || song.downloadUrl.length === 0) {
        return song.media_url || null;
      }
      const highQuality = song.downloadUrl.find(d => d.quality === '320kbps');
      const medQuality = song.downloadUrl.find(d => d.quality === '160kbps');
      return highQuality?.url || medQuality?.url || song.downloadUrl[song.downloadUrl.length - 1]?.url;
    };

    const url = getStreamUrl(song);
    if (!url) {
      alert("Cannot play this song (No streaming link found)");
      return;
    }

    // Toggle logic if same song
    if (currentSongRef.current?.id === song.id) {
      if (isPlaying) {
        setIsPlaying(false);
        TrackPlayer.pause();
      } else {
        setIsPlaying(true);
        TrackPlayer.play();
      }
      return;
    }

    try {
      setIsStartingPlayback(true);
      setStartingSongId(song.id);

      await TrackPlayer.reset();

      if (playlist && playlist.length > 0) {
        const tracks = playlist.map(s => ({
          id: s.id,
          url: getStreamUrl(s),
          title: s.name,
          artist: s.artists?.primary?.[0]?.name || s.artist || 'Unknown Artist',
          artwork: s.image?.[2]?.url || s.image?.[1]?.url,
          duration: s.duration,
          originalSong: s,
        })).filter(t => t.url);

        const startIndex = tracks.findIndex(t => t.id === song.id);
        await TrackPlayer.add(tracks);
        if (startIndex !== -1) {
          await TrackPlayer.skip(startIndex);
        } else if (tracks.length > 0) {
          // If selected song is not valid, play first valid song
          await TrackPlayer.skip(0);
        }
      } else {
        await TrackPlayer.add([{
          id: song.id,
          url: url,
          title: song.name,
          artist: song.artists?.primary?.[0]?.name || song.artist || 'Unknown Artist',
          artwork: song.image?.[2]?.url || song.image?.[1]?.url,
          duration: song.duration,
          originalSong: song,
        }]);
      }

      await TrackPlayer.play();
      setCurrentSong(song);
      currentSongRef.current = song;


    } catch (error) {
      console.error("[Vibee] Playback error:", error);
    } finally {
      setIsStartingPlayback(false);
      setStartingSongId(null);
    }
  };

  const handleNext = async () => {
    try {
      const queue = await TrackPlayer.getQueue();
      const currentIndex = await TrackPlayer.getActiveTrackIndex();
      if (currentIndex !== undefined && currentIndex < queue.length - 1) {
        // Optimistically set the next song in UI
        const nextTrack = queue[currentIndex + 1];
        if (nextTrack?.originalSong) {
          setCurrentSong(nextTrack.originalSong);
          currentSongRef.current = nextTrack.originalSong;
        }
      }
      await TrackPlayer.skipToNext();
    } catch (e) { }
  };

  const handlePrev = async () => {
    try {
      const queue = await TrackPlayer.getQueue();
      const currentIndex = await TrackPlayer.getActiveTrackIndex();
      if (currentIndex !== undefined && currentIndex > 0) {
        // Optimistically set the prev song in UI
        const prevTrack = queue[currentIndex - 1];
        if (prevTrack?.originalSong) {
          setCurrentSong(prevTrack.originalSong);
          currentSongRef.current = prevTrack.originalSong;
        }
      }
      await TrackPlayer.skipToPrevious();
    } catch (e) { }
  };

  const handleSeek = async (positionMillis) => {
    try {
      await TrackPlayer.seekTo(positionMillis / 1000);
    } catch (e) {
      console.warn("[Vibee] Seek error:", e);
    }
  };

  const handleSmartSearch = async (query) => {
    if (!query || !query.trim()) return;

    setLoadingSmartPlaylist(true);
    setSmartPlaylistModalVisible(true);
    setSmartPlaylistTitle(query);
    setSmartPlaylistSongs([]);
    setApiError('');

    try {
      console.log(`[Vibee] Smart Search: Reaching out to Gemini for vibe: "${query}"`);

      let aiMetadata = [];
      try {
        aiMetadata = await GeminiService.getSongRecommendations(query);
      } catch (e) {
        console.warn("[Vibee] Gemini retrieval failed, using fallback search logic.", e);
      }

      let allFoundSongs = [];
      let bannerImage = null;
      const seenIds = new Set();

      const addSongs = (songs) => {
        songs.forEach(s => {
          const formatted = formatSong(s);
          if (formatted && formatted.id && !seenIds.has(formatted.id)) {
            seenIds.add(formatted.id);
            allFoundSongs.push(formatted);
          }
        });
      };

      // --- STAGE 1: AI Metadata Resolution (Mood Accuracy) ---
      if (aiMetadata && aiMetadata.length > 0) {
        console.log(`[Vibee] Gemini recommended ${aiMetadata.length} songs. Resolving tracks...`);
        const BATCH_SIZE = 5;
        for (let i = 0; i < aiMetadata.length; i += BATCH_SIZE) {
          const batch = aiMetadata.slice(i, i + BATCH_SIZE);
          const promises = batch.map(async (meta) => {
            try {
              const searchQuery = `${meta.track} ${meta.artist}`;
              const searchUrl = `${API_BASE}/search/songs?query=${encodeURIComponent(searchQuery)}&limit=1`;
              const data = await fetchJsonWithRetry(searchUrl, { retries: 1 });
              return data?.data?.results?.[0] || data?.results?.[0] || null;
            } catch (err) { return null; }
          });
          const results = await Promise.all(promises);
          addSongs(results.filter(Boolean));
          if (allFoundSongs.length > 0) setSmartPlaylistSongs([...allFoundSongs]);
          await sleep(200);
        }
      }

      // --- STAGE 2: Mood via Curated Playlists (Fallback/Supplement) ---
      if (allFoundSongs.length < 10) {
        try {
          const playlistSearchUrl = `${API_BASE}/search/playlists?query=${encodeURIComponent(query)}&limit=5`;
          const pSearchData = await fetchJsonWithRetry(playlistSearchUrl, { retries: 1 });
          const playlists = pSearchData?.data?.results || pSearchData?.results || [];

          for (const playlist of playlists) {
            const playlistDetailUrl = `${API_BASE}/playlists?id=${playlist.id}`;
            const pDetailData = await fetchJsonWithRetry(playlistDetailUrl, { retries: 1 });
            const songs = pDetailData?.data?.songs || pDetailData?.songs || [];
            if (songs.length > 0) {
              addSongs(songs);
              if (!bannerImage) bannerImage = playlist.image?.[2]?.url || playlist.image?.[playlist.image.length - 1]?.link;
            }
            if (allFoundSongs.length >= 60) break;
          }
        } catch (e) { console.warn("[Vibee] Playlist stage failed", e); }
      }

      if (allFoundSongs.length === 0) {
        setApiError("No results found for this description.");
      } else {
        const shuffled = allFoundSongs
          .map(value => ({ value, sort: Math.random() }))
          .sort((a, b) => a.sort - b.sort)
          .map(({ value }) => value)
          .slice(0, 30);

        setSmartPlaylistSongs(shuffled);
        if (bannerImage) setSmartPlaylistImage(bannerImage);
        else if (shuffled[0]?.image?.[2]?.url) setSmartPlaylistImage(shuffled[0].image[2].url);
      }
      setLoadingSmartPlaylist(false);
      return;
    } catch (e) {
      console.error("Smart search failed", e);
      setApiError(`Error: ${e.message}`);
    } finally {
      setLoadingSmartPlaylist(false);
    }
  };

  // --- Download Management ---
  // No longer using separate useEffect for loadDownloadData as it's now part of the prepare() sequence
  // but we keep the function definition hoisted/available below.

  const loadDownloadData = async () => {
    if (Platform.OS === 'web') {
      try {
        const songs = JSON.parse(localStorage.getItem('vibee_downloads') || '[]');
        const folders = JSON.parse(localStorage.getItem('vibee_folders') || '[]');
        setDownloads(songs);
        setDownloadFolders(folders);
      } catch (e) {
        console.warn("[Vibee] Web download load error", e);
      }
      return;
    }
    try {
      // Ensure directory
      const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
        await FileSystem.writeAsStringAsync(METADATA_FILE, JSON.stringify({ songs: [], folders: [] }));
        return;
      }
      const metaInfo = await FileSystem.getInfoAsync(METADATA_FILE);
      if (metaInfo.exists) {
        const content = await FileSystem.readAsStringAsync(METADATA_FILE);
        const data = JSON.parse(content);
        setDownloads(data.songs || []);
        setDownloadFolders(data.folders || []);
      }
    } catch (e) {
      console.error("[Vibee] Mobile download load error", e);
    }
  };

  const saveDownloadData = async (newSongs, newFolders) => {
    if (Platform.OS === 'web') {
      setDownloads(newSongs);
      setDownloadFolders(newFolders);
      localStorage.setItem('vibee_downloads', JSON.stringify(newSongs));
      localStorage.setItem('vibee_folders', JSON.stringify(newFolders));
      return;
    }
    try {
      await FileSystem.writeAsStringAsync(METADATA_FILE, JSON.stringify({
        songs: newSongs,
        folders: newFolders
      }));
      setDownloads(newSongs);
      setDownloadFolders(newFolders);
    } catch (e) {
      console.error("[Vibee] Save download error", e);
    }
  };

  const createDownloadFolder = async (name) => {
    const newFolder = {
      id: Date.now().toString(),
      name: name.trim(),
      songIds: []
    };
    const updated = [...downloadFolders, newFolder];
    await saveDownloadData(downloads, updated);
  };

  const deleteDownloadFolder = async (folderId) => {
    const updated = downloadFolders.filter(f => f.id !== folderId);
    await saveDownloadData(downloads, updated);
  };

  const addSongToDownloadFolder = async (folderId, songId) => {
    const updated = downloadFolders.map(f => {
      if (f.id === folderId) {
        if (f.songIds.includes(songId)) return f;
        return { ...f, songIds: [...f.songIds, songId] };
      }
      return f;
    });
    await saveDownloadData(downloads, updated);
  };

  const downloadSong = async (song, folderId = null) => {
    if (!song) return;

    try {
      const isAlreadyDownloaded = downloads.some(s => s.id === song.id);

      if (isAlreadyDownloaded) {
        if (folderId) {
          await addSongToDownloadFolder(folderId, song.id);
          ToastAndroid.show("Added to download folder", ToastAndroid.SHORT);
        } else {
          Alert.alert("Already Downloaded", "This song is already in your downloads.");
        }
        return downloads.find(s => s.id === song.id);
      }

      if (Platform.OS === 'web') {
        const newSong = {
          ...song,
          localUri: song.image?.[1]?.url || song.image,
          downloadedAt: Date.now()
        };
        const newDownloads = [...downloads, newSong];
        let newFolders = [...downloadFolders];
        if (folderId) {
          newFolders = newFolders.map(f => f.id === folderId ? { ...f, songIds: [...f.songIds, song.id] } : f);
        }
        await saveDownloadData(newDownloads, newFolders);
        ToastAndroid.show("Download Complete (Web Mock)!", ToastAndroid.SHORT);
        return newSong;
      }

      // Mobile logic
      let url = song.downloadUrl?.[0]?.url || song.media_url;
      if (Array.isArray(song.downloadUrl)) {
        const high = song.downloadUrl.find(d => d.quality === '320kbps') || song.downloadUrl[song.downloadUrl.length - 1];
        url = high.url;
      }
      if (!url) {
        Alert.alert("Error", "No download link available.");
        return null;
      }

      const filename = `${song.id}.mp3`;
      const fileUri = DOWNLOADS_DIR + filename;
      ToastAndroid.show("Downloading...", ToastAndroid.SHORT);

      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      const newSong = {
        ...song,
        localUri: uri,
        downloadedAt: Date.now()
      };

      const newDownloads = [...downloads, newSong];
      let newFolders = [...downloadFolders];
      if (folderId) {
        newFolders = newFolders.map(f => f.id === folderId ? { ...f, songIds: [...f.songIds, song.id] } : f);
      }
      await saveDownloadData(newDownloads, newFolders);
      ToastAndroid.show("Download Complete!", ToastAndroid.SHORT);
      return newSong;
    } catch (error) {
      console.error("Download error:", error);
      Alert.alert("Download Failed", "There was an error saving the song.");
      return null;
    }
  };

  const deleteDownloadedSong = async (songId) => {
    try {
      const song = downloads.find(s => s.id === songId);
      if (song && Platform.OS !== 'web') {
        await FileSystem.deleteAsync(song.localUri).catch(() => { });
      }
      const updatedDownloads = downloads.filter(s => s.id !== songId);
      const updatedFolders = downloadFolders.map(f => ({
        ...f,
        songIds: f.songIds.filter(id => id !== songId)
      }));
      await saveDownloadData(updatedDownloads, updatedFolders);
    } catch (e) {
      console.error("Delete download error", e);
    }
  };

  const handleShowAll = async (title) => {
    // If already loading or showing, maybe prevent? But user might switch.
    setExpandedSection({ title, songs: [], loading: true });

    let query = '';
    const l = currentLanguage;

    // Logic matching the coreQueries
    switch (title) {
      case "Trending Songs": query = `${l} songs 2021,2022,2024,2023,2025`; break;
      case "Chill Songs": query = `${l} songs 2020,2019,2018,2017,2016`; break;
      case "Love Songs": query = `${l} songs 2015,2014,2013,2012,2011`; break;
      case "Melody Songs": query = `${l} songs 2010,2009,2008,2007,2006`; break;
      case "Songs for You": query = `${l} popular songs`; break;
      default: query = `${l} songs`; // Fallback
    }

    try {
      // Reuse similar logic to fetchSection but for "Show All" with higher limit
      const subQueries = query.split(',').map(q => q.trim()).filter(q => q);

      const formatQuery = (rawQ) => {
        const lowerQ = rawQ.toLowerCase();
        const lowerLang = (l || '').toLowerCase();
        if (!lowerQ.includes(lowerLang)) return `${l} songs ${rawQ}`;
        return rawQ;
      };

      const promises = subQueries.map(q =>
        fetchJsonWithRetry(
          `${API_BASE}/search/songs?query=${encodeURIComponent(formatQuery(q))}&limit=20`, // Fetch ~20 per sub-query -> up to 100 total
          { retries: 2, timeoutMs: 12000 }
        ).catch(() => null)
      );

      const responses = await Promise.all(promises);
      let allResults = [];
      for (const data of responses) {
        let raw = [];
        if (data?.data?.results) raw = data.data.results;
        else if (data?.results) raw = data.results;
        else if (data?.data) raw = data.data;
        else if (Array.isArray(data)) raw = data;

        if (raw && raw.length > 0) allResults.push(...raw);
      }

      const unique = [];
      const ids = new Set();
      // Format all raw items
      const formattedAll = allResults.map(formatSong).filter(Boolean);

      for (const item of formattedAll) {
        if (item.id && !ids.has(item.id)) {
          ids.add(item.id);
          unique.push(item);
        }
      }

      setExpandedSection({ title, songs: shuffleArray(unique), loading: false });

    } catch (e) {
      console.warn("Error expanding section", e);
      // Show error state inside the section screen ideally, but for now empty list works
      setExpandedSection({ title, songs: [], loading: false });
    }
  };

  const renderContent = () => {
    // Show Expanded Section if active (overrides tab content temporarily)
    if (expandedSection) {
      return (
        <SectionScreen
          title={expandedSection.title}
          songs={expandedSection.songs}
          onBack={() => setExpandedSection(null)}
          // Standard player props
          currentSong={currentSong}
          isPlaying={isPlaying}
          isStartingPlayback={isStartingPlayback}
          startingSongId={startingSongId}
          onTrackSelect={(song, queue) => playSong(song, queue, expandedSection.title)}
          onLike={toggleLike}
          likedSongs={likedSongs}
          onAddToPlaylist={(song) => {
            setSelectedSongForPlaylist(song);
            setPlaylistModalVisible(true);
          }}
        />
      );
    }

    if (activeTab === 'home') {
      return (
        <HomeScreen
          currentLanguage={currentLanguage}
          sections={sections}
          artists={ARTISTS_BY_LANG[currentLanguage] || []}
          onArtistSelect={handleArtistSelect}
          loading={loading}
          errorText={apiError}
          currentSong={currentSong}
          isPlaying={isPlaying}
          isStartingPlayback={isStartingPlayback}
          startingSongId={startingSongId}
          likedSongs={likedSongs}
          onTrackSelect={(song, queue) => playSong(song, queue, 'home')}
          onLike={toggleLike}
          languages={LANGUAGES}
          onLanguageSelect={(langId) => {
            if (loading) return;
            setCurrentLanguage(langId);
            fetchAllSections(langId);
          }}
          onShowAll={handleShowAll}
        />
      );
    }
    if (activeTab === 'search') {
      return (
        <SearchScreen
          onSearch={performSearch}
          errorText={apiError}
          currentSong={currentSong}
          isPlaying={isPlaying}
          isStartingPlayback={isStartingPlayback}
          startingSongId={startingSongId}
          likedSongs={likedSongs}
          onTrackSelect={(song, queue) => playSong(song, queue, 'search')}
          onLike={toggleLike}
          defaultSongs={sections.trending}
          targetPlaylist={playlists.find(p => p.id === targetPlaylistId)}
          onAddToPlaylist={(song) => {
            addSongToPlaylist(targetPlaylistId, song);
            alert(`Added to ${playlists.find(p => p.id === targetPlaylistId)?.name}`);
          }}
          onArtistSelect={handleArtistSelect}
        />
      );
    }
    if (activeTab === 'library') {
      if (libraryView === 'liked') {
        return (
          <LikedSongsScreen
            likedSongs={likedSongs}
            onBack={() => setLibraryView('main')}
            currentSong={currentSong}
            isPlaying={isPlaying}
            isStartingPlayback={isStartingPlayback}
            startingSongId={startingSongId}
            onTrackSelect={(song) => playSong(song, likedSongs, 'liked')}
            onLike={toggleLike}
          />
        );
      }
      // New Playlist Detail View
      if (libraryView.startsWith('playlist:')) {
        const playlistId = libraryView.split(':')[1];
        const playlist = playlists.find(p => p.id === playlistId);
        if (!playlist) {
          setLibraryView('main');
          return null;
        }
        return (
          <LikedSongsScreen
            title={playlist.name}
            likedSongs={playlist.songs}
            onBack={() => setLibraryView('main')}
            currentSong={currentSong}
            isPlaying={isPlaying}
            isStartingPlayback={isStartingPlayback}
            startingSongId={startingSongId}
            onTrackSelect={(song) => playSong(song, playlist.songs, playlist.name)}
            onLike={toggleLike}
            isPlaylist
            userFavorites={likedSongs}
            onSearchAndAdd={() => {
              setTargetPlaylistId(playlistId);
              setActiveTab('search');
            }}
          />
        );
      }
      return (
        <LibraryScreen
          likedCount={likedSongs.length}
          playlists={playlists}
          downloadFolders={downloadFolders}
          onAddToDownloadFolder={addSongToDownloadFolder}
          followedArtists={followedArtists}
          onCreatePlaylist={createPlaylist}
          onToggleFollowArtist={toggleFollowArtist}
          onArtistClick={handleArtistSelect}
          onNavigate={(screen) => {
            pushToHistory('library', libraryView);
            if (screen === 'liked') {
              setTargetPlaylistId(null);
              setLibraryView('liked');
            } else if (screen.startsWith('playlist:')) {
              setLibraryView(screen);
            }
          }}
        />
      );
    }
    if (activeTab === 'download') {
      return (
        <DownloadScreen
          onTrackSelect={(song, queue) => playSong(song, queue, 'download')}
          currentLanguage={currentLanguage}
          currentSong={currentSong}
          isPlaying={isPlaying}
          isStartingPlayback={isStartingPlayback}
          onPlayPause={() => playSong(currentSong)}
          onNext={handleNext}
          onPrev={handlePrev}
          progress={playbackStatus.progress}
          onOpenFullPlayer={() => setFullPlayerVisible(true)}
          downloads={downloads}
          folders={downloadFolders}
          onDownload={downloadSong}
          onDeleteDownload={deleteDownloadedSong}
          onCreateFolder={createDownloadFolder}
          onDeleteFolder={deleteDownloadFolder}
          onAddToFolder={addSongToDownloadFolder}
          performSearch={performSearch}
        />
      );
    }
    if (activeTab === 'vibe') {
      return (
        <AiScreen
          onSmartSearch={handleSmartSearch}
        />
      );
    }
  };

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <LinearGradient
          colors={['#1a1a1a', '#000000']}
          style={[styles.container, { backgroundColor: '#000' }]}
        >
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

          {/* Main App Content */}
          <SafeAreaView style={styles.safeArea}>
            {/* Main Content with Fade In */}
            {/* Main Content - Always visible behind splash */}
            <View style={[styles.mainContent, { flex: 1 }]}>
              {renderContent()}
            </View>


            {/* Artist Songs Modal - Immersive Header Style */}
            <Modal visible={artistModalVisible} animationType="slide" transparent={true} onRequestClose={() => setArtistModalVisible(false)}>
              <View style={{ flex: 1, backgroundColor: '#000000' }}>
                <View style={{ flex: 1 }}>
                  {loadingArtistSongs ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <ActivityIndicator size="large" color="#9B5DE5" />
                      <Text style={{ color: '#9CA3AF', marginTop: 12 }}>Loading {selectedArtist}...</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={artistSongs}
                      keyExtractor={(item) => item.id}
                      contentContainerStyle={{ paddingBottom: 150 }}
                      ListHeaderComponent={() => (
                        <View>
                          {/* Large Header Section */}
                          <ImageBackground
                            source={{
                              uri: (() => {
                                if (!selectedArtistDetails?.image) return null;
                                if (typeof selectedArtistDetails.image === 'string') {
                                  // Hack to upgrade low-res saavn images
                                  return selectedArtistDetails.image.replace('150x150', '500x500').replace('50x50', '500x500');
                                }
                                if (Array.isArray(selectedArtistDetails.image)) {
                                  // Prefer highest resolution for header
                                  const img = selectedArtistDetails.image.find(i => i.quality === '1000x1000') ||
                                    selectedArtistDetails.image.find(i => i.quality === 'high') ||
                                    selectedArtistDetails.image.find(i => i.quality === '500x500') ||
                                    selectedArtistDetails.image[selectedArtistDetails.image.length - 1];
                                  return img?.url || img?.link || null;
                                }
                                return null;
                              })()
                            }}
                            style={{ width: '100%', height: 450, justifyContent: 'flex-end' }}
                            resizeMode="cover"
                            imageStyle={{ top: 0 }} // Align image to top to see face if cropped
                          >
                            <LinearGradient
                              colors={['transparent', 'rgba(0,0,0,0.6)', '#000000']}
                              style={{ height: '70%', padding: 24, justifyContent: 'flex-end' }}
                            >
                              <Text style={{ color: '#9B5DE5', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 }}>
                                {selectedArtistDetails?.role || 'Artist'}
                              </Text>
                              <Text style={{
                                color: '#FFF',
                                fontSize: 42,
                                fontWeight: '900',
                                letterSpacing: -1
                              }} numberOfLines={2}>
                                {selectedArtist}
                              </Text>
                            </LinearGradient>

                            {/* Back Button */}
                            <TouchableOpacity
                              onPress={() => setArtistModalVisible(false)}
                              style={{
                                position: 'absolute',
                                top: 50,
                                left: 20,
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: 'rgba(0,0,0,0.4)',
                                justifyContent: 'center',
                                alignItems: 'center'
                              }}
                            >
                              <Icon name="keyboard-arrow-down" size={30} color="#FFF" />
                            </TouchableOpacity>
                          </ImageBackground>

                          {/* Quick Actions Bar */}
                          <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 20,
                            paddingTop: 20,
                            paddingBottom: 10
                          }}>
                            <TouchableOpacity
                              onPress={() => artistSongs.length > 0 && handleArtistSongPlay(artistSongs[0])}
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: 28,
                                backgroundColor: '#ae00ffff',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 24
                              }}
                            >
                              <Icon name="play-arrow" size={32} color="#000000ff" />
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => toggleFollowArtist(selectedArtist, selectedArtistDetails)}
                              style={{
                                paddingVertical: 8,
                                paddingHorizontal: 16,
                                borderRadius: 20,
                                borderWidth: 1,
                                borderColor: followedArtists.includes(selectedArtist) ? '#9B5DE5' : '#777',
                                marginRight: 24
                              }}
                            >
                              <Text style={{ color: followedArtists.includes(selectedArtist) ? '#9B5DE5' : '#FFF', fontWeight: 'bold' }}>
                                {followedArtists.includes(selectedArtist) ? 'FOLLOWING' : 'FOLLOW'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={{ padding: 4 }}>
                              <Icon name="more-vert" size={24} color="#B3B3B3" />
                            </TouchableOpacity>
                          </View>

                          {/* Top Songs Title */}
                          <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 }}>
                            <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold' }}>Popular</Text>
                          </View>
                        </View>
                      )}
                      renderItem={({ item, index }) => (
                        <TouchableOpacity
                          onPress={() => handleArtistSongPlay(item)}
                          activeOpacity={0.7}
                          style={{
                            flexDirection: 'row',
                            paddingVertical: 10,
                            paddingHorizontal: 20,
                            alignItems: 'center'
                          }}
                        >
                          <Text style={{ color: '#9CA3AF', width: 24, fontSize: 16 }}>{index + 1}</Text>
                          <Image
                            source={{ uri: item.image?.[1]?.url }}
                            style={{ width: 48, height: 48, borderRadius: 4, marginHorizontal: 12 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ color: '#FFF', fontSize: 16, fontWeight: '500' }}>{item.name}</Text>
                            <Text numberOfLines={1} style={{ color: '#9CA3AF', fontSize: 14, marginTop: 2 }}>
                              {item.duration ? `${Math.floor(item.duration / 60)}:${(item.duration % 60).toString().padStart(2, '0')}` : ''}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleAddToLibraryFromArtist(item)}
                            style={{ padding: 8 }}
                          >
                            <Icon name="more-horiz" size={24} color="#B3B3B3" />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      )}
                      ListEmptyComponent={() => (
                        <View style={{ flex: 1, padding: 40, alignItems: 'center' }}>
                          <Text style={{ color: '#9CA3AF' }}>No songs found for this artist.</Text>
                        </View>
                      )}
                    />
                  )}
                  {currentSong && !fullPlayerVisible && (
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                      <PlayerWidget
                        currentSong={currentSong}
                        isPlaying={isPlaying}
                        isStartingPlayback={isStartingPlayback}
                        onPlayPause={() => playSong(currentSong)}
                        onNext={handleNext}
                        onPrev={handlePrev}
                        progress={playbackStatus.progress}
                        onOpenFullPlayer={() => setFullPlayerVisible(true)}
                      />
                    </View>
                  )}
                </View>
              </View>
            </Modal>

            {/* Smart Playlist Modal - AI / Mood Results */}
            <Modal visible={smartPlaylistModalVisible} animationType="slide" transparent={true} onRequestClose={() => setSmartPlaylistModalVisible(false)}>
              <View style={{ flex: 1, backgroundColor: '#000000' }}>
                <View style={{ flex: 1 }}>
                  {loadingSmartPlaylist ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <ActivityIndicator size="large" color="#9B5DE5" />
                      <Text style={{ color: '#9CA3AF', marginTop: 12 }}>Generating Playlist...</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={smartPlaylistSongs}
                      keyExtractor={(item) => item.id}
                      contentContainerStyle={{ paddingBottom: 150 }}
                      ListHeaderComponent={() => (
                        <View>
                          {/* Large Header Section */}
                          <ImageBackground
                            source={{ uri: smartPlaylistImage || 'https://via.placeholder.com/500/000000/FFFFFF?text=Vibee+AI' }}
                            style={{ width: '100%', height: 400, justifyContent: 'flex-end' }}
                            resizeMode="cover"
                          >
                            <LinearGradient
                              colors={['transparent', 'rgba(0,0,0,0.8)', '#000000']}
                              style={{ height: '80%', padding: 24, justifyContent: 'flex-end' }}
                            >
                              <Text style={{ color: '#9B5DE5', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 1 }}>
                                AI GENERATED PLAYLIST
                              </Text>
                              <Text style={{
                                color: '#FFF',
                                fontSize: 36,
                                fontWeight: '900',
                                letterSpacing: -1,
                                textTransform: 'capitalize'
                              }} numberOfLines={2}>
                                {smartPlaylistTitle}
                              </Text>
                            </LinearGradient>

                            <TouchableOpacity
                              onPress={() => setSmartPlaylistModalVisible(false)}
                              style={{
                                position: 'absolute',
                                top: 50,
                                left: 20,
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: 'rgba(0,0,0,0.4)',
                                justifyContent: 'center',
                                alignItems: 'center'
                              }}
                            >
                              <Icon name="keyboard-arrow-down" size={30} color="#FFF" />
                            </TouchableOpacity>
                          </ImageBackground>

                          {/* Play Button Row */}
                          <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 }}>
                            <TouchableOpacity
                              onPress={() => smartPlaylistSongs.length > 0 && playSong(smartPlaylistSongs[0], smartPlaylistSongs)}
                              style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                backgroundColor: '#ae00ffff',
                                justifyContent: 'center',
                                alignItems: 'center',
                                elevation: 8,
                                shadowColor: '#ae00ffff',
                                shadowOpacity: 0.4,
                                shadowRadius: 10
                              }}
                            >
                              <Icon name="play-arrow" size={36} color="#000" />
                            </TouchableOpacity>
                          </View>

                          <View style={{ paddingHorizontal: 20, marginTop: 10, marginBottom: 10 }}>
                            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>Songs</Text>
                          </View>
                        </View>
                      )}
                      renderItem={({ item, index }) => (
                        <SongItem
                          song={item}
                          isPlaying={currentSong?.id === item.id && isPlaying}
                          isStartingPlayback={isStartingPlayback}
                          startingSongId={startingSongId}
                          onPlay={(song) => playSong(song, smartPlaylistSongs)}
                          onLike={(song) => toggleLike(song)}
                          isLiked={likedSongs.some(s => s.id === item.id)}
                          onAdd={() => handleAddToPlaylist(item)}
                        />
                      )}
                      ListEmptyComponent={() => (
                        <View style={{ flex: 1, padding: 40, alignItems: 'center' }}>
                          <Text style={{ color: '#9CA3AF' }}>No songs found for this vibe.</Text>
                        </View>
                      )}
                    />
                  )}
                  {currentSong && !fullPlayerVisible && (
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                      <PlayerWidget
                        currentSong={currentSong}
                        isPlaying={isPlaying}
                        isStartingPlayback={isStartingPlayback}
                        onPlayPause={() => playSong(currentSong)}
                        onNext={handleNext}
                        onPrev={handlePrev}
                        progress={playbackStatus.progress}
                        onOpenFullPlayer={() => setFullPlayerVisible(true)}
                      />
                    </View>
                  )}
                </View>
              </View>
            </Modal>

            {/* Playlist Selection Modal */}
            <Modal visible={playlistModalVisible} animationType="slide" transparent={true} onRequestClose={() => setPlaylistModalVisible(false)}>
              <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' }}>
                <View style={{
                  backgroundColor: '#1E1E1E',
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  padding: 20,
                  maxHeight: '60%'
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold' }}>
                      {isCreatingPlaylist ? 'New Playlist' : 'Add to Playlist'}
                    </Text>
                    <TouchableOpacity onPress={() => {
                      if (isCreatingPlaylist) {
                        setIsCreatingPlaylist(false);
                      } else {
                        setPlaylistModalVisible(false);
                      }
                    }}>
                      <Icon name="close" size={24} color="#FFF" />
                    </TouchableOpacity>
                  </View>

                  {isCreatingPlaylist ? (
                    <View>
                      <TextInput
                        value={newPlaylistName}
                        onChangeText={setNewPlaylistName}
                        placeholder="Playlist Name"
                        placeholderTextColor="#9CA3AF"
                        style={{
                          backgroundColor: '#333',
                          color: '#FFF',
                          padding: 16,
                          borderRadius: 8,
                          marginBottom: 16,
                          fontSize: 16,
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.1)'
                        }}
                        autoFocus
                      />
                      <TouchableOpacity
                        onPress={createNewPlaylistFromModal}
                        style={{
                          backgroundColor: '#9B5DE5',
                          padding: 14,
                          borderRadius: 8,
                          alignItems: 'center',
                          marginBottom: 12
                        }}
                      >
                        <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>Create</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setIsCreatingPlaylist(false)}
                        style={{
                          padding: 12,
                          alignItems: 'center'
                        }}
                      >
                        <Text style={{ color: '#FFF', fontSize: 16 }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 15,
                          borderBottomWidth: 1,
                          borderBottomColor: 'rgba(255,255,255,0.1)'
                        }}
                        onPress={() => handlePlaylistSelectForSong('create_new')}
                      >
                        <View style={{ width: 50, height: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: '#333', borderRadius: 4 }}>
                          <Icon name="add" size={24} color="#FFF" />
                        </View>
                        <Text style={{ color: '#FFF', fontSize: 16, marginLeft: 16, fontWeight: '600' }}>Create Playlist</Text>
                      </TouchableOpacity>

                      <FlatList
                        data={playlists}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingVertical: 12
                            }}
                            onPress={() => handlePlaylistSelectForSong(item.id)}
                          >
                            <View style={{ width: 50, height: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: '#282828', borderRadius: 4 }}>
                              <Icon name="music-note" size={20} color="#666" />
                            </View>
                            <View style={{ marginLeft: 16, flex: 1 }}>
                              <Text style={{ color: '#FFF', fontSize: 16 }}>{item.name}</Text>
                              <Text style={{ color: '#9CA3AF', fontSize: 13 }}>{item.songs.length} songs</Text>
                            </View>
                            {item.songs.some(s => s.id === selectedSongForPlaylist?.id) && (
                              <Icon name="check-circle" size={20} color="#9B5DE5" />
                            )}
                          </TouchableOpacity>
                        )}
                      />
                    </>
                  )}
                </View>
              </View>
            </Modal>

            {currentSong && (
              <PlayerWidget
                currentSong={currentSong}
                isPlaying={isPlaying}
                onPlayPause={() => playSong(currentSong)}
                onNext={handleNext}
                onPrev={handlePrev}
                progress={playbackStatus.progress}
                onOpenFullPlayer={() => setFullPlayerVisible(true)}
              />
            )}

            <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

            <LanguageModal
              visible={langModalVisible}
              onClose={() => setLangModalVisible(false)}
              onSelect={handleLanguageSelect}
              currentLanguage={currentLanguage}
            />

            <FullScreenPlayer
              visible={fullPlayerVisible}
              onClose={() => setFullPlayerVisible(false)}
              isLyricsVisible={isLyricsVisible}
              setIsLyricsVisible={setIsLyricsVisible}
              currentSong={currentSong}
              isPlaying={isPlaying}
              isStartingPlayback={isStartingPlayback}
              onPlayPause={() => playSong(currentSong)}
              onLike={toggleLike}
              isLiked={likedSongs.some(s => s.id === currentSong?.id)}
              onNext={handleNext}
              onPrev={handlePrev}
              onFetchLyrics={fetchLyrics}
              playlists={playlists}
              onAddToPlaylist={addSongToPlaylist}
              followedArtists={followedArtists}
              onToggleFollow={toggleFollowArtist}
              playbackStatus={playbackStatus}
              onSeek={handleSeek}
              isShuffle={isShuffle}
              onToggleShuffle={() => setIsShuffle(!isShuffle)}
              isRepeat={isRepeat}
              onToggleRepeat={() => setIsRepeat(!isRepeat)}
              isAutoplay={isAutoplay}
              onToggleAutoplay={async () => {
                const newValue = !isAutoplay;
                setIsAutoplay(newValue);
                await AsyncStorage.setItem('@is_autoplay', JSON.stringify(newValue));
              }}
              sleepTimer={sleepTimer}
              sleepTimerActive={sleepTimerActive}
              onSetSleepTimer={handleSetSleepTimer}
              downloadFolders={downloadFolders}
              onDownload={(folderId) => downloadSong(currentSong, folderId)}
              onAddToDownloadFolder={addSongToDownloadFolder}
            />
          </SafeAreaView>
        </LinearGradient>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mainContent: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIcon: {
    width: 140,
    height: 140,
    borderRadius: 35,
    resizeMode: 'contain',
  },
});

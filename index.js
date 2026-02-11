import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import App from './App';

import service from './service';

registerRootComponent(App);
TrackPlayer.registerPlaybackService(() => service);

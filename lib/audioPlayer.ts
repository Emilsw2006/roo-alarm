import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';

export type RooAudioPlayer = AudioPlayer;

export async function configurePlaybackAudio(shouldPlayInBackground = false) {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground,
    interruptionMode: 'duckOthers',
  });
}

export function createRooAudioPlayer(source: AudioSource | string | number, options?: { loop?: boolean; volume?: number }) {
  const player = createAudioPlayer(source, { keepAudioSessionActive: true });
  if (options?.loop != null) player.loop = options.loop;
  if (options?.volume != null) player.volume = options.volume;
  return player;
}

export function stopRooAudioPlayer(player: RooAudioPlayer | null | undefined) {
  if (!player) return;
  try {
    player.pause();
    player.remove();
  } catch (e) {
    console.log('Audio cleanup error', e);
  }
}

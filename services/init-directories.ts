import path from 'path';
import fs from 'fs';
import {execSync} from 'child_process';

export const musicDir = '/tmp/jelly-music';
export const podcastDir = '/tmp/audiobookshelf-podcast';
export const audiobookDir = '/tmp/audiobookshelf-audiobook';

export const dataDir = path.join(process.cwd(), 'data');
export const artworkDir = path.join(dataDir, 'artwork');

export const syncPodcasts = process.env.SYNC_PODCASTS?.toLowerCase() === 'true' ? true : false && process.env.PODCASTS_MOUNT;
export const syncAudiobooks = process.env.SYNC_AUDIOBOOKS?.toLowerCase() === 'true' ? true : false && process.env.AUDIOBOOKS_MOUNT;

const SMB_USER = process.env.SMB_USER || 'guest';
const SMB_PASSWORD = process.env.SMB_PASSWORD || '';

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

if (!fs.existsSync(artworkDir)) {
  fs.mkdirSync(artworkDir);
}

// Mount the volumes
export const mountVolumes = () => {
  if (!SMB_USER) {
    throw new Error('SMB credentials not found');
  }

  if (!fs.existsSync(musicDir) && process.env.MUSIC_MOUNT) {
    execSync(
      `mkdir ${musicDir} ; sudo mount -t cifs ${process.env.MUSIC_MOUNT} ${musicDir} -o user=${SMB_USER},password=${SMB_PASSWORD}`,
    );
  }

  if (!fs.existsSync(podcastDir) && syncPodcasts) {
    execSync(
      `mkdir ${podcastDir} ; sudo mount -t cifs ${process.env.PODCASTS_MOUNT} ${podcastDir} -o user=${SMB_USER},password=${SMB_PASSWORD}`,
    );
  }

  if (!fs.existsSync(audiobookDir) && syncAudiobooks) {
    execSync(
      `mkdir ${audiobookDir} ; sudo mount -t cifs ${process.env.AUDIOBOOKS_MOUNT} ${audiobookDir} -o user=${SMB_USER},password=${SMB_PASSWORD}`,
    );
  }
};

// Unmount the volumes
export const unmountVolumes = () => {
  if (fs.existsSync(musicDir)) {
    execSync(`sudo umount ${musicDir} ; rm -rf ${musicDir}`);
  }

  if (fs.existsSync(podcastDir)) {
    execSync(`sudo umount ${podcastDir} ; rm -rf ${podcastDir}`);
  }

  if (fs.existsSync(audiobookDir)) {
    execSync(`sudo umount ${audiobookDir} ; rm -rf ${audiobookDir}`);
  }
};

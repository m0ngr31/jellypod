import {execSync, exec} from 'child_process';
import _ from 'lodash';
import fs from 'fs';
import {globSync} from 'glob';
import {ProgressBar} from 'ascii-progress';

import config from './services/config';
import synced from './services/synced';
import JellyfinService from './services/jellyfin';
import {audiobookDir, mountVolumes, podcastDir, unmountVolumes, syncAudiobooks, syncPodcasts} from './services/init-directories';

const IPOD_PATH = '/ipod';

if (!fs.existsSync(IPOD_PATH)) {
  console.log(IPOD_PATH);
  throw new Error('iPod not found. Exiting...');
}

const promiseExec = (command: string) =>
  new Promise<void>((resolve, reject) =>
    exec(command, err => {
      if (err) {
        console.log('Exec error: ', err);
        reject(err);
      }

      resolve();
    }),
  );

const defaultBars = {
  blank: '░',
  filled: '█',
  schema: ' [:bar] :current/:total :percent :elapseds :title',
};

mountVolumes();

const instantMixes = (process.env.INSTANT_MIXES || '')
  .split(',')
  .filter(e => e.length)
  .map(e => e.trim()).map(e => {
    const [id, name] = e.split('::');

    return {id, name};
  });

let podcasts = [];

if (syncPodcasts) {
  podcasts = fs
    .readdirSync(podcastDir, {withFileTypes: true})
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

let audiobooks = [];

if (syncAudiobooks) {
  const allowedBooks = (process.env.ALLOWED_BOOKS || '')
    .split(',')
    .filter(e => e.length)
    .map(e => e.trim());
  audiobooks = [];

  globSync(`${audiobookDir}/**/*.m4b`, {
    ignore: {
      ignored: p => {
        const parentDir = p.path;

        if (!allowedBooks.find(b => p.fullpath().toLowerCase().indexOf(b.toLowerCase()) > -1)) {
          return true;
        }

        const siblingFiles = fs.readdirSync(parentDir).filter(f => f.endsWith('cover.jpg'));

        if (!siblingFiles.length) {
          return true;
        }

        audiobooks.push({
          cover: `${p.path}/cover.jpg`,
          name: p.name,
          path: p.fullpath(),
        });

        return false;
      },
    },
    nodir: true,
  });

  audiobooks = _.uniqBy(audiobooks, b => b.path);
}

const main = async () => {
  if (!config.getItemOrDefault('api-token')) {
    await JellyfinService.checkServer(process.env.JELLYFIN_URL);
    await JellyfinService.login(process.env.JELLYFIN_USER, process.env.JELLYFIN_PASS);
  }

  await JellyfinService.getMappedPaths();

  // Import all songs up-front - then filter based on already synced items
  const allSongs = (await JellyfinService.getAllSongs()).filter(s => !synced.getId(s.Id));

  console.log('\nStarting Sync...\n');

  let allSongsBar: ProgressBar;

  if (allSongs.length > 0) {
    console.log('Syncing songs...');

    allSongsBar = new ProgressBar({
      ...defaultBars,
      total: allSongs.length,
    });
  }

  for (const f of allSongs) {
    const mappedPath: string = JellyfinService.convertPath(f.Path);

    const imagePath = await JellyfinService.getItemImageLocal(f);
    let mappedImagePath;

    if (imagePath) {
      mappedImagePath = await JellyfinService.convertPath(imagePath);
    }

    const artist = f.AlbumArtist || f.Artists?.[0]?.Name || 'Unknown';
    const title = `${artist} - ${f.Name}${mappedPath.endsWith('.flac') ? ' [Transcoding to ALAC]' : ''}`;

    const ticker = setInterval(
      () =>
        allSongsBar.tick(0, {
          title,
        }),
      100,
    );

    try {
      const args = [
        `-m ${IPOD_PATH}`,
        `"${mappedPath}"`,
        mappedImagePath ? `--artwork "${mappedImagePath}"` : '',
        mappedPath.endsWith('.flac') ? '--decode=alac' : '',
      ];

      await promiseExec(`gnupod_addsong ${args.join(' ')}`.trim() + ' > /dev/null 2>&1');

      synced.setItem(f.Id);
    } catch (e) {
      console.log(e);
    }

    clearInterval(ticker);
    allSongsBar.tick(1, {
      title,
    });
  }

  console.log('Syncing Instant Mixes & Favorites...');
  const playlistsBar = new ProgressBar({
    ...defaultBars,
    total: instantMixes.length + 1,
  });

  // Favorites
  const favorites = (await JellyfinService.getFavorites()).filter(s => synced.getId(s.Id));
  const favoritesPaths = (favorites || []).map(f => JellyfinService.convertPath(f.Path));

  const ticker = setInterval(
    () =>
      playlistsBar.tick(0, {
        title: 'Favorites',
      }),
    100,
  );

  if (favoritesPaths.length > 0) {
    try {
      const args = [`-m ${IPOD_PATH}`, `--playlist Favorites`, '--decode=alac', ...favoritesPaths.map(f => `"${f}"`)];
      await promiseExec(`gnupod_addsong ${args.join(' ')}`.trim() + ' > /dev/null 2>&1');
    } catch (e) {}

    clearInterval(ticker);
    playlistsBar.tick(1, {
      title: 'Favorites',
    });
  }

  // Instant mixes
  for (const m of instantMixes) {
    const ticker = setInterval(
      () =>
        playlistsBar.tick(0, {
          title: m.name,
        }),
      100,
    );

    try {
      const songs = (await JellyfinService.getInstantMix(m.id)).filter(s => synced.getId(s.Id));
      const songPaths = (songs || []).map(f => JellyfinService.convertPath(f.Path));

      if (songPaths.length > 0) {
        const args = [`-m ${IPOD_PATH}`, `--playlist "${m.name}"`, '--decode=alac', ...songPaths.map(f => `"${f}"`)];
        await promiseExec(`gnupod_addsong ${args.join(' ')}`.trim() + ' > /dev/null 2>&1');
      }
    } catch (e) {
      console.log('Could not get mix for: ', m.name);
    }

    clearInterval(ticker);
    playlistsBar.tick(1, {title: m.name});
  }

  // Podcasts
  if (syncPodcasts) {
    console.log('Syncing Podcasts...');
    const podcastsBar = new ProgressBar({
      ...defaultBars,
      total: podcasts.length,
    });

    for (const p of podcasts) {
      const files = fs
        .readdirSync(`${podcastDir}/${p}`)
        .map(f => `${podcastDir}/${p}/${f}`)
        .filter(f => f.endsWith('.mp3'));

      const ticker = setInterval(
        () =>
          podcastsBar.tick(0, {
            title: p,
          }),
        100,
      );

      try {
        const args = [
          `-m ${IPOD_PATH}`,
          `--playlist "${p}"`,
          '--playlist-is-podcast',
          `--artwork "${podcastDir}/${p}/cover.jpg"`,
          ...files.map(f => `"${f}"`),
        ];
        await promiseExec(`gnupod_addsong ${args.join(' ')}`.trim() + ' > /dev/null 2>&1');
      } catch (e) {}

      clearInterval(ticker);
      podcastsBar.tick(1, {title: p});
    }
  }

  // Audiobooks
  if (syncAudiobooks) {
    console.log('Syncing Audiobooks...');
    const audiobooksBar = new ProgressBar({
      ...defaultBars,
      total: audiobooks.length,
    });

    for (const p of audiobooks) {
      const ticker = setInterval(
        () =>
          audiobooksBar.tick(0, {
            title: p.name,
          }),
        100,
      );

      try {
        const args = [`-m ${IPOD_PATH}`, `--audiobook`, `--artwork "${p.cover}"`, `"${p.path}"`];
        await promiseExec(`gnupod_addsong ${args.join(' ')}`.trim() + ' > /dev/null 2>&1');
      } catch (e) {}

      clearInterval(ticker);
      audiobooksBar.tick(1, {title: p.name});
    }
  }
};

main().then(async () => {
  await new Promise(resolve => setTimeout(resolve, 10 * 1000));
  unmountVolumes();
  console.log('\nSync complete. Running mktunes...\n');
  execSync(`mktunes -m ${IPOD_PATH}`, {
    stdio: 'inherit',
  });
});

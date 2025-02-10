import _ from 'lodash';
import axios from 'axios';
import fs from 'fs';

import config from './config';
import Requests from './requests';
import AuthService from './auth';
import {artworkDir, musicDir} from './init-directories';
import path from 'path';
import {default as artworkConfig} from './artwork';

const cleanUrl = url => {
  if (url.slice(0, 4) !== 'http') {
    throw new Error('Bad url');
  }

  if (url.slice(-1) !== '/') {
    return `${url}/`;
  }

  return url;
};

const JellyfinService = {
  checkServer: async serverUri => {
    try {
      const url = cleanUrl(serverUri);
      const serverData = await Requests.get(`${url}system/info/public`, undefined, false);

      JellyfinService.setServer({...serverData, uri: url});
    } catch (e) {
      console.log(e);
      throw new Error('Server not found');
    }
  },
  convertPath: path => {
    let newPath = path;

    JellyfinService.mappedPaths.forEach(p => {
      if (path.startsWith(p.originalVirtual)) {
        newPath = path.replace(p.originalVirtual, p.mapped);
      } else if (path.startsWith(p.originalCifs)) {
        newPath = path.replace(p.originalCifs, p.mapped).replace(/\\/g, '/');
      }
    });

    return newPath;
  },
  getAlbumSongs: async ParentId => {
    const params = {
      ParentId,
      SortBy: 'SortName',
      SortOrder: 'Ascending',
      fields: 'Path',
    };

    const userId = JellyfinService.getUser()!.Id;
    const res = await Requests.get(`Users/${userId}/Items`, params, true, true);
    return res.Items;
  },
  getAlbums: async () => {
    const params = {
      IncludeItemTypes: 'MusicAlbum',
      Recursive: true,
      SortBy: 'SortName',
      SortOrder: 'Ascending',
      fields: 'Path',
    };

    const userId = JellyfinService.getUser()!.Id;
    const albums = await Requests.get(`Users/${userId}/Items`, params, true, true);

    return albums.Items;
  },
  getAllSongs: async () => {
    const userId = JellyfinService.getUser()!.Id;

    const songs = await Requests.get(
      `Users/${userId}/Items`,
      {
        IncludeItemTypes: 'Audio',
        Recursive: true,
        fields: 'Path',
      },
      true,
      true,
    );

    return songs.Items;
  },
  getArtistAlbums: async artistId => {
    const params = {
      AlbumArtistIds: artistId,
      IncludeItemTypes: ['MusicAlbum', 'Audio'],
      Recursive: true,
      SortOrder: 'Descending',
      fields: 'Path',
    };

    const userId = JellyfinService.getUser()!.Id;
    const res = await Requests.get(`Users/${userId}/Items`, params, true, true);

    const songs = res.Items.filter(item => item.Type === 'Audio');
    const albums = res.Items.filter(item => item.Type === 'MusicAlbum');

    return [songs, albums];
  },
  getArtists: async () => {
    const userId = JellyfinService.getUser()!.Id;
    const artists = await Requests.get('Artists/AlbumArtists', {userId}, true, true);
    return artists.Items;
  },
  getFavorites: async () => {
    const params = {
      IncludeItemTypes: 'Audio',
      IsFavorite: true,
      Recursive: true,
      SortBy: 'SortName',
      SortOrder: 'Ascending',
      fields: 'Path',
    };

    const userId = JellyfinService.getUser()!.Id;
    const favotites = await Requests.get(`Users/${userId}/Items`, params, true, true);

    return favotites.Items;
  },
  getGenreSongs: async itemId => {
    const params = {
      GenreIds: itemId,
      IncludeItemTypes: 'Audio',
      Recursive: true,
      SortBy: 'SortName',
      SortOrder: 'Ascending',
      fields: 'Path',
    };

    const userId = JellyfinService.getUser()!.Id;
    const res = await Requests.get(`Users/${userId}/Items`, params, true, true);
    return res.Items;
  },
  getGenres: async () => {
    const userId = JellyfinService.getUser()!.Id;
    const genres = await Requests.get('MusicGenres', {userId}, true, true);
    return genres.Items;
  },
  getInstantMix: async itemId => {
    const UserId = JellyfinService.getUser()!.Id;

    const params = {
      Limit: 200,
      UserId,
      fields: 'Path',
    };

    const songs = await Requests.get(`Items/${itemId}/InstantMix`, params, true, true);
    return songs.Items;
  },
  getItem: async itemId => {
    const userId = JellyfinService.getUser()!.Id;
    return Requests.get(`Users/${userId}/Items/${itemId}`, undefined, true, true);
  },
  getItemImageLocal: async item => {
    let albumArtId = item.id;

    if (item.AlbumId && item.AlbumPrimaryImageTag) {
      albumArtId = item.AlbumId;
    }

    const existingPath = artworkConfig.getId(albumArtId);

    if (existingPath) {
      return existingPath;
    }

    try {
      const artwork = await Requests.get(`Items/${albumArtId}/Images`, undefined, true, true);

      let artworkPath: string;

      artwork.forEach((a, i) => {
        if (a.ImageType === 'Primary') {
          artworkPath = a.Path;
        }

        if (artworkPath) {
          return;
        }

        if (i === artwork.length) {
          artworkPath = a.Path;
        }
      });

      if (!artworkPath.startsWith('/config')) {
        artworkConfig.setItem(albumArtId, artworkPath);
        return artworkPath;
      }
    } catch (e) {}

    const localPath = path.join(artworkDir, `${albumArtId}.jpg`);

    // Check and see if we have the artwork downloaded already
    if (fs.existsSync(localPath)) {
      return localPath;
    }

    // Download the artwork
    try {
      const remotePath = JellyfinService.getItemImageUrl(item);

      if (remotePath) {
        const {data} = await axios.get(remotePath, {
          responseType: 'stream',
        });

        const writer = fs.createWriteStream(localPath);
        data.pipe(writer);

        return new Promise((resolve, reject) => {
          writer.on('finish', () => resolve(localPath));
          writer.on('error', e => {
            console.log('stream error: ', e);
            reject(e);
          });
        });
      }
    } catch (e) {}
  },
  getItemImageUrl: item => {
    const serverUri = JellyfinService.getServer().uri;
    const keys = Object.keys(item.ImageTags);

    const albumInfo = {
      Id: item.AlbumId || null,
      Image: item.AlbumPrimaryImageTag || null,
    };

    if (albumInfo.Id && albumInfo.Image) {
      return `${serverUri}Items/${albumInfo.Id}/Images/Primary`;
    }

    if (!keys.length) {
      return null;
    }

    let imageKey;

    if (keys.includes('Primary')) {
      imageKey = 'Primary';
    } else {
      [imageKey] = keys;
    }

    return `${serverUri}Items/${item.Id}/Images/${imageKey}`;
  },
  getLibraries: async () => {
    const libraries = await Requests.get('Library/VirtualFolders', undefined, true, true);

    const musicLibraries = [];

    libraries.forEach(l => {
      if (l.CollectionType === 'music') {
        musicLibraries.push(l);
      }
    });

    return musicLibraries;
  },
  getMappedPaths: async () => {
    const musicLibraries = await JellyfinService.getLibraries();

    const mappedPaths = [];

    musicLibraries.forEach(ml => {
      (ml.LibraryOptions?.PathInfos || []).forEach(p => {
        const networkPath = p.Path.replace(/^\\+/, '\\');

        mappedPaths.push({
          mapped: musicDir,
          originalCifs: '\\' + networkPath,
          originalVirtual: p.Path,
        });
      });
    });

    JellyfinService.mappedPaths = mappedPaths;
  },
  getPlaylistSongs: async itemId => {
    const UserId = JellyfinService.getUser()!.Id;

    const params = {
      UserId,
    };

    const res = await Requests.get(`Playlists/${itemId}/Items`, params, true, true);
    return res.Items;
  },
  getPlaylists: async () => {
    const params = {
      IncludeItemTypes: 'Playlist',
      Recursive: true,
      SortBy: 'SortName',
      SortOrder: 'Ascending',
      fields: 'Path',
    };

    const userId = JellyfinService.getUser()!.Id;
    const playlists = await Requests.get(`Users/${userId}/Items`, params, true, true);

    return _.filter(playlists.Items, item => item.MediaType === 'Audio');
  },
  getServer: () => config.getItemOrDefault('server', {uri: undefined}),
  getToken: () => config.getItemOrDefault('api-token'),
  getUser: () => config.getItemOrDefault('user', {Id: undefined}),
  login: async (username, password) => {
    try {
      const auth = await Requests.post('users/authenticatebyname', {Pw: password, Username: username}, true, false);

      AuthService.login(auth.User, auth.AccessToken);
    } catch (e) {
      console.log(e);
      throw new Error('Could not login');
    }
  },
  logout: () => AuthService.logout(),
  mappedPaths: [],
  search: async searchTerm => {
    const userId = JellyfinService.getUser()!.Id;

    const artists = await Requests.get('Artists', {searchTerm}, true, true);
    const songs = await Requests.get(
      `Users/${userId}/Items`,
      {
        IncludeItemTypes: 'Audio',
        Recursive: true,
        fields: 'Path',
        searchTerm,
      },
      true,
      true,
    );
    const albums = await Requests.get(
      `Users/${userId}/Items`,
      {
        IncludeItemTypes: 'MusicAlbum',
        Recursive: true,
        fields: 'Path',
        searchTerm,
      },
      true,
      true,
    );
    const playlists = await Requests.get(
      `Users/${userId}/Items`,
      {
        IncludeItemTypes: 'Playlist',
        Recursive: true,
        fields: 'Path',
        searchTerm,
      },
      true,
      true,
    );

    return [artists.Items, songs.Items, albums.Items, playlists.Items];
  },
  setServer: serverData => {
    config.setItem('server', serverData);
  },
};

export default JellyfinService;

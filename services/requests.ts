import axios from 'axios';
import {v4 as uuidv4} from 'uuid';

import {version} from '../package.json';

import AuthService from './auth';
import {default as appConfig} from './config';

const authAxios = axios.create();

authAxios.interceptors.request.use(
  config => {
    const token = appConfig.getItemOrDefault('api-token');

    if (token) {
      config.headers['X-MediaBrowser-Token'] = token;
    }

    return config;
  },
  error => Promise.reject(error),
);

authAxios.interceptors.response.use(
  res => res,
  err => {
    if (err.response && err.response.status === 401) {
      AuthService.logout();
    }

    return Promise.reject(err);
  },
);

const genConfig = (url, isJellyfin) => {
  const config: any = {};
  let newUrl = url;

  if (isJellyfin) {
    let deviceId = appConfig.getItemOrDefault('deviceId');

    if (!deviceId) {
      deviceId = uuidv4();
      appConfig.setItem('deviceId', deviceId);
    }

    config.headers = {};
    config.headers[
      'X-Emby-Authorization'
    ] = `MediaBrowser Client="Jellyamp", Device="PC", DeviceId="${deviceId}", Version="${version}"`;

    const serverUrl = appConfig.getItemOrDefault('server', {uri: undefined})!.uri;

    if (!serverUrl) {
      throw new Error('No server information');
    }

    newUrl = `${serverUrl}${url}`;
  }

  return [newUrl, config];
};

const Requests = {
  delete: async (url, _obj, jellyfinUrl = true, requiresAuth = true) => {
    const [uri, config] = genConfig(url, jellyfinUrl);

    const reqestHandler = requiresAuth ? authAxios : axios;

    const {data} = await reqestHandler.delete(uri, config);
    return data;
  },
  get: async (url, obj, jellyfinUrl, requiresAuth = true) => {
    const [uri, config] = genConfig(url, jellyfinUrl);

    const reqestHandler = requiresAuth ? authAxios : axios;

    if (obj) {
      config.params = obj;
    }

    const {data} = await reqestHandler.get(uri, config);
    return data;
  },
  post: async (url, obj, jellyfinUrl = true, requiresAuth = true) => {
    const [uri, config] = genConfig(url, jellyfinUrl);

    const reqestHandler = requiresAuth ? authAxios : axios;

    const {data} = await reqestHandler.post(uri, obj, config);
    return data;
  },
};

export default Requests;

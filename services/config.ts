import path from 'path';
import fs from 'fs';
import fsExtra from 'fs-extra';

import {dataDir} from './init-directories';

const configPath = path.join(dataDir, 'config.json');

interface IConfigData {
  user?: {
    Id?: string;
  };
  server?: {
    uri?: string;
  };
  'api-token'?: string;
  deviceId?: string;
}

class Config {
  private data: IConfigData = {};

  constructor() {
    this.load();
  }

  public getItemOrDefault = <K extends keyof IConfigData>(key: K, defaultVal?: IConfigData[K]) => {
    if (!this.data[key]) {
      return defaultVal;
    }

    return this.data[key];
  };

  public setItem = <K extends keyof IConfigData>(key: K, value: IConfigData[K]) => {
    this.data[key] = value;
    this.save();
  };

  public removeItem = <K extends keyof IConfigData>(key: K) => {
    delete this.data[key];
    this.save();
  };

  private load = () => {
    if (fs.existsSync(configPath)) {
      this.data = fsExtra.readJSONSync(configPath);
    }
  };

  private save = () => {
    fsExtra.writeJSONSync(configPath, this.data, {
      spaces: 2,
    });
  };
}

export default new Config();

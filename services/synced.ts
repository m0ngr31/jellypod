import path from 'path';
import fs from 'fs';
import fsExtra from 'fs-extra';

import {dataDir} from './init-directories';

const syncedPath = path.join(dataDir, 'synced.json');

interface ISyncData {
  [key: string]: boolean;
}

class SyncConfig {
  private data: ISyncData = {};

  constructor() {
    this.load();
  }

  public getId = (id: string) => this.data[id];

  public setItem = (id: string) => {
    this.data[id] = true;
    this.save();
  };

  private load = () => {
    if (fs.existsSync(syncedPath)) {
      this.data = fsExtra.readJSONSync(syncedPath);
    }
  };

  private save = () => {
    fsExtra.writeJSONSync(syncedPath, this.data, {
      spaces: 2,
    });
  };
}

export default new SyncConfig();

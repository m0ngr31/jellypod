import path from 'path';
import fs from 'fs';
import fsExtra from 'fs-extra';

import {dataDir} from './init-directories';

const artworkPath = path.join(dataDir, 'artwork.json');

interface IArtworkData {
  [key: string]: string;
}

class ArtworkConfig {
  private data: IArtworkData = {};

  constructor() {
    this.load();
  }

  public getId = (id: string) => this.data[id];

  public setItem = (id: string, value: string) => {
    this.data[id] = value;
    this.save();
  };

  private load = () => {
    if (fs.existsSync(artworkPath)) {
      this.data = fsExtra.readJSONSync(artworkPath);
    }
  };

  private save = () => {
    fsExtra.writeJSONSync(artworkPath, this.data, {
      spaces: 2,
    });
  };
}

export default new ArtworkConfig();

import * as fs from 'fs';

let configFilePath: string = 'deepunit.config.json';
let extraConfigFilePath: string = 'deepunit.extra.config.json';

export function grabFromConfig(configProperty: string): string | null {
  if (fs.existsSync(extraConfigFilePath)) {
    let config = JSON.parse(fs.readFileSync(extraConfigFilePath, 'utf8'));

    // Check if the 'repoPath' property exists in the configuration
    if (configProperty in config) {
      let shouldSkip: boolean = false;
      if ('skipExtraConfig' in config) {
        let skipExtraConfig: boolean = config['skipExtraConfig'];
        if (skipExtraConfig) {
          shouldSkip = skipExtraConfig;
        }
      }
      if (!shouldSkip) {
        let configValue = config[configProperty];
        return configValue;
      }
    }
  }
  if (fs.existsSync(configFilePath)) {
    let config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));

    // Check if the 'repoPath' property exists in the configuration
    if (configProperty in config) {
      let configValue = config[configProperty];
      return configValue;
    }
  }
  return null;
}

const AutoLaunch = require('auto-launch');
const { app } = require('electron');

class AutoLauncher {
  constructor() {
    this.autoLauncher = new AutoLaunch({
      name: 'ParaFile',
      path: app.getPath('exe'),
      isHidden: true
    });
  }

  async isEnabled() {
    try {
      return await this.autoLauncher.isEnabled();
    } catch (error) {
      console.error('Error checking auto-launch status:', error);
      return false;
    }
  }

  async enable() {
    try {
      const isEnabled = await this.isEnabled();
      if (!isEnabled) {
        await this.autoLauncher.enable();
      }
      return true;
    } catch (error) {
      console.error('Error enabling auto-launch:', error);
      return false;
    }
  }

  async disable() {
    try {
      const isEnabled = await this.isEnabled();
      if (isEnabled) {
        await this.autoLauncher.disable();
      }
      return true;
    } catch (error) {
      console.error('Error disabling auto-launch:', error);
      return false;
    }
  }

  async toggle() {
    const isEnabled = await this.isEnabled();
    if (isEnabled) {
      return await this.disable();
    } else {
      return await this.enable();
    }
  }
}

module.exports = new AutoLauncher();
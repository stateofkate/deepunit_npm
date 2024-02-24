import * as os from 'os';
import { createInterface } from 'readline';
import { Files } from './Files';
import {exitWithError, getEmailFlag, isVsCode} from './utils';
import fs, {FileSystem, PathLike} from "./vsfs";
import console, {Log} from './Log';
export const logAnchor = console.anchor

export class Auth {
  private email: string | null = null;
  private readonly FILE_PATH: string = `${os.homedir()}/.deepunit`;
  constructor(email?: string) {
    if(email) {
      this.email = email;
    }
  }
  /**
   * Currently the auth is done all at once in this function. Given that Vs code will expose a UI to do this we need to breakout the check for auth step into its own. The new flow will look like
   * 1. Check for Auth
   *  1B: If no auth, enter auth flow
   * 2. Return auth
   *
   * Each step in the flow will be its own function. The init function can still be used in captainhook to do all trhee steps, but in the VS code we will call each step individually.
   */
  public static async init(): Promise<Auth> {
    const auth = await this.checkForAuthFlagOrFile();

    if (!auth.email) {
      await auth.promptForEmail();
    }

    return auth;
  }
  
  public static async checkForAuthFlagOrFile(): Promise<Auth> {
    //step 1: check the emailFlag
    //step 2: check the file if not flag
    const auth = new Auth();
    
    const emailFlag = getEmailFlag()
    if (emailFlag) {
      auth.email = emailFlag;
      return auth;
    }
    await auth.loadEmail();
    return auth;
  }
  
  /**
   * Saves the user's email globally in VS Code
   * @param {string} email The email to save
   * @param {vscode.ExtensionContext} context The extension context
   */
  public static async saveUserEmailToVSCode(email: string, context: any) {
    if (isVsCode()) {
      let vscode = require('vscode')
      try {
        await context.globalState.update('userEmail', email);
        vscode.window.showInformationMessage('Email saved successfully.');
        return new Auth(email)
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to save email: ${error}`);
      }
    } else {
      exitWithError('Attempt to call the VS Code function saveUserEmailToVSCode() from outside of a VS Code extension');
    }
  }
  /**
   * Grabs the user's email from the VS Code global storage
   * @param {vscode.ExtensionContext} context The extension context
   * @returns {string|null} The saved email or null if not found
   */
  public static async getUserEmailFromVSCodeStorage(context): Promise<Auth | null> {
    if (isVsCode()) {
      const vscode = require('vscode')
      try {
        const email = await context.globalState.get('userEmail', null);
        if (email) {
          let auth = new Auth(email)
          return auth;
        }
        console.log("DeepUnit was unable to find the users email, lets ask for it.")
        return null;
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to retrieve email: ${error}`);
        return null;
      }
    } else {
      exitWithError('Attempt to call the VS Code function getUserEmailFromVSCodeStorage() from outside of a VS Code extension');
      return null;
    }
  }
  

  private isValidEmail(email: string): boolean {
    const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    return re.test(email);
  }

  private promptForEmail(): Promise<void> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      const ask = () => {
        rl.question('Please enter a valid email: ', (answer) => {
          if (this.isValidEmail(answer)) {
            this.email = answer;
            this.saveEmail();
            console.log('Email saved successfully!');
            rl.close();
            resolve();
          } else {
            console.log('Invalid email. Please try again.');
            ask();
          }
        });
      };

      ask();
    });
  }

  private saveEmail(): void {
    if (this.email) {
      Files.writeFileSync(this.FILE_PATH, `EMAIL=${this.email}`);
    }
  }

  private async loadEmail(): Promise<void> {
    return new Promise((resolve) => {
      if (fs.existsSync(this.FILE_PATH)) {
        const content = fs.readFileSync(this.FILE_PATH).toString();
        const matches = content.match(/EMAIL=(.+)/);
        if (matches && matches[1]) {
          this.email = matches[1];
        }
      }
      resolve();
    });
  }

  getEmail(): string | null {
    return this.email;
  }
}

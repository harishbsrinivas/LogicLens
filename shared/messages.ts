// Types and constants shared by the extension host and the webview. No Node or vscode imports.

export const HELLO_MESSAGE = 'Hello from Clarity';

export interface HostToWebviewMessage {
  type: 'hello';
  text: string;
}

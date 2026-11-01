import * as assert from 'node:assert';
import * as vscode from 'vscode';

suite('clarity.hello', () => {
  test('is registered and runs', async () => {
    const ext = vscode.extensions.getExtension('clarity-dev.clarity');
    assert.ok(ext, 'extension not found');
    await ext.activate();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('clarity.hello'));
    const result = await vscode.commands.executeCommand<string>('clarity.hello');
    assert.strictEqual(result, 'Hello from Clarity');
  });
});

import * as assert from 'node:assert';
import * as vscode from 'vscode';

suite('logiclens.hello', () => {
  test('is registered and runs', async () => {
    const ext = vscode.extensions.getExtension('logiclens-dev.logiclens');
    assert.ok(ext, 'extension not found');
    await ext.activate();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('logiclens.hello'));
    const result = await vscode.commands.executeCommand<string>('logiclens.hello');
    assert.strictEqual(result, 'Hello from LogicLens');
  });
});

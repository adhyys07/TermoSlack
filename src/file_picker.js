import { exec } from 'child_process';
import os from 'os';

export function pickFile() {
  return new Promise((resolve, reject) => {
    if (os.platform() === 'win32') {
      // PowerShell command to open file dialog
      // We use System.Windows.Forms to show the dialog
      const psCommand = `
        Add-Type -AssemblyName System.Windows.Forms;
        $f = New-Object System.Windows.Forms.OpenFileDialog;
        $f.InitialDirectory = [Environment]::GetFolderPath('UserProfile');
        $f.Title = 'Select a file to upload to Slack';
        $result = $f.ShowDialog();
        if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
          Write-Output $f.FileName
        }
      `;
      
      // Flatten command for execution
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ')}"`;

      exec(command, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          // If it's just a cancellation or empty result, it might not be a real error, 
          // but exec might report non-zero exit code if we don't handle it carefully.
          // However, ShowDialog usually returns OK or Cancel.
          // If stderr has content, log it.
          if (stderr) console.error('File picker stderr:', stderr);
          resolve(null);
          return;
        }
        
        const filePath = stdout.trim();
        if (filePath) {
          resolve(filePath);
        } else {
          resolve(null); // Cancelled
        }
      });
    } else if (os.platform() === 'darwin') {
        // macOS implementation using osascript
        const command = `osascript -e 'POSIX path of (choose file with prompt "Select a file to upload to Slack")'`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                resolve(null);
                return;
            }
            resolve(stdout.trim());
        });
    } else {
      // Linux (try zenity, fallback to error)
      const command = `zenity --file-selection --title="Select a file to upload to Slack"`;
      exec(command, (error, stdout, stderr) => {
          if (error) {
             resolve(null);
             return;
          }
          resolve(stdout.trim());
      });
    }
  });
}

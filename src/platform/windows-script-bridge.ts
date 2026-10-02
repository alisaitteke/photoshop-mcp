import { readFile } from 'fs/promises';

/** Child-process env var holding the JSX path. Kept out of the .vbs source. */
export const WINDOWS_JSX_ENV = 'PSMCP_JSX';

/** Child-process env var holding the UTF-16 result file path. */
export const WINDOWS_RESULT_ENV = 'PSMCP_RESULT';

/**
 * ASCII-only cscript bridge.
 *
 * cscript prints WScript.Echo with the system ANSI code page, so any non-ASCII
 * Photoshop result (and any non-ASCII temp path inlined into the .vbs file)
 * is corrupted before Node can read it. Paths travel in the process environment
 * (Unicode), and the script body is written as UTF-16 LE by FileSystemObject,
 * which ships with Windows Script Host. Stdout stays ASCII.
 */
export function buildWindowsBridgeScript(): string {
  return `
On Error Resume Next
Dim shell, jsxPath, outFile, photoshopApp, result, jsxForJs

Sub WriteResult(text)
    On Error Resume Next
    Dim fso, stream, writeErr
    ' Err is global. Clear the Photoshop failure that caused this write
    ' before treating a non-zero Err as a file-system failure.
    Err.Clear
    Set fso = CreateObject("Scripting.FileSystemObject")
    Set stream = fso.CreateTextFile(outFile, True, True)
    writeErr = Err.Number
    If writeErr <> 0 Then
        WScript.Echo "ERROR: Failed to write script result (" & writeErr & ")"
        WScript.Quit 1
    End If
    Err.Clear
    stream.Write text
    writeErr = Err.Number
    If writeErr <> 0 Then
        WScript.Echo "ERROR: Failed to write script result (" & writeErr & ")"
        WScript.Quit 1
    End If
    stream.Close
End Sub

Set shell = CreateObject("WScript.Shell")
jsxPath = shell.Environment("PROCESS")("${WINDOWS_JSX_ENV}")
outFile = shell.Environment("PROCESS")("${WINDOWS_RESULT_ENV}")

If jsxPath = "" Or outFile = "" Then
    WScript.Echo "ERROR: Missing Photoshop script paths"
    WScript.Quit 1
End If

Set photoshopApp = CreateObject("Photoshop.Application")
If Err.Number <> 0 Then
    WriteResult "ERROR: Failed to connect to Photoshop - " & Err.Description
    WScript.Quit 1
End If

Err.Clear
jsxForJs = Replace(jsxPath, "\\", "\\\\")
jsxForJs = Replace(jsxForJs, "'", "\\'")
result = photoshopApp.DoJavaScript("$.evalFile('" & jsxForJs & "')")

If Err.Number <> 0 Then
    WriteResult "ERROR: " & Err.Description
    WScript.Quit 1
End If

If IsNull(result) Or IsEmpty(result) Then
    result = ""
Else
    result = CStr(result)
End If

WriteResult result
`
    .trim()
    .replace(/\n/g, '\r\n');
}

/** Decode a FileSystemObject Unicode text file (UTF-16 LE, BOM required). */
export function decodeWindowsResultFile(buffer: Buffer): string {
  if (buffer.length === 0) return '';
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le');
  }
  throw new Error('Photoshop script result was not UTF-16 text');
}

export async function readWindowsResultFile(path: string): Promise<string | null> {
  try {
    const buffer = await readFile(path);
    return decodeWindowsResultFile(buffer);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return null;
    throw error;
  }
}

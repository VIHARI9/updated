Option Explicit

Dim SapGuiAuto, application, connection, session
Dim fso, outputFolder, reportFiles, fileName, xlApp, wb, i
Dim exportFailed, failureMessage

Set fso = CreateObject("Scripting.FileSystemObject")

If WScript.Arguments.Count > 0 Then
    outputFolder = WScript.Arguments(0)
Else
    outputFolder = "C:\Users\vijaya.kalyani\Downloads\Dashboard\database"
End If

If Not fso.FolderExists(outputFolder) Then
    fso.CreateFolder outputFolder
End If

reportFiles = Array( _
    "Daywise Data.xlsx", _
    "Daywise MW Report.xlsx", _
    "Monthwise MW Report.xlsx", _
    "Monthwise Report.xlsx" _
)

' Delete only the four SAP-generated reports. Plan.xlsx is preserved.
On Error Resume Next
For Each fileName In reportFiles
    If fso.FileExists(fso.BuildPath(outputFolder, fileName)) Then
        fso.DeleteFile fso.BuildPath(outputFolder, fileName), True
    End If
Next
On Error GoTo 0

' Connect to the first open SAP GUI session.
On Error Resume Next
Set SapGuiAuto = GetObject("SAPGUI")
If Err.Number <> 0 Then Fail "SAP GUI is not open or SAP GUI Scripting is unavailable."
Set application = SapGuiAuto.GetScriptingEngine
If Err.Number <> 0 Then Fail "Could not access the SAP GUI scripting engine."
Set connection = application.Children(0)
If Err.Number <> 0 Then Fail "No active SAP connection was found."
Set session = connection.Children(0)
If Err.Number <> 0 Then Fail "No active SAP session was found."
On Error GoTo 0

session.findById("wnd[0]").maximize

' DAYWISE DATA
session.findById("wnd[0]/tbar[0]/okcd").Text = "zcellreport"
session.findById("wnd[0]").sendVKey 0
WScript.Sleep 2000
session.findById("wnd[0]/tbar[1]/btn[8]").press
WScript.Sleep 1000
session.findById("wnd[0]/usr/radR_BUT4").Select
session.findById("wnd[0]/usr/radR_BUT4").SetFocus
session.findById("wnd[0]/tbar[1]/btn[8]").press
WScript.Sleep 2000
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").currentCellColumn = "SALE_A_GRADE"
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").selectedRows = "0"
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").contextMenu
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").selectContextMenuItem "&XXL"
session.findById("wnd[1]/tbar[0]/btn[0]").press
session.findById("wnd[1]").sendVKey 4
session.findById("wnd[2]").sendVKey 4
session.findById("wnd[3]/usr/ctxtDY_PATH").Text = outputFolder
session.findById("wnd[3]/usr/ctxtDY_FILENAME").Text = "Daywise Data.xlsx"
session.findById("wnd[3]/tbar[0]/btn[11]").press
session.findById("wnd[2]/tbar[0]/btn[11]").press
session.findById("wnd[1]/tbar[0]/btn[11]").press
WScript.Sleep 2000

' DAYWISE MW REPORT
session.findById("wnd[0]/tbar[0]/okcd").Text = "/nzcellreport"
session.findById("wnd[0]").sendVKey 0
WScript.Sleep 2000
session.findById("wnd[0]/tbar[1]/btn[8]").press
session.findById("wnd[0]/tbar[1]/btn[8]").press
WScript.Sleep 2000
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").currentCellColumn = "BEL_GRADE"
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").selectedRows = "0"
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").contextMenu
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").selectContextMenuItem "&XXL"
session.findById("wnd[1]/tbar[0]/btn[0]").press
session.findById("wnd[1]").sendVKey 4
session.findById("wnd[2]/usr/ctxtDY_PATH").Text = outputFolder
session.findById("wnd[2]/usr/ctxtDY_FILENAME").Text = "Daywise MW Report.xlsx"
session.findById("wnd[2]/tbar[0]/btn[11]").press
session.findById("wnd[1]/tbar[0]/btn[11]").press
WScript.Sleep 2000

' MONTHWISE MW REPORT
session.findById("wnd[0]/tbar[0]/okcd").Text = "/nzcellreport"
session.findById("wnd[0]").sendVKey 0
WScript.Sleep 2000
session.findById("wnd[0]/usr/radR_BUT2").Select
session.findById("wnd[0]/usr/radR_BUT2").SetFocus
session.findById("wnd[0]/tbar[1]/btn[8]").press
session.findById("wnd[0]/tbar[1]/btn[8]").press
WScript.Sleep 2000
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").currentCellColumn = "A_GRADE"
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").selectedRows = "0"
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").contextMenu
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").selectContextMenuItem "&XXL"
session.findById("wnd[1]/tbar[0]/btn[0]").press
session.findById("wnd[1]/usr/ctxtDY_PATH").Text = outputFolder
session.findById("wnd[1]/usr/ctxtDY_FILENAME").Text = "Monthwise MW Report.xlsx"
session.findById("wnd[1]/tbar[0]/btn[11]").press
WScript.Sleep 2000

' MONTHWISE REPORT
session.findById("wnd[0]/tbar[0]/okcd").Text = "/nzcellreport"
session.findById("wnd[0]").sendVKey 0
WScript.Sleep 2000
session.findById("wnd[0]/usr/radR_BUT2").Select
session.findById("wnd[0]/usr/radR_BUT2").SetFocus
session.findById("wnd[0]/tbar[1]/btn[8]").press
WScript.Sleep 1000
session.findById("wnd[0]/usr/radR_BUT4").Select
session.findById("wnd[0]/usr/radR_BUT4").SetFocus
session.findById("wnd[0]/tbar[1]/btn[8]").press
WScript.Sleep 2000
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").currentCellColumn = "SALE_A_GRADE"
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").selectedRows = "0"
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").contextMenu
session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell").selectContextMenuItem "&XXL"
session.findById("wnd[1]/tbar[0]/btn[0]").press
session.findById("wnd[1]/usr/ctxtDY_PATH").Text = outputFolder
session.findById("wnd[1]/usr/ctxtDY_FILENAME").Text = "Monthwise Report.xlsx"
session.findById("wnd[1]/tbar[0]/btn[11]").press
WScript.Sleep 3000

' Close only workbooks exported into the dashboard data folder.
On Error Resume Next
Set xlApp = GetObject(, "Excel.Application")
If Not xlApp Is Nothing Then
    xlApp.DisplayAlerts = False
    For i = xlApp.Workbooks.Count To 1 Step -1
        Set wb = xlApp.Workbooks(i)
        If LCase(fso.GetParentFolderName(wb.FullName)) = LCase(outputFolder) Then
            wb.Close False
        End If
    Next
    If xlApp.Workbooks.Count = 0 Then xlApp.Quit
End If
Set xlApp = Nothing
On Error GoTo 0

' Verify that every expected export exists and is not empty.
For Each fileName In reportFiles
    If Not fso.FileExists(fso.BuildPath(outputFolder, fileName)) Then
        Fail "Export did not create " & fileName
    End If
    If fso.GetFile(fso.BuildPath(outputFolder, fileName)).Size = 0 Then
        Fail "Export created an empty file: " & fileName
    End If
Next

WScript.Echo "SUCCESS: All 4 SAP reports were exported to " & outputFolder
WScript.Quit 0

Sub Fail(message)
    WScript.Echo "ERROR: " & message
    WScript.Quit 1
End Sub


                                    Yes. Since you're using Microsoft Copilot Agent, the best approach is to ask it to generate the entire `.vbs` file from scratch while preserving your existing SAP navigation and export logic. Use this prompt exactly as it is.

### Microsoft Copilot Prompt – Generate Complete SAP Incremental Refresh VBS File

I already have a working SAP GUI Scripting `.vbs` file that exports four reports from SAP to Excel. I do not want a framework or partial code. Generate a complete, production-ready `.vbs` file that I can directly replace my existing script with.

### Goal

Convert my current full-refresh workflow into an incremental refresh workflow while keeping the same SAP navigation, Excel formats, filenames, and dashboard integration.

### Existing Reports

The script must continue working with these exact files:

* `Daywise Data.xlsx`

* `Daywise MW Report.xlsx`

* `Monthwise MW Report.xlsx`

* `Monthwise Report.xlsx`

Do not change these filenames.

### Required Workflow

### Step 1 – Read Existing Excel Files

Before downloading anything from SAP:

* Open each existing workbook from my output folder.

* Read the last available date (or last available month for monthly reports).

* Ignore blank rows.

* Close the workbook.

Example:

| File                | Last Data   |
| ------------------- | ----------- |
| Daywise Data        | 10-Sep-2026 |
| Daywise MW Report   | 10-Sep-2026 |
| Monthwise MW Report | Sep-2026    |
| Monthwise Report    | Sep-2026    |

### Step 2 – Use Existing SAP Navigation

Keep my existing SAP GUI scripting navigation exactly the same:

* `zcellreport`

* Execute

* Export using `&XXL`

* Same report sequence

Do not change login or navigation logic.

### Step 3 – Automatically Populate the From Date

Do not require any manual interaction.

The script must automatically locate the SAP From Date field at runtime and enter the last available date from the corresponding Excel file.

The To Date should remain today's/latest SAP date.

No manual Tab presses.

### Step 4 – Export to Temporary Files

Do not overwrite the original files immediately.

Export as:

* `Daywise Data_TEMP.xlsx`

* `Daywise MW Report_TEMP.xlsx`

* `Monthwise MW Report_TEMP.xlsx`

* `Monthwise Report_TEMP.xlsx`

### Step 5 – Update Existing Workbook

After export:

Open both:

* Original workbook

* Temporary workbook

For daily reports:

* Delete every row from the last stored date onward.

* Copy all rows from the temporary export starting from that same date.

* Preserve:

    * headers

    * formatting

    * column widths

    * filters

    * formulas

    * sheet names

For monthly reports:

* Replace data from the last stored month onward.

### Example

Existing:

| Date   | MW  |
| ------ | --- |
| 08 Sep | 5.4 |
| 09 Sep | 5.7 |
| 10 Sep | 5.6 |

SAP export:

| Date   | MW  |
| ------ | --- |
| 10 Sep | 5.8 |
| 11 Sep | 5.9 |
| 12 Sep | 5.8 |
| 13 Sep | 6.1 |

Final workbook becomes:

| Date   | MW  |
| ------ | --- |
| 08 Sep | 5.4 |
| 09 Sep | 5.7 |
| 10 Sep | 5.8 |
| 11 Sep | 5.9 |
| 12 Sep | 5.8 |
| 13 Sep | 6.1 |

No duplicate rows.

### Step 6 – Cleanup

After a successful merge:

* Delete all `_TEMP.xlsx` files.

* Close only the exported Excel workbooks.

* Leave other Excel workbooks untouched.

### Error Handling

Handle gracefully:

* SAP not open

* No active session

* Missing workbook

* Empty workbook

* Missing Date column

* Export failure

* Locked workbook

* Invalid date format

### Logging

Create a refresh log.

Example:

Refresh Started: 15-Sep-2026 09:15

Daywise Data.xlsx

* Last Excel Date: 10-Sep

* Updated: 10-Sep → 15-Sep

Daywise MW Report.xlsx

* Updated: 10-Sep → 15-Sep

Monthwise MW Report.xlsx

* Updated: Sep-2026

Refresh Completed

Duration: 1m 42s

### Important Constraints

* Generate one complete `.vbs` file.

* Do not provide a framework or placeholders.

* Include every helper function inside the same file.

* The final script should be a drop-in replacement for my existing SAP refresh script and work automatically with my dashboard's existing Refresh SAP Data button.
                                                                                            

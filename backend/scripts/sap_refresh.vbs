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

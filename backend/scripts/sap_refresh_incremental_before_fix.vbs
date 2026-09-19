Option Explicit

Const xlUp = -4162
Const xlToLeft = -4159
Const xlPasteAll = -4104
Const xlOpenXMLWorkbook = 51
Const ForAppending = 8

Dim SapGuiAuto, application, connection, session
Dim fso, outputFolder, logPath, startTime
Dim reports, temps, monthlyFlags, gridColumns, saveWindows
Dim boundaries(3), i, xlApp

Set fso = CreateObject("Scripting.FileSystemObject")
startTime = Now

If WScript.Arguments.Count > 0 Then
    outputFolder = WScript.Arguments(0)
Else
    outputFolder = "C:\Users\vijaya.kalyani\Downloads\dashboard\updated\backend\data"
End If

If Not fso.FolderExists(outputFolder) Then fso.CreateFolder outputFolder
logPath = fso.BuildPath(outputFolder, "SAP Refresh Log.txt")

reports = Array("Daywise Data.xlsx", "Daywise MW Report.xlsx", "Monthwise MW Report.xlsx", "Monthwise Report.xlsx")
temps = Array("Daywise Data_TEMP.xlsx", "Daywise MW Report_TEMP.xlsx", "Monthwise MW Report_TEMP.xlsx", "Monthwise Report_TEMP.xlsx")
monthlyFlags = Array(False, False, True, True)
gridColumns = Array("SALE_A_GRADE", "BEL_GRADE", "A_GRADE", "SALE_A_GRADE")
saveWindows = Array(3, 2, 1, 1)

LogLine String(70, "=")
LogLine "Refresh Started: " & FormatDateTime(startTime, 0)
LogLine "Output Folder: " & outputFolder

' Read the existing boundary date/month from every workbook.
Set xlApp = CreateObject("Excel.Application")
xlApp.Visible = False
xlApp.DisplayAlerts = False
xlApp.EnableEvents = False

For i = 0 To 3
    boundaries(i) = ReadLatestPeriod(xlApp, fso.BuildPath(outputFolder, reports(i)), monthlyFlags(i))
    If IsEmpty(boundaries(i)) Then FailWithExcel "No valid Date/Month data found in " & reports(i), xlApp
    If monthlyFlags(i) Then
        LogLine reports(i) & " | Last Excel Month: " & MonthName(Month(boundaries(i)), True) & "-" & Year(boundaries(i))
    Else
        LogLine reports(i) & " | Last Excel Date: " & LogDate(boundaries(i))
    End If
Next

xlApp.Quit
Set xlApp = Nothing

' Remove stale TEMP files only. Original files remain untouched.
For i = 0 To 3
    DeleteFileIfPresent fso.BuildPath(outputFolder, temps(i))
Next

ConnectToSap
session.findById("wnd[0]").maximize

' DAYWISE DATA
OpenZCell "zcellreport", boundaries(0), Date
PressSap "wnd[0]/tbar[1]/btn[8]"
WaitForSap 800
session.findById("wnd[0]/usr/radR_BUT4").Select
session.findById("wnd[0]/usr/radR_BUT4").SetFocus
PressSap "wnd[0]/tbar[1]/btn[8]"
ExportGrid gridColumns(0), temps(0), saveWindows(0)

' DAYWISE MW REPORT
OpenZCell "/nzcellreport", boundaries(1), Date
PressSap "wnd[0]/tbar[1]/btn[8]"
PressSap "wnd[0]/tbar[1]/btn[8]"
ExportGrid gridColumns(1), temps(1), saveWindows(1)

' MONTHWISE MW REPORT
OpenZCell "/nzcellreport", boundaries(2), Date
session.findById("wnd[0]/usr/radR_BUT2").Select
session.findById("wnd[0]/usr/radR_BUT2").SetFocus
PressSap "wnd[0]/tbar[1]/btn[8]"
PressSap "wnd[0]/tbar[1]/btn[8]"
ExportGrid gridColumns(2), temps(2), saveWindows(2)

' MONTHWISE REPORT
OpenZCell "/nzcellreport", boundaries(3), Date
session.findById("wnd[0]/usr/radR_BUT2").Select
session.findById("wnd[0]/usr/radR_BUT2").SetFocus
PressSap "wnd[0]/tbar[1]/btn[8]"
WaitForSap 800
session.findById("wnd[0]/usr/radR_BUT4").Select
session.findById("wnd[0]/usr/radR_BUT4").SetFocus
PressSap "wnd[0]/tbar[1]/btn[8]"
ExportGrid gridColumns(3), temps(3), saveWindows(3)

CloseOnlyTempWorkbooks

' Verify all exports before changing any original workbook.
For i = 0 To 3
    VerifyFile fso.BuildPath(outputFolder, temps(i))
Next

' Back up all originals before merging.
Dim backupFolder, stamp
stamp = Year(Now) & Right("0" & Month(Now), 2) & Right("0" & Day(Now), 2) & "_" & Right("0" & Hour(Now), 2) & Right("0" & Minute(Now), 2) & Right("0" & Second(Now), 2)
backupFolder = fso.BuildPath(outputFolder, "refresh_backup_" & stamp)
fso.CreateFolder backupFolder
For i = 0 To 3
    If Not fso.FileExists(fso.BuildPath(outputFolder, reports(i))) Then Fail "Missing original workbook: " & reports(i)
    fso.CopyFile fso.BuildPath(outputFolder, reports(i)), fso.BuildPath(backupFolder, reports(i)), True
Next

' Merge fresh overlap data into the original files.
Set xlApp = CreateObject("Excel.Application")
xlApp.Visible = False
xlApp.DisplayAlerts = False
xlApp.EnableEvents = False

On Error Resume Next
For i = 0 To 3
    Err.Clear
    MergeWorkbook xlApp, fso.BuildPath(outputFolder, reports(i)), fso.BuildPath(outputFolder, temps(i)), boundaries(i), monthlyFlags(i)
    If Err.Number <> 0 Then
        Dim mergeError
        mergeError = "Merge failed for " & reports(i) & ": " & Err.Description
        xlApp.Quit
        Set xlApp = Nothing
        RestoreBackups backupFolder
        On Error GoTo 0
        Fail mergeError
    End If
    If monthlyFlags(i) Then
        LogLine reports(i) & " | Updated from " & MonthName(Month(boundaries(i)), True) & "-" & Year(boundaries(i))
    Else
        LogLine reports(i) & " | Updated: " & LogDate(boundaries(i)) & " to " & LogDate(Date)
    End If
Next
On Error GoTo 0

xlApp.Quit
Set xlApp = Nothing

' Delete TEMP exports only after every merge succeeds.
For i = 0 To 3
    DeleteFileIfPresent fso.BuildPath(outputFolder, temps(i))
Next

LogLine "Refresh Completed: " & FormatDateTime(Now, 0)
LogLine "Duration: " & FormatDuration(DateDiff("s", startTime, Now))
LogLine String(70, "=")
WScript.Echo "SUCCESS: Incremental SAP refresh completed. Log: " & logPath
WScript.Quit 0

Sub ConnectToSap()
    On Error Resume Next
    Set SapGuiAuto = GetObject("SAPGUI")
    If Err.Number <> 0 Then Fail "SAP GUI is not open or SAP GUI Scripting is unavailable."
    Err.Clear
    Set application = SapGuiAuto.GetScriptingEngine
    If Err.Number <> 0 Then Fail "Could not access the SAP GUI scripting engine."
    Err.Clear
    Set connection = application.Children(0)
    If Err.Number <> 0 Then Fail "No active SAP connection was found."
    Err.Clear
    Set session = connection.Children(0)
    If Err.Number <> 0 Then Fail "No active SAP session was found."
    On Error GoTo 0
End Sub

Sub OpenZCell(commandText, fromDate, toDate)
    session.findById("wnd[0]/tbar[0]/okcd").Text = commandText
    session.findById("wnd[0]").sendVKey 0
    WaitForSap 1500

    On Error Resume Next
    session.findById("wnd[0]/usr/ctxtS_DATE-LOW").Text = SapDate(fromDate)
    If Err.Number <> 0 Then
        Dim lowError
        lowError = Err.Description
        On Error GoTo 0
        Fail "Could not set SAP From Date S_DATE-LOW: " & lowError
    End If
    Err.Clear
    session.findById("wnd[0]/usr/ctxtS_DATE-HIGH").Text = SapDate(toDate)
    If Err.Number <> 0 Then
        Dim highError
        highError = Err.Description
        On Error GoTo 0
        Fail "Could not set SAP To Date S_DATE-HIGH: " & highError
    End If
    session.findById("wnd[0]/usr/ctxtS_DATE-HIGH").SetFocus
    session.findById("wnd[0]").sendVKey 0
    On Error GoTo 0
    WaitForSap 500
End Sub

Sub PressSap(objectId)
    On Error Resume Next
    session.findById(objectId).press
    If Err.Number <> 0 Then
        Dim pressError
        pressError = Err.Description
        On Error GoTo 0
        Fail "SAP action failed at " & objectId & ": " & pressError
    End If
    On Error GoTo 0
    WaitForSap 500
End Sub

Sub WaitForSap(minimumMs)
    Dim elapsed
    WScript.Sleep minimumMs
    elapsed = 0
    On Error Resume Next
    Do While session.Busy And elapsed < 120000
        WScript.Sleep 250
        elapsed = elapsed + 250
    Loop
    On Error GoTo 0
    If elapsed >= 120000 Then Fail "SAP remained busy for more than 120 seconds."
End Sub

Sub ExportGrid(columnName, tempName, saveWindowNumber)
    Dim grid, saveWindow, n
    WaitForSap 1000
    Set grid = session.findById("wnd[0]/usr/cntlGRID1/shellcont/shell")
    grid.currentCellColumn = columnName
    grid.selectedRows = "0"
    grid.contextMenu
    grid.selectContextMenuItem "&XXL"
    WaitForSap 500
    session.findById("wnd[1]/tbar[0]/btn[0]").press
    WaitForSap 400

    If saveWindowNumber = 3 Then
        session.findById("wnd[1]").sendVKey 4
        WScript.Sleep 300
        session.findById("wnd[2]").sendVKey 4
    ElseIf saveWindowNumber = 2 Then
        session.findById("wnd[1]").sendVKey 4
    End If

    saveWindow = "wnd[" & saveWindowNumber & "]"
    session.findById(saveWindow & "/usr/ctxtDY_PATH").Text = outputFolder
    session.findById(saveWindow & "/usr/ctxtDY_FILENAME").Text = tempName
    session.findById(saveWindow & "/tbar[0]/btn[11]").press
    WaitForSap 600

    For n = saveWindowNumber - 1 To 1 Step -1
        On Error Resume Next
        session.findById("wnd[" & n & "]/tbar[0]/btn[11]").press
        Err.Clear
        On Error GoTo 0
        WScript.Sleep 250
    Next

    WaitForFile fso.BuildPath(outputFolder, tempName), 90
End Sub

Function ReadLatestPeriod(excelApp, workbookPath, monthly)
    Dim book, sheet, info, headerRow, dateColumn, lastRow, rowNumber, candidate, latest
    ReadLatestPeriod = Empty
    If Not fso.FileExists(workbookPath) Then FailWithExcel "Missing workbook: " & workbookPath, excelApp

    On Error Resume Next
    Set book = excelApp.Workbooks.Open(workbookPath, 0, True)
    If Err.Number <> 0 Or book Is Nothing Then
        Dim openError
        openError = Err.Description
        On Error GoTo 0
        FailWithExcel "Could not open workbook, possibly locked: " & workbookPath & ". " & openError, excelApp
    End If
    On Error GoTo 0

    Set sheet = FindDateSheet(book, monthly)
    If sheet Is Nothing Then book.Close False: Exit Function
    info = FindDateColumn(sheet, monthly)
    If IsEmpty(info) Then book.Close False: Exit Function
    headerRow = info(0)
    dateColumn = info(1)
    lastRow = sheet.Cells(sheet.Rows.Count, dateColumn).End(xlUp).Row

    latest = Empty
    For rowNumber = headerRow + 1 To lastRow
        candidate = ParsePeriod(sheet.Cells(rowNumber, dateColumn).Value, monthly)
        If Not IsEmpty(candidate) Then
            If IsEmpty(latest) Then
                latest = candidate
            ElseIf CDate(candidate) > CDate(latest) Then
                latest = candidate
            End If
        End If
    Next

    book.Close False
    ReadLatestPeriod = latest
End Function

Sub MergeWorkbook(excelApp, originalPath, tempPath, boundaryDate, monthly)
    Dim originalBook, tempBook, originalSheet, tempSheet
    Dim originalInfo, tempInfo, originalHeader, originalDateCol, tempHeader, tempDateCol
    Dim originalLastRow, tempLastRow, firstDelete, firstCopy, rowNumber, targetRow, lastColumn

    Set originalBook = excelApp.Workbooks.Open(originalPath, 0, False)
    If originalBook.ReadOnly Then Err.Raise vbObjectError + 110, , "Original workbook is read-only or locked"
    Set tempBook = excelApp.Workbooks.Open(tempPath, 0, True)

    Set originalSheet = FindDateSheet(originalBook, monthly)
    Set tempSheet = FindDateSheet(tempBook, monthly)
    If originalSheet Is Nothing Or tempSheet Is Nothing Then Err.Raise vbObjectError + 111, , "Date/Month column was not found"

    originalInfo = FindDateColumn(originalSheet, monthly)
    tempInfo = FindDateColumn(tempSheet, monthly)
    originalHeader = originalInfo(0): originalDateCol = originalInfo(1)
    tempHeader = tempInfo(0): tempDateCol = tempInfo(1)
    originalLastRow = LastUsedRow(originalSheet)
    tempLastRow = LastUsedRow(tempSheet)

    firstDelete = 0
    For rowNumber = originalHeader + 1 To originalLastRow
        If IsAtOrAfter(originalSheet.Cells(rowNumber, originalDateCol).Value, boundaryDate, monthly) Then
            firstDelete = rowNumber
            Exit For
        End If
    Next
    If firstDelete > 0 Then originalSheet.Rows(firstDelete & ":" & originalLastRow).Delete

    firstCopy = 0
    For rowNumber = tempHeader + 1 To tempLastRow
        If IsAtOrAfter(tempSheet.Cells(rowNumber, tempDateCol).Value, boundaryDate, monthly) Then
            firstCopy = rowNumber
            Exit For
        End If
    Next
    If firstCopy = 0 Then Err.Raise vbObjectError + 112, , "TEMP export has no rows from the overlap period"

    targetRow = LastUsedRow(originalSheet) + 1
    If targetRow <= originalHeader Then targetRow = originalHeader + 1
    lastColumn = LastUsedColumn(tempSheet)

    tempSheet.Range(tempSheet.Cells(firstCopy, 1), tempSheet.Cells(tempLastRow, lastColumn)).Copy
    originalSheet.Cells(targetRow, 1).PasteSpecial xlPasteAll
    excelApp.CutCopyMode = False

    originalBook.Save
    tempBook.Close False
    originalBook.Close True
End Sub

Function FindDateSheet(book, monthly)
    Dim sheet, info
    Set FindDateSheet = Nothing
    For Each sheet In book.Worksheets
        info = FindDateColumn(sheet, monthly)
        If Not IsEmpty(info) Then
            Set FindDateSheet = sheet
            Exit Function
        End If
    Next
End Function

Function FindDateColumn(sheet, monthly)
    Dim maxRow, maxCol, rowNumber, colNumber, header, score, bestScore, bestRow, bestCol
    FindDateColumn = Empty
    maxRow = LastUsedRow(sheet): If maxRow > 25 Then maxRow = 25
    maxCol = LastUsedColumn(sheet): If maxCol > 100 Then maxCol = 100
    bestScore = 0

    For rowNumber = 1 To maxRow
        For colNumber = 1 To maxCol
            header = NormalizeHeader(sheet.Cells(rowNumber, colNumber).Value)
            score = DateHeaderScore(header, monthly)
            If score > bestScore Then
                bestScore = score
                bestRow = rowNumber
                bestCol = colNumber
            End If
        Next
    Next

    If bestScore > 0 Then FindDateColumn = Array(bestRow, bestCol)
End Function

Function DateHeaderScore(header, monthly)
    DateHeaderScore = 0
    If monthly Then
        If header = "month" Or header = "monthyear" Or header = "period" Then DateHeaderScore = 100: Exit Function
        If InStr(header, "month") > 0 Then DateHeaderScore = 90: Exit Function
        If header = "date" Then DateHeaderScore = 50
    Else
        If header = "date" Or header = "day" Or header = "productiondate" Then DateHeaderScore = 100: Exit Function
        If InStr(header, "date") > 0 Then DateHeaderScore = 80
    End If
End Function

Function NormalizeHeader(value)
    Dim text
    If IsEmpty(value) Or IsError(value) Then NormalizeHeader = "": Exit Function
    text = LCase(Trim(CStr(value)))
    text = Replace(text, " ", "")
    text = Replace(text, "_", "")
    text = Replace(text, "-", "")
    text = Replace(text, "/", "")
    NormalizeHeader = text
End Function

Function ParsePeriod(value, monthly)
    Dim parsed
    ParsePeriod = Empty
    If IsEmpty(value) Or IsError(value) Or Trim(CStr(value)) = "" Then Exit Function
    On Error Resume Next
    parsed = CDate(value)
    If Err.Number = 0 Then
        If monthly Then parsed = DateSerial(Year(parsed), Month(parsed), 1)
        ParsePeriod = parsed
    End If
    Err.Clear
    On Error GoTo 0
End Function

Function IsAtOrAfter(value, boundaryDate, monthly)
    Dim parsed
    parsed = ParsePeriod(value, monthly)
    IsAtOrAfter = False
    If Not IsEmpty(parsed) Then IsAtOrAfter = (CDate(parsed) >= CDate(boundaryDate))
End Function

Function LastUsedRow(sheet)
    Dim found
    On Error Resume Next
    Set found = sheet.Cells.Find("*", sheet.Cells(1, 1), -4123, 2, 1, 2, False)
    If found Is Nothing Then LastUsedRow = 1 Else LastUsedRow = found.Row
    On Error GoTo 0
End Function

Function LastUsedColumn(sheet)
    Dim found
    On Error Resume Next
    Set found = sheet.Cells.Find("*", sheet.Cells(1, 1), -4123, 2, 2, 2, False)
    If found Is Nothing Then LastUsedColumn = 1 Else LastUsedColumn = found.Column
    On Error GoTo 0
End Function

Sub CloseOnlyTempWorkbooks()
    Dim excelInstance, book, n
    On Error Resume Next
    Set excelInstance = GetObject(, "Excel.Application")
    If excelInstance Is Nothing Then On Error GoTo 0: Exit Sub
    For n = excelInstance.Workbooks.Count To 1 Step -1
        Set book = excelInstance.Workbooks(n)
        If IsTempPath(book.FullName) Then book.Close False
    Next
    If excelInstance.Workbooks.Count = 0 Then excelInstance.Quit
    Set excelInstance = Nothing
    On Error GoTo 0
End Sub

Function IsTempPath(path)
    Dim n
    IsTempPath = False
    For n = 0 To 3
        If LCase(path) = LCase(fso.BuildPath(outputFolder, temps(n))) Then IsTempPath = True: Exit Function
    Next
End Function

Sub VerifyFile(path)
    If Not fso.FileExists(path) Then Fail "Export did not create " & path
    If fso.GetFile(path).Size = 0 Then Fail "Export created an empty file: " & path
End Sub

Sub WaitForFile(path, timeoutSeconds)
    Dim limit, size1, size2
    limit = DateAdd("s", timeoutSeconds, Now)
    Do
        If fso.FileExists(path) Then
            size1 = fso.GetFile(path).Size
            WScript.Sleep 500
            size2 = fso.GetFile(path).Size
            If size1 > 0 And size1 = size2 Then Exit Sub
        Else
            WScript.Sleep 300
        End If
        If Now >= limit Then Fail "Timed out waiting for export: " & path
    Loop
End Sub

Sub RestoreBackups(folder)
    Dim n
    On Error Resume Next
    For n = 0 To 3
        If fso.FileExists(fso.BuildPath(folder, reports(n))) Then
            fso.CopyFile fso.BuildPath(folder, reports(n)), fso.BuildPath(outputFolder, reports(n)), True
        End If
    Next
    On Error GoTo 0
End Sub

Sub DeleteFileIfPresent(path)
    If fso.FileExists(path) Then
        On Error Resume Next
        fso.DeleteFile path, True
        If Err.Number <> 0 Then
            Dim deleteError
            deleteError = Err.Description
            On Error GoTo 0
            Fail "Could not delete old TEMP file, possibly locked: " & path & ". " & deleteError
        End If
        On Error GoTo 0
    End If
End Sub

Function SapDate(value)
    SapDate = Right("0" & Day(value), 2) & "." & Right("0" & Month(value), 2) & "." & Year(value)
End Function

Function LogDate(value)
    LogDate = Right("0" & Day(value), 2) & "-" & MonthName(Month(value), True) & "-" & Year(value)
End Function

Function FormatDuration(seconds)
    FormatDuration = (seconds \ 60) & "m " & (seconds Mod 60) & "s"
End Function

Sub LogLine(text)
    Dim stream
    Set stream = fso.OpenTextFile(logPath, ForAppending, True)
    stream.WriteLine text
    stream.Close
End Sub

Sub FailWithExcel(message, excelInstance)
    On Error Resume Next
    excelInstance.Quit
    On Error GoTo 0
    Fail message
End Sub

Sub Fail(message)
    LogLine "ERROR: " & message
    LogLine "Refresh Failed: " & FormatDateTime(Now, 0)
    LogLine "Duration: " & FormatDuration(DateDiff("s", startTime, Now))
    LogLine String(70, "=")
    WScript.Echo "ERROR: " & message & vbCrLf & "Log: " & logPath
    WScript.Quit 1
End Sub

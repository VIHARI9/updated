'''
gen json:
$Project = "C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2"
>> 
>> Set-Location "$Project\backend"
>> 
>> .\.venv\Scripts\python.exe ".\build_efficiency_json.py"

Created sap_efficiency_daily.json with 703 daily records
PS C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2\backend> Test-Path "$Project\backend\data\sap_efficiency_daily.json"


                          run backend:
                          $Project = "C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2"
>> 
>> Set-Location "$Project\backend"
>> 
>> .\.venv\Scripts\python.exe -m py_compile `
>>   ".\app\main.py" `
>>   ".\app\data_service.py" `
>>   ".\app\efficiency_service.py" `
>>   ".\build_efficiency_json.py"
>> 
>> .\.venv\Scripts\python.exe -m uvicorn `
>>   app.main:app `
>>   --host 127.0.0.1 `
>>   --port 8000


run frontend:

PS C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2> $Project = "C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2"
PS C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2> $NodeFolder = "$Project\node-v24.20.0-win-x64"
PS C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2> 
PS C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2> $env:Path = "$NodeFolder;$env:Path"
PS C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2> 
PS C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2> Set-Location "$Project\frontend"
PS C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2\frontend> 
PS C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2\frontend> Remove-Item ".\node_modules\.vite" `
>>   -Recurse `
>>   -Force `
>>   -ErrorAction SilentlyContinue
PS C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2\frontend> 
PS C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2\frontend> Remove-Item ".\dist" `
>>   -Recurse `
>>   -Force `
>>   -ErrorAction SilentlyContinue
PS C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2\frontend> 
PS C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2\frontend> npm.cmd run build

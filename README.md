# ReNew Solar Manufacturing Dashboard v2

Professional responsive React + TypeScript frontend with a FastAPI Python backend.

## Dashboard design

- Two tabs only: **Overview** and **Trends**.
- Financial-year selector in the title header.
- For a previous financial year, **On Date** uses the last available day in that FY and **MTD** uses the final available month in that FY.
- Existing Excel files are loaded on startup. SAP is contacted only when **Refresh SAP Data** is clicked.

## Expected Excel workbooks

Copy these files to `backend/data/`:

- `Daywise Data.xlsx`
- `Daywise MW Report.xlsx`
- `Monthwise MW Report.xlsx`
- `Monthwise Report.xlsx`
- `Plan.xlsx`

The current application calculations use the two day-wise files and Plan.xlsx. Month-wise files are retained for SAP refresh compatibility.

## OR mapping

The available source wording previously supplied contains ER, FOR and ER(Q). This project displays **OR** using the configured ER(Q) value. Change `OR_SOURCE_FIELD` in `backend/app/config.py` if your OR field means something else.

## Backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs

## Frontend

```powershell
$NodeFolder = "C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2\node-v24.20.0-win-x64"
$env:Path = "$NodeFolder;$env:Path"

cd "C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2\frontend"

node.exe --version
npm.cmd --version
npm.cmd install
npm.cmd run dev
```


Frontend: http://localhost:5173

## Production build

```powershell
cd frontend
npm.cmd run build
```
$NodeFolder = "C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2\node-v24.20.0-win-x64"

$env:Path = "$NodeFolder;$env:Path"

cd "C:\Users\vijaya.kalyani\Downloads\renew-solar-dashboard-v2\frontend"

node.exe --version
npm.cmd --version

npm.cmd run build

Then start FastAPI without `--reload`. FastAPI serves `frontend/dist` at http://localhost:8000.

## SAP refresh

Copy your script to `backend/scripts/sap_refresh.vbs`. The script must accept the output data directory as its first argument. SAP GUI must be open, authenticated, and scripting-enabled. Only one refresh can run at a time.

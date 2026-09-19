```
# Navigate into your repository folder (replace with your actual folder path)
cd path\to\your\React-Dashboard

# Download and apply the latest changes
git pull origin main
```
backend
```
cd C:\Users\vviha\Downloads\updated\backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
frontend
```
# Point the terminal to your local Node.js version
$NodeFolder = "C:\Users\vijaya.kalyani\Downloads\dashboard\updated\node-v24.20.0-win-x64"
$env:Path = "$NodeFolder;$env:Path"

# Navigate to the frontend folder
cd C:\Users\vijaya.kalyani\Downloads\dashboard\updated\frontend

# Install dependencies and start the app
npm.cmd install
npm.cmd run dev
```
GIT PULL
On the other PC:

```powershell
cd C:\Users\<your-user>\Downloads
git clone https://github.com/VIHARI9/updated.git dashboard
cd dashboard
git checkout main
git pull origin main
```

Install and run the backend:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In a second terminal, run the frontend:

```powershell
$NodeFolder = "C:\path\to\node-v24.20.0-win-x64"
$env:Path = "$NodeFolder;$env:Path"

cd C:\Users\<your-user>\Downloads\dashboard\frontend
npm.cmd install
npm.cmd run dev
```

For future updates on that PC:

```powershell
cd C:\Users\<your-user>\Downloads\dashboard
git pull origin main
```

Do not copy `.venv`, `node_modules`, or `dist`; recreate them with the commands above.

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

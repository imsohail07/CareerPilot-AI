@echo off
cd /d "%~dp0"
if not exist .venv (
  echo Creating Python virtual environment...
  py -3 -m venv .venv
  if errorlevel 1 python -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
if exist .env (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
    if not "%%A"=="" set "%%A=%%B"
  )
)
echo.
echo Starting CareerPilot AI at http://127.0.0.1:8000
echo API docs: http://127.0.0.1:8000/docs
echo Press Ctrl+C to stop the server.
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause

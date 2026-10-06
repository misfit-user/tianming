@echo off
chcp 65001 >nul
rem 新前端预览：在本工作树的 web\ 起本地服务，浏览器打开 index.html?ui=new（新前端开关）。
rem 本工作树没有未跟踪的立绘等资产，人物像以名字首字代替；装好的游戏里立绘照常。
cd /d "%~dp0..\..\web"
where python >nul 2>nul
if errorlevel 1 goto nopython
start "天命新前端预览服务" /min python -m http.server 8794 --bind 127.0.0.1
timeout /t 2 >nul
start "" "http://127.0.0.1:8794/index.html?ui=new"
goto end
:nopython
echo 找不到 python，无法起本地服务。
pause
:end

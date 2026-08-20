@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title KaysOS GitHub: 3n4zb1rm1ly0n-lang

rem Bu dosyayi cift tikla. KaysOS push hesabini 3n4zb1rm1ly0n-lang yapar.
set "ACCOUNT=3n4zb1rm1ly0n-lang"

cd /d "%~dp0.."
if not exist ".git" (
  echo Repo koku bulunamadi. Bu .bat scripts klasorunde olmali.
  pause
  exit /b 1
)

echo Repo: %CD%
echo Hedef GitHub hesabi: %ACCOUNT%
echo.

git remote get-url origin
echo.
echo Kayitli GitHub hesaplari:
git credential-manager github list
echo.

echo Tarayicide %ACCOUNT% ile giris acilacak...
echo kendisepetimtr veya kaysia-store SECME.
echo.
git credential-manager github login --username %ACCOUNT% --browser --force
if errorlevel 1 (
  echo.
  echo GitHub girisi basarisiz.
  pause
  exit /b 1
)

git config --local credential.https://github.com.username %ACCOUNT%
echo Bu repo icin credential kullanicisi: %ACCOUNT%
echo.

echo Baglanti denemesi...
git ls-remote origin HEAD >nul
if errorlevel 1 (
  echo.
  echo Hala 403. Tarayicide %ACCOUNT% ile girdiginden emin ol.
  pause
  exit /b 1
)

echo GitHub erisimi tamam.
echo.

set "DOPUSH="
if /i "%~1"=="-Push" set "DOPUSH=1"
if /i "%~1"=="/push" set "DOPUSH=1"

if not defined DOPUSH (
  set /p ANS=main'i simdi push etmek ister misin? [E/H]: 
  if /i "!ANS!"=="E" set "DOPUSH=1"
  if /i "!ANS!"=="Y" set "DOPUSH=1"
)

if defined DOPUSH (
  echo Push: origin HEAD
  git push -u origin HEAD
  if errorlevel 1 (
    echo Push basarisiz.
    pause
    exit /b 1
  )
  echo Push tamam.
) else (
  echo Push atlandi. Sonra: git push origin main
)

echo.
pause
exit /b 0

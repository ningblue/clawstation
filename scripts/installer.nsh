; !include "getProcessInfo.nsh"
; Var pid

!macro customHeader
  !define MUI_ABORTWARNING
  ShowInstDetails show
!macroend

!macro customCheckAppRunning
  SetDetailsPrint both
  DetailPrint "Preparing installation..."
  ; !insertmacro _CHECK_APP_RUNNING
!macroend

!macro customInstall
  DetailPrint "Updating AI Engine Resources..."
  
  ; 清理旧版本资源 (如果存在)
  IfFileExists "$INSTDIR\resources\openclaw\*.*" 0 +2
    RMDir /r "$INSTDIR\resources\openclaw"
    
  ; 创建目标目录
  CreateDirectory "$INSTDIR\resources\openclaw"
  
  ; 检查 zip 文件是否存在
  IfFileExists "$INSTDIR\resources\openclaw.zip" extract_zip end_zip
  
extract_zip:
    DetailPrint "Extracting openclaw.zip..."
    
    ; 尝试使用 7za.exe (极速)
    InitPluginsDir
    ; 将 7za.exe 打包进安装程序，并在运行时释放到临时目录
    File "/oname=$PLUGINSDIR\7za.exe" "${PROJECT_DIR}\node_modules\7zip-bin\win\x64\7za.exe"
    
    ; 执行解压
    ; x: 解压
    ; -o: 输出目录 (注意没有空格)
    ; -y: 覆盖确认
    ; -aoa: 覆盖所有文件
    nsExec::ExecToLog '"$PLUGINSDIR\7za.exe" x "$INSTDIR\resources\openclaw.zip" -o"$INSTDIR\resources\openclaw" -y -aoa'
    Pop $0
    
    ; 检查解压是否成功 (0 = 成功)
    IntCmp $0 0 success_extract fail_7z
    
fail_7z:
    DetailPrint "7zip failed, falling back to PowerShell..."
    ; 回退到 PowerShell 解压 (Windows 10+)
    nsExec::ExecToLog 'powershell -NoProfile -NonInteractive -Command "Expand-Archive -Path \"$INSTDIR\resources\openclaw.zip\" -DestinationPath \"$INSTDIR\resources\openclaw\" -Force"'
    Pop $0
    
    ; 检查解压是否成功 (0 = 成功)
    IntCmp $0 0 success_extract fail_extract fail_extract
    
fail_extract:
    MessageBox MB_OK|MB_ICONSTOP "Failed to extract AI Engine resources. Please ensure PowerShell 5.0+ is installed."
    Abort
    
success_extract:
    ; 删除 zip 文件
    Delete "$INSTDIR\resources\openclaw.zip"
    Goto end_zip

end_zip:
    DetailPrint "AI Engine Resources Updated."
!macroend

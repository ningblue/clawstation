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
  
  ; 检查 7z 文件是否存在
  IfFileExists "$INSTDIR\resources\openclaw.7z" extract_7z end_zip
  
extract_7z:
    DetailPrint "Extracting openclaw.7z..."
    
    ; 使用预置在 resources 下的 7za.exe (静态资源)
    ; 避免使用 InitPluginsDir 和 File 指令动态释放 exe，防止安装器崩溃或被杀软拦截
    
    ; 重试逻辑
    StrCpy $1 0
    
retry_extract:
    ; 执行解压
    ; 注意：7za.exe 位于 $INSTDIR\resources\7za.exe
    nsExec::ExecToLog '"$INSTDIR\resources\7za.exe" x "$INSTDIR\resources\openclaw.7z" -o"$INSTDIR\resources\openclaw" -y -aoa'
    Pop $0
    
    ; 检查解压是否成功
    ; 7-Zip 返回码: 0=成功, 1=警告(可继续), >=2=失败
    IntCmp $0 0 success_extract
    IntCmp $0 1 success_extract
    
    ; 失败，检查重试次数
    IntOp $1 $1 + 1
    IntCmp $1 3 fail_extract
    
    DetailPrint "Extraction failed (Code $0). Retrying ($1/3)..."
    Sleep 1000
    Goto retry_extract

fail_extract:
    DetailPrint "Failed to extract AI Engine resources. Exit code: $0"
    ; 即使失败也不要 Abort，让安装完成，用户可以手动修复或重装
    Goto end_zip
    
success_extract:
    ; 删除 7z 文件
    Delete "$INSTDIR\resources\openclaw.7z"
    ; 删除 7za.exe (如果不想保留)
    Delete "$INSTDIR\resources\7za.exe"

    ; 恢复 .node 文件
    ; electron-builder 会将 .node 文件放在 resources/openclaw/node_modules 下 (因为 asarUnpack)
    ; 我们需要确保它们在解压后仍然存在且位置正确
    ; 由于我们解压到 resources/openclaw，且 7z 中排除了 .node 文件
    ; 而 electron-builder 将 .node 文件打包到了 app.asar.unpacked 或者直接复制到了 resources/openclaw
    ; 如果是 extraResources 方式，electron-builder 会直接复制文件
    ; 所以我们需要确认 .node 文件是否被正确放置
    
    ; 如果 electron-builder 按照我们的配置将 .node 文件复制到了 resources/openclaw/node_modules
    ; 那么解压 7z (不含 .node) 到同一目录应该是安全的，不会覆盖现有的 .node 文件 (因为 7z 里没有)
    
    Goto end_zip

end_zip:
    DetailPrint "AI Engine Resources Updated."

    ; Configure Firewall Rules to prevent popup
    DetailPrint "Configuring Firewall Rules..."
    ; Allow Node.js (AI Engine)
    nsExec::ExecToLog 'netsh advfirewall firewall add rule name="XClaw AI Engine" dir=in action=allow program="$INSTDIR\resources\node\node.exe" enable=yes profile=any'
    Pop $0
    ; Allow Main App
    nsExec::ExecToLog 'netsh advfirewall firewall add rule name="XClaw Application" dir=in action=allow program="$INSTDIR\XClaw.exe" enable=yes profile=any'
    Pop $0
!macroend

!macro customUninstall
  DetailPrint "Removing Firewall Rules..."
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="XClaw AI Engine" program="$INSTDIR\resources\node\node.exe"'
  Pop $0
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="XClaw Application" program="$INSTDIR\XClaw.exe"'
  Pop $0
!macroend

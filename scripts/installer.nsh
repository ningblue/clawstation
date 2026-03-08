!include "getProcessInfo.nsh"
Var pid

!macro customHeader
  !define MUI_ABORTWARNING
  ShowInstDetails show
!macroend

!macro customCheckAppRunning
  SetDetailsPrint both
  DetailPrint "Preparing installation..."
  !insertmacro _CHECK_APP_RUNNING
!macroend

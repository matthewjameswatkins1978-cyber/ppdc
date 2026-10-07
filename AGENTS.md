# Local developer tools

Before declaring an installed local developer tool unavailable, run:

```powershell
& "D:\AgentTools\bootstrap-project.ps1"
```

Consult `D:\AgentTools\capability-report.json`. Do not infer that a tool is absent merely because the initial shell PATH cannot find it. Run `& ".\scripts\use-agent-tools.ps1"` to prepare this project shell.
# Local developer tools

Local developer tools are exposed through `D:\AgentTools` and should normally already be on PATH.

Before declaring a local tool unavailable:

1. Consult `D:\AgentTools\capability-report.json`.
2. If the report is stale or inconsistent, run `D:\AgentTools\refresh-agent-tools.ps1`.
3. Only then report the tool unavailable.

Do not run `bootstrap-project.ps1` at every session; it is primarily a diagnostic and manual verification command.



# Security policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Use **Security → Report a vulnerability** on this GitHub repository (private vulnerability reporting). You should get a reply within a week.

## What this project does to stay safe

- **No secrets in the repository.** The app needs no API keys. The optional server token is read from the `REMASTER_LAB_TOKEN` environment variable; see `server/.env.example`. CI runs [gitleaks](https://github.com/gitleaks/gitleaks) on every push and pull request.
- **Audio stays local** in browser mode. The server, if you run one, keeps nothing on disk: uploads are decoded in memory and the stems are streamed back.
- **Server hardening**: CORS is limited to the origins in `REMASTER_LAB_ORIGINS`, uploads are capped by `REMASTER_LAB_MAX_MB`, ffmpeg runs without a shell, the token check is constant-time, and the Docker image runs as a non-root user. Put the server behind HTTPS and set a token before exposing it to the internet.

# Релиз и публикация

Публикация автоматизирована через GitHub Actions (`.github/workflows/publish.yml`).

1. Все изменения влиты в `develop`, CI зелёный.
2. Поднять версию по SemVer и создать тег:

```bash
npm version X.Y.Z
git push && git push --tags
```

3. Workflow `Publish` соберёт пакет (`prepublishOnly`: lint + typecheck + test + build)
   и опубликует его в npm. Требуется секрет репозитория `NPM_TOKEN`
   (automation-токен npm с правом публикации в scope `@invoicebox`).
4. Влить `develop` в `main`.

#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
README="$PROJECT_DIR/README.md"

echo "🔍 Obteniendo el build más reciente..."
BUILD_JSON=$(eas build:list --platform android --limit 1 --json)

ARTIFACT_URL=$(echo "$BUILD_JSON" | grep -o 'https://expo.dev/artifacts/eas/[^"]*\.apk' || true)

if [ -z "$ARTIFACT_URL" ]; then
  echo "❌ No se pudo obtener la URL del artifact. Resultado completo:"
  echo "$BUILD_JSON"
  exit 1
fi

echo "📱 Build más reciente: $ARTIFACT_URL"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

NEW_LINE="| **Android** | **[Descargar APK]($ARTIFACT_URL)**"
sed -i "/| \\*\\*Android\\*\\* | \\*\\*Descargar APK/\\| \\*\\*Android\\*\\* | \\*\\*Descargar APK/c\\$NEW_LINE" "$README"

DATE_LINE="> **Fecha de build:** $TIMESTAMP"
sed -i "/^> Instrucciones:/i\\$DATE_LINE" "$README"

echo "✅ README actualizado con el build más reciente."
# Builds a release APK on Windows and copies it into the project folder as Journal-<version>.apk.
# Requirements: Android Studio installed (SDK + bundled Java), Windows long paths enabled.
# The project path contains '&' and is long, so the build runs in a short copy at C:\pj.

# Native tools write warnings to stderr; check exit codes instead of failing on stderr.
$ErrorActionPreference = 'Continue'
$project = Split-Path -Parent $PSScriptRoot
$build = 'C:\pj'

$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:NODE_ENV = 'production'
$env:CI = '1'

Write-Host '1/5 Copying project to' $build
robocopy $project $build /MIR /XD node_modules android ios .git .expo scripts /XF *.apk /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE)" }

Push-Location $build
try {
  Write-Host '2/5 Installing dependencies'
  npm ci --no-audit --no-fund 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }

  Write-Host '3/5 Generating Android project'
  node node_modules/expo/bin/cli prebuild --platform android --clean --no-install 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'expo prebuild failed' }

  Write-Host '4/5 Patching native build for short paths'
  $gp = 'android\gradle.properties'
  (Get-Content $gp) -replace '^reactNativeArchitectures=.*', 'reactNativeArchitectures=arm64-v8a' | Set-Content -Encoding ascii $gp
  $bg = 'android\app\build.gradle'
  $c = Get-Content $bg -Raw
  $c = $c -replace '(?m)^android \{', "android {`n    externalNativeBuild {`n        cmake {`n            buildStagingDirectory `"C:/c`"`n        }`n    }"
  [IO.File]::WriteAllText((Resolve-Path $bg), $c)
  Set-Content -Encoding ascii 'android\local.properties' ('sdk.dir=' + $env:ANDROID_HOME.Replace('\', '\\'))

  Write-Host '5/5 Gradle assembleRelease (takes a while)'
  Push-Location android
  .\gradlew.bat assembleRelease --no-daemon
  if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed' }
  Pop-Location

  $version = (Get-Content "$build\app.json" -Raw | ConvertFrom-Json).expo.version
  $target = Join-Path $project "Journal-$version.apk"
  Copy-Item "$build\android\app\build\outputs\apk\release\app-release.apk" $target -Force
  Write-Host "Done: $target"
}
finally {
  Pop-Location
}
